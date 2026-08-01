const crypto = require("crypto");

const {
  NODE_ENV,
} = require("../config/env");

const isDevelopment =
  NODE_ENV === "development";

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

const createRequestId = (
  req
) =>
  cleanRequestId(
    req.headers[
      "x-request-id"
    ]
  ) ||
  crypto.randomUUID();

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