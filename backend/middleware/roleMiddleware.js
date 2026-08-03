/*
|--------------------------------------------------------------------------
| Role middleware
|--------------------------------------------------------------------------
|
| Authorisation. authMiddleware establishes *who* the caller is; this
| decides whether that person may reach the route.
|
| A user carries two roles, and which one applies depends on the route:
|
|   users.role          their role across the product
|   company_users.role  their role within the company they are acting for,
|                       surfaced by authMiddleware as company_role
|
| The `source` option chooses between them — "user", "company", or "either",
| which passes if the role matches on one side or the other. Most routes use
| "either", because the two are the same value in practice today; keeping
| the distinction means a future membership model can diverge without
| revisiting every route.
|
| server.js mounts this at the mount point rather than per route for the
| office registers, so a route added inside one of those modules inherits
| the restriction instead of having to remember it.
|
*/

const {
  USER_ROLES,
  COMPANY_ROLES,
} = require("../config/constants");

/*
 * The recognised roles, as Sets for O(1) membership tests.
 *
 * Built from the constants rather than written out again, so adding a role
 * in one place cannot leave this list behind.
 */
const VALID_USER_ROLES = new Set(
  Object.values(USER_ROLES)
);

const VALID_COMPANY_ROLES = new Set(
  Object.values(COMPANY_ROLES)
);

/**
 * Lowercases and trims a role for comparison.
 *
 * Roles are stored as plain text rather than a PostgreSQL enum, so "Admin"
 * and "admin " are both possible in the column. Comparing normalised
 * values means a stray capital cannot silently deny someone access.
 *
 * A non-string — null for a user with no company membership — becomes "",
 * which matches no allowed role and therefore denies.
 */
const normaliseRole = (value) =>
  typeof value === "string"
    ? value.trim().toLowerCase()
    : "";

/**
 * Normalises an allowed-role argument.
 *
 * Supports:
 *
 * roleMiddleware("admin")
 *
 * roleMiddleware([
 *   "admin",
 *   "manager",
 * ])
 */
const normaliseAllowedRoles = (
  allowedRoles
) => {
  const values = Array.isArray(
    allowedRoles
  )
    ? allowedRoles
    : [allowedRoles];

  return [
    ...new Set(
      values
        .map(normaliseRole)
        .filter(Boolean)
    ),
  ];
};

/**
 * Authorises a request using either:
 *
 * - the user's account role; or
 * - their role within the current company.
 *
 * By default, either matching role grants access.
 */
const roleMiddleware = (
  allowedRoles = [],
  options = {}
) => {
  const normalisedAllowedRoles =
    normaliseAllowedRoles(
      allowedRoles
    );

  const {
    source = "either",
    requireCompanyOwner = false,
  } = options;

  const validSources = new Set([
    "user",
    "company",
    "either",
    "both",
  ]);

  if (!validSources.has(source)) {
    throw new TypeError(
      `Invalid role source: ${source}`
    );
  }

  return (
    req,
    res,
    next
  ) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication is required.",
      });
    }

    if (
      normalisedAllowedRoles.length ===
        0 &&
      !requireCompanyOwner
    ) {
      return next();
    }

    const userRole =
      normaliseRole(
        req.user.role
      );

    const companyRole =
      normaliseRole(
        req.user.company_role
      );

    const userRoleValid =
      VALID_USER_ROLES.has(
        userRole
      );

    const companyRoleValid =
      VALID_COMPANY_ROLES.has(
        companyRole
      );

    if (!userRoleValid) {
      return res.status(403).json({
        success: false,
        message:
          "Your account has an invalid role.",
      });
    }

    if (
      req.user.company_id &&
      !companyRoleValid
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your company membership has an invalid role.",
      });
    }

    if (requireCompanyOwner) {
      const userId = Number(
        req.user.id
      );

      const ownerUserId = Number(
        req.user
          .company_owner_user_id
      );

      if (
        !Number.isInteger(
          userId
        ) ||
        !Number.isInteger(
          ownerUserId
        ) ||
        userId !== ownerUserId
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Only the company owner can perform this action.",
        });
      }
    }

    if (
      normalisedAllowedRoles.length ===
      0
    ) {
      return next();
    }

    const userRoleAllowed =
      normalisedAllowedRoles.includes(
        userRole
      );

    const companyRoleAllowed =
      normalisedAllowedRoles.includes(
        companyRole
      );

    let hasAccess = false;

    switch (source) {
      case "user":
        hasAccess =
          userRoleAllowed;
        break;

      case "company":
        hasAccess =
          companyRoleAllowed;
        break;

      case "both":
        hasAccess =
          userRoleAllowed &&
          companyRoleAllowed;
        break;

      case "either":
      default:
        hasAccess =
          userRoleAllowed ||
          companyRoleAllowed;
        break;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to perform this action.",
      });
    }

    return next();
  };
};

module.exports =
  roleMiddleware;