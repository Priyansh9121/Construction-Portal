const jwt = require("jsonwebtoken");

const pool = require("../database/pool");

const {
  JWT_SECRET,
} = require("../config/env");

/**
 * Reads a Bearer token from the Authorization header.
 */
const getBearerToken = (req) => {
  const authorization =
    req.headers.authorization;

  if (
    !authorization ||
    typeof authorization !==
      "string"
  ) {
    return null;
  }

  const [
    scheme,
    token,
  ] = authorization
    .trim()
    .split(/\s+/);

  if (
    scheme?.toLowerCase() !==
      "bearer" ||
    !token
  ) {
    return null;
  }

  return token;
};

/**
 * Verifies authentication and refreshes request context
 * from the database.
 *
 * The JWT proves the token was issued by this backend.
 * The database check confirms that:
 *
 * - the user still exists;
 * - the user is still active;
 * - the user is still linked to a company;
 * - the current company role is still valid.
 */
const authMiddleware = async (
  req,
  res,
  next
) => {
  try {
    const token =
      getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token is required.",
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        JWT_SECRET
      );
    } catch (error) {
      if (
        error.name ===
        "TokenExpiredError"
      ) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "Your session has expired. Please log in again.",
          });
      }

      return res.status(401).json({
        success: false,
        message:
          "Invalid authentication token.",
      });
    }

    const userId = Number(
      decoded?.id
    );

    if (
      !Number.isInteger(
        userId
      ) ||
      userId <= 0
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authentication token.",
      });
    }

    const userResult =
      await pool.query(
        `
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.role,
          u.status,
          u.token_version,

          cu.company_id,
          cu.role AS company_role,

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

        ORDER BY cu.id ASC

        LIMIT 1
        `,
        [userId]
      );

    if (
      userResult.rows.length ===
      0
    ) {
      return res.status(401).json({
        success: false,
        message:
          "The authenticated user no longer exists.",
      });
    }

    const user =
      userResult.rows[0];

    /*
     * Token generation check.
     *
     * users.token_version is bumped whenever a password changes or an
     * account is deactivated. A token carrying an older generation is
     * rejected here, which is what makes those actions take effect
     * immediately rather than at the end of the token's 7-day life.
     *
     * Tokens issued before this field existed have no `tv` claim; those
     * are treated as generation 0 so existing sessions are not broken by
     * the upgrade itself.
     */
    if (
      Number(decoded?.tv || 0) !==
      Number(user.token_version || 0)
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Your session is no longer valid. Please sign in again.",
      });
    }

    if (
      String(
        user.status || ""
      ).toLowerCase() !==
      "active"
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

    if (!user.company_name) {
      return res.status(403).json({
        success: false,
        message:
          "Your company account is unavailable.",
      });
    }

    /*
     * Always rebuild req.user from current database values.
     *
     * Do not rely on role or company_id from the JWT because
     * those values may have changed after the token was issued.
     */
    req.user = {
      id: user.id,
      full_name:
        user.full_name,
      email: user.email,

      role: String(
        user.role || ""
      ).toLowerCase(),

      status: user.status,

      company_id:
        user.company_id,

      company_role: String(
        user.company_role ||
          user.role ||
          ""
      ).toLowerCase(),

      company_name:
        user.company_name,

      company_owner_user_id:
        user.owner_user_id,

      currency_code:
        user.currency_code ||
        "AUD",

      timezone:
        user.timezone ||
        "Australia/Melbourne",

      industry:
        user.industry || null,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports =
  authMiddleware;