/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| All business logic and every query behind /api/company. The controller is
| deliberately thin; this is where the rules live.
|
| The rules worth knowing before changing anything here:
|
|   * A company always has exactly one owner, and that owner is always an
|     active administrator. Several functions exist mainly to preserve that
|     invariant — it is what prevents a company nobody can administer.
|   * Only the owner may transfer ownership or grant administrator standing.
|     The route's admin gate is a coarse filter; these are the real checks,
|     because they need to read current state.
|   * Membership is the unit of removal. Users are never deleted here.
|
| Responsibilities:
|   - Validate and normalise company payloads, roles and statuses
|   - Read companies with their owner and member count
|   - Confirm membership before returning anything
|   - Update the company profile
|   - Change a member's role, remove a member, transfer ownership
|
| Exports:
|   getCompanyForUser, getCompanyMembers
|   updateCompany, transferCompanyOwnership
|   updateCompanyMemberRole, removeCompanyMember
|
| Used by:
|   ./company.controller.js — the only consumer
|
| Depends on:
|   database/pool.js
|   utils/requestContext.js  coercion and withTransaction
|   config/constants.js      COMPANY_ROLES, RECORD_STATUS
|   config/env.js            DEFAULT_CURRENCY, DEFAULT_TIMEZONE
|
| Database tables touched:
|   companies      SELECT, UPDATE
|   company_users  SELECT, UPDATE, DELETE
|   users          SELECT, joined for owner and member details
|
| Error style:
|   Throws errors carrying statusCode and publicMessage, which
|   errorHandler.js turns into a response. Nothing here writes to res.
|
| Security:
|   Every exported function takes companyId as an argument and the
|   controller always supplies it from the session. None of them derive it
|   from user input, and none should be called with a company id that came
|   from a request body.
|
*/

const pool = require("../../database/pool");

const {
  cleanText,
  cleanLowerText,
  emptyToNull,
  toPositiveInteger,
  withTransaction,
} = require("../../utils/requestContext");

const {
  COMPANY_ROLES,
  RECORD_STATUS,
} = require("../../config/constants");

const {
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
} = require("../../config/env");

const VALID_COMPANY_ROLES = new Set(
  Object.values(COMPANY_ROLES)
);

const VALID_COMPANY_STATUSES = new Set([
  RECORD_STATUS.ACTIVE,
  RECORD_STATUS.INACTIVE,
]);

/*
 * The shared projection for reading a company.
 *
 * Kept as one constant because four call sites need the identical shape,
 * and a company returned by one path must not have different fields from
 * the same company returned by another — the frontend renders them with
 * the same components.
 *
 * Note what it deliberately includes:
 *
 *   owner_name / owner_email  joined from users, so the Settings screen can
 *                             show who owns the company without a second
 *                             request.
 *   member_count              a correlated subquery rather than a JOIN with
 *                             GROUP BY, which would otherwise multiply the
 *                             company row by its members and force a
 *                             grouping over every selected column.
 *
 * The LEFT JOIN on the owner is deliberate too: owner_user_id is nullable
 * in principle, and an INNER JOIN would make such a company invisible
 * rather than merely ownerless.
 *
 * No WHERE clause — each caller appends its own, which is what allows the
 * company_id filter to be added at the point where the scope is known.
 */
const COMPANY_SELECT = `
  SELECT
    c.id,
    c.company_name,
    c.owner_user_id,
    c.logo_url,
    c.logo_storage_path,
    c.email,
    c.phone,
    c.address,
    c.gst_number,
    c.currency_code,
    c.timezone,
    c.status,
    c.industry,
    c.website,
    c.abn,
    c.created_at,
    c.updated_at,

    owner.full_name AS owner_name,
    owner.email AS owner_email,

    (
      SELECT COUNT(*)::INTEGER
      FROM public.company_users cu_count
      WHERE cu_count.company_id = c.id
    ) AS member_count

  FROM public.companies c

  LEFT JOIN public.users owner
    ON owner.id = c.owner_user_id
`;

/**
 * Normalises a company membership role.
 *
 * Purpose:
 * company_users.role is a plain VARCHAR, so nothing at the database level
 * stops a typo being stored. This is the gate.
 *
 * Parameters:
 * role     - the requested role, any casing
 * fallback - used when the role is blank; MANAGER here
 *
 * Returns:
 * The lowercased, validated role.
 *
 * Throws:
 * 400 "Invalid company role." for anything unrecognised.
 *
 * Note:
 * The fallback is MANAGER, whereas the equivalent function in
 * auth.service.js falls back to WORKER. The difference is contextual —
 * this module deals with office membership, where a manager is the sensible
 * default — but it does mean the same omitted field produces different
 * roles depending on which endpoint was used. Worth knowing before relying
 * on either default.
 */
