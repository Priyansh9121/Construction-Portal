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