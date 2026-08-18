/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The identity layer. Password hashing, token issuing, and every read or
| write that touches users, company_users or a company's identity fields
| lives here — not in the controller.
|
| The split is worth stating plainly, because it is what keeps this module
| trustworthy: the controller deals in HTTP (status codes, request bodies,
| response shapes) and this file deals in identity. Nothing here reads
| `req` or writes `res`. It throws errors carrying a statusCode and a
| publicMessage, and lets the controller or errorHandler turn those into a
| response.
|
| Responsibilities:
|   - Normalise and validate emails, roles and passwords
|   - Hash and verify passwords (bcrypt, cost 12)
|   - Issue signed access tokens
|   - Load the combined user + membership + company context
|   - Create users, memberships, and whole companies, transactionally
|   - Strip a user record down to what is safe to return
|
| Exports:
|   normaliseEmail, normaliseUserRole, normaliseCompanyRole
|   validatePassword, hashPassword, verifyPassword
|   createAccessToken
|   getUserContextByEmail, getUserContextById
|   emailExists
|   createBaseUser, createCompanyMembership
|   registerCompanyOwner, createCompanyUser
|   serialiseUserContext
|
| Used by:
|   ./auth.controller.js         every handler
|   middleware/authMiddleware.js re-reads the user context per request
|   modules/companies/company.controller.js  when inviting a user
|
| Depends on:
|   bcryptjs, jsonwebtoken
|   database/pool.js
|   config/env.js        JWT_SECRET, JWT_EXPIRES_IN, and the company defaults
|   config/constants.js  the role and status vocabularies
|   utils/requestContext.js  coercion and withTransaction
|
| Database tables touched:
|   users          SELECT, INSERT, UPDATE
|   company_users  SELECT, INSERT
|   companies      SELECT, INSERT
|
| Security:
|   - bcrypt cost 12 everywhere. The break-glass script matches it
|     deliberately; if one is ever raised, raise both.
|   - password_hash is only selected when a caller explicitly passes
|     includePassword. Every other read leaves it out of the row entirely,
|     so it cannot be leaked by a response that forgets to strip it.
|   - Tokens carry a `tv` generation counter checked against
|     users.token_version, which is what makes existing sessions
|     revocable — see createAccessToken.
|   - A user is never created without a company membership; see
|     createBaseUser.
|
| Note on error style:
|   Errors thrown here set `statusCode` and `publicMessage`. errorHandler.js
|   uses publicMessage to decide the wording is safe to show a user, rather
|   than falling back to a generic message.
|
*/

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const pool = require("../../database/pool");

const {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
} = require("../../config/env");

const {
  USER_ROLES,
  COMPANY_ROLES,
  RECORD_STATUS,
} = require("../../config/constants");

const {
  cleanText,
  cleanLowerText,
  toPositiveInteger,
  withTransaction,
} = require("../../utils/requestContext");

/*
 * The link between a login and the register row that gives it meaning.
 * A 'worker' or 'subcontractor' users row without one can authenticate and
 * then reach nothing — see profileLink.service.js for the full reasoning.
 */
const {
  resolveProfilePlan,
  applyProfilePlan,
} = require("./profileLink.service");

/*
 * The role vocabularies as Sets, built once from config/constants.js.
 *
 * Derived rather than retyped, so adding a role to the constants file
 * automatically makes it acceptable here — there is no second list to
 * forget to update.
 *
 * A Set rather than an array because these are membership tests on a path
 * that runs for every user creation and role change.
 */
const ALLOWED_USER_ROLES = new Set(
  Object.values(USER_ROLES)
);

const ALLOWED_COMPANY_ROLES = new Set(
  Object.values(COMPANY_ROLES)
);

const ACTIVE_STATUS =
  RECORD_STATUS.ACTIVE;

/**
 * Normalises an email address before database operations.
 *
 * Purpose:
 * Email is the login identifier and the uniqueness key, so its stored form
 * has to be canonical. Without this, "Alice@Example.com" and
 * "alice@example.com" would be two accounts, and whichever was typed at
 * login would decide which one you got.
 *
 * Parameters:
 * email - the raw input
 *
 * Returns:
 * A trimmed, lowercased string; "" for anything that was not a string.
 *
 * Notes:
 * Every query in this file also wraps the column in LOWER(), so a row
 * written before this normalisation existed still matches.
 */
const normaliseEmail = (email) =>
  cleanLowerText(email);

