/*
|--------------------------------------------------------------------------
| Request logging
|--------------------------------------------------------------------------
|
| Structured request/response logging, mounted once in server.js after body
| parsing and before any route. Logs go to stdout as objects rather than
| formatted strings, so Render's log viewer keeps them searchable by field.
|
| Every request is given an id which is:
|
|   * attached to the request as req.requestId, so handlers and the error
|     handler can quote it;
|   * returned in the X-Request-Id response header, so a user reporting a
|     failure can hand over something that finds the exact log line;
|   * carried on the completion log for the same request.
|
| An inbound X-Request-Id is honoured when present, which lets a trace
| survive a proxy or a retry.
|
| Nothing here reads the request body. Only the query string is logged, and
| the sensitive keys below are redacted first — a password sent as a query
| parameter would otherwise be written to disk in clear text.
|
*/

const crypto = require("crypto");

const {
  NODE_ENV,
} = require("../config/env");

/*
 * Development gets a line when a request *starts* as well as when it
 * finishes, which makes a hung request obvious. In production only the
 * completion line is written, halving the log volume.
 */
const isDevelopment =
  NODE_ENV === "development";

/**
 * Query-string keys whose values are replaced with [REDACTED].
 *
 * Compared lowercase, so ?Token= and ?TOKEN= are caught as well. This is
 * the same idea as the REDACTED_KEYS list in utils/activityLog.js, kept
 * separate because that one walks a database row rather than a query.
 */
const SENSITIVE_QUERY_KEYS =
  new Set([
    "password",
    "current_password",
    "new_password",
    "confirm_password",
    "token",
    "reset_token",
    "authorization",
    "secret",
    "api_key",
    "service_role_key",
  ]);

/**
 * Accepts an inbound request id only if it is a non-empty string, and caps
 * it at 100 characters.
 *
 * The value comes from a client header, so it is untrusted: without the cap
 * a caller could push an arbitrarily long string into every log line for
 * their request.
 */
const cleanRequestId = (
  value
) => {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    return null;
  }

  return value
    .trim()
    .slice(0, 100);
};

/**
 * The id for this request: whatever the caller supplied, or a fresh UUID.
 *
 * Honouring an inbound id means a trace started by a proxy or another
 * service continues through this one instead of restarting.
 */
const createRequestId = (
  req
) =>
  cleanRequestId(
    req.headers[
      "x-request-id"
    ]
  ) ||
  crypto.randomUUID();

/**
 * Reduces the query string to something safe and bounded to log.
 *
 * Four rules, in order:
 *
 *   1. a key on the sensitive list has its value replaced outright;
 *   2. an array is capped at 20 entries, each truncated to 200 characters;
 *   3. a nested object becomes "[OBJECT]" rather than being serialised,
 *      since Express's query parser will happily build one from
 *      ?a[b][c]=1 and there is no useful bound on its depth;
 *   4. anything else is stringified and truncated to 200 characters.
 *
 * The caps matter: the query string is entirely under the caller's control,
 * so without them a single request could write megabytes to the log.
 */
const sanitiseQuery = (
  query
) => {
  if (
    !query ||
    typeof query !==
      "object"
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(query).map(
      ([key, value]) => {
        const normalisedKey =
          key.toLowerCase();

        if (
          SENSITIVE_QUERY_KEYS.has(
            normalisedKey
          )
        ) {
          return [
            key,
            "[REDACTED]",
          ];
        }

        if (
          Array.isArray(value)
        ) {
          return [
            key,
            value
              .slice(0, 20)
              .map((item) =>
                String(
                  item
                ).slice(
                  0,
                  200
                )
              ),
          ];
        }

        if (
          value &&
          typeof value ===
            "object"
        ) {
          return [
            key,
            "[OBJECT]",
          ];
        }

        return [
          key,
          String(
            value ?? ""
          ).slice(0, 200),
        ];
      }
    )
  );
};

/**
 * The caller's IP address.
 *
 * Behind Render's load balancer the socket address is the balancer, so the
 * first entry of X-Forwarded-For is used instead — that header is a
 * comma-separated chain, oldest first, and the leftmost entry is the
 * original client.
 *
 * That header is forgeable by anyone talking to the server directly, which
 * is why server.js sets `trust proxy` in production only. This value is for
 * logs; the rate limiter does its own trusted resolution.
 */
