/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The shared vocabulary every controller uses to read a request safely and
| answer it consistently. Three jobs live here:
|
|   1. Coercion — turn loose JSON input into trimmed text, finite numbers
|      and real nulls, so a controller never does arithmetic on a string or
|      writes "" into a nullable column.
|
|   2. Identity — read the actor and the tenant from the verified JWT, and
|      only from there. This is the file that makes tenant isolation a
|      habit rather than a decision each controller re-makes.
|
|   3. Uniform responses — one shape for 400, 403, 404 and 500 so the
|      frontend can handle failures in one place.
|
| Plus two pieces that did not fit elsewhere: existence checks scoped to the
| current company, and a transaction wrapper.
|
| Responsibilities:
|   - Input coercion (cleanText, toNumber, toPositiveInteger, emptyToNull)
|   - Authenticated identity (getUserId, getCompanyId, getUserRole)
|   - Guard-and-respond helpers (requireCompanyId, requireParamId,
|     requireText) which return null after writing the error response
|   - Company-scoped existence checks for the four main entities
|   - withTransaction for multi-statement writes
|   - sendServerError / sendNotFound / sendForbidden
|
| Depends on:
|   database/pool.js — only for the existence checks and transactions
|
| Used by:
|   nearly every controller in backend/modules/. The require line at the top
|   of a controller is the quickest way to see which of these it relies on.
|
| Database tables touched:
|   tenders, sites, workers, subcontractors — SELECT only, and only to
|   confirm a row exists within the caller's company. No writes happen here;
|   withTransaction merely lends a client to code that does.
|
| Security:
|   The getCompanyId / getUserId pair is load-bearing. Both read exclusively
|   from req.user, which authMiddleware populated from a verified token. A
|   controller that instead trusted req.body.company_id would let any
|   authenticated user write into another tenant. backend/tests/
|   tenantIsolation.test.js exists to catch that regression.
|
| Convention:
|   The require* helpers write the 400 themselves and return null. The
|   calling controller must therefore check for null and return immediately:
|
|     const companyId = requireCompanyId(req, res);
|     if (!companyId) return;
|
|   Forgetting the early return means writing a second response to an
|   already-sent reply.
|
*/

const pool = require("../database/pool");

/**
 * Converts a value to trimmed text.
 *
 * Returns an empty string for null, undefined and non-string values.
 *
 * Parameters:
 * value - anything
 *
 * Returns:
 * A trimmed string; "" for anything that was not a string to begin with.
 *
 * Notes:
 * Non-strings become "" rather than being coerced. That is deliberate: if a
 * client sends a number or an object where text was expected, silently
 * stringifying it would write "[object Object]" into a name column, whereas
 * "" fails the requireText check and produces a clear 400.
 */
const cleanText = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

/**
 * Converts a value to lowercase trimmed text.
 *
 * Purpose:
 * The normal form for anything compared case-insensitively — email
 * addresses, role names, status values arriving from a client.
 *
 * Parameters:
 * value - anything
 *
 * Returns:
 * A lowercase trimmed string, or "" for non-strings.
 *
 * Notes:
 * Uses the locale-independent toLowerCase rather than toLocaleLowerCase, so
 * the result does not vary with the server's locale. That matters for
 * emails, where a Turkish-locale lowercase of "I" would not round-trip.
 */
const cleanLowerText = (value) =>
  cleanText(value).toLowerCase();

/**
 * Converts a value to a finite number.
 *
 * Returns fallback when conversion fails.
 *
 * Parameters:
 * value    - anything; usually a numeric string from a JSON body
 * fallback - what to return when the value is not a finite number
 *
 * Returns:
 * A finite number. Never NaN and never Infinity, which is the whole point —
 * either would propagate silently through a running total and only surface
 * much later as a null column or a nonsense figure on a report.
 *
 * Notes:
 * Distinct from the toNumber in utils/financeCalculations.js, which has no
 * fallback parameter and treats every falsy input as 0. This one lets the
 * caller choose, so a missing rate can default to 1 rather than to 0.
 */
const toNumber = (
  value,
  fallback = 0
) => {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
};