const normaliseCompanyRole = (
  role,
  fallback = COMPANY_ROLES.MANAGER
) => {
  const normalised =
    cleanLowerText(role) || fallback;

  if (
    !VALID_COMPANY_ROLES.has(
      normalised
    )
  ) {
    const error = new Error(
      "Invalid company role."
    );

    error.statusCode = 400;
    error.publicMessage =
      "Invalid company role.";

    throw error;
  }

  return normalised;
};

/**
 * Normalises a company status.
 *
 * Purpose:
 * Constrains companies.status to the two values the application
 * understands.
 *
 * Parameters:
 * status   - the requested status
 * fallback - ACTIVE when blank
 *
 * Returns:
 * "active" or "inactive".
 *
 * Throws:
 * 400 "Invalid company status." for anything else.
 *
 * Notes:
 * VALID_COMPANY_STATUSES is a deliberately narrow subset of RECORD_STATUS,
 * which carries more values used elsewhere in the schema. A company is
 * either trading or it is not; the intermediate states that suit a payment
 * or an approval have no meaning here.
 */
const normaliseCompanyStatus = (
  status,
  fallback = RECORD_STATUS.ACTIVE
) => {
  const normalised =
    cleanLowerText(status) || fallback;

  if (
    !VALID_COMPANY_STATUSES.has(
      normalised
    )
  ) {
    const error = new Error(
      "Invalid company status."
    );

    error.statusCode = 400;
    error.publicMessage =
      "Invalid company status.";

    throw error;
  }

  return normalised;
};

/**
 * Produces a validated company payload.
 *
 * Purpose:
 * Turns a partial update from the client into the complete, validated row
 * the UPDATE below writes. This is the writable-column allow-list the
 * controller relies on — it names every field that may be changed, so a key
 * the client invents (id, owner_user_id, created_at) is simply not carried
 * across.
 *
 * Parameters:
 * payload         - req.body, as sent
 * existingCompany - the stored row, supplying the fallback for every
 *                   omitted field
 *
 * Returns:
 * A flat object with one property per writable column, all validated and
 * coerced. Never partial — every key is always present.
 *
 * Throws:
 * 400 for a missing company name, an invalid status, or an invalid role
 * further down the call chain.
 *
 * Business rules:
 * - The company name is the one required field, and it cannot be cleared.
 * - Every other field may be set to null by sending an empty value; that is
 *   what emptyToNull is doing on each of them.
 * - currency_code is upper-cased, so "aud" and "AUD" cannot become two
 *   different stored values.
 * - Absent currency or timezone fall back to the environment defaults
 *   rather than to null, since both must always have a usable value.
 *
 * Security:
 * The allow-list shape is the protection. owner_user_id is conspicuously
 * absent — ownership can only move through transferCompanyOwnership, with
 * its owner-only check, and not by including the field in a profile update.
 *
 * Notes:
 * The repeated `payload.x !== undefined ? payload.x : existing.x` is
 * checking for *presence*, not truthiness. That distinction is what allows
 * a field to be deliberately cleared: sending "" means "make it null",
 * whereas omitting the key means "leave it alone". A `||` here would
 * conflate the two and make clearing a field impossible.
 */
const normaliseCompanyPayload = (
  payload = {},
  existingCompany = {}
) => {
  const companyName =
    cleanText(payload.company_name) ||
    cleanText(existingCompany.company_name);

  if (!companyName) {
    const error = new Error(
      "Company name is required."
    );

    error.statusCode = 400;
    error.publicMessage =
      "Company name is required.";

    throw error;
  }

  const emailValue =
    payload.email !== undefined
      ? cleanLowerText(payload.email)
      : cleanLowerText(existingCompany.email);

  const currencyCode =
    cleanText(
      payload.currency_code !== undefined
        ? payload.currency_code
        : existingCompany.currency_code
    ).toUpperCase() || DEFAULT_CURRENCY;

  const timezone =
    cleanText(
      payload.timezone !== undefined
        ? payload.timezone
        : existingCompany.timezone
    ) || DEFAULT_TIMEZONE;

  const status =
    normaliseCompanyStatus(
      payload.status !== undefined
        ? payload.status
        : existingCompany.status
    );

  return {
    company_name: companyName,
    email: emailValue || null,

    phone: emptyToNull(
      payload.phone !== undefined
        ? payload.phone
        : existingCompany.phone
    ),

    address: emptyToNull(
      payload.address !== undefined
        ? payload.address
        : existingCompany.address
    ),

    gst_number: emptyToNull(
      payload.gst_number !== undefined
        ? payload.gst_number
        : existingCompany.gst_number
    ),

    currency_code: currencyCode,
    timezone,
    status,

    industry: emptyToNull(
      payload.industry !== undefined
        ? payload.industry
        : existingCompany.industry
    ),

    website: emptyToNull(
      payload.website !== undefined
        ? payload.website
        : existingCompany.website
    ),

    abn: emptyToNull(
      payload.abn !== undefined
        ? payload.abn
        : existingCompany.abn
    ),

    logo_url: emptyToNull(
      payload.logo_url !== undefined
        ? payload.logo_url
        : existingCompany.logo_url
    ),

    logo_storage_path: emptyToNull(
      payload.logo_storage_path !== undefined
        ? payload.logo_storage_path
        : existingCompany.logo_storage_path
    ),
  };
};

