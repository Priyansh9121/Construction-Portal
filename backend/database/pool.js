const { Pool, types } = require("pg");

/*
|--------------------------------------------------------------------------
| Date handling
|--------------------------------------------------------------------------
|
| node-pg turns a DATE column into a JavaScript Date at the server's LOCAL
| midnight. Serialising that to JSON converts it to UTC, so anywhere east of
| Greenwich the date arrives at the client as the day before:
|
|     stored 2026-08-01  ->  "2026-07-31T14:00:00.000Z"  ->  renders 31 Jul
|
| A DATE has no time and no timezone; it is a calendar day. Turning it into
| an instant invents information and then loses a day to it. The parser below
| hands the raw "YYYY-MM-DD" string through untouched.
|
| This applies to every DATE column in the schema — payment_date, log_date,
| due_date, entry_date, work_date, expense_date, receipt_date.
|
| TIMESTAMPTZ columns are unaffected: those genuinely are instants and keep
| their normal Date conversion.
|
*/
types.setTypeParser(
  types.builtins.DATE,
  (value) => value
);

const {
  DATABASE_URL,
  NODE_ENV,
  IS_TEST,

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
} = require("../config/env");

const isProduction =
  NODE_ENV === "production";

/**
 * Builds the TLS options for the database connection.
 *
 * Previously this always set rejectUnauthorized: false, which accepts any
 * certificate the server presents. That silently removes the protection
 * TLS exists to provide: an attacker able to intercept the connection can
 * present their own certificate and read every query and result.
 *
 * The order of preference is:
 *
 *   1. A CA bundle was supplied  -> verify against it (the correct setup).
 *   2. Verification opted out    -> warn loudly, refuse in production.
 *   3. Otherwise                 -> verify against the system trust store.
 */
const buildSslConfig = () => {
  if (!DB_SSL) {
    return false;
  }

  if (DB_SSL_CA) {
    return {
      ca: DB_SSL_CA,
      rejectUnauthorized: true,
    };
  }

  if (!DB_SSL_REJECT_UNAUTHORIZED) {
    if (isProduction) {
      throw new Error(
        "DB_SSL_REJECT_UNAUTHORIZED=false is not permitted in production. " +
          "Supply DB_SSL_CA with your provider's certificate bundle instead."
      );
    }

    console.warn(
      "[database] TLS certificate verification is DISABLED. " +
        "The connection is encrypted but not authenticated. " +
        "Set DB_SSL_CA to verify properly."
    );

    return {
      rejectUnauthorized: false,
    };
  }

  return {
    rejectUnauthorized: true,
  };
};

const pool = new Pool({
  connectionString:
    DATABASE_URL,

  ssl: buildSslConfig(),

  max: DB_POOL_MAX,

  min: DB_POOL_MIN,

  idleTimeoutMillis:
    DB_IDLE_TIMEOUT_MS,

  connectionTimeoutMillis:
    DB_CONNECTION_TIMEOUT_MS,

  statement_timeout:
    DB_STATEMENT_TIMEOUT_MS,

  query_timeout:
    DB_QUERY_TIMEOUT_MS,

  application_name:
    DB_APPLICATION_NAME,

  keepAlive: true,

  allowExitOnIdle:
    IS_TEST,
});

/**
 * Runs once whenever PostgreSQL creates a new physical
 * connection for the pool.
 */
pool.on("connect", (client) => {
  client
    .query(`
      SET TIME ZONE 'UTC';
    `)
    .catch((error) => {
      console.error(
        "Failed to initialise PostgreSQL connection:",
        error
      );
    });
});

/**
 * PostgreSQL pool-level errors can occur while an idle client
 * is waiting in the pool.
 *
 * Without this listener, Node may terminate unexpectedly.
 */
pool.on("error", (error) => {
  console.error(
    "Unexpected PostgreSQL pool error:",
    {
      message: error.message,
      code: error.code || null,
      stack:
        NODE_ENV === "development"
          ? error.stack
          : undefined,
    }
  );
});

/**
 * Verifies database connectivity.
 *
 * Call this during backend startup before accepting requests.
 */
const checkDatabaseConnection =
  async () => {
    const result = await pool.query(`
      SELECT
        current_database()
          AS database_name,

        current_user
          AS database_user,

        current_schema()
          AS database_schema,

        current_setting(
          'server_version'
        ) AS server_version,

        NOW()
          AS database_time
    `);

    return result.rows[0];
  };

/**
 * Closes all database clients.
 *
 * This must be called during graceful backend shutdown.
 */
const closeDatabasePool =
  async () => {
    await pool.end();
  };

/*
|--------------------------------------------------------------------------
| Tenant scoping
|--------------------------------------------------------------------------
|
| Every tenant-owned table carries a company_id, and the row-level security
| policies installed by migration 003 compare it against the app.company_id
| session variable.
|
| The helpers below are the only supported way to set that variable. They
| use SET LOCAL, so the value is scoped to the surrounding transaction and
| cannot leak to the next request that borrows the same pooled connection.
|
| Note that RLS only bites when the API connects as a role without
| BYPASSRLS. Connecting as a superuser leaves these helpers correct but
| unenforced, so they are written to be useful either way: the transaction
| boundary and the explicit company context are worth having regardless.
|
*/

/**
 * Rejects anything that is not a positive integer company id.
 *
 * The value is interpolated into a SET LOCAL statement, which cannot take
 * a bind parameter, so it must be validated rather than trusted.
 */
const assertCompanyId = (companyId) => {
  const parsed = Number(companyId);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    const error = new Error(
      "A valid company context is required for this operation."
    );

    error.statusCode = 403;
    error.code =
      "COMPANY_CONTEXT_REQUIRED";

    throw error;
  }

  return parsed;
};

/**
 * Runs a callback inside a transaction bound to one company.
 *
 * Usage:
 *
 *   const rows = await withTenant(req.user.company_id, async (client) => {
 *     const result = await client.query("SELECT * FROM payments");
 *     return result.rows;
 *   });
 *
 * The callback receives a dedicated client. Commits on success, rolls back
 * on any thrown error, and always returns the client to the pool.
 */
const withTenant = async (
  companyId,
  callback
) => {
  const scopedCompanyId =
    assertCompanyId(companyId);

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    // SET LOCAL reverts when the transaction ends, so the next borrower
    // of this connection starts with no company context.
    await client.query(
      `SET LOCAL app.company_id = '${scopedCompanyId}'`
    );

    const result = await callback(
      client
    );

    await client.query("COMMIT");

    return result;
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch (rollbackError) {
      console.error(
        "Failed to roll back tenant transaction:",
        rollbackError.message
      );
    }

    throw error;
  } finally {
    client.release();
  }
};

/**
 * Convenience wrapper for a single company-scoped statement.
 *
 * Returns the pg result object, so callers use it exactly like pool.query.
 */
const tenantQuery = (
  companyId,
  text,
  params = []
) =>
  withTenant(
    companyId,
    (client) =>
      client.query(text, params)
  );

module.exports = pool;

module.exports.checkDatabaseConnection =
  checkDatabaseConnection;

module.exports.closeDatabasePool =
  closeDatabasePool;

module.exports.withTenant =
  withTenant;

module.exports.tenantQuery =
  tenantQuery;

module.exports.assertCompanyId =
  assertCompanyId;