/**
 * Converts a value to a positive integer.
 *
 * Returns null when invalid.
 *
 * Purpose:
 * Every id in this system is a positive bigint. This is the one gate that
 * turns a path segment or a body field into something safe to put in a
 * query parameter.
 *
 * Parameters:
 * value - anything; typically a string from req.params
 *
 * Returns:
 * A positive integer, or null. Rejects 0, negatives, fractions, NaN,
 * Infinity and non-numeric strings alike.
 *
 * Security:
 * Returning null rather than NaN matters. NaN reaching a query parameter
 * makes Postgres reject the whole statement with a type error, which
 * surfaces to the user as a 500 rather than the 400 it really is.
 *
 * Notes:
 * Number("") is 0 and Number(null) is 0, both of which fail the `<= 0`
 * check — so blank input is rejected rather than silently treated as id 0.
 */
const toPositiveInteger = (
  value
) => {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
};

/**
 * Converts blank values into null.
 *
 * Purpose:
 * An HTML form submits an untouched optional field as "", not as absent.
 * Written straight to the database that becomes an empty string where the
 * schema meant NULL — which breaks IS NULL checks, COALESCE defaults and
 * every "has this been filled in yet" query.
 *
 * Parameters:
 * value - anything
 *
 * Returns:
 * null for undefined, null, "" and whitespace-only strings. Any other value
 * is returned untouched, including 0 and false — both of which are
 * meaningful values that must survive.
 *
 * Notes:
 * Non-string values pass through without trimming, so a number stays a
 * number rather than being stringified on the way to the query.
 */
const emptyToNull = (value) => {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  if (
    typeof value === "string"
  ) {
    const trimmed = value.trim();

    return trimmed || null;
  }

  return value;
};

/**
 * Returns the authenticated user ID.
 *
 * Controllers must not accept user IDs from request bodies
 * for ownership or audit operations.
 *
 * Parameters:
 * req - the Express request, after authMiddleware
 *
 * Returns:
 * A positive integer, or null when unauthenticated.
 *
 * Security:
 * Used as created_by, requested_by and approved_by across the modules. If
 * this ever read from the body, one user could file an approval in another
 * user's name — and the audit trail would faithfully record the lie.
 */
const getUserId = (req) =>
  toPositiveInteger(
    req.user?.id
  );

/**
 * Returns the company ID from the authenticated token.
 *
 * Do not fall back to req.body.company_id because that allows
 * users to submit records for another company.
 *
 * Purpose:
 * The tenant boundary. Practically every query in the application filters
 * on the value this returns, so it is the single point at which "which
 * company is asking" is decided.
 *
 * Parameters:
 * req - the Express request, after authMiddleware has run
 *
 * Returns:
 * A positive integer company id, or null when the account is not linked to
 * a company. Most callers use requireCompanyId instead, which turns that
 * null into a 400.
 *
 * Security:
 * This is the highest-value line in the file. req.user is set only by
 * authMiddleware from a signature-verified JWT, so the value cannot be
 * influenced by the client. Any future change that accepts a company id
 * from the request body, a query string or a header would collapse tenant
 * isolation across the whole API.
 */
const getCompanyId = (req) =>
  toPositiveInteger(
    req.user?.company_id
  );

/**
 * Returns the authenticated user's role.
 *
 * Parameters:
 * req - the Express request, after authMiddleware
 *
 * Returns:
 * A lowercase role string, or "" when unauthenticated. Never null, so a
 * caller can compare against USER_ROLES without a nullish guard.
 *
 * Notes:
 * Lowercased on the way out so a comparison cannot fail on casing. This is
 * the coarse `users.role`; the per-company role lives on
 * req.user.company_role and roleMiddleware accepts either.
 *
 * Security:
 * Route-level authorisation belongs in roleMiddleware. Use this only for
 * decisions inside a controller that middleware cannot express — for
 * instance branching on whether the caller is a supervisor to decide which
 * columns they may change.
 */
const getUserRole = (req) =>
  cleanLowerText(
    req.user?.role
  );

/**
 * Creates a standard 400 response when the authenticated
 * account has no company relationship.
 *
 * Parameters:
 * req, res - the Express pair
 *
 * Returns:
 * The company id, or null having already sent a 400. The caller must return
 * immediately on null — see the convention note at the top of this file.
 *
 * Side effects:
 * May write the response.
 *
 * Notes:
 * An account without a company is a real state, not a bug: a user row can
 * exist before the company_users link is created. 400 rather than 403,
 * because the request is malformed for this account rather than forbidden.
 */
