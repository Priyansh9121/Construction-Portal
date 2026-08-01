const rateLimit = require("express-rate-limit");

const {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_MAX,
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
  windowMs: 60 * 60 * 1000,
  limit: 5,

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