/**
 * Retrieves one company without membership validation.
 *
 * Internal service use only.
 *
 * Purpose:
 * A raw read, used by the functions in this file that have already
 * established the caller's right to see the row.
 *
 * Parameters:
 * companyId - the company
 * options   - { client, includeInactive }
 *
 * Returns:
 * The company row, or null.
 *
 * Side effects:
 * One SELECT.
 *
 * Security:
 * NOT exported, and the "internal use only" note above is the reason. This
 * function performs no membership check, so calling it with an id from a
 * request would read any tenant's company record. getCompanyForUser is the
 * membership-checked wrapper and is what callers outside this file get.
 */
const getCompanyById = async (
  companyId,
  {
    client = pool,
    includeInactive = true,
  } = {}
) => {
  const parsedCompanyId =
    toPositiveInteger(companyId);

  if (!parsedCompanyId) {
    return null;
  }

  const statusFilter = includeInactive
    ? ""
    : `
      AND LOWER(
        COALESCE(c.status, 'active')
      ) = 'active'
    `;

  const result = await client.query(
    `
    ${COMPANY_SELECT}

    WHERE c.id = $1
      ${statusFilter}

    LIMIT 1
    `,
    [parsedCompanyId]
  );

  return result.rows[0] || null;
};

/**
 * Confirms that a user belongs to a company.
 *
 * Purpose:
 * The workhorse authorisation check for this module. Nearly every function
 * below starts by calling it, because "is this person actually in this
 * company, and what standing do they have" is the question that gates
 * everything else.
 *
 * Parameters (one options object):
 * companyId - the company
 * userId    - the user whose membership is in question
 * client    - pool or transaction client
 *
 * Returns:
 * The membership row joined with the user and the company, including a
 * computed is_company_owner. Null when there is no membership, or when
 * either id is not a positive integer.
 *
 * Side effects:
 * One SELECT.
 *
 * Security:
 * Returning null rather than throwing lets each caller decide whether the
 * absence means 403 or 404 — a distinction that matters, since answering
 * 403 for a company the caller is not in would confirm it exists.
 *
 * is_company_owner is computed from companies.owner_user_id rather than
 * inferred from the role, because owner is a distinct standing from admin.
 * Several rules below turn on exactly that difference.
 *
 * Notes:
 * INNER JOINs throughout, so a membership pointing at a deleted user or a
 * missing company yields nothing — a broken link reads as "not a member",
 * which is the safe interpretation.
 */
const getCompanyMembership = async ({
  companyId,
  userId,
  client = pool,
}) => {
  const parsedCompanyId =
    toPositiveInteger(companyId);

  const parsedUserId =
    toPositiveInteger(userId);

  if (
    !parsedCompanyId ||
    !parsedUserId
  ) {
    return null;
  }

  const result = await client.query(
    `
    SELECT
      cu.id,
      cu.company_id,
      cu.user_id,
      cu.role,
      cu.created_at,

      u.full_name,
      u.email,
      u.role AS user_role,
      u.status AS user_status,

      c.company_name,
      c.owner_user_id,

      CASE
        WHEN c.owner_user_id = cu.user_id
          THEN TRUE
        ELSE FALSE
      END AS is_company_owner

    FROM public.company_users cu

    INNER JOIN public.users u
      ON u.id = cu.user_id

    INNER JOIN public.companies c
      ON c.id = cu.company_id

    WHERE cu.company_id = $1
      AND cu.user_id = $2

    LIMIT 1
    `,
    [
      parsedCompanyId,
      parsedUserId,
    ]
  );

  return result.rows[0] || null;
};

