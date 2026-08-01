const pool = require("../database/pool");

const {
  ACTIVITY_ACTIONS,
} = require("../config/constants");

/*
|--------------------------------------------------------------------------
| Activity log
|--------------------------------------------------------------------------
|
| activity_logs already existed in the database with nothing writing to it.
| For a system handling payments and approvals, an audit trail is the thing
| you need most on the day someone asks who changed a figure.
|
| Design notes:
|
|   * Logging never breaks the request. A failed write is reported to the
|     console and swallowed — an audit miss is bad, but failing a payment
|     because the audit insert failed is worse.
|
|   * Calls are fire-and-forget by default. The caller does not await, so
|     the log does not sit in the response's critical path.
|
|   * Payloads are redacted before storage. Diffs of a user record would
|     otherwise capture password hashes and reset tokens.
|
*/

/**
 * Keys never written to the audit trail.
 */
const REDACTED_KEYS = new Set([
  "password",
  "password_hash",
  "new_password",
  "current_password",
  "confirm_password",
  "reset_token",
  "reset_token_expires",
  "token",
  "refresh_token",
  "jwt",
  "authorization",
  "secret",
  "encrypted_tfn",
  "encrypted_account_number",
  "encrypted_bsb",
]);

/**
 * Recursively strips sensitive values from an object.
 */
const redact = (value, depth = 0) => {
  if (depth > 6 || value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      redact(item, depth + 1)
    );
  }

  if (typeof value !== "object") {
    return value;
  }

  return Object.entries(value).reduce(
    (acc, [key, val]) => {
      acc[key] = REDACTED_KEYS.has(
        key.toLowerCase()
      )
        ? "[redacted]"
        : redact(val, depth + 1);

      return acc;
    },
    {}
  );
};

/**
 * Reduces a before/after pair to only the fields that actually changed.
 *
 * Storing whole rows makes the log expensive to read; storing the delta
 * makes "what changed" answerable at a glance.
 */
const diff = (before, after) => {
  if (!before || !after) {
    return {
      old: redact(before),
      new: redact(after),
    };
  }

  const changedOld = {};

  const changedNew = {};

  Object.keys({
    ...before,
    ...after,
  }).forEach((key) => {
    const a = before[key];

    const b = after[key];

    // Compare loosely: pg returns numerics as strings, so 100 and "100"
    // are the same value arriving in two shapes.
    if (
      String(a ?? "") !==
      String(b ?? "")
    ) {
      changedOld[key] = a;
      changedNew[key] = b;
    }
  });

  return {
    old: redact(changedOld),
    new: redact(changedNew),
  };
};

/**
 * Writes one audit row.
 *
 * Intentionally not awaited by callers. Returns a promise for tests that
 * want to assert on it.
 */
const record = ({
  req,
  action,
  module,
  recordId = null,
  entityType = null,
  before = null,
  after = null,
}) => {
  const companyId =
    req?.user?.company_id || null;

  const userId = req?.user?.id || null;

  const payload = diff(before, after);

  return pool
    .query(
      `
      INSERT INTO activity_logs
        (company_id, user_id, action, module, record_id,
         entity_type, entity_id, old_data, new_data,
         ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        companyId,
        userId,
        action,
        module,
        recordId,
        entityType || module,
        recordId,
        JSON.stringify(
          payload.old ?? {}
        ),
        JSON.stringify(
          payload.new ?? {}
        ),
        // inet accepts null; an unparsable address would abort the insert.
        req?.ip || null,
        req?.headers?.[
          "user-agent"
        ] || null,
      ]
    )
    .catch((error) => {
      console.error(
        "[activity-log] write failed:",
        {
          action,
          module,
          message: error.message,
        }
      );
    });
};

/**
 * Express middleware that logs a successful mutating request.
 *
 * Hooks res.json so the created or updated record is available, and only
 * records when the response was a success.
 */
const logActivity = (
  module,
  action
) => (req, res, next) => {
  const originalJson =
    res.json.bind(res);

  res.json = (body) => {
    const succeeded =
      res.statusCode < 400 &&
      body?.success !== false;

    if (succeeded) {
      // Find the returned entity under whichever key the module used.
      const entity =
        body?.payment ??
        body?.entry ??
        body?.labour ??
        body?.item ??
        body?.receipt ??
        body?.expense ??
        body?.allocation ??
        body?.siteLog ??
        body?.approval ??
        null;

      record({
        req,
        action,
        module,
        recordId:
          entity?.id ??
          Number(req.params?.id) ??
          null,
        after: entity,
      });
    }

    return originalJson(body);
  };

  next();
};

module.exports = {
  record,
  logActivity,
  diff,
  redact,
  ACTIVITY_ACTIONS,
};
