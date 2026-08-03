/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The URL map for everything under /api/auth: signing up, signing in,
| recovering a password, and managing the users inside a company.
|
| Unusually for this codebase, this router mixes public and protected
| endpoints. server.js therefore mounts it WITHOUT authMiddleware — the four
| public routes could not work otherwise — and each protected route applies
| its own gate from the two arrays defined below. Every other module is
| gated once at the mount instead.
|
| Endpoint summary:
|
|   Method Path                        Auth   Role   Audited
|   ------ --------------------------- -----  -----  -------
|   POST   /register                   no     —      no
|   POST   /login                      no     —      no
|   POST   /forgot-password            no     —      no
|   POST   /reset-password             no     —      no
|   GET    /me                         yes    any    no
|   PUT    /change-password            yes    any    no
|   GET    /users                      yes    admin  no
|   POST   /users                      yes    admin  create
|   PUT    /users/:userId              yes    admin  update
|   PUT    /users/:userId/disable      yes    admin  update
|   PUT    /users/:userId/enable       yes    admin  update
|
| Rate limiting:
|   server.js puts authLimiter in front of this whole router — a much
|   tighter budget than the rest of the API, because login runs bcrypt at
|   cost 12 and is otherwise an unauthenticated way to burn CPU as well as
|   to guess passwords.
|
| Exports:
|   an Express router
|
| Used by:
|   backend/server.js, mounted at /api/auth
|
| Depends on:
|   ./auth.controller.js   every handler
|   middleware/authMiddleware.js, roleMiddleware.js
|   utils/asyncHandler.js  so a rejected controller reaches errorHandler
|   utils/activityLog.js   audit middleware on the mutating user routes
|
| Frontend consumers:
|   frontend/src/services/authService.js and userService.js, and through
|   them LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage,
|   SettingsPage, UsersPage and AuthProvider.
|
| Note:
|   The four credential endpoints are deliberately NOT audited. An activity
|   row for a login attempt would be written before anyone is authenticated,
|   with no company to scope it to — and a failed login is a security event
|   for the log, not a business event for the audit trail.
|
*/

const express = require("express");

const authMiddleware = require(
  "../../middleware/authMiddleware"
);

const roleMiddleware = require(
  "../../middleware/roleMiddleware"
);

const asyncHandler = require(
  "../../utils/asyncHandler"
);

const authController = require(
  "./auth.controller"
);

const {
  logActivity,
  ACTIVITY_ACTIONS,
} = require("../../utils/activityLog");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Reusable access middleware
|--------------------------------------------------------------------------
|
| auth.routes.js contains both public and protected routes, so
| authentication must remain inside this route file.
|
| Grouping the middleware removes repeated declarations from every
| user-management endpoint.
|
*/

/**
 * A valid token, any role. Spread into a route with `...`.
 *
 * A one-element array rather than the bare middleware so both gates are
 * applied the same way at the call sites, and so adding a second step later
 * does not mean rewriting every route that uses it.
 */
const requireAuthentication = [
  authMiddleware,
];

/**
 * A valid token belonging to an administrator.
 *
 * Order is not optional: authMiddleware must run first, because
 * roleMiddleware reads the role off req.user, which does not exist until
 * the token has been verified.
 *
 * `source: "either"` accepts admin from users.role or from
 * company_users.role — see roleMiddleware.js.
 *
 * This is the coarse gate. The controller applies a second, finer check on
 * top: creating or promoting an administrator additionally requires being
 * the company owner, so one admin cannot mint another without that
 * standing.
 */
const requireAdministrator = [
  authMiddleware,

  roleMiddleware(
    ["admin"],
    {
      source: "either",
    }
  ),
];

/*
|--------------------------------------------------------------------------
| Public authentication routes
|--------------------------------------------------------------------------
*/

/**
 * POST /api/auth/register
 *
 * Creates:
 *
 * - company
 * - company owner/admin account
 * - company_users membership
 *
 * Auth:       none — this is how a tenant comes into existence
 * Roles:      none
 * Body:       full_name, email, password, company_name
 * Validation: in the controller — email format and uniqueness, password
 *             strength, required fields
 * Controller: auth.controller.register
 * Response:   201 { success, token, user } — the caller is signed in
 *             immediately, so registration does not end at a login screen
 *             400 validation failed
 *             409 the email is already registered
 *
 * Business rule:
 * All three rows are written in one transaction. A company without an
 * owner, or an owner without a membership, would be unreachable.
 *
 * Security:
 * Self-service and unauthenticated, so anyone may create a tenant. That is
 * the intended product behaviour; the isolation that keeps tenants apart is
 * enforced on every other endpoint by getCompanyId.
 */