/**
 * Retrieves a company only when the user is a member.
 *
 * Purpose:
 * The membership-checked wrapper around getCompanyById, and the version
 * that leaves this file. Two steps: prove membership, then read.
 *
 * Parameters (one options object):
 * companyId - the company being read
 * userId    - the caller
 * client    - pool or transaction client
 *
 * Returns:
 * The company row, or null when the user is not a member.
 *
 * Side effects:
 * Two SELECTs — the membership check, then the company read.
 *
 * Security:
 * The reason getCompanyById is not exported. Even though the controller
 * takes companyId from the session and could not currently pass someone
 * else's, the check is performed anyway rather than assumed. Defence in
 * depth: if a future caller ever obtained the id from a request, this
 * function still refuses.
 *
 * Performance:
 * Two round trips where a single joined query would do. The cost is one
 * extra lookup on a screen load, and what is bought is that the
 * authorisation check is impossible to remove by editing a projection.
 *
 * Notes:
 * includeInactive is true, so a suspended company still loads for its
 * members. Hiding it would leave them with a broken application and no
 * explanation.
 */
const getCompanyForUser = async ({
  companyId,
  userId,
  client = pool,
}) => {
  const membership =
    await getCompanyMembership({
      companyId,
      userId,
      client,
    });

  if (!membership) {
    return null;
  }

  return getCompanyById(
    companyId,
    {
      client,
      includeInactive: true,
    }
  );
};

/**
 * Lists company members.
 *
 * Purpose:
 * The team roster for the Users and Settings screens.
 *
 * Parameters (one options object):
 * companyId       - the company
 * client          - pool or transaction client
 * includeInactive - defaults to true; see below
 *
 * Returns:
 * An array of member rows, each combining the membership, the user and a
 * computed is_company_owner. An empty array for an invalid company id —
 * never null, so callers can map over the result unguarded.
 *
 * Side effects:
 * One SELECT.
 *
 * Business rule:
 * Inactive members are included by default, because an administrator
 * needs to see a disabled account in order to re-enable it. The
 * COALESCE in the filter treats a null status as active, covering rows
 * written before the column had a default.
 *
 * Security:
 * Driven from company_users and filtered on company_id, so the query cannot
 * reach another tenant's staff. The projection names its columns and
 * excludes password_hash, reset_token and token_version.
 *
 * Performance:
 * Unpaginated. Fine for a company's staff list, which is tens of rows; it
 * would need revisiting for an organisation with thousands.
 */
const getCompanyMembers = async ({
  companyId,
  client = pool,
  includeInactive = true,
}) => {
  const parsedCompanyId =
    toPositiveInteger(companyId);

  if (!parsedCompanyId) {
    return [];
  }

  const statusFilter =
    includeInactive
      ? ""
      : `
        AND LOWER(
          COALESCE(u.status, 'active')
        ) = 'active'
      `;

  const result = await client.query(
    `
    SELECT
      cu.id AS membership_id,
      cu.company_id,
      cu.user_id,
      cu.role AS company_role,
      cu.created_at AS joined_at,

      u.full_name,
      u.email,
      u.role AS user_role,
      u.status AS user_status,
      u.last_login_at,
      u.created_at AS user_created_at,
      u.updated_at AS user_updated_at,

      CASE
        WHEN c.owner_user_id = u.id
          THEN TRUE
        ELSE FALSE
      END AS is_company_owner

    FROM public.company_users cu

    INNER JOIN public.users u
      ON u.id = cu.user_id

    INNER JOIN public.companies c
      ON c.id = cu.company_id

    WHERE cu.company_id = $1
      ${statusFilter}

    ORDER BY
      CASE
        WHEN c.owner_user_id = u.id
          THEN 0
        ELSE 1
      END,
      u.full_name ASC,
      u.id ASC
    `,
    [parsedCompanyId]
  );

  return result.rows;
};

