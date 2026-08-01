const { Pool } = require("pg");

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
} = require("../config/env");

const isProduction =
  NODE_ENV === "production";

const pool = new Pool({
  connectionString:
    DATABASE_URL,

  ssl: DB_SSL
    ? {
        rejectUnauthorized:
          false,
      }
    : false,

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

module.exports = pool;

module.exports.checkDatabaseConnection =
  checkDatabaseConnection;

module.exports.closeDatabasePool =
  closeDatabasePool;