router.post(
  "/register",
  asyncHandler(
    authController.register
  )
);

/**
 * POST /api/auth/login
 *
 * Auth:       none
 * Roles:      none
 * Body:       email, password
 * Controller: auth.controller.login
 * Response:   200 { success, token, user }
 *             401 on bad credentials or a disabled account
 *
 * Security:
 * The 401 is deliberately identical whether the email is unknown, the
 * password is wrong, or the account is disabled — otherwise the response
 * becomes an oracle for which addresses are registered.
 *
 * The signed token carries the user id, company id and role; authMiddleware
 * trusts those on every later request, which is why JWT_SECRET is gated so
 * firmly in config/env.js.
 *
 * Performance:
 * bcrypt at cost 12 makes this endpoint intentionally slow — a few hundred
 * milliseconds. That is the defence against offline cracking, and the
 * reason authLimiter sits in front of it.
 */
router.post(
  "/login",
  asyncHandler(
    authController.login
  )
);

/**
 * POST /api/auth/forgot-password
 *
 * Auth:       none
 * Roles:      none
 * Body:       email
 * Controller: auth.controller.forgotPassword
 * Response:   200 always, with the same message whether or not the address
 *             is registered
 *
 * Side effects:
 * Stores a reset token and its expiry on the user, then emails the link via
 * config/mailer.js. Without SMTP configured the link is logged to the
 * console instead.
 *
 * Security:
 * The invariant response is the point: any difference — a 404, a different
 * message, even a noticeably faster reply — would let an attacker enumerate
 * registered addresses. A mail-send failure is likewise swallowed rather
 * than surfaced, for the same reason.
 */
router.post(
  "/forgot-password",
  asyncHandler(
    authController.forgotPassword
  )
);

/**
 * POST /api/auth/reset-password
 *
 * Auth:       none — the token in the body IS the authentication
 * Roles:      none
 * Body:       token, new_password
 * Controller: auth.controller.resetPassword
 * Response:   200 on success
 *             400 when the token is missing, unknown, expired or already
 *                 used, or the new password is too weak
 *
 * Side effects:
 * Replaces the password hash and clears reset_token and
 * reset_token_expires, which makes the token single-use.
 *
 * Security:
 * Possession of a valid token is full account takeover, which is why it is
 * short-lived (RESET_TOKEN_TTL_MINUTES), cleared on use, and never logged —
 * utils/activityLog.js has reset_token in its redaction list.
 *
 * Frontend:
 * ResetPasswordPage.jsx reads the token from the query string of the emailed
 * link and posts it here with the new password.
 */
router.post(
  "/reset-password",
  asyncHandler(
    authController.resetPassword
  )
);

/*
|--------------------------------------------------------------------------
| Authenticated account routes
|--------------------------------------------------------------------------
*/

/**
 * GET /api/auth/me
 *
 * Returns the current user and company context.
 *
 * Auth:       required, any role
 * Controller: auth.controller.getCurrentUser
 * Response:   200 { success, user } including company id, name and role
 *             401 when the token is missing, malformed or expired
 *
 * Purpose:
 * The frontend's session-restore call. A token in localStorage survives a
 * page reload, but the user record does not — AuthProvider.jsx calls this
 * on mount to rehydrate the session, and treats a 401 as "log out".
 *
 * Because it re-reads the user from the database rather than trusting the
 * token's claims, a role change or a disabled account takes effect on the
 * next reload without waiting for the token to expire.
 */
router.get(
  "/me",
  ...requireAuthentication,
  asyncHandler(
    authController.getCurrentUser
  )
);

/**
 * PUT /api/auth/change-password
 *
 * PUT is retained because the current frontend already uses this route.
 *
 * Auth:       required, any role
 * Body:       current_password, new_password
 * Controller: auth.controller.changePassword
 * Response:   200 on success
 *             400 when the new password is too weak
 *             401 when the current password does not match
 *
 * Business rule:
 * The current password is required even though the caller is already
 * authenticated. That is what stops an unattended logged-in session, or a
 * stolen token, from being turned into permanent ownership of the account.
 *
 * Security:
 * Acts only on the authenticated user — there is no user id in the body, so
 * this endpoint cannot be aimed at somebody else. Both passwords are in the
 * redaction list, so neither reaches the audit trail or the request log.
 *
 * Frontend: SettingsPage.jsx.
 */
router.put(
  "/change-password",
  ...requireAuthentication,
  asyncHandler(
    authController.changePassword
  )
);

