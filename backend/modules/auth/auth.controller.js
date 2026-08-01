const crypto = require("crypto");

const pool = require("../../database/pool");

const {
  NODE_ENV,
  RESET_TOKEN_TTL_MINUTES,
} = require("../../config/env");

const {
  sendPasswordResetEmail,
  isConfigured: isMailConfigured,
} = require("../../config/mailer");

const {
  USER_ROLES,
  COMPANY_ROLES,
  RECORD_STATUS,
} = require("../../config/constants");

const {
  cleanText,
  cleanLowerText,
  requireCompanyId,
  requireParamId,
  getUserId,
  withTransaction,
  sendNotFound,
  sendForbidden,
} = require("../../utils/requestContext");

const {
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
  registerCompanyOwner,
  createCompanyUser,
  serialiseUserContext,
} = require("./auth.service");

/**
 * Reset token lifetime.
 *
 * Driven by RESET_TOKEN_TTL_MINUTES so the value stored on the token and
 * the one quoted in the email cannot disagree.
 */
const RESET_TOKEN_EXPIRY_MINUTES =
  RESET_TOKEN_TTL_MINUTES;

/**
 * Creates a secure reset token.
 *
 * Only the SHA-256 hash is saved in PostgreSQL.
 * The raw token is returned only in development until
 * an email service is implemented.
 */
const createPasswordResetToken = () => {
  const rawToken = crypto
    .randomBytes(32)
    .toString("hex");

  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const expiresAt = new Date(
    Date.now() +
      RESET_TOKEN_EXPIRY_MINUTES *
        60 *
        1000
  );

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
};

/**
 * POST /api/auth/register
 *
 * Public registration creates:
 *
 * 1. An admin account
 * 2. A company
 * 3. An admin company membership
 *
 * It does not allow public worker, manager or subcontractor
 * registrations.
 */
exports.register = async (
  req,
  res
) => {
  const {
    full_name,
    email,
    password,
    company_name,
    industry,
    currency_code,
    timezone,
  } = req.body;

  if (!cleanText(full_name)) {
    return res.status(400).json({
      success: false,
      message:
        "Full name is required.",
    });
  }

  if (!normaliseEmail(email)) {
    return res.status(400).json({
      success: false,
      message:
        "A valid email is required.",
    });
  }

  if (!cleanText(company_name)) {
    return res.status(400).json({
      success: false,
      message:
        "Company name is required.",
    });
  }

  validatePassword(password);

  const userContext =
    await registerCompanyOwner({
      fullName: full_name,
      email,
      password,
      companyName: company_name,
      industry,
      currencyCode:
        currency_code,
      timezone,
    });

  const token =
    createAccessToken(
      userContext
    );

  return res.status(201).json({
    success: true,
    message:
      "Company and administrator account created successfully.",
    token,
    user:
      serialiseUserContext(
        userContext
      ),
  });
};

/**
 * POST /api/auth/login
 */
exports.login = async (
  req,
  res
) => {
  const email =
    normaliseEmail(
      req.body.email
    );

  const password =
    req.body.password;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message:
        "Email and password are required.",
    });
  }

  const user =
    await getUserContextByEmail(
      email,
      {
        includePassword: true,
      }
    );

  /*
   * Use the same error for unknown email and wrong password
   * to avoid revealing registered accounts.
   */
  if (!user) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid email or password.",
    });
  }

  const passwordMatches =
    await verifyPassword(
      password,
      user.password_hash
    );

  if (!passwordMatches) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid email or password.",
    });
  }

  if (
    cleanLowerText(
      user.status
    ) !==
    RECORD_STATUS.ACTIVE
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Your account is inactive. Please contact an administrator.",
    });
  }

  if (!user.company_id) {
    return res.status(403).json({
      success: false,
      message:
        "Your account is not linked to a company.",
    });
  }

  await pool.query(
    `
    UPDATE public.users
    SET
      last_login_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    `,
    [user.id]
  );

  const refreshedUser =
    await getUserContextById(
      user.id
    );

  const token =
    createAccessToken(
      refreshedUser
    );

  return res.status(200).json({
    success: true,
    message:
      "Login successful.",
    token,
    user:
      serialiseUserContext(
        refreshedUser
      ),
  });
};

/**
 * GET /api/auth/me
 */
exports.getCurrentUser = async (
  req,
  res
) => {
  const userId =
    getUserId(req);

  const user =
    await getUserContextById(
      userId
    );

  if (!user) {
    return sendNotFound(
      res,
      "User"
    );
  }

  return res.status(200).json({
    success: true,
    user:
      serialiseUserContext(
        user
      ),
  });
};

