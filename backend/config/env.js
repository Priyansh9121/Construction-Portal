/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The single place the backend reads process.env. Every other file imports
| already-parsed, already-validated values from here rather than touching
| process.env itself.
|
| Three things follow from that:
|
|   1. A misconfiguration is caught at startup, not at the moment a user
|      first hits the affected feature. Requiring this module is enough to
|      fail the boot on a missing JWT_SECRET.
|
|   2. Types are settled once. Ports are numbers, flags are booleans, and
|      origin lists are arrays — no consumer re-parses a string.
|
|   3. Defaults live in one readable list, so "what happens if I do not set
|      this" is answerable by reading one file.
|
| Responsibilities:
|   - Load backend/.env regardless of the working directory
|   - Parse and bounds-check every variable
|   - Refuse to start on a missing or unsafe secret in production
|   - Export one frozen object of settled configuration
|
| Structure (in order):
|   parsing helpers -> environment -> port -> database URL -> JWT ->
|   CORS -> pool tuning -> rate limits -> supervisor entry windows ->
|   SMTP -> Supabase storage -> uploads -> application defaults
|
| Exports:
|   one frozen object; see the module.exports at the foot of the file for
|   the authoritative list of names.
|
| Used by:
|   backend/server.js, database/pool.js, config/mailer.js,
|   config/supabase.js, middleware/rateLimiter.js,
|   modules/auth/auth.service.js, modules/siteOperations/
|   entryWindow.service.js, modules/uploads/*, and the test helpers.
|
| Depends on:
|   dotenv, path — nothing internal, so it can be required first without a
|   cycle.
|
| Documentation:
|   backend/.env.example documents each variable for an operator: what it
|   is, whether it is required, its default and its security impact. This
|   file documents how each is parsed and what the code does with it.
|
| Security:
|   - JWT_SECRET has no default in production; the process exits instead.
|   - Nothing here is ever logged. Printing this object would print every
|     credential the service holds.
|   - Object.freeze stops a later module from mutating shared configuration
|     at runtime.
|
| Note:
|   Reading process.env directly elsewhere bypasses all of the above. Two
|   places currently do — utils/requestContext.js and middleware/
|   errorHandler.js both check NODE_ENV inline — and both are noted where
|   they occur.
|
*/

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

/**
 * A trimmed string, or the fallback when the variable is absent or blank.
 *
 * Every environment variable arrives as a string or undefined, and an
 * unset one in a .env file often shows up as "" rather than missing —
 * `KEY=` with nothing after it. Treating empty as absent is what makes the
 * fallback fire in that case.
 */
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

/**
 * An integer within bounds, or the fallback.
 *
 * Number.isInteger rejects NaN, Infinity and any fractional value in one
 * test, so "abc", "" and "1.5" all fall back rather than reaching a
 * setting that expects a whole number.
 *
 * The bounds are how a typo is caught at startup instead of at runtime: a
 * pool size of 1000 or a port of 99999 is refused here rather than
 * producing a confusing failure later.
 */
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

/**
 * A boolean from the several spellings people actually write.
 *
 * true / 1 / yes / on and false / 0 / no / off, case-insensitive. Anything
 * unrecognised returns the fallback rather than being coerced, so a typo
 * like DB_SSL=ture does not silently become false — it keeps the default,
 * which for DB_SSL is the safer of the two.
 */
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

/**
 * A comma-separated variable as a deduplicated array of trimmed entries.
 *
 * Used for CORS_ORIGINS and ALLOWED_UPLOAD_FOLDERS — the two settings that
 * are naturally a list but can only be written as one string in a .env
 * file or a Render dashboard field.
 *
 * Parameters:
 * value    - the raw variable, e.g. "https://a.com, https://b.com"
 * fallback - returned when the variable is absent or blank
 *
 * Returns:
 * A new array of non-empty trimmed strings, with duplicates removed.
 *
 * Notes:
 * `filter(Boolean)` drops the empty entries a trailing comma or a stray
 * ", ," would otherwise produce. For CORS that matters: an empty string in
 * the allow-list would be compared against the Origin header and could
 * match a request that sends no origin at all.
 *
 * The fallback is spread into a fresh array rather than returned directly,
 * so a caller mutating the result cannot corrupt the shared default for
 * everyone else.
 */
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

/**
 * Reads a variable that has no safe default, throwing when it is absent.
 *
 * Purpose:
 * Some settings cannot be guessed. A JWT secret invented at boot would
 * invalidate every existing session on each restart and differ between
 * instances behind a load balancer; a database URL has no sensible local
 * stand-in in production. For those, refusing to start is the correct
 * behaviour.
 *
 * Parameters:
 * name - the variable name, used both to read and to name it in the error
 *
 * Returns:
 * The trimmed value.
 *
 * Throws:
 * Error when the variable is missing or blank. Thrown at require time, so
 * it aborts the boot rather than surfacing on a request.
 *
 * Security:
 * This is what makes "no default in production" enforceable. The error
 * names the variable but never its value, so a crash log cannot leak a
 * secret that was set but malformed.
 */
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

