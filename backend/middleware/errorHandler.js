/*
|--------------------------------------------------------------------------
| Global error handler
|--------------------------------------------------------------------------
|
| The last middleware in server.js. Anything thrown by a route — including
| inside an async handler, because utils/asyncHandler.js forwards rejections
| to next() — arrives here and is turned into a JSON response of the same
| shape the rest of the API uses:
|
|     { success: false, message: "..." }
|
| Two jobs, and they pull in opposite directions:
|
|   Tell the caller enough to act on.  A duplicate email should say so, not
|   "Internal server error".
|
|   Tell an attacker nothing.  A raw PostgreSQL error leaks table names,
|   column names, constraint names and sometimes row contents. So on a 5xx
|   in production the message is replaced with a generic one and the detail
|   goes to the log instead — where it is still available to whoever is
|   debugging, keyed by the request id the logger attached.
|
| In development the original error is echoed back in an `error` object,
| which is why an unfamiliar failure is far easier to diagnose locally than
| against the deployed API.
|
*/

const { NODE_ENV } = require("../config/env");

const isDevelopment =
  NODE_ENV === "development";

/**
 * Maps PostgreSQL error codes to safe HTTP responses.
 *
 * The codes are the five-character SQLSTATE values node-postgres puts on
 * error.code. Grouped by what they mean for the caller:
 *
 *   23xxx  integrity violations — usually the caller's fault, so 4xx.
 *          23505 unique violation      -> 409, refined by constraint below
 *          23503 foreign key violation -> 409, the row is still referenced
 *          23502 not-null violation    -> 400
 *          23514 check violation       -> 400
 *
 *   22xxx  data exceptions — a value the caller sent is malformed, 400.
 *          22P02 invalid text representation, e.g. "abc" for an integer
 *          22001 string too long for the column
 *          22003 numeric out of range
 *
 *   42xxx  the application is wrong, not the caller, so 5xx.
 *          42P01 undefined table  -> a migration has not been run
 *          42703 undefined column -> a query names a column that is gone
 *          42501 insufficient privilege -> 403; under row-level security
 *                this is what a cross-tenant write looks like
 *
 *   57014  query cancelled — the statement_timeout fired. 408.
 *   53300  too many connections. 503, and worth retrying.
 *   08xxx  connection exceptions. 503, the database is unreachable.
 *
 * Returns null for anything unrecognised, so the caller falls back to the
 * error's own statusCode or 500.
 */
const getPostgresErrorResponse = (error) => {
  switch (error.code) {
    case "23505":
      return {
        statusCode: 409,
        message:
          "A record with the same unique information already exists.",
      };

    case "23503":
      return {
        statusCode: 409,
        message:
          "This operation cannot be completed because the record is linked to other data.",
      };

    case "23502":
      return {
        statusCode: 400,
        message:
          "A required database value is missing.",
      };

    case "23514":
      return {
        statusCode: 400,
        message:
          "One or more values do not meet the required rules.",
      };

    case "22P02":
      return {
        statusCode: 400,
        message:
          "One or more supplied values have an invalid format.",
      };

    case "22001":
      return {
        statusCode: 400,
        message:
          "One or more supplied values are too long.",
      };

    case "22003":
      return {
        statusCode: 400,
        message:
          "One or more supplied numbers are outside the supported range.",
      };

    case "42P01":
      return {
        statusCode: 500,
        message:
          "A required database table is unavailable.",
      };

    case "42703":
      return {
        statusCode: 500,
        message:
          "The application is using a database field that does not exist.",
      };

    case "42501":
      return {
        statusCode: 403,
        message:
          "The database denied permission for this operation.",
      };

    case "57014":
      return {
        statusCode: 408,
        message:
          "The database operation timed out.",
      };

    case "53300":
      return {
        statusCode: 503,
        message:
          "The database is temporarily too busy. Please try again.",
      };

    case "08000":
    case "08001":
    case "08003":
    case "08004":
    case "08006":
    case "08007":
      return {
        statusCode: 503,
        message:
          "The database is temporarily unavailable.",
      };

    default:
      return null;
  }
};

/**
 * Attempts to produce a clearer message for duplicate constraints.
 *
 * A 23505 on its own can only say "something unique already exists", which
 * tells the user nothing about which field to change. PostgreSQL names the
 * index it violated on error.constraint, so matching on that recovers the
 * meaning: "An account with this email already exists."
 *
 * Matched with `includes` rather than equality because the index names are
 * not consistent across the schema — some come from migration 001, some
 * from the original schema.sql, and Supabase's baseline renamed a few. A
 * substring is resilient to that.
 *
 * Order matters: `users_email` is tested before the bare `email` so the
 * more specific message wins.
 *
 * Returns null when nothing matches, and the caller keeps the generic text.
 * Note this only ever reveals which *field* collided, never the value that
 * is already stored — so it cannot be used to enumerate accounts beyond
 * what a registration attempt already tells you.
 */
