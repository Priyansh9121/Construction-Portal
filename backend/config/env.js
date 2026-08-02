const path = require("path");
const dotenv = require("dotenv");

/*
|--------------------------------------------------------------------------
| Load backend/.env consistently
|--------------------------------------------------------------------------
|
| This works regardless of whether the command is run from:
|
| backend/
| backend/database/
| the project root
|
*/
dotenv.config({
  path: path.resolve(
    __dirname,
    "../.env"
  ),
});

const VALID_NODE_ENVIRONMENTS =
  new Set([
    "development",
    "test",
    "production",
  ]);

const cleanString = (
  value,
  fallback = ""
) => {
  if (
    typeof value !==
    "string"
  ) {
    return fallback;
  }

  const cleaned =
    value.trim();

  return cleaned || fallback;
};

const parseInteger = (
  value,
  fallback,
  {
    minimum = Number.MIN_SAFE_INTEGER,
    maximum = Number.MAX_SAFE_INTEGER,
  } = {}
) => {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    return fallback;
  }

  return parsed;
};

const parseBoolean = (
  value,
  fallback = false
) => {
  if (
    typeof value !==
    "string"
  ) {
    return fallback;
  }

  const normalised =
    value.trim().toLowerCase();

  if (
    ["true", "1", "yes", "on"].includes(
      normalised
    )
  ) {
    return true;
  }

  if (
    ["false", "0", "no", "off"].includes(
      normalised
    )
  ) {
    return false;
  }

  return fallback;
};

const parseList = (
  value,
  fallback = []
) => {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    return [...fallback];
  }

  return [
    ...new Set(
      value
        .split(",")
        .map((item) =>
          item.trim()
        )
        .filter(Boolean)
    ),
  ];
};

const requireEnvironmentValue = (
  name
) => {
  const value =
    cleanString(
      process.env[name]
    );

  if (!value) {
    throw new Error(
      `${name} is required`
    );
  }

  return value;
};

const NODE_ENV =
  cleanString(
    process.env.NODE_ENV,
    "development"
  ).toLowerCase();

if (
  !VALID_NODE_ENVIRONMENTS.has(
    NODE_ENV
  )
) {
  throw new Error(
    `Invalid NODE_ENV: ${NODE_ENV}`
  );
}

const IS_PRODUCTION =
  NODE_ENV === "production";

const IS_DEVELOPMENT =
  NODE_ENV === "development";

const IS_TEST =
  NODE_ENV === "test";

const PORT = parseInteger(
  process.env.PORT,
  5051,
  {
    minimum: 1,
    maximum: 65535,
  }
);

const DATABASE_URL =
  requireEnvironmentValue(
    "DATABASE_URL"
  );

const developmentJwtSecret =
  "construction-portal-development-secret-change-before-production";

const JWT_SECRET =
  cleanString(
    process.env.JWT_SECRET,
    IS_PRODUCTION
      ? ""
      : developmentJwtSecret
  );

/**
 * Builds an actionable message for a missing or weak production secret.
 *
 * A deploy that dies on "JWT_SECRET is required" tells you what is wrong
 * but not what to do, which is a poor experience at exactly the moment
 * someone is under pressure. This spells out the fix.
 *
 * The "injected env (0)" line dotenv prints just above is the useful clue:
 * it means no variables reached the process at all, which on a hosted
 * platform means they were never configured in its dashboard. .env is
 * deliberately not committed, so the platform is the only source.
 */
const missingSecretMessage = (
  reason
) =>
  [
    "",
    "──────────────────────────────────────────────────────────────",
    ` Cannot start: ${reason}`,
    "──────────────────────────────────────────────────────────────",
    "",
    " The .env file is intentionally not committed, so a hosted",
    " deployment gets its configuration from the platform, not the",
    " repository.",
    "",
    " Fix — set these in your host's environment settings:",
    "   (Render: Dashboard -> your service -> Environment)",
    "",
    "   JWT_SECRET      at least 32 characters, generate with:",
    "                   openssl rand -base64 48",
    "   DATABASE_URL    your PostgreSQL connection string",
    "   NODE_ENV        production",
    "   CORS_ORIGINS    your frontend URL",
    "",
    " backend/.env.example lists every supported variable.",
    " See DEPLOYMENT.md for the full walkthrough.",
    "──────────────────────────────────────────────────────────────",
    "",
  ].join("\n");

if (!JWT_SECRET) {
  throw new Error(
    missingSecretMessage(
      "JWT_SECRET is not set"
    )
  );
}

if (
  IS_PRODUCTION &&
  JWT_SECRET.length < 32
) {
  throw new Error(
    missingSecretMessage(
      `JWT_SECRET is only ${JWT_SECRET.length} characters; production requires at least 32`
    )
  );
}

/**
 * Refuse to run in production with the development placeholder, whatever
 * its length. A known secret is the same as no secret.
 */