const requireCompanyId = (
  req,
  res
) => {
  const companyId =
    getCompanyId(req);

  if (!companyId) {
    res.status(400).json({
      success: false,
      message:
        "Your account is not linked to a company.",
    });

    return null;
  }

  return companyId;
};

/**
 * Reads and validates a positive integer from route parameters.
 *
 * Parameters:
 * req, res  - the Express pair
 * paramName - which route parameter to read; defaults to "id"
 * label     - the noun used in the error message, e.g. "tender"
 *
 * Returns:
 * A positive integer, or null having already sent a 400.
 *
 * Side effects:
 * May write the response.
 *
 * Security:
 * Route parameters are raw user input. Passing one straight into a query
 * risks a type error at best; this rejects anything that is not a plain
 * positive integer before it reaches the database.
 */
const requireParamId = (
  req,
  res,
  paramName = "id",
  label = "record"
) => {
  const id =
    toPositiveInteger(
      req.params?.[paramName]
    );

  if (!id) {
    res.status(400).json({
      success: false,
      message: `Invalid ${label} ID.`,
    });

    return null;
  }

  return id;
};

/**
 * Validates that a value exists as non-empty text.
 *
 * Parameters:
 * value - the raw body field
 * res   - the Express response
 * label - the field name as the user should see it, e.g. "Tender name"
 *
 * Returns:
 * The trimmed string, or null having already sent a 400.
 *
 * Side effects:
 * May write the response.
 *
 * Notes:
 * Returns the *cleaned* value, so the caller should store what comes back
 * rather than the original. That is what stops "  Acme  " being written to
 * the database with its padding intact, and what makes a whitespace-only
 * field fail validation instead of becoming an empty row.
 */
const requireText = (
  value,
  res,
  label
) => {
  const cleaned =
    cleanText(value);

  if (!cleaned) {
    res.status(400).json({
      success: false,
      message: `${label} is required.`,
    });

    return null;
  }

  return cleaned;
};

/**
 * Checks whether a company-owned record exists.
 *
 * tableName and idColumn must come from controller constants,
 * never from request input.
 *
 * Purpose:
 * Before attaching a child row to a parent — a site to a tender, an expense
 * to a worker — the parent must be confirmed to exist *and* to belong to the
 * caller's company. Doing both in one query means a caller cannot discover
 * that another tenant's record exists by observing which error they get.
 *
 * Parameters (one options object):
 * client         - a pool or a transaction client; defaults to the pool, so
 *                  a check inside withTransaction must pass its client
 *                  explicitly or it will read outside the transaction
 * tableName      - the table to look in; a trusted constant, see below
 * idColumn       - the primary key column; defaults to "id"
 * recordId       - the id being checked
 * companyId      - the caller's company, from getCompanyId
 * includeDeleted - when false (the default) soft-deleted rows do not count
 *
 * Returns:
 * A boolean. Missing arguments return false rather than throwing, so a
 * controller that forgot one gets a clean "not found" rather than a 500.
 *
 * Side effects:
 * One SELECT ... LIMIT 1.
 *
 * Security:
 * tableName and idColumn are interpolated into the SQL string, not bound as
 * parameters — identifiers cannot be parameterised in Postgres. That makes
 * them an injection vector if they ever come from user input. Every current
 * caller passes a hard-coded literal, and the four wrappers below exist
 * partly so that stays true.
 *
 * recordId and companyId, by contrast, are bound as $1 and $2 and are safe.
 *
 * Performance:
 * LIMIT 1 with a primary-key lookup; the company_id filter is covered by the
 * per-table indexes. Cheap enough to call on every write path.
 */
const companyRecordExists = async ({
  client = pool,
  tableName,
  idColumn = "id",
  recordId,
  companyId,
  includeDeleted = false,
}) => {
  if (
    !tableName ||
    !recordId ||
    !companyId
  ) {
    return false;
  }

  /*
   * Soft deletes are the norm in this schema, so "exists" has to mean "is
   * live" by default — otherwise a controller would happily attach a new
   * child to a tender the office already removed.
   *
   * COALESCE guards the tables that predate the is_deleted column and may
   * hold NULL there; a bare `is_deleted = FALSE` would exclude those rows,
   * making every legacy record look deleted.
   */
  const deletedFilter =
    includeDeleted
      ? ""
      : `
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE
      `;

  const result =
    await client.query(
      `
      SELECT ${idColumn}
      FROM public.${tableName}
      WHERE ${idColumn} = $1
        AND company_id = $2
        ${deletedFilter}
      LIMIT 1
      `,
      [
        recordId,
        companyId,
      ]
    );

  return (
    result.rows.length > 0
  );
};

