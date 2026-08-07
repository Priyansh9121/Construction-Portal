/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The two rate limiters, mounted in server.js.
|
| Responsibilities:
|   - apiLimiter   a generous ceiling across the whole API
|   - authLimiter  a tight limit on the credential endpoints
|
| Exports:
|   { apiLimiter, authLimiter }
|
| Used by:
|   backend/server.js — apiLimiter on /api, authLimiter in front of
|   /api/auth
|
| Depends on:
|   express-rate-limit
|   config/env.js — RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX,
|                   AUTH_RATE_LIMIT_MAX, IS_TEST
|
| Database tables touched:
|   none. Counters are held in memory.
|
| Security:
|   authLimiter is the important one. Login verifies with bcrypt at cost
|   12, which is expensive by design — without a limit that same property
|   turns an unauthenticated endpoint into a cheap way to saturate the CPU,
|   quite apart from letting an attacker try passwords indefinitely.
|
|   Counting is per IP, which depends on server.js setting `trust proxy` in
|   production. Without that every request behind the load balancer appears
|   to come from one address, and the first user to trip the limit locks
|   out everybody.
|
| Note:
|   In-memory counters mean the limit is PER PROCESS. Scaled to several
|   instances, the effective ceiling is the configured value multiplied by
|   the instance count, and a restart clears the counters. A shared store
|   would be needed for a strict global limit; for blunting abuse this is
|   adequate.
|
|   Limits are disabled under IS_TEST so the integration suite is not
|   throttled by its own fixtures.
|
*/

const rateLimit = require("express-rate-limit");

const {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_MAX,
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
  PASSWORD_RESET_RATE_LIMIT_MAX,
  IS_TEST,
} = require("../config/env");

/*
|--------------------------------------------------------------------------
| Rate limiting
|--------------------------------------------------------------------------
|
| Two tiers:
|
|   apiLimiter    a generous ceiling across the whole API, there to blunt
|                 scraping and runaway clients.
|
|   authLimiter   a deliberately tight limit on the credential endpoints.
|                 Login verifies with bcrypt at cost 12, which is expensive
|                 by design; without a limit that same property turns an
|                 unauthenticated endpoint into a cheap way to saturate the
|                 CPU, quite apart from letting an attacker try passwords
|                 indefinitely.
|
| Counting is per IP. server.js sets `trust proxy` in production so the
| client address is read from X-Forwarded-For rather than the load balancer.
|
*/

/**
 * Shared JSON error shape, matching the rest of the API.
 */
const buildHandler = (message) => (
  req,
  res
) =>
  res.status(429).json({
    success: false,
    message,
    request_id:
      req.requestId || null,
  });

/**
 * Skip limiting entirely under test, so suites are not throttled.
 */
const skip = () => IS_TEST;

const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX,

  standardHeaders: "draft-7",
  legacyHeaders: false,

  skip,

  handler: buildHandler(
    "Too many requests. Please slow down and try again shortly."
  ),
});

const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: AUTH_RATE_LIMIT_MAX,

  standardHeaders: "draft-7",
  legacyHeaders: false,

  // A successful login should not consume an attempt, so a legitimate user
  // is never locked out by their own activity.
  skipSuccessfulRequests: true,

  skip,

  handler: buildHandler(
    "Too many attempts. Please wait a few minutes before trying again."
  ),
});

/**
 * Tighter still for password reset requests, which send email and are a
 * favourite target for enumeration and mail-bombing.
 */
const passwordResetLimiter = rateLimit({
  /*
   * Defaults are 60 minutes and 5 requests, which is exactly what these were
   * when hard-coded here. They became configurable ONLY so a local end-to-end
   * run can exercise the recovery flow more than five times an hour; with the
   * variables absent, production behaviour is byte-for-byte what it was.
   *
   * The limiter is never skipped and there is no IP bypass. See
   * config/env.js for the validation policy applied to both values.
   */
  windowMs: PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
  limit: PASSWORD_RESET_RATE_LIMIT_MAX,

  standardHeaders: "draft-7",
  legacyHeaders: false,

  skip,

  handler: buildHandler(
    "Too many password reset requests. Please try again in an hour."
  ),
});

module.exports = {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
};