if (
  IS_PRODUCTION &&
  JWT_SECRET === developmentJwtSecret
) {
  throw new Error(
    missingSecretMessage(
      "JWT_SECRET is still the development placeholder"
    )
  );
}

const JWT_EXPIRES_IN =
  cleanString(
    process.env.JWT_EXPIRES_IN,
    "7d"
  );

/*
|--------------------------------------------------------------------------
| Frontend and CORS
|--------------------------------------------------------------------------
*/

const defaultDevelopmentOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const CORS_ORIGINS =
  parseList(
    process.env.CORS_ORIGINS,
    IS_PRODUCTION
      ? []
      : defaultDevelopmentOrigins
  );

if (
  IS_PRODUCTION &&
  CORS_ORIGINS.length === 0
) {
  throw new Error(
    "CORS_ORIGINS is required in production"
  );
}

/*
|--------------------------------------------------------------------------
| PostgreSQL pool
|--------------------------------------------------------------------------
*/

const DB_POOL_MAX =
  parseInteger(
    process.env.DB_POOL_MAX,
    15,
    {
      minimum: 1,
      maximum: 100,
    }
  );

const DB_POOL_MIN =
  parseInteger(
    process.env.DB_POOL_MIN,
    0,
    {
      minimum: 0,
      maximum: DB_POOL_MAX,
    }
  );

const DB_IDLE_TIMEOUT_MS =
  parseInteger(
    process.env
      .DB_IDLE_TIMEOUT_MS,
    30000,
    {
      minimum: 1000,
      maximum: 600000,
    }
  );

const DB_CONNECTION_TIMEOUT_MS =
  parseInteger(
    process.env
      .DB_CONNECTION_TIMEOUT_MS,
    10000,
    {
      minimum: 1000,
      maximum: 120000,
    }
  );

const DB_STATEMENT_TIMEOUT_MS =
  parseInteger(
    process.env
      .DB_STATEMENT_TIMEOUT_MS,
    30000,
    {
      minimum: 1000,
      maximum: 600000,
    }
  );

const DB_QUERY_TIMEOUT_MS =
  parseInteger(
    process.env
      .DB_QUERY_TIMEOUT_MS,
    35000,
    {
      minimum: 1000,
      maximum: 600000,
    }
  );

const DB_APPLICATION_NAME =
  cleanString(
    process.env
      .DB_APPLICATION_NAME,
    "construction-portal-backend"
  );

const DB_SSL =
  parseBoolean(
    process.env.DB_SSL,
    IS_PRODUCTION
  );

/**
 * PEM-encoded CA bundle for the database server certificate.
 *
 * Supply this in production so the TLS connection is actually verified.
 * Supabase publishes its certificate under
 * Project Settings -> Database -> SSL Configuration.
 */
const DB_SSL_CA =
  cleanString(
    process.env.DB_SSL_CA
  );

/**
 * Escape hatch that disables certificate verification.
 *
 * Defaults to false. Setting this to true accepts ANY certificate,
 * which removes the protection TLS is there to provide and exposes
 * the connection to interception. It exists only for local proxies
 * that present a self-signed certificate.
 */
const DB_SSL_REJECT_UNAUTHORIZED =
  parseBoolean(
    process.env
      .DB_SSL_REJECT_UNAUTHORIZED,
    true
  );

/*
|--------------------------------------------------------------------------
| Rate limiting
|--------------------------------------------------------------------------
*/

const RATE_LIMIT_WINDOW_MS =
  parseInteger(
    process.env
      .RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000,
    {
      minimum: 1000,
      maximum: 3600000,
    }
  );

const RATE_LIMIT_MAX =
  parseInteger(
    process.env.RATE_LIMIT_MAX,
    300,
    {
      minimum: 10,
      maximum: 100000,
    }
  );

/**
 * Deliberately much tighter than the global limit.
 *
 * Login runs bcrypt at cost 12, so an unthrottled endpoint is both a
 * credential-stuffing target and a cheap way to exhaust CPU.
 */
const AUTH_RATE_LIMIT_MAX =
  parseInteger(
    process.env
      .AUTH_RATE_LIMIT_MAX,
    10,
    {
      minimum: 3,
      maximum: 1000,
    }
  );

/*
|--------------------------------------------------------------------------
| Site operation rules
|--------------------------------------------------------------------------
|
| How far back a supervisor may record material, labour, banking and
| daily-update entries without an explicit admin grant.
|
| From the operations notes: entries are added within two days; anything
| older requires calling the office for access.
|
*/

const SUPERVISOR_EDIT_WINDOW_DAYS =
  parseInteger(
    process.env
      .SUPERVISOR_EDIT_WINDOW_DAYS,
    2,
    {
      minimum: 0,
      maximum: 365,
    }
  );

const SUPERVISOR_BANKING_GRACE_DAYS =
  parseInteger(
    process.env
      .SUPERVISOR_BANKING_GRACE_DAYS,
    1,
    {
      minimum: 0,
      maximum: 30,
    }
  );