/*
|--------------------------------------------------------------------------
| Company user management
|--------------------------------------------------------------------------
|
| These routes are administrator-only.
|
| The controller performs additional company-owner checks when someone
| attempts to create or grant administrator access.
|
*/

/**
 * GET /api/auth/users
 *
 * Auth:       required
 * Roles:      admin
 * Controller: auth.controller.getUsers
 * Response:   200 { success, users } for the caller's company only
 *
 * Security:
 * Scoped to the authenticated company, so an admin of one tenant cannot
 * list another's staff. Password hashes and reset tokens are excluded by
 * the controller's column list rather than filtered afterwards.
 *
 * Frontend: UsersPage.jsx.
 */
router.get(
  "/users",
  ...requireAdministrator,
  asyncHandler(
    authController.getUsers
  )
);

/**
 * POST /api/auth/users
 *
 * Preferred REST endpoint for creating a company user.
 *
 * Auth:       required
 * Roles:      admin, plus a company-owner check inside the controller when
 *             the new user is to be an admin
 * Body:       full_name, email, role, and optionally password
 * Controller: auth.controller.createUser
 * Audited:    yes — logActivity("users", CREATE)
 * Response:   201 { success, user }
 *             400 validation failed
 *             403 a non-owner admin attempting to create an admin
 *             409 the email already exists
 *
 * Business rules:
 * - The new user joins the creating admin's company; company_id is never
 *   read from the body.
 * - Creating an administrator additionally requires being the company
 *   owner, so admin rights cannot be propagated sideways.
 * - When no password is supplied the account is created with a reset token
 *   and an invite email, so the office never handles a plaintext password.
 *
 * Frontend: UsersPage.jsx.
 */
router.post(
  "/users",
  ...requireAdministrator,
  logActivity(
    "users",
    ACTIVITY_ACTIONS.CREATE
  ),
  asyncHandler(
    authController.createUser
  )
);

/**
 * PUT /api/auth/users/:userId
 *
 * Auth:       required
 * Roles:      admin, plus the owner check when granting admin
 * Params:     :userId must belong to the caller's company
 * Body:       the editable profile fields and role
 * Controller: auth.controller.updateUser
 * Audited:    yes — logActivity("users", UPDATE)
 * Response:   200 { success, user }
 *             403 a non-owner admin attempting to promote to admin
 *             404 no such user in this company
 *
 * Security:
 * This endpoint changes another account's role, so it is the main
 * privilege-escalation surface in the product. Two things contain it: the
 * target must be in the caller's company, and promotion to admin requires
 * company ownership.
 *
 * The password hash is not editable here — changing a password goes through
 * change-password or the reset flow.
 */
router.put(
  "/users/:userId",
  ...requireAdministrator,
  logActivity(
    "users",
    ACTIVITY_ACTIONS.UPDATE
  ),
  asyncHandler(
    authController.updateUser
  )
);

/**
 * PUT /api/auth/users/:userId/disable
 *
 * PUT is retained for compatibility with the current frontend service.
 *
 * Auth:       required
 * Roles:      admin
 * Params:     :userId, within the caller's company
 * Controller: auth.controller.disableUser
 * Audited:    yes — logActivity("users", UPDATE)
 * Response:   200 on success
 *             400 when an admin tries to disable themselves
 *             404 no such user in this company
 *
 * Business rule:
 * Sets status to disabled rather than deleting the row. Users are
 * referenced as created_by, approved_by and requested_by across the
 * schema, so removing one would break the history that references them.
 * Login checks status, so a disabled account cannot sign in — though an
 * already-issued token keeps working until it expires.
 *
 * Self-disabling is refused; it would be an unrecoverable lockout for a
 * sole admin.
 */
router.put(
  "/users/:userId/disable",
  ...requireAdministrator,
  logActivity(
    "users",
    ACTIVITY_ACTIONS.UPDATE
  ),
  asyncHandler(
    authController.disableUser
  )
);

/**
 * PUT /api/auth/users/:userId/enable
 *
 * Auth:       required
 * Roles:      admin
 * Params:     :userId, within the caller's company
 * Controller: auth.controller.enableUser
 * Audited:    yes — logActivity("users", UPDATE)
 * Response:   200 on success
 *             404 no such user in this company
 *
 * The inverse of disable: sets status back to active so the account can
 * sign in again. Kept as a separate endpoint from the general update so
 * that reactivating someone is a distinct, individually auditable act
 * rather than an incidental field change.
 */
router.put(
  "/users/:userId/enable",
  ...requireAdministrator,
  logActivity(
    "users",
    ACTIVITY_ACTIONS.UPDATE
  ),
  asyncHandler(
    authController.enableUser
  )
);

module.exports = router;