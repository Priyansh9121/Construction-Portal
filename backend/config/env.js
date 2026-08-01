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

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is required in production"
  );
}

if (
  IS_PRODUCTION &&
  JWT_SECRET.length < 32
) {
  throw new Error(
    "JWT_SECRET must contain at least 32 characters in production"
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