/**
 * Updates company profile and configuration.
 *
 * Purpose:
 * Applies a partial profile update, after establishing that the caller is
 * entitled to make one.
 *
 * Parameters (one options object):
 * companyId - from the session
 * userId    - the caller, for the membership and permission checks
 * updates   - req.body, filtered by normaliseCompanyPayload
 *
 * Returns:
 * The updated company row.
 *
 * Throws:
 * 404 when the caller is not a member — deliberately not 403, so the
 *     response cannot confirm the company exists.
 * 403 when they are a member but neither owner nor admin.
 * 400 from payload validation.
 *
 * Side effects:
 * One UPDATE on companies, inside a transaction.
 *
 * Business rules:
 * - Owner OR company-admin may update. Ownership alone is sufficient even
 *   if the role were somehow not admin, which keeps an owner from being
 *   locked out of their own settings.
 * - Every writable column is written on every call. The partial-update
 *   behaviour comes from normaliseCompanyPayload filling omitted fields
 *   from the existing row, not from a dynamic SET clause.
 *
 * Security:
 * The role is re-checked here even though roleMiddleware already required
 * admin at the route. That gate reads users.role or company_users.role for
 * *any* company; this confirms the standing is held in THIS company. An
 * admin of one tenant is not an admin of another.
 *
 * Note the permission check reads `membership.role` — the company role —
 * rather than the account role, which is the correct source for a
 * company-scoped decision.
 *
 * Notes:
 * Wrapped in a transaction although only one statement writes. The read,
 * the permission check and the write then see a consistent snapshot, so a
 * membership revoked concurrently cannot slip between the check and the
 * update.
 */
const updateCompany = async ({
  companyId,
  userId,
  updates,
}) =>
  withTransaction(
    async (client) => {
      const company =
        await getCompanyForUser({
          companyId,
          userId,
          client,
        });

      if (!company) {
        const error = new Error(
          "Company not found."
        );

        error.statusCode = 404;
        error.publicMessage =
          "Company not found.";

        throw error;
      }

      const membership =
        await getCompanyMembership({
          companyId,
          userId,
          client,
        });

      const companyRole =
        cleanLowerText(
          membership?.role
        );

      const canUpdate =
        membership?.is_company_owner ||
        companyRole ===
          COMPANY_ROLES.ADMIN;

      if (!canUpdate) {
        const error = new Error(
          "Only company administrators can update company settings."
        );

        error.statusCode = 403;
        error.publicMessage =
          "Only company administrators can update company settings.";

        throw error;
      }

      const payload =
        normaliseCompanyPayload(
          updates,
          company
        );

      const result =
        await client.query(
          `
          UPDATE public.companies
          SET
            company_name = $1,
            email = $2,
            phone = $3,
            address = $4,
            gst_number = $5,
            currency_code = $6,
            timezone = $7,
            status = $8,
            industry = $9,
            website = $10,
            abn = $11,
            logo_url = $12,
            logo_storage_path = $13,
            updated_at = NOW()
          WHERE id = $14
          RETURNING *
          `,
          [
            payload.company_name,
            payload.email,
            payload.phone,
            payload.address,
            payload.gst_number,
            payload.currency_code,
            payload.timezone,
            payload.status,
            payload.industry,
            payload.website,
            payload.abn,
            payload.logo_url,
            payload.logo_storage_path,
            companyId,
          ]
        );

      return getCompanyById(
        result.rows[0].id,
        {
          client,
        }
      );
    }
  );

/**
 * Changes the company owner's user ID.
 *
 * Only the current owner may transfer ownership.
 *
 * Purpose:
 * Moves ownership of a company to another member, and makes sure the
 * recipient can actually exercise it.
 *
 * Parameters (one options object):
 * companyId          - from the session
 * currentOwnerUserId - the caller, from the session
 * nextOwnerUserId    - the nominee, from the body
 *
 * Returns:
 * The updated company row.
 *
 * Throws:
 * 400 invalid ids, nominating the current owner, a nominee who is not a
 *     member, or a nominee whose account is not active
 * 403 the caller is not the current owner
 * 404 no such company
 *
 * Side effects:
 * Updates companies.owner_user_id and raises the new owner's company role
 * to admin, in one transaction.
 *
 * Business rules, in the order they are checked:
 *   1. All three ids must be positive integers.
 *   2. The nominee must not already be the owner — a no-op transfer would
 *      otherwise report success.
 *   3. The company must exist, and is locked FOR UPDATE.
 *   4. The caller must BE the current owner. This is the real
 *      authorisation; the route's admin gate is not sufficient.
 *   5. The nominee must already be a member.
 *   6. The nominee's account must be active — handing a company to a
 *      disabled account would leave it with an owner who cannot log in,
 *      and the owner-protection rules elsewhere make that unrecoverable.
 *
 * Security:
 * Irreversible from the caller's side. Once ownership moves, the previous
 * owner is an ordinary admin and cannot take it back — only the new owner
 * can transfer again. That is the intended semantics, and the reason for
 * the six checks above.
 *
 * currentOwnerUserId is read from the session by the controller, so the
 * ownership comparison cannot be spoofed through the request body.
 *
 * Concurrency:
 * SELECT ... FOR UPDATE locks the company row for the transaction's
 * duration. Without it, two simultaneous transfers could both read the same
 * owner, both pass check 4, and both write — leaving the last writer's
 * nominee as owner while both callers were told they succeeded. The lock
 * serialises them, so the second sees the new owner and is refused.
 *
 * Note:
 * Not audited — see F-09 in findings.md. This is the operation where that
 * gap matters most.
 */
