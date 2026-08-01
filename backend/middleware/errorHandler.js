const { NODE_ENV } = require("../config/env");

const isDevelopment =
  NODE_ENV === "development";

/**
 * Maps PostgreSQL error codes to safe HTTP responses.
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
 */
function errorHandler(
  error,
  req,
  res,
  next
) {
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

  if (
    statusCode >= 500 &&
    !isDevelopment
  ) {
    message =
      postgresResponse?.message ||
      "Internal server error.";
  }

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