/**
 * POST /api/auth/create-user
 *
 * Creates a user inside the authenticated administrator's company.
 */
exports.createUser = async (
  req,
  res
) => {
  const companyId =
    requireCompanyId(
      req,
      res
    );

  if (!companyId) {
    return;
  }

  const {
    full_name,
    email,
    password,
    role = USER_ROLES.WORKER,
    company_role,
    status =
      RECORD_STATUS.ACTIVE,
  } = req.body;

  if (!cleanText(full_name)) {
    return res.status(400).json({
      success: false,
      message:
        "Full name is required.",
    });
  }

  if (!normaliseEmail(email)) {
    return res.status(400).json({
      success: false,
      message:
        "A valid email is required.",
    });
  }

  validatePassword(password);

  const userRole =
    normaliseUserRole(role);

  const membershipRole =
    normaliseCompanyRole(
      company_role ||
        userRole
    );

  /*
   * Only the company owner should be able to create another
   * administrator.
   */
  if (
    userRole ===
      USER_ROLES.ADMIN ||
    membershipRole ===
      COMPANY_ROLES.ADMIN
  ) {
    const currentUserId =
      Number(req.user.id);

    const ownerUserId =
      Number(
        req.user
          .company_owner_user_id
      );

    if (
      currentUserId !==
      ownerUserId
    ) {
      return sendForbidden(
        res,
        "Only the company owner can create another administrator."
      );
    }
  }

  const user =
    await createCompanyUser({
      companyId,
      fullName: full_name,
      email,
      password,
      role: userRole,
      companyRole:
        membershipRole,
      status,
    });

  return res.status(201).json({
    success: true,
    message:
      "User created and linked to the company successfully.",
    user:
      serialiseUserContext(
        user
      ),
  });
};

/**
 * GET /api/auth/users
 *
 * Lists only members of the authenticated company.
 */
exports.getUsers = async (
  req,
  res
) => {
  const companyId =
    requireCompanyId(
      req,
      res
    );

  if (!companyId) {
    return;
  }

  const result =
    await pool.query(
      `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.role,
        u.status,
        u.created_at,
        u.updated_at,
        u.last_login_at,

        cu.role
          AS company_role,
        cu.created_at
          AS company_joined_at,

        c.company_name,

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

      ORDER BY
        CASE
          WHEN c.owner_user_id = u.id
            THEN 0
          ELSE 1
        END,
        u.full_name ASC,
        u.id ASC
      `,
      [companyId]
    );

  return res.status(200).json({
    success: true,
    users: result.rows,
  });
};

/**
 * PUT /api/auth/users/:userId
 *
 * Updates the base account and its company membership together.
 */
exports.updateUser = async (
  req,
  res
) => {
  const companyId =
    requireCompanyId(
      req,
      res
    );

  if (!companyId) {
    return;
  }

  const userId =
    requireParamId(
      req,
      res,
      "userId",
      "user"
    );

  if (!userId) {
    return;
  }

  const {
    full_name,
    email,
    role,
    company_role,
    status,
  } = req.body;

  const existingResult =
    await pool.query(
      `
      SELECT
        u.id,
        u.role,
        u.status,
        cu.role AS company_role,
        c.owner_user_id
      FROM public.company_users cu
      INNER JOIN public.users u
        ON u.id = cu.user_id
      INNER JOIN public.companies c
        ON c.id = cu.company_id
      WHERE cu.company_id = $1
        AND cu.user_id = $2
      LIMIT 1
      `,
      [companyId, userId]
    );

  if (
    existingResult.rows.length ===
    0
  ) {
    return sendNotFound(
      res,
      "User"
    );
  }

  const existing =
    existingResult.rows[0];

  const isOwner =
    Number(
      existing.owner_user_id
    ) === userId;

  const requesterIsOwner =
    Number(
      req.user.id
    ) ===
    Number(
      existing.owner_user_id
    );

  const nextRole =
    normaliseUserRole(
      role ||
        existing.role
    );

  const nextCompanyRole =
    normaliseCompanyRole(
      company_role ||
        existing.company_role ||
        nextRole
    );

  const nextStatus =
    cleanLowerText(status) ||
    existing.status;

  if (
    isOwner &&
    (
      nextRole !==
        USER_ROLES.ADMIN ||
      nextCompanyRole !==
        COMPANY_ROLES.ADMIN ||
      nextStatus !==
        RECORD_STATUS.ACTIVE
    )
  ) {
    return res.status(400).json({
      success: false,
      message:
        "The company owner must remain an active administrator.",
    });
  }

  if (
    (
      nextRole ===
        USER_ROLES.ADMIN ||
      nextCompanyRole ===
        COMPANY_ROLES.ADMIN
    ) &&
    !requesterIsOwner
  ) {
    return sendForbidden(
      res,
      "Only the company owner can grant administrator access."
    );
  }

  const nextEmail =
    normaliseEmail(email);

  if (!nextEmail) {
    return res.status(400).json({
      success: false,
      message:
        "A valid email is required.",
    });
  }

  if (
    await emailExists(
      nextEmail,
      {
        excludeUserId:
          userId,
      }
    )
  ) {
    return res.status(409).json({
      success: false,
      message:
        "An account with this email already exists.",
    });
  }

  const updatedUser =
    await withTransaction(
      async (client) => {
        await client.query(
          `
          UPDATE public.users
          SET
            full_name = $1,
            email = LOWER($2),
            role = $3,
            status = $4,
            updated_at = NOW()
          WHERE id = $5
          `,
          [
            cleanText(
              full_name
            ),
            nextEmail,
            nextRole,
            nextStatus,
            userId,
          ]
        );

        await client.query(
          `
          UPDATE public.company_users
          SET role = $1
          WHERE company_id = $2
            AND user_id = $3
          `,
          [
            nextCompanyRole,
            companyId,
            userId,
          ]
        );

        return getUserContextById(
          userId,
          {
            client,
          }
        );
      }
    );

  return res.status(200).json({
    success: true,
    message:
      "User updated successfully.",
    user:
      serialiseUserContext(
        updatedUser
      ),
  });
};