/**
 * Validates a supported account role.
 *
 * Purpose:
 * users.role is a plain VARCHAR, not a PostgreSQL enum, so the database
 * will accept any string at all. This function is the only thing standing
 * between a request body and a nonsense role being persisted.
 *
 * Parameters:
 * role     - the requested role, in any casing
 * fallback - what an absent role becomes; defaults to worker
 *
 * Returns:
 * The lowercased, validated role.
 *
 * Throws:
 * A 400 with publicMessage "Invalid user role." for anything unrecognised.
 *
 * Security:
 * The failure mode matters more than the success one. Silently defaulting
 * an unknown role to worker would be tempting, but it would also mean a
 * typo in the frontend quietly downgrades someone. Worse, an unvalidated
 * role written to the database and later compared by roleMiddleware could
 * produce an account matching no gate at all — or, with the wrong
 * comparison, every one.
 *
 * Defaulting to the LEAST privileged role is deliberate: an omitted role
 * can never accidentally grant access.
 */
const normaliseUserRole = (
  role,
  fallback = USER_ROLES.WORKER
) => {
  const normalised =
    cleanLowerText(role) ||
    fallback;

  if (
    !ALLOWED_USER_ROLES.has(
      normalised
    )
  ) {
    const error = new Error(
      "Invalid user role."
    );

    error.statusCode = 400;
    error.publicMessage =
      "Invalid user role.";

    throw error;
  }

  return normalised;
};

/**
 * Validates a supported company-membership role.
 *
 * Purpose:
 * The same guarantee as normaliseUserRole, for company_users.role — the
 * role a person holds *within one company*, as opposed to their global
 * account role.
 *
 * Parameters:
 * role     - the requested membership role
 * fallback - defaults to worker, again the least privileged
 *
 * Returns:
 * The lowercased, validated role.
 *
 * Throws:
 * A 400 with publicMessage "Invalid company role."
 *
 * Notes:
 * COMPANY_ROLES currently holds the same four values as USER_ROLES, so this
 * duplicates normaliseUserRole in practice. Kept separate on purpose: the
 * two are different concepts on different tables, and a future membership
 * model where they diverge should not require untangling one function that
 * quietly served both. roleMiddleware already accepts either source.
 */
