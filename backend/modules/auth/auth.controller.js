/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The HTTP layer for /api/auth. Eleven handlers covering the whole account
| lifecycle: register, log in, read yourself, change your own password,
| recover a forgotten one, and — for administrators — create, list, update,
| disable and enable the users in your company.
|
| The division of labour with auth.service.js is strict and worth keeping.
| This file reads req, validates shapes, decides status codes and writes
| res. It holds no bcrypt calls, no token signing, and no user INSERTs; all
| of that is the service's. What DOES live here is the reset-token
| machinery, because a reset token is an HTTP-flow concern rather than an
| identity primitive.
|
| Responsibilities:
|   - Validate request bodies and reject with 400 before doing work
|   - Delegate identity operations to auth.service.js
|   - Enforce the finer authorisation rules the route gate cannot express,
|     principally "only the company owner may create or promote an admin"
|   - Issue, store and consume password-reset tokens
|   - Shape every response as { success, ... }
|
| Exports (all Express handlers, all mounted in auth.routes.js):
|   register, login, getCurrentUser, changePassword
|   createUser, getUsers, updateUser, disableUser, enableUser
|   forgotPassword, resetPassword
|
| Used by:
|   ./auth.routes.js — nothing else should import this
|
| Depends on:
|   crypto                 reset-token generation and hashing
|   database/pool.js       the queries this file issues directly
|   config/env.js          RESET_TOKEN_TTL_MINUTES
|   config/mailer.js       sendPasswordResetEmail
|   utils/requestContext.js  validation, identity and response helpers
|   ./auth.service.js      every identity operation
|
| Database tables touched:
|   users          SELECT, INSERT (via service), UPDATE
|   company_users  SELECT, INSERT (via service), UPDATE
|   companies      SELECT, for the ownership check
|
| Frontend consumers:
|   authService.js  -> LoginPage, RegisterPage, ForgotPasswordPage,
|                      ResetPasswordPage, AuthProvider
|   userService.js  -> UsersPage, SettingsPage
|
| Security summary:
|   - Login and forgot-password answer identically whether or not an account
|     exists, so neither can be used to enumerate addresses.
|   - Reset tokens are stored as a SHA-256 hash; the raw token exists only
|     in the email.
|   - Admin creation and promotion require company ownership, checked here
|     rather than in the route gate.
|   - Every user-management handler is scoped to the caller's own company.
|   - token_version is bumped on password change and on disable, which
|     invalidates sessions already issued.
|
*/

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
 *
 * Purpose:
 * Mints one password-reset credential: the secret to email, the digest to
 * store, and the moment it stops working.
 *
 * Parameters:
 * none
 *
 * Returns:
 * { rawToken, tokenHash, expiresAt }
 *   rawToken  64 hex characters. Goes in the emailed link and is never
 *             persisted.
 *   tokenHash SHA-256 of rawToken. This is what is written to
 *             users.reset_token.
 *   expiresAt a Date, RESET_TOKEN_TTL_MINUTES from now.
 *
 * Side effects:
 * None — it neither stores nor sends anything. forgotPassword does both.
 *
 * Security:
 * Three separate properties, each load-bearing:
 *
 * 1. randomBytes is a cryptographically secure source. Math.random here
 *    would be predictable enough to guess another user's token.
 *
 * 2. Only the hash is stored. A leaked database backup, or SQL injection
 *    reading users, yields digests rather than usable reset links —
 *    verification hashes the incoming token and compares digests.
 *
 * 3. 32 bytes is 256 bits of entropy, far past brute-forcing, and the
 *    expiry bounds the window in which a token is worth anything at all.
 *
 * Notes:
 * The doc line about development is now stale — mailer.js exists, and
 * forgotPassword sends the link rather than returning it. Left in place
 * because this pass does not edit existing text.
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
 *
 * Purpose:
 * Self-service signup. The only unauthenticated endpoint that creates a
 * tenant, and therefore the front door to the whole product.
 *
 * Parameters:
 * req - Express request. Body: full_name, email, password, company_name,
 *       and optionally industry, currency_code, timezone.
 * res - Express response
 *
 * Returns:
 * 201 { success, message, token, user }
 * 400 when a required field is missing or the password is too weak
 * 409 when the email is already registered
 *
 * Side effects:
 * Creates a users row, a companies row and a company_users row, in one
 * transaction inside registerCompanyOwner.
 *
 * Business rules:
 * - The registrant always becomes an admin and the company's owner. The
 *   request cannot ask for any other role — a signup producing a worker
 *   would create a company nobody could administer.
 * - A token is returned immediately, so the user lands in the application
 *   rather than at a login screen.
 * - currency_code and timezone fall back to the environment defaults. The
 *   timezone is not merely cosmetic: it decides what "today" means for the
 *   supervisor backdated-entry window.
 *
 * Security:
 * Unauthenticated and rate-limited by authLimiter. Anyone may create a
 * company; nothing about that threatens existing tenants, because every
 * other endpoint scopes to the caller's own company_id.
 *
 * Notes:
 * The three field checks here duplicate validation the service also
 * performs. That is deliberate rather than redundant — checking first means
 * an obviously malformed request is answered without opening a transaction
 * or hashing a password.
 *
 * validatePassword throws rather than returning, so asyncHandler forwards
 * it to errorHandler, which reads its statusCode and publicMessage.
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
 *
 * Purpose:
 * Exchanges an email and password for a bearer token.
 *
 * Parameters:
 * req - Express request. Body: email, password.
 * res - Express response
 *
 * Returns:
 * 200 { success, message, token, user }
 * 400 missing fields, unknown email, or wrong password
 * 403 the account is inactive, or has no company
 *
 * Side effects:
 * Updates last_login_at, then re-reads the user and signs a token.
 *
 * Business rules:
 * Four conditions must all hold: the account exists, the password matches,
 * the status is active, and there is a company membership. The last is not
 * a formality — a user without a company would authenticate successfully
 * and then fail requireCompanyId on every subsequent request, which is a
 * far more confusing failure than being refused at the door.
 *
 * Security:
 * The unknown-email and wrong-password branches return byte-identical
 * responses, so this cannot be used to discover which addresses are
 * registered.
 *
 * The inactive and no-company branches are distinguishable, and
 * deliberately so — but note they are only reachable *after* the correct
 * password has been proven, so they reveal nothing to an attacker who does
 * not already hold the credentials.
 *
 * Performance:
 * Dominated by bcrypt at cost 12, a few hundred milliseconds. Intentional,
 * and the reason authLimiter guards this route.
 *
 * Frontend:
 * LoginPage.jsx via authService.login; AuthProvider stores the token and
 * user.
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

  /*
   * verifyPassword returns false rather than throwing when password_hash is
   * absent, which is the case for an account created by invite that has not
   * set a password yet. Such an account therefore cannot be signed into at
   * all until the reset link is used — the correct outcome.
   */
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

  /*
   * Status is checked only after the password has been verified. Refusing a
   * disabled account before that point would tell an unauthenticated caller
   * that the address exists — the enumeration leak the two identical 400s
   * above exist to prevent.
   *
   * Compared through cleanLowerText so a row holding "Active" or a stray
   * trailing space still matches.
   */
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

  // Record the sign-in. Awaited rather than fired and forgotten so the
  // refreshed read below cannot race it, and so a failure surfaces as a
  // 500 rather than a silently missing timestamp.
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

  /*
   * Re-read rather than reuse the row above. Two reasons: `user` was
   * fetched with includePassword and still carries the hash, which must not
   * reach the response; and this picks up the last_login_at just written.
   *
   * serialiseUserContext would strip the hash anyway — this is defence in
   * depth, not the only guard.
   */
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
 *
 * Purpose:
 * Session restore. A token survives a page reload in localStorage but the
 * user object does not, so the frontend calls this on mount to rehydrate
 * who is signed in.
 *
 * Parameters:
 * req - Express request, after authMiddleware
 * res - Express response
 *
 * Returns:
 * 200 { success, user }
 * 401 from authMiddleware when the token is missing, invalid or expired
 * 404 when the token is valid but the user no longer exists — a deleted
 *     account whose token has not yet expired
 *
 * Side effects:
 * One SELECT.
 *
 * Security:
 * Reads the user id from the verified token, never from the request, so
 * this endpoint cannot be pointed at anyone else. The response goes through
 * serialiseUserContext, so no hash or reset token escapes.
 *
 * Because the record is re-read rather than reconstructed from token
 * claims, a role change or a disable made since the token was issued is
 * reflected on the next reload.
 *
 * Frontend:
 * AuthProvider.jsx calls this on mount and treats any failure as "log out".
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
 * POST /api/auth/users
 *
 * Creates a user inside the authenticated administrator's company.
 *
 * Purpose:
 * How everyone except a company's founder gets an account: staff, site
 * supervisors, workers and subcontractors are all created here by an
 * administrator.
 *
 * Parameters:
 * req - Express request. Body: full_name, email, password, and optionally
 *       role (default worker), company_role, status (default active).
 * res - Express response
 *
 * Returns:
 * 201 { success, message, user }
 * 400 missing name or email, weak password, unrecognised role
 * 403 a non-owner administrator attempting to create an administrator
 * 409 the email is already registered
 *
 * Side effects:
 * Creates a users row and a company_users row in one transaction, inside
 * createCompanyUser.
 *
 * Business rules:
 * - The new user joins the caller's company. company_id comes from
 *   requireCompanyId, so it cannot be aimed at another tenant.
 * - The role defaults to worker — the least privileged — when omitted.
 * - company_role falls back to the account role, which is the usual case;
 *   the two only differ if a caller sets them apart deliberately.
 * - Creating an administrator requires being the company OWNER, not merely
 *   an administrator. See the inline note.
 *
 * Security:
 * The ownership rule is the containment on privilege escalation. The route
 * gate already requires admin, but admin alone must not be enough to mint
 * more admins, or one compromised administrator account could quietly
 * multiply itself.
 *
 * Frontend:
 * UsersPage.jsx via userService.createUser.
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
   *
   * Both roles are tested, not just the account role. Either one alone
   * would confer administrative access — roleMiddleware runs with
   * `source: "either"` — so checking only users.role would leave an obvious
   * bypass: request role "worker" with company_role "admin".
   *
   * The owner id comes from req.user, which authMiddleware populated from
   * the database on this request. It is not a client-supplied value.
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
 *
 * Purpose:
 * Populates the Users screen: who is in this company, what role they hold,
 * whether they are active, and when they last signed in.
 *
 * Parameters:
 * req - Express request, after authMiddleware and the admin gate
 * res - Express response
 *
 * Returns:
 * 200 { success, users } — an array, ordered owner first then by name
 * 400 when the account has no company
 *
 * Side effects:
 * One SELECT.
 *
 * Security:
 * Driven from company_users with an INNER JOIN and filtered on
 * cu.company_id, so the query is structurally incapable of returning
 * another tenant's staff — a user with no membership in this company has no
 * row to join through.
 *
 * The projection names its columns explicitly and omits password_hash,
 * reset_token, reset_token_expires and token_version. `SELECT u.*` here
 * would leak all four.
 *
 * Notes:
 * is_company_owner is computed rather than stored on the user, because
 * ownership is a property of the company row. The frontend uses it to
 * disable the controls that only an owner may use.
 *
 * The ORDER BY puts the owner first and then sorts by name, with the id as
 * a final tie-break so the list is stable between reloads when two people
 * share a name.
 *
 * Frontend:
 * UsersPage.jsx via userService.getUsers.
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
 *
 * Purpose:
 * Edits a colleague's name, email, role and status. Because a role lives on
 * two tables, the update has to touch both — and atomically, or a user
 * could be left admin on one and worker on the other.
 *
 * Parameters:
 * req - Express request. Params: userId. Body: full_name, email, role,
 *       company_role, status. Omitted role and status keep their current
 *       values; email is required.
 * res - Express response
 *
 * Returns:
 * 200 { success, message, user }
 * 400 invalid id, invalid email, or an attempt to demote the owner
 * 403 a non-owner attempting to grant administrator access
 * 404 no such user in this company
 * 409 the email belongs to someone else
 *
 * Side effects:
 * Two UPDATEs — users and company_users — in one transaction.
 *
 * Business rules:
 * - The target must already be a member of the caller's company. The
 *   lookup joins through company_users, so a user in another tenant simply
 *   is not found.
 * - The company owner must remain an active administrator. See below.
 * - Granting administrator access — by either role field — requires being
 *   the owner, matching createUser.
 * - Absent fields fall back to the stored values, so a partial update does
 *   not blank anything. Email is the exception and must always be supplied.
 *
 * Security:
 * This is the principal privilege-escalation surface in the product: it is
 * the endpoint that changes someone else's role. Two rules contain it —
 * company membership, and owner-only promotion — and both are checked
 * before any write happens.
 *
 * The password hash is not touched here. Changing a password goes through
 * change-password or the reset flow, so this endpoint cannot be used to
 * take over an account.
 *
 * Frontend:
 * UsersPage.jsx via userService.updateUser.
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

  /*
   * Load the current state before deciding anything. This single query does
   * three jobs: it proves the target is in the caller's company (the join
   * plus the company_id filter), it supplies the fallback values for
   * omitted fields, and it returns owner_user_id for the two ownership
   * rules below.
   */
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

  // Is the person being EDITED the owner?
  const isOwner =
    Number(
      existing.owner_user_id
    ) === userId;

  // Is the person DOING the editing the owner? Two different questions,
  // used by the two different rules below.
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

  /*
   * The owner may not be demoted or deactivated — by anyone, including
   * themselves.
   *
   * Without this the company could be left with no administrator at all,
   * and since promoting someone to admin requires being the owner, there
   * would be no way back in short of running the break-glass script. The
   * rule makes that state unreachable.
   *
   * All three conditions are tested because any one of them would produce
   * it: an owner who is not an account admin, not a company admin, or not
   * active.
   */
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

  /*
   * Promotion to administrator requires ownership, exactly as in
   * createUser. Both role fields are tested for the same reason: either one
   * alone satisfies roleMiddleware's "either" source, so checking only one
   * would leave the other as a bypass.
   *
   * Note this fires whenever the resulting role is admin, not only when it
   * changes to admin — so editing an existing administrator's name also
   * requires ownership. Stricter than strictly necessary, and the safe
   * direction to err in.
   */
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

  /*
   * Both writes in one transaction. A role lives on users AND on
   * company_users, and the two must never disagree — a partial update
   * leaving someone admin on one table and worker on the other would grant
   * access through roleMiddleware's "either" source while appearing
   * demoted on the Users screen.
   */
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
 *
 * Purpose:
 * Revokes someone's access without destroying the record. Used when a
 * worker leaves, a subcontractor's engagement ends, or an account is
 * suspected of compromise.
 *
 * Parameters:
 * req - Express request. Params: userId.
 * res - Express response
 *
 * Returns:
 * 200 { success, message, user }
 * 400 invalid id, or an attempt to disable your own account
 * 404 no such user in this company, or the target is the owner
 *
 * Side effects:
 * Sets status to inactive and increments token_version.
 *
 * Business rules:
 * - Soft, never a delete. Users are referenced as created_by, approved_by
 *   and requested_by across the schema; removing the row would break every
 *   record that points at them.
 * - You cannot disable yourself — a sole administrator doing so would lock
 *   the company out entirely.
 * - The owner cannot be disabled. Enforced in the WHERE clause rather than
 *   as a separate check, so it cannot be bypassed by any path that reaches
 *   this query.
 *
 * Security:
 * Incrementing token_version is what makes this immediate. Without it the
 * user would keep working normally until their token expired — up to seven
 * days for someone who may have just been dismissed. authMiddleware
 * compares the token's `tv` claim against this column on every request, so
 * the bump invalidates every session the moment it is written.
 *
 * Notes:
 * The single UPDATE ... FROM does the authorisation and the write together.
 * Ownership, company membership and existence are all conditions of the
 * same statement, so there is no window between checking and acting, and
 * zero rows affected means one of them failed. That is why the 404 message
 * is deliberately vague about which.
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
 *
 * Purpose:
 * Restores a disabled account — a seasonal worker returning, or an
 * accidental deactivation being undone.
 *
 * Parameters:
 * req - Express request. Params: userId.
 * res - Express response
 *
 * Returns:
 * 200 { success, message, user }
 * 400 invalid id
 * 404 no such user in this company
 *
 * Side effects:
 * Sets status back to active.
 *
 * Business rules:
 * - Restores access only. The user's roles are untouched, so re-enabling
 *   someone cannot quietly change what they are permitted to do.
 * - token_version is NOT decremented, and could not sensibly be. The
 *   sessions invalidated by the disable stay invalid; the user signs in
 *   again and receives a token carrying the current generation.
 * - No owner exclusion, unlike disable — the owner can never be inactive
 *   in the first place, so there is nothing to guard against.
 *
 * Security:
 * Same single-statement pattern as disable: the company_users join scopes
 * the write to the caller's tenant, so an administrator cannot reactivate
 * an account in another company.
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
 *
 * Purpose:
 * Starts account recovery. Generates a reset token, stores its hash against
 * the user, and emails the raw token as a link.
 *
 * Parameters:
 * req - Express request. Body: email.
 * res - Express response
 *
 * Returns:
 * 200 with the same message in every case where the email is well-formed.
 * 400 only when the email is missing or malformed — a shape check, which
 *     reveals nothing about who is registered.
 *
 * Side effects:
 * For an existing user: writes reset_token and reset_token_expires, then
 * sends mail. For an unknown address: nothing at all, silently.
 *
 * Security:
 * The whole handler is built around not leaking account existence. Four
 * things have to hold together for that:
 *
 *   1. The same 200 and the same message either way.
 *   2. Mail failures are swallowed rather than surfaced.
 *   3. The send is not awaited, so a slow or failing SMTP server does not
 *      make the "account exists" path measurably slower.
 *   4. Only the SHA-256 hash of the token is stored, so reading the users
 *      table does not yield usable reset links.
 *
 * Any change that returns a 404 for an unknown address, or reports that the
 * email could not be sent, undoes all of it.
 *
 * Note:
 * Requesting a reset overwrites any previous outstanding token for that
 * user, so the most recent link is the only working one.
 *
 * Frontend:
 * ForgotPasswordPage.jsx via authService.forgotPassword.
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

  /*
   * Declared outside the branch so the send below can see it. Stays
   * undefined for an unknown address, which is what the `user && rawToken`
   * guard keys off.
   */
  let rawToken;

  // Only do any work at all if the account exists. The response is
  // identical either way, so an attacker cannot tell this branch was taken.
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
 *
 * Purpose:
 * Completes account recovery. The token from the emailed link stands in for
 * authentication — the caller has no session yet.
 *
 * Parameters:
 * req - Express request. Body: token (the raw value from the link),
 *       new_password.
 * res - Express response
 *
 * Returns:
 * 200 on success
 * 400 when the token is missing, unknown, expired or already used, or the
 *     new password fails validation
 *
 * Side effects:
 * Replaces password_hash, clears the reset token, bumps token_version, and
 * resets the failed-login counters.
 *
 * Business rules:
 * - Single use. Clearing reset_token in the same statement means the link
 *   cannot be replayed, including from a browser back button.
 * - Expiry is enforced in SQL, so a token past its window matches nothing.
 * - The lockout counters are cleared, because a user who has just proved
 *   control of their mailbox should not still be locked out by earlier
 *   failed attempts.
 *
 * Security:
 * The incoming token is hashed and compared against the stored digest —
 * the raw value is never in the database, so it cannot be read out of it.
 *
 * The UPDATE is the authorisation: matching the hash and being unexpired
 * are conditions of the write itself, leaving no gap between checking the
 * token and using it. Zero rows means one of them failed, and the message
 * deliberately does not say which.
 *
 * Bumping token_version signs out every existing session. That is the point
 * — if the reset was prompted by a compromise, the attacker's session dies
 * here.
 *
 * Notes:
 * The new password is hashed before the UPDATE runs, so a request with a
 * bad token still pays bcrypt's cost. Slightly wasteful, and it means the
 * timing does not distinguish a valid token from an invalid one — which on
 * balance is the more useful property.
 *
 * Frontend:
 * ResetPasswordPage.jsx, which reads the token from the link's query string.
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

  /*
   * Hash the submitted token the same way createPasswordResetToken did, so
   * the comparison happens between digests. The raw token exists only in
   * the user's email and in this request.
   */
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
 *
 * Purpose:
 * Lets a signed-in user change their own password, having proved they know
 * the current one.
 *
 * Parameters:
 * req - Express request, after authMiddleware. Body: current_password,
 *       new_password.
 * res - Express response
 *
 * Returns:
 * 200 on success, with a fresh token so the caller stays signed in
 * 400 missing fields, weak new password, unchanged password, or an
 *     incorrect current password
 * 404 the authenticated user no longer exists
 *
 * Side effects:
 * Replaces password_hash, clears any outstanding reset token, and bumps
 * token_version.
 *
 * Business rules:
 * - The current password is required despite the caller already being
 *   authenticated. That is what stops an unattended session or a stolen
 *   token from being converted into permanent ownership of the account.
 * - The new password must differ from the old one.
 * - Any outstanding reset token is cleared: someone who has just
 *   demonstrated they know their password should not leave a live recovery
 *   link outstanding.
 *
 * Security:
 * Acts only on the authenticated user — there is no id in the body, so this
 * cannot be aimed at another account.
 *
 * token_version is bumped, which signs out every other device. The caller
 * is then issued a replacement token so their own session survives; that
 * asymmetry is the intended behaviour of "change my password and sign
 * everyone else out".
 *
 * Both password fields are in the redaction list in utils/activityLog.js,
 * so neither reaches the audit trail or the request log.
 *
 * Notes:
 * The mismatch on current_password returns 400 rather than 401. The request
 * is authenticated — it is the supplied field that is wrong — and a 401
 * would make the frontend's interceptor log the user out.
 *
 * Frontend:
 * SettingsPage.jsx via authService.changePassword.
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