/**
 * PATCH /api/auth/users/:userId/disable
 */
exports.disableUser = async (
  req,
  res
) => {
  const companyId =
    requireCompanyId(
      req,
      res
    );

  if (!companyId) {
    return;
  }

  const userId =
    requireParamId(
      req,
      res,
      "userId",
      "user"
    );

  if (!userId) {
    return;
  }

  if (
    userId ===
    Number(req.user.id)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "You cannot disable your own account.",
    });
  }

  const result =
    await pool.query(
      `
      UPDATE public.users u
      SET
        status = 'inactive',
        -- A deactivated user must lose access immediately rather than at
        -- the end of their token's life.
        token_version = u.token_version + 1,
        updated_at = NOW()
      FROM public.company_users cu
      INNER JOIN public.companies c
        ON c.id = cu.company_id
      WHERE u.id = $1
        AND cu.user_id = u.id
        AND cu.company_id = $2
        AND c.owner_user_id <> u.id
      RETURNING
        u.id,
        u.full_name,
        u.email,
        u.role,
        u.status
      `,
      [userId, companyId]
    );

  if (
    result.rows.length ===
    0
  ) {
    return res.status(404).json({
      success: false,
      message:
        "User was not found or cannot be disabled.",
    });
  }

  return res.status(200).json({
    success: true,
    message:
      "User disabled successfully.",
    user: result.rows[0],
  });
};

/**
 * PATCH /api/auth/users/:userId/enable
 */
exports.enableUser = async (
  req,
  res
) => {
  const companyId =
    requireCompanyId(
      req,
      res
    );

  if (!companyId) {
    return;
  }

  const userId =
    requireParamId(
      req,
      res,
      "userId",
      "user"
    );

  if (!userId) {
    return;
  }

  const result =
    await pool.query(
      `
      UPDATE public.users u
      SET
        status = 'active',
        updated_at = NOW()
      FROM public.company_users cu
      WHERE u.id = $1
        AND cu.user_id = u.id
        AND cu.company_id = $2
      RETURNING
        u.id,
        u.full_name,
        u.email,
        u.role,
        u.status
      `,
      [userId, companyId]
    );

  if (
    result.rows.length ===
    0
  ) {
    return sendNotFound(
      res,
      "User"
    );
  }

  return res.status(200).json({
    success: true,
    message:
      "User enabled successfully.",
    user: result.rows[0],
  });
};

/**
 * POST /api/auth/forgot-password
 *
 * Always returns success to avoid revealing whether an email
 * exists.
 */