/*
|--------------------------------------------------------------------------
| Named existence checks
|--------------------------------------------------------------------------
|
| Four thin wrappers over companyRecordExists, one per entity that other
| records hang off. They exist for two reasons: the call site reads as the
| question being asked, and the table name stays a literal in this file
| rather than becoming an argument controllers pass around — which is what
| keeps the interpolated identifier in companyRecordExists safe.
|
| All four take an optional `client`, so they can participate in a
| transaction. All four exclude soft-deleted rows.
|
| Returns a boolean in every case; a false means either "no such row" or
| "not yours", deliberately indistinguishable to the caller.
|
*/

/**
 * Checks whether a tender belongs to the current company.
 *
 * Used before attaching sites, finance records, documents, workers,
 * subcontractors or payments to a tender.
 */
const tenderExists = async ({
  client = pool,
  tenderId,
  companyId,
}) =>
  companyRecordExists({
    client,
    tableName: "tenders",
    recordId: tenderId,
    companyId,
  });

/**
 * Checks whether a site belongs to the current company.
 */
const siteExists = async ({
  client = pool,
  siteId,
  companyId,
}) =>
  companyRecordExists({
    client,
    tableName: "sites",
    recordId: siteId,
    companyId,
  });

/**
 * Checks whether a worker belongs to the current company.
 */
const workerExists = async ({
  client = pool,
  workerId,
  companyId,
}) =>
  companyRecordExists({
    client,
    tableName: "workers",
    recordId: workerId,
    companyId,
  });

/**
 * Checks whether a subcontractor belongs to the current company.
 */
const subcontractorExists =
  async ({
    client = pool,
    subcontractorId,
    companyId,
  }) =>
    companyRecordExists({
      client,
      tableName:
        "subcontractors",
      recordId:
        subcontractorId,
      companyId,
    });

/**
 * Verifies that a site belongs to a tender and company.
 *
 * Purpose:
 * A two-level ownership check for nested routes of the form
 * /tenders/:tenderId/sites/:siteId. Confirming the site exists in the
 * company is not enough — it must be a site of *this* tender, or one
 * tender's page could be used to read or write another's site.
 *
 * Parameters (one options object):
 * client    - pool or transaction client; defaults to the pool
 * siteId    - the site being addressed
 * tenderId  - the tender it is claimed to belong to
 * companyId - the caller's company
 *
 * Returns:
 * Boolean. False when any argument is missing, when the row is soft-deleted,
 * or when the parentage does not hold.
 *
 * Side effects:
 * One SELECT ... LIMIT 1.
 *
 * Security:
 * All three values are bound parameters. Unlike companyRecordExists this
 * query has no interpolated identifiers at all.
 */
const siteBelongsToTender =
  async ({
    client = pool,
    siteId,
    tenderId,
    companyId,
  }) => {
    if (
      !siteId ||
      !tenderId ||
      !companyId
    ) {
      return false;
    }

    const result =
      await client.query(
        `
        SELECT id
        FROM public.sites
        WHERE id = $1
          AND tender_id = $2
          AND company_id = $3
          AND COALESCE(
            is_deleted,
            FALSE
          ) = FALSE
        LIMIT 1
        `,
        [
          siteId,
          tenderId,
          companyId,
        ]
      );

    return (
      result.rows.length > 0
    );
  };

