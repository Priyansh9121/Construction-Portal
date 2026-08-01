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
 */
const normaliseEmail = (email) =>
  cleanLowerText(email);

/**
 * Validates a supported account role.
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
 */
const createCompanyUser =
  async ({
    companyId,
    fullName,
    email,
    password,
    role,
    companyRole,
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

        return getUserContextById(
          user.id,
          {
            client,
          }
        );
      }
    );

/**
 * Removes password and reset-token fields before sending user
 * information to the frontend.
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