exports.forgotPassword = async (
  req,
  res
) => {
  const email =
    normaliseEmail(
      req.body.email
    );

  if (!email) {
    return res.status(400).json({
      success: false,
      message:
        "A valid email is required.",
    });
  }

  const user =
    await getUserContextByEmail(
      email
    );

  let rawToken;

  if (user) {
    const tokenData =
      createPasswordResetToken();

    rawToken =
      tokenData.rawToken;

    await pool.query(
      `
      UPDATE public.users
      SET
        reset_token = $1,
        reset_token_expires = $2,
        updated_at = NOW()
      WHERE id = $3
      `,
      [
        tokenData.tokenHash,
        tokenData.expiresAt,
        user.id,
      ]
    );
  }

  /*
   * Send the link.
   *
   * Deliberately not awaited for its result before responding, and any
   * failure is swallowed: if a mail outage produced a different response
   * or a different response time, this endpoint would become a way to
   * discover which email addresses have accounts.
   *
   * The identical response below is returned whether or not the user
   * exists, for the same reason.
   */
  if (user && rawToken) {
    sendPasswordResetEmail({
      to: email,
      fullName: user.full_name,
      token: rawToken,
      expiresInMinutes:
        RESET_TOKEN_EXPIRY_MINUTES,
    }).catch((error) => {
      console.error(
        "[auth] password reset email failed:",
        error.message
      );
    });
  }

  const response = {
    success: true,
    message:
      "If an account exists for this email, a password reset link has been sent.",
  };

  /*
   * Local convenience only: when SMTP is not configured there is nowhere
   * for the link to go, so the token is returned to keep development
   * workable. Gated on both the environment and the absence of a mail
   * provider, so it can never fire in a configured deployment.
   */
  if (
    NODE_ENV === "development" &&
    !isMailConfigured &&
    rawToken
  ) {
    response.resetToken = rawToken;
  }

  return res.status(200).json(
    response
  );
};

/**
 * POST /api/auth/reset-password
 */
exports.resetPassword = async (
  req,
  res
) => {
  const {
    token,
    new_password,
  } = req.body;

  if (!cleanText(token)) {
    return res.status(400).json({
      success: false,
      message:
        "Reset token is required.",
    });
  }

  validatePassword(
    new_password
  );

  const tokenHash = crypto
    .createHash("sha256")
    .update(
      cleanText(token)
    )
    .digest("hex");

  const passwordHash =
    await hashPassword(
      new_password
    );

  const result =
    await pool.query(
      `
      UPDATE public.users
      SET
        password_hash = $1,
        reset_token = NULL,
        reset_token_expires = NULL,
        -- Invalidate every session issued before the reset. Someone who
        -- had the old password (or a stolen token) is signed out.
        token_version = token_version + 1,
        failed_logins = 0,
        locked_until = NULL,
        updated_at = NOW()
      WHERE reset_token = $2
        AND reset_token_expires > NOW()
      RETURNING id
      `,
      [
        passwordHash,
        tokenHash,
      ]
    );

  if (
    result.rows.length ===
    0
  ) {
    return res.status(400).json({
      success: false,
      message:
        "The password reset token is invalid or has expired.",
    });
  }

  return res.status(200).json({
    success: true,
    message:
      "Password reset successfully.",
  });
};

/**
 * POST /api/auth/change-password
 */
exports.changePassword = async (
  req,
  res
) => {
  const userId =
    getUserId(req);

  const {
    current_password,
    new_password,
  } = req.body;

  if (
    !current_password ||
    !new_password
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Current password and new password are required.",
    });
  }

  validatePassword(
    new_password
  );

  if (
    current_password ===
    new_password
  ) {
    return res.status(400).json({
      success: false,
      message:
        "The new password must be different from the current password.",
    });
  }

  const user =
    await getUserContextById(
      userId,
      {
        includePassword: true,
      }
    );

  if (!user) {
    return sendNotFound(
      res,
      "User"
    );
  }

  const passwordMatches =
    await verifyPassword(
      current_password,
      user.password_hash
    );

  if (!passwordMatches) {
    return res.status(400).json({
      success: false,
      message:
        "Current password is incorrect.",
    });
  }

  const passwordHash =
    await hashPassword(
      new_password
    );

  await pool.query(
    `
    UPDATE public.users
    SET
      password_hash = $1,
      reset_token = NULL,
      reset_token_expires = NULL,
      -- Sign out other devices; the caller gets a fresh token below.
      token_version = token_version + 1,
      updated_at = NOW()
    WHERE id = $2
    `,
    [
      passwordHash,
      userId,
    ]
  );

  /*
   * The bump above invalidated the caller's own token along with every
   * other session. Hand back a token carrying the new generation so the
   * user who just changed their password is not signed out by doing so,
   * while their other devices are.
   */
  const refreshedUser =
    await getUserContextById(userId);

  const token = createAccessToken(
    refreshedUser
  );

  return res.status(200).json({
    success: true,
    message:
      "Password changed successfully. Other devices have been signed out.",
    token,
    user: serialiseUserContext(
      refreshedUser
    ),
  });
};