const transferCompanyOwnership = async ({
  companyId,
  currentOwnerUserId,
  nextOwnerUserId,
}) =>
  withTransaction(
    async (client) => {
      const parsedCompanyId =
        toPositiveInteger(companyId);

      const parsedCurrentOwnerId =
        toPositiveInteger(
          currentOwnerUserId
        );

      const parsedNextOwnerId =
        toPositiveInteger(
          nextOwnerUserId
        );

      if (
        !parsedCompanyId ||
        !parsedCurrentOwnerId ||
        !parsedNextOwnerId
      ) {
        const error = new Error(
          "Valid company and user IDs are required."
        );

        error.statusCode = 400;
        error.publicMessage =
          "Valid company and user IDs are required.";

        throw error;
      }

      if (
        parsedCurrentOwnerId ===
        parsedNextOwnerId
      ) {
        const error = new Error(
          "The selected user is already the company owner."
        );

        error.statusCode = 400;
        error.publicMessage =
          "The selected user is already the company owner.";

        throw error;
      }

      const companyResult =
        await client.query(
          `
          /*
           * FOR UPDATE locks this company row until the transaction ends.
           *
           * The ownership check below reads owner_user_id and then writes
           * it — a classic read-modify-write. Two concurrent transfers
           * without the lock could both read the same current owner, both
           * conclude the caller is entitled, and both write; each caller
           * would be told they succeeded while only one nominee ended up
           * as owner.
           *
           * With the lock the second transaction blocks until the first
           * commits, then reads the new owner and is correctly refused.
           */
          SELECT
            id,
            owner_user_id
          FROM public.companies
          WHERE id = $1
          FOR UPDATE
          `,
          [parsedCompanyId]
        );

      if (
        companyResult.rows.length === 0
      ) {
        const error = new Error(
          "Company not found."
        );

        error.statusCode = 404;
        error.publicMessage =
          "Company not found.";

        throw error;
      }

      if (
        Number(
          companyResult.rows[0]
            .owner_user_id
        ) !==
        parsedCurrentOwnerId
      ) {
        const error = new Error(
          "Only the current company owner can transfer ownership."
        );

        error.statusCode = 403;
        error.publicMessage =
          "Only the current company owner can transfer ownership.";

        throw error;
      }

      const nextOwnerMembership =
        await getCompanyMembership({
          companyId:
            parsedCompanyId,
          userId:
            parsedNextOwnerId,
          client,
        });

      if (!nextOwnerMembership) {
        const error = new Error(
          "The new owner must already be a member of the company."
        );

        error.statusCode = 400;
        error.publicMessage =
          "The new owner must already be a member of the company.";

        throw error;
      }

      if (
        cleanLowerText(
          nextOwnerMembership
            .user_status
        ) !==
        RECORD_STATUS.ACTIVE
      ) {
        const error = new Error(
          "The new company owner must have an active account."
        );

        error.statusCode = 400;
        error.publicMessage =
          "The new company owner must have an active account.";

        throw error;
      }

      await client.query(
        `
        UPDATE public.companies
        SET
          owner_user_id = $1,
          updated_at = NOW()
        WHERE id = $2
        `,
        [
          parsedNextOwnerId,
          parsedCompanyId,
        ]
      );

      /*
       * The new owner must always have administrator access.
       *
       * Unconditional rather than checked-then-set: the nominee may already
       * be an admin, in which case this is a harmless no-op write. Setting
       * it outright is simpler than branching, and it guarantees the
       * invariant regardless of what the role was before.
       *
       * Without this an owner could end up unable to administer their own
       * company, which the owner-protection rules elsewhere would then make
       * impossible to repair.
       */
      await client.query(
        `
        UPDATE public.company_users
        SET role = $1
        WHERE company_id = $2
          AND user_id = $3
        `,
        [
          COMPANY_ROLES.ADMIN,
          parsedCompanyId,
          parsedNextOwnerId,
        ]
      );

      /*
       * Keep the previous owner as an administrator.
       * They can be downgraded later by the new owner.
       *
       * Deliberately not a demotion. A transfer is usually a handover
       * between colleagues, not an ejection, and silently stripping the
       * outgoing owner's access would be a surprising side effect of an
       * operation described as "transfer ownership".
       *
       * The new owner can demote them afterwards through
       * updateCompanyMemberRole — which they can, and the former owner
       * cannot reverse, since ownership is what gates that.
       */
      await client.query(
        `
        UPDATE public.company_users
        SET role = $1
        WHERE company_id = $2
          AND user_id = $3
        `,
        [
          COMPANY_ROLES.ADMIN,
          parsedCompanyId,
          parsedCurrentOwnerId,
        ]
      );

      return getCompanyById(
        parsedCompanyId,
        {
          client,
        }
      );
    }
  );