const getClientIp = (
  req
) => {
  const forwardedFor =
    req.headers[
      "x-forwarded-for"
    ];

  if (
    typeof forwardedFor ===
    "string"
  ) {
    return forwardedFor
      .split(",")[0]
      .trim();
  }

  return (
    req.ip ||
    req.socket
      ?.remoteAddress ||
    null
  );
};

/**
 * Milliseconds elapsed since the BigInt timestamp taken at request start.
 *
 * process.hrtime.bigint() is a monotonic clock in nanoseconds, so unlike
 * Date.now() it cannot go backwards if the system clock is adjusted
 * mid-request.
 *
 * The division happens in BigInt arithmetic and therefore truncates —
 * durations are whole milliseconds, and anything under 1 ms logs as 0.
 * Number() is applied after dividing because a nanosecond count can exceed
 * the safe integer range.
 */
const getDurationMs = (
  startedAt
) => {
  const elapsed =
    process.hrtime.bigint() -
    startedAt;

  return Number(
    elapsed /
      1_000_000n
  );
};

/**
 * The middleware itself.
 *
 * Registers two listeners and returns immediately — the logging happens
 * when the response settles, so nothing here delays the handler.
 *
 *   res "finish"  the response was sent. Severity follows the status code:
 *                 5xx to console.error, 4xx to console.warn, the rest to
 *                 console.info. This is what makes failures greppable.
 *
 *   res "close"   the connection ended. Fires on every request, including
 *                 the ones that finished normally, so it checks
 *                 res.writableEnded and only logs when the client hung up
 *                 early — an aborted upload, or a user closing the tab
 *                 mid-request.
 *
 * req.user is read inside the listeners rather than up front, because
 * authMiddleware runs after this and will have populated it by the time the
 * response settles. That is what puts userId, companyId and role on the
 * completion line.
 */
const requestLogger = (
  req,
  res,
  next
) => {
  const startedAt =
    process.hrtime.bigint();

  const requestId =
    createRequestId(req);

  req.requestId =
    requestId;

  res.setHeader(
    "X-Request-Id",
    requestId
  );

  const requestContext = {
    requestId,
    method: req.method,
    path: req.originalUrl,
    query:
      sanitiseQuery(
        req.query
      ),
    ip: getClientIp(req),
    userAgent:
      req.headers[
        "user-agent"
      ] || null,
  };

  if (isDevelopment) {
    console.info(
      "Request started:",
      requestContext
    );
  }

  res.on(
    "finish",
    () => {
      const durationMs =
        getDurationMs(
          startedAt
        );

      const responseLog = {
        timestamp:
          new Date()
            .toISOString(),

        requestId,

        method:
          req.method,

        path:
          req.originalUrl,

        statusCode:
          res.statusCode,

        durationMs,

        contentLength:
          res.getHeader(
            "content-length"
          ) || null,

        userId:
          req.user?.id ||
          null,

        companyId:
          req.user
            ?.company_id ||
          null,

        role:
          req.user?.role ||
          null,

        ip:
          getClientIp(req),
      };

      if (
        res.statusCode >=
        500
      ) {
        console.error(
          "Request completed with server error:",
          responseLog
        );

        return;
      }

      if (
        res.statusCode >=
        400
      ) {
        console.warn(
          "Request completed with client error:",
          responseLog
        );

        return;
      }

      console.info(
        "Request completed:",
        responseLog
      );
    }
  );

  res.on(
    "close",
    () => {
      if (
        res.writableEnded
      ) {
        return;
      }

      console.warn(
        "Request connection closed before completion:",
        {
          timestamp:
            new Date()
              .toISOString(),

          requestId,

          method:
            req.method,

          path:
            req.originalUrl,

          durationMs:
            getDurationMs(
              startedAt
            ),

          userId:
            req.user?.id ||
            null,

          companyId:
            req.user
              ?.company_id ||
            null,
        }
      );
    }
  );

  return next();
};

module.exports =
  requestLogger;