/**
 * Runs database operations inside a transaction.
 *
 * Automatically commits on success and rolls back on failure.
 *
 * Purpose:
 * Several writes in this system are only correct as a set — creating a
 * payment and adjusting the balance it affects, or inserting a tender along
 * with its initial sites. This makes the all-or-nothing case the easy one to
 * write, and guarantees the client is returned to the pool either way.
 *
 * Parameters:
 * callback - async (client) => result. Every query inside must be issued on
 *            the supplied `client`, not on the pool. A query sent to the
 *            pool instead runs on a different connection and is therefore
 *            outside the transaction — it will not be rolled back.
 *
 * Returns:
 * Whatever the callback returns, after the COMMIT succeeds.
 *
 * Side effects:
 * Checks out a pooled connection, issues BEGIN / COMMIT or ROLLBACK, and
 * always releases the connection.
 *
 * Error handling:
 * The original error is re-thrown after rollback, so the caller — and
 * ultimately errorHandler.js — sees the real cause. A failure *during*
 * rollback is logged and deliberately not thrown, because replacing the
 * original error with the rollback error would hide why the transaction
 * failed in the first place.
 *
 * Performance:
 * Holds a pooled connection for the whole callback. Keep the callback to
 * database work — an HTTP call or a file write inside one starves the pool
 * under load.
 *
 * Usage:
 *   await withTransaction(async (client) => {
 *     await client.query("INSERT ...");
 *     await client.query("UPDATE ...");
 *   });
 */
const withTransaction =
  async (callback) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN"
      );

      const result =
        await callback(client);

      await client.query(
        "COMMIT"
      );

      return result;
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Transaction rollback failed:",
          rollbackError
        );
      }

      throw error;
    } finally {
      client.release();
    }
  };

/**
 * Produces a standard internal error response.
 *
 * Avoid exposing database details in production.
 *
 * Purpose:
 * The catch-all a controller reaches for when a query fails. Logs the real
 * error for the operator while showing the user something safe.
 *
 * Parameters:
 * res             - the Express response
 * error           - the caught error; logged in full, never sent as-is
 * fallbackMessage - what the user sees in production
 *
 * Returns:
 * The result of res.json, so a controller can `return sendServerError(...)`.
 *
 * Side effects:
 * Writes the full error to console.error and sends a 500.
 *
 * Security:
 * The message is only echoed to the client when NODE_ENV is "development".
 * A raw Postgres error reveals table and column names, and occasionally the
 * offending value — useful while building, an information leak in
 * production. The environment check is what keeps the two apart.
 *
 * Notes:
 * Reads process.env.NODE_ENV directly rather than the IS_PRODUCTION flag
 * from config/env.js. The effect is the same but the condition is inverted:
 * anything that is not exactly "development" — including an unset
 * NODE_ENV — gets the safe message. That failure direction is the right one.
 */
const sendServerError = (
  res,
  error,
  fallbackMessage =
    "Server error."
) => {
  console.error(
    fallbackMessage,
    error
  );

  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV ===
      "development"
        ? error.message ||
          fallbackMessage
        : fallbackMessage,
  });
};

/**
 * Produces a standard not-found response.
 *
 * Parameters:
 * res   - the Express response
 * label - the noun for the message; defaults to "Record"
 *
 * Returns:
 * The result of res.json, so callers can `return sendNotFound(res)`.
 *
 * Security:
 * This is also the response for a record that exists but belongs to another
 * company. Answering 404 rather than 403 in that case is deliberate: a 403
 * would confirm the record exists, letting a caller enumerate other tenants'
 * ids.
 */
const sendNotFound = (
  res,
  label = "Record"
) =>
  res.status(404).json({
    success: false,
    message: `${label} not found.`,
  });

/**
 * Produces a standard forbidden response.
 *
 * Parameters:
 * res     - the Express response
 * message - overridable wording for role-specific refusals
 *
 * Returns:
 * The result of res.json.
 *
 * Notes:
 * Reserved for cases where the caller may legitimately know the record
 * exists but is not permitted to act on it — a supervisor editing outside
 * the entry window, say. For "not yours", use sendNotFound instead.
 */
const sendForbidden = (
  res,
  message =
    "You do not have permission to perform this action."
) =>
  res.status(403).json({
    success: false,
    message,
  });

module.exports = {
  cleanText,
  cleanLowerText,
  toNumber,
  toPositiveInteger,
  emptyToNull,

  getUserId,
  getCompanyId,
  getUserRole,

  requireCompanyId,
  requireParamId,
  requireText,

  companyRecordExists,
  tenderExists,
  siteExists,
  workerExists,
  subcontractorExists,
  siteBelongsToTender,

  withTransaction,

  sendServerError,
  sendNotFound,
  sendForbidden,
};