/**
 * Changes a member's company-specific role.
 *
 * Purpose:
 * Adjusts what someone may do inside this company, without touching their
 * account or their global role.
 *
 * Parameters (one options object):
 * companyId    - from the session
 * actingUserId - the caller, from the session
 * memberUserId - the member being changed
 * role         - the new company role
 *
 * Returns:
 * The updated membership row.
 *
 * Throws:
 * 400 an invalid role, or demoting the owner
 * 403 the caller is not a member, or is neither owner nor admin
 * 404 the target is not a member of this company
 *
 * Side effects:
 * One UPDATE on company_users, inside a transaction.
 *
 * Business rules:
 * - The caller must be the owner or a company admin.
 * - The target must be a member of the same company.
 * - The owner cannot be demoted below admin, preserving the invariant that
 *   an owner is always able to administer.
 *
 * Security:
 * Both the caller's and the target's memberships are loaded from the
 * database rather than inferred from the token, so the check reflects
 * current state in THIS company. An admin of another tenant fails the first
 * check; a target in another tenant fails the second.
 *
 * Note the escalation consequence: because roleMiddleware runs with
 * `source: "either"`, raising someone's company_role to admin grants them
 * administrative access across the whole API even though their users.role
 * is unchanged. This endpoint is therefore as privilege-sensitive as
 * /api/auth/users/:userId, and is likewise not audited — F-09.
 */
const updateCompanyMemberRole = async ({
  companyId,
  actingUserId,
  memberUserId,
  role,
}) =>
  withTransaction(
    async (client) => {
      const parsedCompanyId =
        toPositiveInteger(companyId);

      const parsedActingUserId =
        toPositiveInteger(
          actingUserId
        );

      const parsedMemberUserId =
        toPositiveInteger(
          memberUserId
        );

      const nextRole =
        normaliseCompanyRole(role);

      const actingMembership =
        await getCompanyMembership({
          companyId:
            parsedCompanyId,
          userId:
            parsedActingUserId,
          client,
        });

      if (!actingMembership) {
        const error = new Error(
          "Company membership not found."
        );

        error.statusCode = 403;
        error.publicMessage =
          "You do not have access to this company.";

        throw error;
      }

      const actingRole =
        cleanLowerText(
          actingMembership.role
        );

      if (
        !actingMembership.is_company_owner &&
        actingRole !==
          COMPANY_ROLES.ADMIN
      ) {
        const error = new Error(
          "Only company administrators can change member roles."
        );

        error.statusCode = 403;
        error.publicMessage =
          "Only company administrators can change member roles.";

        throw error;
      }

      const memberMembership =
        await getCompanyMembership({
          companyId:
            parsedCompanyId,
          userId:
            parsedMemberUserId,
          client,
        });

      if (!memberMembership) {
        const error = new Error(
          "Company member not found."
        );

        error.statusCode = 404;
        error.publicMessage =
          "Company member not found.";

        throw error;
      }

      if (
        memberMembership.is_company_owner &&
        nextRole !==
          COMPANY_ROLES.ADMIN
      ) {
        const error = new Error(
          "The company owner must remain an administrator."
        );

        error.statusCode = 400;
        error.publicMessage =
          "The company owner must remain an administrator.";

        throw error;
      }

      /*
       * Only the company owner may grant administrator access.
       */
      if (
        nextRole ===
          COMPANY_ROLES.ADMIN &&
        !actingMembership.is_company_owner
      ) {
        const error = new Error(
          "Only the company owner can grant administrator access."
        );

        error.statusCode = 403;
        error.publicMessage =
          "Only the company owner can grant administrator access.";

        throw error;
      }

      const result =
        await client.query(
          `
          UPDATE public.company_users
          SET role = $1
          WHERE company_id = $2
            AND user_id = $3
          RETURNING *
          `,
          [
            nextRole,
            parsedCompanyId,
            parsedMemberUserId,
          ]
        );

      return result.rows[0];
    }
  );