/*
|--------------------------------------------------------------------------
| Transactional email
|--------------------------------------------------------------------------
|
| Any SMTP provider: Gmail app password, Resend, SendGrid, Postmark, SES.
| Without these, password reset cannot deliver a link.
|
*/

const SMTP_HOST = cleanString(
  process.env.SMTP_HOST
);

const SMTP_PORT = parseInteger(
  process.env.SMTP_PORT,
  587,
  {
    minimum: 1,
    maximum: 65535,
  }
);

// Port 465 uses implicit TLS; 587 upgrades via STARTTLS.
const SMTP_SECURE = parseBoolean(
  process.env.SMTP_SECURE,
  SMTP_PORT === 465
);

const SMTP_USER = cleanString(
  process.env.SMTP_USER
);

const SMTP_PASSWORD = cleanString(
  process.env.SMTP_PASSWORD
);

const MAIL_FROM =
  cleanString(
    process.env.MAIL_FROM
  ) ||
  SMTP_USER ||
  "no-reply@localhost";

const MAIL_FROM_NAME = cleanString(
  process.env.MAIL_FROM_NAME,
  "Construction Portal"
);

/**
 * Where the reset link points.
 *
 * This is the frontend origin, which is not the same as BASE_URL (the API).
 */
const FRONTEND_URL = cleanString(
  process.env.FRONTEND_URL
);

/**
 * How long a password reset token stays valid, in minutes.
 */
const RESET_TOKEN_TTL_MINUTES =
  parseInteger(
    process.env
      .RESET_TOKEN_TTL_MINUTES,
    60,
    {
      minimum: 5,
      maximum: 1440,
    }
  );

/*
|--------------------------------------------------------------------------
| Supabase Storage
|--------------------------------------------------------------------------
*/

const SUPABASE_URL =
  cleanString(
    process.env.SUPABASE_URL
  );

const SUPABASE_SERVICE_ROLE_KEY =
  cleanString(
    process.env
      .SUPABASE_SERVICE_ROLE_KEY
  );

const SUPABASE_BUCKET =
  cleanString(
    process.env.SUPABASE_BUCKET,
    "construction-files"
  );

const STORAGE_CONFIGURED =
  Boolean(
    SUPABASE_URL &&
      SUPABASE_SERVICE_ROLE_KEY &&
      SUPABASE_BUCKET
  );

if (
  IS_PRODUCTION &&
  !STORAGE_CONFIGURED
) {
  console.warn(
    "Supabase Storage is not fully configured. File uploads will be unavailable."
  );
}

/*
|--------------------------------------------------------------------------
| Upload configuration
|--------------------------------------------------------------------------
*/

const MAX_UPLOAD_SIZE_MB =
  parseInteger(
    process.env
      .MAX_UPLOAD_SIZE_MB,
    10,
    {
      minimum: 1,
      maximum: 100,
    }
  );

const MAX_UPLOAD_SIZE_BYTES =
  MAX_UPLOAD_SIZE_MB *
  1024 *
  1024;

const ALLOWED_UPLOAD_FOLDERS =
  parseList(
    process.env
      .ALLOWED_UPLOAD_FOLDERS,
    [
      "tender-documents",
      "worker-updates",
      "subcontractor-updates",
      "worker-expenses",
      "invoices",
      "reports",
      "site-inspections",
      "site-models",
      "general",
    ]
  );

/*
|--------------------------------------------------------------------------
| Application defaults
|--------------------------------------------------------------------------
*/

const DEFAULT_CURRENCY =
  cleanString(
    process.env.DEFAULT_CURRENCY,
    "AUD"
  ).toUpperCase();

const DEFAULT_TIMEZONE =
  cleanString(
    process.env.DEFAULT_TIMEZONE,
    "Australia/Melbourne"
  );

module.exports = Object.freeze({
  NODE_ENV,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  IS_TEST,

  PORT,

  DATABASE_URL,

  JWT_SECRET,
  JWT_EXPIRES_IN,

  CORS_ORIGINS,

  DB_POOL_MAX,
  DB_POOL_MIN,
  DB_IDLE_TIMEOUT_MS,
  DB_CONNECTION_TIMEOUT_MS,
  DB_STATEMENT_TIMEOUT_MS,
  DB_QUERY_TIMEOUT_MS,
  DB_APPLICATION_NAME,
  DB_SSL,
  DB_SSL_CA,
  DB_SSL_REJECT_UNAUTHORIZED,

  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_MAX,

  SUPERVISOR_EDIT_WINDOW_DAYS,
  SUPERVISOR_BANKING_GRACE_DAYS,

  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASSWORD,
  MAIL_FROM,
  MAIL_FROM_NAME,
  FRONTEND_URL,
  RESET_TOKEN_TTL_MINUTES,

  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_BUCKET,
  STORAGE_CONFIGURED,

  MAX_UPLOAD_SIZE_MB,
  MAX_UPLOAD_SIZE_BYTES,
  ALLOWED_UPLOAD_FOLDERS,

  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
});