const normaliseCompanyRole = (
  role,
  fallback = COMPANY_ROLES.WORKER
) => {
  const normalised =
    cleanLowerText(role) ||
    fallback;

  if (
    !ALLOWED_COMPANY_ROLES.has(
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
 * Validates password requirements in one location.
 *
 * Purpose:
 * Registration, admin user creation, password change and password reset all
 * set a password. One function means the four cannot drift apart and leave
 * one path accepting something the others reject.
 *
 * Parameters:
 * password - the candidate
 *
 * Returns:
 * The password unchanged, so it can be used inline as
 * `bcrypt.hash(validatePassword(p), 12)`.
 *
 * Throws:
 * A 400 when shorter than 8 characters or longer than 128.
 *
 * Business rules:
 * - Eight characters is the floor. Note that the break-glass script demands
 *   twelve; that account is more privileged and deliberately stricter.
 * - No composition rules — no forced symbol or digit. A length minimum with
 *   no character classes is current guidance: composition rules push people
 *   towards predictable substitutions without adding real entropy.
 *
 * Security:
 * The 128-character ceiling is not arbitrary. bcrypt only considers the
 * first 72 bytes of input, so anything beyond that is silently ignored —
 * and accepting a megabyte-long password would let an unauthenticated
 * caller make the server hash it. The cap bounds the work per attempt.
 *
 * The error message states the requirement rather than what was wrong with
 * the input, so it never echoes any part of the password back.
 */
const validatePassword = (
  password
) => {
  if (
    typeof password !==
      "string" ||
    password.length < 8
  ) {
    const error = new Error(
      "Password must contain at least 8 characters."
    );

    error.statusCode = 400;
    error.publicMessage =
      "Password must contain at least 8 characters.";

    throw error;
  }

  if (
    password.length > 128
  ) {
    const error = new Error(
      "Password is too long."
    );

    error.statusCode = 400;
    error.publicMessage =
      "Password must contain no more than 128 characters.";

    throw error;
  }

  return password;
};

/**
 * Generates a bcrypt password hash.
 *
 * Purpose:
 * The only place a password becomes a hash. Validation is folded in, so
 * there is no way to hash a password without it having been checked first.
 *
 * Parameters:
 * password - plaintext
 *
 * Returns:
 * A promise of the bcrypt hash string, which embeds the algorithm, the cost
 * and the salt alongside the digest.
 *
 * Throws:
 * Whatever validatePassword throws.
 *
 * Security:
 * Cost 12 means 2^12 key-expansion rounds. bcrypt generates a fresh random
 * salt per call, so two users with the same password get different hashes
 * and one cracked hash reveals nothing about the other.
 *
 * Performance:
 * Deliberately slow — a few hundred milliseconds of CPU, and it blocks
 * nothing else only because bcryptjs yields. That cost is the security
 * property, not a regression. It is also why authLimiter guards the
 * endpoints that reach this.
 */
const hashPassword = async (
  password
) => {
  validatePassword(password);

  return bcrypt.hash(
    password,
    12
  );
};

/**
 * Compares a submitted password with its stored hash.
 *
 * Purpose:
 * Used by login and by change-password's current-password check.
 *
 * Parameters:
 * password     - the plaintext submitted
 * passwordHash - the stored bcrypt hash
 *
 * Returns:
 * A promise of true or false. Returns false rather than throwing when
 * either input is missing.
 *
 * Security:
 * bcrypt.compare is constant-time with respect to the hash, so it does not
 * leak how much of the password matched through timing.
 *
 * The guard returning false for a missing hash matters: a user created
 * through the invite flow has no password yet, and `bcrypt.compare(p,
 * undefined)` would throw. Returning false turns that into a clean failed
 * login instead of a 500 — and, importantly, it means a passwordless
 * account cannot be signed into by sending no password.
 */
const verifyPassword = async (
  password,
  passwordHash
) => {
  if (
    typeof password !==
      "string" ||
    !passwordHash
  ) {
    return false;
  }

  return bcrypt.compare(
    password,
    passwordHash
  );
};

/**
 * Creates a signed access token.
 *
 * Company and role details are also refreshed by authMiddleware
 * on every protected request, so the token is not the final
 * access-control authority.
 *
 * Purpose:
 * Turns a user context into the bearer token the frontend holds for the
 * rest of the session.
 *
 * Parameters:
 * user - a user context row; needs at least id, and normally email, role,
 *        company_id and token_version
 *
 * Returns:
 * A signed JWT string.
 *
 * Throws:
 * When there is no valid user id. A token without a subject would
 * authenticate nobody in particular, which is far worse than a failed
 * login.
 *
 * Claims:
 *   id          the user
 *   email       normalised, for logging and display
 *   role        validated on the way in
 *   company_id  may be null for a user with no membership yet
 *   tv          token generation; see the inline note
 *
 * Security:
 * Signed with JWT_SECRET (HS256 by default) and given a finite lifetime
 * from JWT_EXPIRES_IN. The payload is signed, not encrypted — anyone
 * holding the token can read these claims, so nothing secret goes in it.
 *
 * The claims are a cache, not the authority. authMiddleware re-reads the
 * user on every request, so a role change or a disabled account takes
 * effect immediately rather than at expiry.
 *
 * Note:
 * config/env.js declares JWT_REFRESH_EXPIRES_IN, but there is no refresh
 * flow — this single access token is the whole session. Recorded as F-02
 * in docs/repository-reference/findings.md.
 */
const createAccessToken = (
  user
) => {
  const userId =
    toPositiveInteger(user?.id);

  const companyId =
    toPositiveInteger(
      user?.company_id
    );

  if (!userId) {
    throw new Error(
      "Cannot create a token without a valid user ID."
    );
  }

  return jwt.sign(
    {
      id: userId,
      email:
        normaliseEmail(
          user.email
        ),
      role:
        normaliseUserRole(
          user.role
        ),
      company_id:
        companyId,

      /*
       * Token generation.
       *
       * authMiddleware compares this against users.token_version and
       * rejects the token when they differ. Bumping the column therefore
       * invalidates every token already issued to that user.
       *
       * Without it, changing a password or deactivating an account left
       * existing sessions working for the remainder of the 7-day expiry.
       */
      tv: Number(
        user?.token_version || 0
      ),
    },
    JWT_SECRET,
    {
      expiresIn:
        JWT_EXPIRES_IN,
    }
  );
};

/**
 * Returns the complete user and company context required by
 * login and authentication middleware.
 *
 * Purpose:
 * Login's entry point. One query assembles everything the rest of the
 * request needs — the account, its company membership, and that company's
 * display settings — so authentication does not cost three round trips.
 *
 * Parameters:
 * email   - the address being signed in with; normalised internally
 * options - { client, includePassword }
 *             client          pool or transaction client
 *             includePassword adds password_hash to the projection. Only
 *                             login and change-password pass true.
 *
 * Returns:
 * The combined row, or null when no such user exists.
 *
 * Side effects:
 * One SELECT.
 *
 * Security:
 * password_hash is omitted from the projection unless explicitly requested,
 * so a caller cannot leak it by accident — the field is simply absent from
 * the object rather than present and needing to be deleted.
 *
 * `includePassword` is a boolean chosen by the caller, never derived from
 * request input, so the interpolation into the SQL string is safe.
 *
 * Notes:
 * LEFT JOINs throughout, so a user with no company membership is still
 * returned with null company fields. That state is real — it exists between
 * user creation and membership creation — and returning null instead would
 * make it indistinguishable from "no such user".
 *
 * The ORDER BY resolves which membership wins if a user somehow belongs to
 * several: ownership first, then the oldest. See the inline note.
 */
const getUserContextByEmail =
  async (
    email,
    {
      client = pool,
      includePassword = false,
    } = {}
  ) => {
    const normalisedEmail =
      normaliseEmail(email);

    if (!normalisedEmail) {
      return null;
    }

    const passwordSelection =
      includePassword
        ? "u.password_hash,"
        : "";

    const result =
      await client.query(
        `
        SELECT
          u.id,
          u.full_name,
          u.email,
          ${passwordSelection}
          u.role,
          u.status,
          u.token_version,
          u.created_at,
          u.updated_at,
          u.last_login_at,

          cu.id AS company_user_id,
          cu.company_id,
          cu.role AS company_role,
          cu.created_at
            AS company_joined_at,

          c.company_name,
          c.owner_user_id,
          c.currency_code,
          c.timezone,
          c.industry

        FROM public.users u

        LEFT JOIN public.company_users cu
          ON cu.user_id = u.id

        LEFT JOIN public.companies c
          ON c.id = cu.company_id

        WHERE LOWER(u.email) =
          LOWER($1)

        /*
         * A user belongs to one company today, but company_users does not
         * structurally prevent several. LIMIT 1 without an ORDER BY would
         * then pick an arbitrary row, and the same login could land in a
         * different company between requests.
         *
         * The tie-break is deterministic and sensible: a company the user
         * owns wins, otherwise the earliest membership. Stable across calls,
         * which is what matters.
         */
        ORDER BY
          CASE
            WHEN c.owner_user_id = u.id
              THEN 0
            ELSE 1
          END,
          cu.id ASC

        LIMIT 1
        `,
        [normalisedEmail]
      );

    return (
      result.rows[0] ||
      null
    );
  };

/**
 * Returns complete user/company context by user ID.
 *
 * Purpose:
 * The same projection as getUserContextByEmail, keyed by id instead. This
 * is the hot one: authMiddleware calls it on every authenticated request to
 * refresh the caller's role, status and company from the database rather
 * than trusting the token's claims.
 *
 * Parameters:
 * userId  - coerced through toPositiveInteger; anything invalid returns null
 * options - { client, includePassword }, as above
 *
 * Returns:
 * The combined row, or null.
 *
 * Side effects:
 * One SELECT.
 *
 * Security:
 * This is what makes token claims non-authoritative. Because the role and
 * status are re-read here, disabling an account or demoting a user takes
 * effect on their next request — not when their week-old token happens to
 * expire.
 *
 * Performance:
 * Runs on every authenticated request, so it is the most frequently
 * executed query in the application. It is a primary-key lookup with two
 * joins on indexed foreign keys, which keeps it cheap; anything added to
 * this projection is paid for on every request.
 *
 * Notes:
 * Duplicates getUserContextByEmail apart from the WHERE clause. Left as two
 * functions rather than one with a variable predicate, which would mean
 * building the WHERE from a parameter — exactly the kind of construction
 * this codebase avoids in an authentication path.
 */
const getUserContextById =
  async (
    userId,
    {
      client = pool,
      includePassword = false,
    } = {}
  ) => {
    const parsedUserId =
      toPositiveInteger(userId);

    if (!parsedUserId) {
      return null;
    }

    const passwordSelection =
      includePassword
        ? "u.password_hash,"
        : "";

    const result =
      await client.query(
        `
        SELECT
          u.id,
          u.full_name,
          u.email,
          ${passwordSelection}
          u.role,
          u.status,
          u.token_version,
          u.created_at,
          u.updated_at,
          u.last_login_at,

          cu.id AS company_user_id,
          cu.company_id,
          cu.role AS company_role,
          cu.created_at
            AS company_joined_at,

          c.company_name,
          c.owner_user_id,
          c.currency_code,
          c.timezone,
          c.industry

        FROM public.users u

        LEFT JOIN public.company_users cu
          ON cu.user_id = u.id

        LEFT JOIN public.companies c
          ON c.id = cu.company_id

        WHERE u.id = $1

        /*
         * A user belongs to one company today, but company_users does not
         * structurally prevent several. LIMIT 1 without an ORDER BY would
         * then pick an arbitrary row, and the same login could land in a
         * different company between requests.
         *
         * The tie-break is deterministic and sensible: a company the user
         * owns wins, otherwise the earliest membership. Stable across calls,
         * which is what matters.
         */
        ORDER BY
          CASE
            WHEN c.owner_user_id = u.id
              THEN 0
            ELSE 1
          END,
          cu.id ASC

        LIMIT 1
        `,
        [parsedUserId]
      );

    return (
      result.rows[0] ||
      null
    );
  };

/**
 * Checks whether an email is already registered.
 *
 * Purpose:
 * Lets registration and user-update return a clean 409 instead of letting
 * the unique index throw a constraint violation that surfaces as a 500.
 *
 * Parameters:
 * email   - the address to check; normalised internally
 * options - { client, excludeUserId }
 *             excludeUserId ignores one user, so updating a user without
 *             changing their email does not collide with themselves
 *
 * Returns:
 * A promise of boolean. False for a blank email, since there is nothing to
 * collide with.
 *
 * Side effects:
 * One SELECT ... LIMIT 1.
 *
 * Security:
 * Deliberately NOT exposed as an endpoint. Called only after a caller has
 * committed to creating or updating a user, because a bare
 * "is this email registered" check reachable from outside would be an
 * account-enumeration oracle — the same reason forgot-password answers
 * identically either way.
 *
 * Notes:
 * This check and the subsequent insert are not atomic, so two simultaneous
 * registrations of the same address could both pass it. The unique index on
 * LOWER(email) is the real guarantee; this only makes the common case a
 * good error message.
 *
 * `$2::INTEGER IS NULL OR id <> $2` is written that way because a plain
 * `id <> NULL` is NULL in SQL, not true, and would exclude every row. The
 * cast is needed because Postgres cannot infer a bare parameter's type
 * inside IS NULL.
 */
const emailExists = async (
  email,
  {
    client = pool,
    excludeUserId = null,
  } = {}
) => {
  const normalisedEmail =
    normaliseEmail(email);

  if (!normalisedEmail) {
    return false;
  }

  const excludedId =
    toPositiveInteger(
      excludeUserId
    );

  const result =
    await client.query(
      `
      SELECT id
      FROM public.users
      WHERE LOWER(email) =
        LOWER($1)
        AND (
          $2::INTEGER IS NULL
          OR id <> $2
        )
      LIMIT 1
      `,
      [
        normalisedEmail,
        excludedId,
      ]
    );

  return (
    result.rows.length > 0
  );
};

/**
 * Creates only the base user record.
 *
 * Callers must also create company membership inside the same
 * transaction. This service does not permit disconnected users.
 *
 * Purpose:
 * Inserts the `users` row and nothing else. Half of every account-creation
 * path — registerCompanyOwner and createCompanyUser both build on it.
 *
 * Parameters (one options object):
 * client   - REQUIRED. A transaction client, not the pool. See below.
 * fullName - trimmed; must be non-empty
 * email    - normalised; must be non-empty and unused
 * password - hashed here, after validation
 * role     - validated through normaliseUserRole
 * status   - defaults to active
 *
 * Returns:
 * The created user row.
 *
 * Throws:
 * - A plain Error when no client was passed — a programming mistake, not a
 *   user error, so it carries no statusCode and becomes a 500.
 * - 400 for a missing name or email, or an invalid role or password.
 * - 409 when the email is taken.
 *
 * Side effects:
 * One INSERT into users, plus the emailExists SELECT.
 *
 * Business rule:
 * The mandatory `client` is the enforcement mechanism for "no disconnected
 * users". Because this cannot run outside a transaction, the caller is
 * obliged to open one — and the membership insert that must accompany it
 * then lives in the same atomic unit. A user without a company_users row
 * would be able to log in but fail requireCompanyId on every request: an
 * account that exists and does nothing.
 *
 * Security:
 * The password is validated and hashed here rather than by the caller, so
 * no code path can insert a plaintext password or skip the strength check.
 */
const createBaseUser = async ({
  client,
  fullName,
  email,
  password,
  role,
  status = ACTIVE_STATUS,
}) => {
  if (!client) {
    throw new Error(
      "A transaction client is required to create a user."
    );
  }

  const cleanedFullName =
    cleanText(fullName);

  const normalisedEmail =
    normaliseEmail(email);

  if (!cleanedFullName) {
    const error = new Error(
      "Full name is required."
    );

    error.statusCode = 400;
    error.publicMessage =
      "Full name is required.";

    throw error;
  }

  if (!normalisedEmail) {
    const error = new Error(
      "Email is required."
    );

    error.statusCode = 400;
    error.publicMessage =
      "Email is required.";

    throw error;
  }

  if (
    await emailExists(
      normalisedEmail,
      {
        client,
      }
    )
  ) {
    const error = new Error(
      "User already exists."
    );

    error.statusCode = 409;
    error.publicMessage =
      "An account with this email already exists.";

    throw error;
  }

  const normalisedRole =
    normaliseUserRole(role);

  const passwordHash =
    await hashPassword(
      password
    );

  const result =
    await client.query(
      `
      INSERT INTO public.users
      (
        full_name,
        email,
        password_hash,
        role,
        status,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,
        LOWER($2),
        $3,
        $4,
        $5,
        NOW(),
        NOW()
      )
      /*
       * The RETURNING list deliberately omits password_hash. The row this
       * function hands back flows into the registration response, so the
       * hash is excluded at the source rather than stripped downstream —
       * a projection cannot be forgotten the way a delete can.
       */
      RETURNING
        id,
        full_name,
        email,
        role,
        status,
        created_at,
        updated_at
      `,
      [
        cleanedFullName,
        normalisedEmail,
        passwordHash,
        normalisedRole,
        status,
      ]
    );

  return result.rows[0];
};

/**
 * Links an existing user to a company.
 *
 * Purpose:
 * The other half of account creation. Writes the company_users row that
 * gives a user a tenant — which is what getCompanyId reads, and therefore
 * what makes every other endpoint in the application work for them.
 *
 * Parameters (one options object):
 * client    - REQUIRED, a transaction client, for the same reason as
 *             createBaseUser
 * companyId - the company to join
 * userId    - the user joining it
 * role      - validated through normaliseCompanyRole
 *
 * Returns:
 * The created or updated membership row.
 *
 * Throws:
 * A plain Error without a client; 400 when either id is not a positive
 * integer or the role is unrecognised.
 *
 * Side effects:
 * One INSERT ... ON CONFLICT DO UPDATE on company_users.
 *
 * Business rule:
 * The upsert makes this idempotent: calling it again for an existing
 * membership changes that member's role rather than failing on the unique
 * constraint. That is what lets the invite flow re-invite someone, and what
 * the break-glass script relies on to promote an existing member.
 *
 * Security:
 * companyId is supplied by the caller, not read from a request. Every
 * current caller passes either a company it has just created or the
 * authenticated admin's own — accepting one from a request body here would
 * let an admin add users to another tenant.
 */
const createCompanyMembership =
  async ({
    client,
    companyId,
    userId,
    role,
  }) => {
    if (!client) {
      throw new Error(
        "A transaction client is required to create company membership."
      );
    }

    const parsedCompanyId =
      toPositiveInteger(
        companyId
      );

    const parsedUserId =
      toPositiveInteger(
        userId
      );

    if (
      !parsedCompanyId ||
      !parsedUserId
    ) {
      const error = new Error(
        "A valid company and user are required."
      );

      error.statusCode = 400;
      error.publicMessage =
        "A valid company and user are required.";

      throw error;
    }

    const companyRole =
      normaliseCompanyRole(role);

    const result =
      await client.query(
        `
        INSERT INTO public.company_users
        (
          company_id,
          user_id,
          role,
          created_at
        )
        VALUES
        (
          $1,
          $2,
          $3,
          NOW()
        )
        ON CONFLICT
          (company_id, user_id)
        DO UPDATE
        SET role = EXCLUDED.role
        RETURNING *
        `,
        [
          parsedCompanyId,
          parsedUserId,
          companyRole,
        ]
      );

    return result.rows[0];
  };

/**
 * Creates a company and its owner account.
 *
 * Public registration should create an admin owner rather than
 * a disconnected worker account.
 *
 * Purpose:
 * The whole of self-service signup. Creates the user, the company and the
 * membership as one atomic act, and establishes the user as the company's
 * owner.
 *
 * Parameters (one options object):
 * fullName, email, password - passed through to createBaseUser
 * companyName               - required; trimmed
 * industry                  - optional, free text
 * currencyCode              - defaults to DEFAULT_CURRENCY from env
 * timezone                  - defaults to DEFAULT_TIMEZONE from env
 *
 * Returns:
 * The combined context for the new owner, ready to be tokenised.
 *
 * Throws:
 * 400 for a missing company name, plus anything createBaseUser throws.
 *
 * Side effects:
 * Three INSERTs — users, companies, company_users — inside one transaction.
 *
 * Business rules:
 * - The registering user is forced to USER_ROLES.ADMIN regardless of what
 *   the request asked for. Whoever creates a company owns it; a signup that
 *   produced a worker would create a company nobody could administer.
 * - companies.owner_user_id is set to this user, which is the standing that
 *   later gates creating other admins.
 * - The company's timezone matters beyond display: it decides what "today"
 *   means for the supervisor backdated-entry window.
 *
 * Security:
 * This is the one unauthenticated endpoint that writes to the database, so
 * it is the product's main abuse surface — anyone may create a tenant.
 * authLimiter bounds the rate. Isolation between tenants is enforced
 * everywhere else, so a spuriously created company can see nothing but its
 * own empty data.
 *
 * Notes:
 * The transaction is what makes partial state impossible. A company with no
 * owner, or an owner with no membership, would each be unreachable through
 * the API and awkward to repair by hand.
 */
const registerCompanyOwner =
  async ({
    fullName,
    email,
    password,
    companyName,
    industry = null,
    currencyCode =
      DEFAULT_CURRENCY,
    timezone =
      DEFAULT_TIMEZONE,
  }) =>
    withTransaction(
      async (client) => {
        const cleanedCompanyName =
          cleanText(
            companyName
          );

        if (!cleanedCompanyName) {
          const error =
            new Error(
              "Company name is required."
            );

          error.statusCode =
            400;

          error.publicMessage =
            "Company name is required.";

          throw error;
        }

        const user =
          await createBaseUser({
            client,
            fullName,
            email,
            password,
            role:
              USER_ROLES.ADMIN,
            status:
              ACTIVE_STATUS,
          });

        const companyResult =
          await client.query(
            `
            INSERT INTO public.companies
            (
              company_name,
              owner_user_id,
              currency_code,
              timezone,
              industry,
              created_at,
              updated_at
            )
            VALUES
            (
              $1,
              $2,
              $3,
              $4,
              $5,
              NOW(),
              NOW()
            )
            RETURNING *
            `,
            [
              cleanedCompanyName,
              user.id,
              cleanText(
                currencyCode
              ).toUpperCase() ||
                DEFAULT_CURRENCY,
              cleanText(
                timezone
              ) ||
                DEFAULT_TIMEZONE,
              cleanText(
                industry
              ) ||
                null,
            ]
          );

        const company =
          companyResult.rows[0];

        await createCompanyMembership({
          client,
          companyId:
            company.id,
          userId:
            user.id,
          role:
            COMPANY_ROLES.ADMIN,
        });

        /*
         * Re-read the full context rather than assembling it from the three
         * rows just inserted. Two reasons: the caller needs the joined
         * shape that login also produces, and reading it back confirms the
         * joins actually resolve before the transaction commits.
         *
         * The transaction client is passed so this sees the uncommitted
         * rows — the pool would not.
         */
        const context =
          await getUserContextById(
            user.id,
            {
              client,
            }
          );

        return context;
      }
    );

/**
 * Creates a user within an existing company.
 *
 * This is used by administrator user-management flows.
 *
 * Purpose:
 * Adds a member to a company that already exists — the admin-driven
 * counterpart to registerCompanyOwner.
 *
 * Parameters (one options object):
 * companyId   - which company; supplied by the caller from the
 *               authenticated session, never from a request body
 * fullName, email, password - passed to createBaseUser
 * role        - the global users.role
 * companyRole - the company_users.role; falls back to `role` when omitted,
 *               which is the normal case since the two are usually the same
 * status      - defaults to active
 *
 * Returns:
 * The new user's combined context.
 *
 * Throws:
 * 400 for a missing or invalid company id; 404 when the company does not
 * exist; plus anything createBaseUser throws (400, 409).
 *
 * Side effects:
 * A SELECT to confirm the company, then two INSERTs, all in one
 * transaction.
 *
 * Business rules:
 * - The company is verified to exist before any work is done, so the
 *   failure names the real problem rather than surfacing as a foreign-key
 *   violation after the password has been hashed.
 * - Unlike registration, the role here is whatever the admin chose — this
 *   is how workers, supervisors and subcontractors get their accounts. The
 *   restriction on creating *administrators* is applied by the controller,
 *   which checks company ownership before calling this.
 *
 * Security:
 * This function does not itself check who is calling. It is only safe
 * because auth.routes.js gates the endpoint on admin and the controller
 * passes the caller's own company id. Any new caller must do the same.
 */
const createCompanyUser =
  async ({
    companyId,
    fullName,
    email,
    password,
    role,
    companyRole,
    profile,
    status =
      ACTIVE_STATUS,
  }) =>
    withTransaction(
      async (client) => {
        const parsedCompanyId =
          toPositiveInteger(
            companyId
          );

        if (!parsedCompanyId) {
          const error =
            new Error(
              "Company ID is required."
            );

          error.statusCode =
            400;

          error.publicMessage =
            "Company ID is required.";

          throw error;
        }

        const companyResult =
          await client.query(
            `
            SELECT id
            FROM public.companies
            WHERE id = $1
            LIMIT 1
            `,
            [parsedCompanyId]
          );

        if (
          companyResult.rows
            .length === 0
        ) {
          const error =
            new Error(
              "Company not found."
            );

          error.statusCode =
            404;

          error.publicMessage =
            "Company not found.";

          throw error;
        }

        const userRole =
          normaliseUserRole(
            role
          );

        const membershipRole =
          normaliseCompanyRole(
            companyRole ||
              userRole
          );

        /*
         * Decide the profile work BEFORE createBaseUser, for the same
         * reason the company is checked above: createBaseUser hashes the
         * password, and a request that was always going to be rejected
         * should be rejected before that work is done and before any row
         * is written.
         *
         * This is read-only. It cannot write yet — the link needs a user
         * id that does not exist until the next statement — which is why
         * resolving and applying are separate calls.
         *
         * Returns null for admin and manager, so their path is unchanged.
         */
        const profilePlan =
          await resolveProfilePlan({
            client,
            companyId:
              parsedCompanyId,
            role: userRole,
            /*
             * BOTH roles, because admission reads both. The worker portal
             * admits on users.role OR company_users.role, so passing only
             * users.role here let { role: "manager", company_role: "worker" }
             * create a login with no register row that the portal still let
             * in — BUG-002 through a second door.
             */
            companyRole:
              membershipRole,
            profile,
          });

        const user =
          await createBaseUser({
            client,
            fullName,
            email,
            password,
            role: userRole,
            status,
          });

        await createCompanyMembership({
          client,
          companyId:
            parsedCompanyId,
          userId:
            user.id,
          role:
            membershipRole,
        });

        /*
         * The write half. Same client, so a failure here rolls back the
         * users and company_users rows above it rather than leaving a
         * login with no profile — which was BUG-002 exactly.
         */
        const profileId =
          await applyProfilePlan({
            client,
            plan: profilePlan,
            userId: user.id,
          });

        const context =
          await getUserContextById(
            user.id,
            {
              client,
            }
          );

        /*
         * Returned beside the context, not inside it. serialiseUserContext
         * is an allow-list over the users table and adding a field there
         * would widen it for every caller; this one belongs to the create
         * response alone.
         *
         * null for admin and manager, which have no profile concept.
         */
        return {
          user: context,
          profileId,
        };
      }
    );

/**
 * Removes password and reset-token fields before sending user
 * information to the frontend.
 *
 * Purpose:
 * The last gate before a user record leaves the server. Everything the
 * frontend is allowed to know about the signed-in user, and nothing else.
 *
 * Parameters:
 * user - a context row from getUserContextByEmail or getUserContextById
 *
 * Returns:
 * A new object with an explicit set of fields, or null when given null.
 *
 * Side effects:
 * None.
 *
 * Security:
 * This is an allow-list, not a deny-list — it names the fields to include
 * rather than deleting the ones to hide. The distinction is the whole
 * value: a column added to the users table later cannot leak through here
 * by default, whereas a `delete user.password_hash` approach would let it.
 *
 * That covers password_hash, reset_token, reset_token_expires and
 * token_version, none of which the frontend has any use for.
 *
 * Used by:
 * every auth.controller response that carries a user, and by the two
 * portals when they return the caller's own record.
 */
const serialiseUserContext = (
  user
) => {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    full_name:
      user.full_name,
    email: user.email,
    role: user.role,
    status: user.status,

    company_id:
      user.company_id,
    company_role:
      user.company_role,
    company_name:
      user.company_name,

    company_owner_user_id:
      user.owner_user_id,

    currency_code:
      user.currency_code ||
      DEFAULT_CURRENCY,

    timezone:
      user.timezone ||
      DEFAULT_TIMEZONE,

    industry:
      user.industry || null,

    created_at:
      user.created_at,
    updated_at:
      user.updated_at,
    last_login_at:
      user.last_login_at,
  };
};

module.exports = {
  normaliseEmail,
  normaliseUserRole,
  normaliseCompanyRole,

  validatePassword,
  hashPassword,
  verifyPassword,

  createAccessToken,

  getUserContextByEmail,
  getUserContextById,

  emailExists,

  createBaseUser,
  createCompanyMembership,
  registerCompanyOwner,
  createCompanyUser,

  serialiseUserContext,
};