/**
 * Removes a user from the company.
 *
 * The owner cannot be removed.
 * The base user account is not deleted.
 *
 * Purpose:
 * Detaches someone from the company. Used when a worker leaves or a
 * subcontractor's engagement ends.
 *
 * Parameters (one options object):
 * companyId    - from the session
 * actingUserId - the caller, from the session
 * memberUserId - the member being removed
 *
 * Returns:
 * The deleted membership row.
 *
 * Throws:
 * 400 removing yourself, or removing the owner
 * 403 the caller is not a member, or is neither owner nor admin
 * 404 the target is not a member
 *
 * Side effects:
 * Deletes one company_users row, inside a transaction.
 *
 * Business rules, in order:
 *   1. You cannot remove yourself. A sole administrator doing so would
 *      leave the company unmanageable, and there is no undo.
 *   2. The caller must be owner or admin.
 *   3. The target must be a member.
 *   4. The owner cannot be removed — the error says so plainly, and points
 *      at the transfer endpoint as the way through.
 *
 * Security:
 * The users row is untouched. That is deliberate and load-bearing: users
 * are referenced as created_by, approved_by and requested_by across the
 * schema, so deleting one would orphan records that name them. What the
 * person loses is their tenant — getCompanyId then returns null and every
 * subsequent request fails requireCompanyId.
 *
 * Note the consequence: the account still exists and can still
 * authenticate. Login itself refuses an account with no company, so this is
 * an effective revocation, but it is revocation by detachment rather than
 * by disabling. To stop the account outright as well, disable it through
 * /api/auth/users/:userId/disable — which additionally bumps token_version
 * and so kills existing sessions immediately.
 *
 * Notes:
 * A hard DELETE, unusual in this schema. Consistent, though: company_users
 * is a link row nothing else references, so there is no history to keep.
 * Re-adding the person later creates a fresh membership with a new
 * joined-at date.
 *
 * Not audited — F-09.
 */
const removeCompanyMember = async ({
  companyId,
  actingUserId,
  memberUserId,
}) =>
  withTransaction(
    async (client) => {
      const parsedCompanyId =
        toPositiveInteger(companyId);

      const parsedActingUserId =
        toPositiveInteger(
          actingUserId
        );

      const parsedMemberUserId =
        toPositiveInteger(
          memberUserId
        );

      if (
        parsedActingUserId ===
        parsedMemberUserId
      ) {
        const error = new Error(
          "You cannot remove your own company membership."
        );

        error.statusCode = 400;
        error.publicMessage =
          "You cannot remove your own company membership.";

        throw error;
      }

      const actingMembership =
        await getCompanyMembership({
          companyId:
            parsedCompanyId,
          userId:
            parsedActingUserId,
          client,
        });

      if (
        !actingMembership ||
        (
          !actingMembership.is_company_owner &&
          cleanLowerText(
            actingMembership.role
          ) !==
            COMPANY_ROLES.ADMIN
        )
      ) {
        const error = new Error(
          "Only company administrators can remove members."
        );

        error.statusCode = 403;
        error.publicMessage =
          "Only company administrators can remove members.";

        throw error;
      }

      const memberMembership =
        await getCompanyMembership({
          companyId:
            parsedCompanyId,
          userId:
            parsedMemberUserId,
          client,
        });

      if (!memberMembership) {
        const error = new Error(
          "Company member not found."
        );

        error.statusCode = 404;
        error.publicMessage =
          "Company member not found.";

        throw error;
      }

      if (
        memberMembership.is_company_owner
      ) {
        const error = new Error(
          "Transfer company ownership before removing the owner."
        );

        error.statusCode = 400;
        error.publicMessage =
          "Transfer company ownership before removing the owner.";

        throw error;
      }

      const result =
        await client.query(
          `
          DELETE FROM public.company_users
          WHERE company_id = $1
            AND user_id = $2
          RETURNING *
          `,
          [
            parsedCompanyId,
            parsedMemberUserId,
          ]
        );

      return result.rows[0];
    }
  );

module.exports = {
  normaliseCompanyRole,
  normaliseCompanyStatus,
  normaliseCompanyPayload,

  getCompanyById,
  getCompanyMembership,
  getCompanyForUser,
  getCompanyMembers,

  updateCompany,
  transferCompanyOwnership,

  updateCompanyMemberRole,
  removeCompanyMember,
};