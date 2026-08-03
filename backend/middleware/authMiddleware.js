/*
|--------------------------------------------------------------------------
| Authentication middleware
|--------------------------------------------------------------------------
|
| Establishes WHO the caller is. Deciding what they may do is
| roleMiddleware's job, and the two are always used in that order.
|
| Mounted once per route group in server.js. Route files must not apply it
| again — doing so verifies the token and re-runs the query below twice per
| request, which is exactly what dailyUpdateApproval.routes.js used to do.
|
| The flow, and why it is not just jwt.verify:
|
|   1. Read the Bearer token from the Authorization header.
|   2. Verify the signature and expiry. This proves the token was issued by
|      this server and has not been tampered with.
|   3. Load the user, their company membership and the company from the
|      database — on every request.
|   4. Check the token generation, the account status and the membership.
|   5. Rebuild req.user from what the database says, not from the token.
|
| Step 3 costs a query per request, and it is the point of the design. A
| JWT is a snapshot of the moment it was signed; it says nothing about what
| has happened in the seven days since. Without this lookup, demoting an
| admin, disabling an account or removing someone from a company would have
| no effect until their token expired.
|
| Step 5 matters for the same reason: reading `role` or `company_id` from
| the token would mean acting on values that may since have changed. The
| token is used for one thing only — the user id — and everything else is
| re-read.
|
| Failure codes are deliberate. 401 means "we do not know who you are, sign
| in again" and the frontend's axios interceptor clears storage and
| redirects on it. 403 means "we know exactly who you are and the answer is
| still no", which must not trigger that redirect — an inactive account
| would otherwise land in a sign-in loop.
|
*/

const jwt = require("jsonwebtoken");

const pool = require("../database/pool");

const {
  JWT_SECRET,
} = require("../config/env");

/**
 * Reads a Bearer token from the Authorization header.
 *
 * Expects `Authorization: Bearer <token>`. Split on one-or-more whitespace
 * rather than a single space, so an extra space does not produce a
 * confusing 401. The scheme is compared case-insensitively because the
 * standard treats it that way.
 *
 * Returns null rather than throwing for anything malformed, leaving the
 * caller to answer with a single consistent message.
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

    /*
     * The only claim trusted from the token.
     *
     * Coerced and range-checked before it reaches the query: a signed
     * token with a non-numeric id would otherwise be passed to Postgres as
     * a parameter and produce a 22P02 rather than a clean 401.
     */
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

    /*
     * The per-request refresh.
     *
     * Both joins are LEFT joins so a user with no company membership still
     * returns a row — that case is answered with a specific 403 below
     * rather than the "user no longer exists" 401 an INNER join would give.
     *
     * ORDER BY cu.id ASC with LIMIT 1 picks the oldest membership. A user
     * belongs to one company today; this makes the choice deterministic if
     * that ever changes, rather than depending on Postgres row order.
     *
     * cu.role is aliased to company_role because u.role is also selected
     * and the two would otherwise collide. Every other query in the
     * codebase uses the same alias — notification.service.js selected
     * cu.company_role directly for a while, and silently returned nobody.
     */
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

    /*
     * A disabled account. 403 rather than 401 — the credentials were
     * valid, so signing in again will not help, and the frontend must not
     * bounce them to the login screen over it.
     */
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

    /*
     * No company membership. Every table in this system is scoped by
     * company_id, so a user without one has nothing they could read or
     * write and would otherwise hit confusing failures deeper in.
     */
    if (!user.company_id) {
      return res.status(403).json({
        success: false,
        message:
          "Your account is not linked to a company.",
      });
    }

    /*
     * The membership points at a company row that is gone — a deleted
     * company whose company_users rows outlived it. Distinguished from the
     * case above so the message is accurate.
     */
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
    /*
     * Only reached if the database query itself fails — every
     * authentication outcome above returns its own response. Forwarded to
     * the global error handler so a connection failure is reported as a
     * 503 rather than being mistaken for a rejected credential.
     */
    return next(error);
  }
};

module.exports =
  authMiddleware;