const getDuplicateMessage = (error) => {
  const constraint = String(
    error.constraint || ""
  ).toLowerCase();

  if (
    constraint.includes("users_email") ||
    constraint.includes("email")
  ) {
    return "An account with this email already exists.";
  }

  if (
    constraint.includes("company_users")
  ) {
    return "This user is already linked to the company.";
  }

  if (
    constraint.includes("worker_assignments")
  ) {
    return "This worker is already assigned to the selected tender site.";
  }

  if (
    constraint.includes("tender_subcontractors")
  ) {
    return "This subcontractor is already assigned to the tender.";
  }

  if (
    constraint.includes("invoice_number")
  ) {
    return "An invoice with this number already exists.";
  }

  if (
    constraint.includes("contract_number")
  ) {
    return "A tender with this contract number already exists.";
  }

  if (
    constraint.includes("gst_number")
  ) {
    return "A record with this GST number already exists.";
  }

  return null;
};

/**
 * Express global error handler.
 *
 * This must be registered after every route and the 404 handler.
 *
 * The four-argument signature is what marks it as an error handler to
 * Express — dropping `next`, even though it is only used in one branch,
 * would silently turn it back into ordinary middleware and every error
 * would fall through to Express's default HTML error page.
 *
 * Status code is resolved in priority order:
 *
 *   error.statusCode        set deliberately by a service, e.g. 409 for
 *                           "already assigned"
 *   error.status            the same idea, as some libraries name it
 *   postgres mapping        from the SQLSTATE above
 *   500                     nothing else applied
 *
 * and then sanity-checked: anything not an integer in 400..599 becomes 500,
 * so a bad value cannot produce a 200 response carrying success: false.
 *
 * Message is resolved the same way, with `publicMessage` first — that is
 * the convention services use to mark a message as deliberately safe to
 * show a user.
 */
function errorHandler(
  error,
  req,
  res,
  next
) {
  /*
   * Streaming or a partially written response means the status line has
   * already gone out and cannot be changed. Hand it to Express's built-in
   * handler, which closes the connection.
   */
  if (res.headersSent) {
    return next(error);
  }

  const postgresResponse =
    getPostgresErrorResponse(
      error
    );

  let statusCode =
    Number(
      error.statusCode ||
        error.status ||
        postgresResponse?.statusCode ||
        500
    );

  if (
    !Number.isInteger(statusCode) ||
    statusCode < 400 ||
    statusCode > 599
  ) {
    statusCode = 500;
  }

  let message =
    error.publicMessage ||
    postgresResponse?.message ||
    error.message ||
    "Internal server error.";

  if (error.code === "23505") {
    message =
      getDuplicateMessage(error) ||
      message;
  }

  /*
   * The disclosure boundary. On a server error in production, discard
   * whatever the original message said — it may name a table, a column or
   * a constraint — and use either the vetted PostgreSQL text or a generic
   * line. The real message still reaches the log below.
   *
   * 4xx messages pass through untouched: those describe what the caller
   * did wrong and are meant to be read.
   */
  if (
    statusCode >= 500 &&
    !isDevelopment
  ) {
    message =
      postgresResponse?.message ||
      "Internal server error.";
  }

  /*
   * What goes to the log rather than to the caller. userId and companyId
   * come from req.user, so an error after authentication can be traced to
   * a person and a tenant.
   */
  const logDetails = {
    timestamp:
      new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    statusCode,
    errorName:
      error.name || "Error",
    errorCode:
      error.code || null,
    constraint:
      error.constraint || null,
    message:
      error.message || null,
    userId:
      req.user?.id || null,
    companyId:
      req.user?.company_id ||
      null,
  };

  if (statusCode >= 500) {
    console.error(
      "Unhandled server error:",
      {
        ...logDetails,
        stack: error.stack,
        detail:
          isDevelopment
            ? error.detail ||
              null
            : undefined,
      }
    );
  } else {
    console.warn(
      "Handled request error:",
      logDetails
    );
  }

  const response = {
    success: false,
    message,
  };

  /*
   * Development only: echo the raw PostgreSQL detail back to the caller so
   * it shows up in the browser's network tab instead of having to be dug
   * out of the server log. This block is exactly what must never run in
   * production — table, column and constraint names are a map of the
   * schema.
   */
  if (isDevelopment) {
    response.error = {
      name:
        error.name || "Error",
      code:
        error.code || null,
      constraint:
        error.constraint ||
        null,
      detail:
        error.detail || null,
      table:
        error.table || null,
      column:
        error.column || null,
      path: req.originalUrl,
    };
  }

  return res
    .status(statusCode)
    .json(response);
}

module.exports = errorHandler;