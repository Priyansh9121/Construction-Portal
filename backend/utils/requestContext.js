const pool = require("../database/pool");

/**
 * Converts a value to trimmed text.
 *
 * Returns an empty string for null, undefined and non-string values.
 */
const cleanText = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

/**
 * Converts a value to lowercase trimmed text.
 */
const cleanLowerText = (value) =>
  cleanText(value).toLowerCase();

/**
 * Converts a value to a finite number.
 *
 * Returns fallback when conversion fails.
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
 */
const getCompanyId = (req) =>
  toPositiveInteger(
    req.user?.company_id
  );

/**
 * Returns the authenticated user's role.
 */
const getUserRole = (req) =>
  cleanLowerText(
    req.user?.role
  );

/**
 * Creates a standard 400 response when the authenticated
 * account has no company relationship.
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

/**
 * Checks whether a tender belongs to the current company.
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