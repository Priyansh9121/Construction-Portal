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

const requireAuthentication = [
  authMiddleware,
];

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
 */
router.post(
  "/register",
  asyncHandler(
    authController.register
  )
);

/**
 * POST /api/auth/login
 */
router.post(
  "/login",
  asyncHandler(
    authController.login
  )
);

/**
 * POST /api/auth/forgot-password
 */
router.post(
  "/forgot-password",
  asyncHandler(
    authController.forgotPassword
  )
);

/**
 * POST /api/auth/reset-password
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