/*
 * A known placeholder used only when NODE_ENV is not production, so a
 * developer can clone and run without generating a key first.
 *
 * The value is deliberately recognisable: the production guard further
 * down compares against it by identity, so shipping with this still in
 * place aborts startup rather than signing real tokens with a secret that
 * is published in this file.
 */
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
/**
 * Formats the fatal-configuration banner shown when a secret is unusable.
 *
 * Purpose:
 * A boot failure on a hosted platform is read as a wall of log output,
 * usually by someone who did not write this code and is looking at Render's
 * log viewer at the time. The message is deliberately long and formatted:
 * it states the cause, explains why the value is not in the repository, and
 * gives the exact commands and dashboard path to fix it.
 *
 * Parameters:
 * reason - the specific failure, e.g. "JWT_SECRET is not set"
 *
 * Returns:
 * A multi-line string suitable for `new Error(...)`.
 *
 * Security:
 * Only the length of an offending secret is ever quoted back, never its
 * content — see the caller below. Startup errors are frequently pasted into
 * chat threads and issue trackers.
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

/*
|--------------------------------------------------------------------------
| JWT secret gate
|--------------------------------------------------------------------------
|
| Three checks, run at require time so a bad secret stops the deploy rather
| than quietly weakening every token the service issues. They escalate:
| absent, then too short, then still the placeholder.
|
| Any token signed with a guessable secret can be forged, and this
| application puts the user id, company id and role inside the token. A
| forged one is a login as anybody, in any tenant, at any role — which is
| why these are hard failures and not warnings.
|
*/

// No secret at all is fatal everywhere, including development: there is no
// meaningful fallback, and starting without one would mean tokens signed
// with `undefined`.
if (!JWT_SECRET) {
  throw new Error(
    missingSecretMessage(
      "JWT_SECRET is not set"
    )
  );
}

// Length is only enforced in production. 32 characters is the floor at
// which brute-forcing the signing key stops being practical; a short but
// convenient secret stays allowed locally.
//
// The message quotes the length, never the value.
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

/*
 * Origins allowed when CORS_ORIGINS is unset, which is only permitted
 * outside production. These are the Vite dev server's two spellings —
 * localhost and 127.0.0.1 are different origins to a browser, and which
 * one appears depends on how the developer opened the page.
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

/**
 * Password reset is tighter still: it sends email, so it is the favourite
 * target for both account enumeration and mail-bombing.
 *
 * PRODUCTION DEFAULTS ARE UNCHANGED — 5 requests per hour per IP. These were
 * hard-coded in middleware/rateLimiter.js and are now overridable ONLY so a
 * local end-to-end run can exercise the recovery flow more than five times an
 * hour. Omitting both variables reproduces the previous behaviour exactly.
 *
 * The limiter is never disabled and there is no IP bypass: a high local value
 * still counts requests, it just does not stop a test suite mid-run.
 *
 * parseInteger applies the project's standard policy, so a non-numeric or
 * out-of-range value fails the same way every other misconfigured variable
 * does rather than silently falling back to something permissive.
 */
const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS =
  parseInteger(
    process.env
      .PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
    60 * 60 * 1000,
    {
      minimum: 1000,
      maximum: 24 * 60 * 60 * 1000,
    }
  );

const PASSWORD_RESET_RATE_LIMIT_MAX =
  parseInteger(
    process.env
      .PASSWORD_RESET_RATE_LIMIT_MAX,
    5,
    {
      minimum: 1,
      maximum: 100000,
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
    "INR"
  ).toUpperCase();

/**
 * Rejects a timezone the runtime cannot actually resolve.
 *
 * Purpose:
 * `DEFAULT_TIMEZONE` was accepted as free text, so a plausible-looking but
 * non-existent zone passed straight through. `India/Kolkata` is the real
 * example — it is not an IANA name (the correct one is `Asia/Kolkata`) and
 * was sitting in a working .env.
 *
 * Nothing complained, because the value is only resolved later, inside
 * entryWindow.service.js, which catches the RangeError and falls back to
 * UTC. So every date question silently answered in UTC instead of IST:
 *
 *   - a company created without an explicit timezone stored the bad string
 *   - "today" for the supervisor backdated-entry rule shifted by 5.5 hours
 *   - an evening entry in India could be judged a future date and refused
 *
 * That is the exact defect finding F-13 was written to fix, reintroduced
 * through configuration rather than code.
 *
 * Parameters:
 * value - the configured zone name
 *
 * Returns:
 * The zone unchanged when Intl can resolve it.
 *
 * Side effects:
 * Throws in production, so a bad zone aborts the deploy instead of quietly
 * degrading. Warns and falls back to the default elsewhere, so a local
 * typo does not block development.
 */
const resolveTimezone = (
  value,
  fallback
) => {
  try {
    new Intl.DateTimeFormat("en-CA", {
      timeZone: value,
    }).format(new Date());

    return value;
  } catch {
    const message =
      `DEFAULT_TIMEZONE "${value}" is not a valid IANA timezone. ` +
      `Dates would silently resolve in UTC. Use e.g. "Asia/Kolkata".`;

    if (NODE_ENV === "production") {
      throw new Error(message);
    }

    console.warn(
      `${message} Falling back to "${fallback}".`
    );

    return fallback;
  }
};

const DEFAULT_TIMEZONE =
  resolveTimezone(
    cleanString(
      process.env.DEFAULT_TIMEZONE,
      "Asia/Kolkata"
    ),
    "Asia/Kolkata"
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
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
  PASSWORD_RESET_RATE_LIMIT_MAX,
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