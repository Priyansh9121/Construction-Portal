/*
|--------------------------------------------------------------------------
| PostgreSQL connection pool
|--------------------------------------------------------------------------
|
| The single database entry point. Every module imports this file; nothing
| else constructs a Pool, so connection limits, TLS settings and type
| parsers are decided once.
|
| Exported as the pool itself, with helpers hung off it:
|
|     const pool = require("../../database/pool");
|     await pool.query("SELECT 1");
|     await pool.withTenant(companyId, async (client) => { ... });
|
| That shape exists because most call sites predate the tenant helpers and
| use the pool directly. Assigning to module.exports first and then adding
| properties keeps both styles working.
|
| Note this talks to PostgreSQL directly through node-postgres. Supabase is
| used for file storage only and issues no queries.
|
*/

const { Pool, types } = require("pg");

const {
  getTenantCompanyId,
} = require("./tenantContext");

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

/*
 * The pool.
 *
 * Two of these settings are easy to confuse:
 *
 *   statement_timeout   enforced by PostgreSQL. The server cancels the
 *                       query, so the connection is freed even if the
 *                       client has stopped listening.
 *   query_timeout       enforced by node-postgres. The client gives up,
 *                       but the server may still be executing.
 *
 * Both are set, because each covers a case the other does not.
 *
 * keepAlive stops a managed load balancer or NAT from silently dropping an
 * idle TCP connection, which otherwise surfaces much later as a confusing
 * ECONNRESET on the first query after a quiet period.
 *
 * allowExitOnIdle is enabled under test only: it lets Node exit once no
 * query is in flight, so a Vitest worker does not hang on an idle pooled
 * connection at the end of a suite. In production the pool is meant to stay
 * up, and shutdown goes through closeDatabasePool.
 */
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

/*
 * Whether queries need to carry a tenant context.
 *
 * Set by checkDatabaseConnection at startup from the connected role's actual
 * attributes. It stays false until then, and false means every query runs
 * exactly as it did before this wrapper existed — which is what migrations,
 * scripts and the test suite want, and what a superuser connection wants
 * too, since the policies do not apply to it anyway.
 *
 * Guessing wrong in this direction is cheap: the application's own WHERE
 * clauses still scope every query. Guessing wrong in the other direction is
 * not, so it is never assumed true.
 */
let tenantScopingEnabled = false;

/**
 * Runs once whenever PostgreSQL creates a new physical
 * connection for the pool.
 *
 * Pins the session to UTC so a TIMESTAMPTZ is interpreted the same way
 * regardless of the host's timezone — a deploy host on UTC and a laptop on
 * IST must not disagree about what an instant means.
 *
 * This does not affect DATE columns, which the parser above keeps as
 * strings, nor the company-local "today" the entry-window rules use: that
 * is computed from the company's own timezone in JavaScript, not here.
 *
 * A failure is logged and swallowed rather than thrown, because throwing
 * inside this listener would take down the process. A connection that
 * failed to set its timezone still works; it is just misconfigured, and the
 * log says so.
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
 * Verifies database connectivity and reports what was connected to.
 *
 * Called by server.js before it binds the port, so a misconfigured
 * DATABASE_URL fails at startup rather than on the first request.
 *
 * The fields it returns are the ones worth seeing in a boot log:
 *
 *   database_user   the role in use. This is the one to check when
 *                   row-level security appears not to work — as `postgres`
 *                   every policy is bypassed, and only `construction_app`
 *                   makes them live.
 *   database_schema whether the search path resolves as expected.
 *   database_time   the server's clock, for spotting a skew against the
 *                   application host.
 *   rls_enforced    whether the connected role is actually subject to the
 *                   migration 003 policies.
 *
 * Deciding rls_enforced here is what switches the tenant wrapper below on
 * and off. It is asked of the database rather than inferred from the role
 * name or an environment variable, because the only thing that genuinely
 * matters is whether PostgreSQL will apply the policies to this connection,
 * and pg_roles is the one place that knows.
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
          AS database_time,

        NOT (
          rolsuper OR rolbypassrls
        ) AS rls_enforced

      FROM pg_roles
      WHERE rolname = current_user
    `);

    const row = result.rows[0];

    tenantScopingEnabled = Boolean(
      row && row.rls_enforced
    );

    if (tenantScopingEnabled) {
      console.log(
        "[database] Connected as a role subject to row-level security. " +
          "Every request-scoped query will carry its company context."
      );
    } else {
      console.warn(
        "[database] Connected as a role that BYPASSES row-level security " +
          `(${row && row.database_user}). The migration 003 policies have no ` +
          "effect; tenant isolation rests entirely on the WHERE clauses in " +
          "the application."
      );
    }

    return row;
  };

/**
 * Closes every pooled client.
 *
 * Called from the SIGTERM and SIGINT handlers in server.js. Render sends
 * SIGTERM on redeploy, and draining the pool lets in-flight queries finish
 * instead of being cut off mid-transaction.
 *
 * The pool cannot be reused afterwards — a query against an ended pool
 * throws — so this is genuinely shutdown-only.
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

/*
|--------------------------------------------------------------------------
| The choke point
|--------------------------------------------------------------------------
|
| Every module in this codebase already calls pool.query. Rather than
| rewriting 139 call sites to remember withTenant, pool.query itself supplies
| the context when there is one to supply.
|
| A bare pool.query runs in autocommit, and SET LOCAL outside a transaction
| affects nothing, so a scoped query has to become a transaction. That costs
| two extra round trips per query, which is why it only happens when the
| connected role is genuinely subject to the policies — under postgres the
| original fast path is used unchanged.
|
| Deliberately left alone:
|
|   client.query   a caller holding its own client from pool.connect() has
|                  taken responsibility for its own transaction. withTenant
|                  and withTransaction are the two that do, and both set the
|                  context themselves.
|
|   callback style pool.query(text, params, cb) resolves through a callback
|                  rather than a promise. Nothing here uses it, and quietly
|                  changing its semantics would be worse than not covering
|                  it, so it passes straight through.
|
*/
const unscopedQuery =
  pool.query.bind(pool);

pool.query = (...args) => {
  const companyId =
    getTenantCompanyId();

  const isCallbackStyle =
    typeof args[args.length - 1] ===
    "function";

  if (
    !tenantScopingEnabled ||
    companyId === null ||
    isCallbackStyle
  ) {
    return unscopedQuery(...args);
  }

  return withTenant(
    companyId,
    (client) =>
      client.query(...args)
  );
};

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