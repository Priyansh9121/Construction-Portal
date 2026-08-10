/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The write side of the audit trail. Anything that answers "who changed
| this figure, and when" is inserted into activity_logs from here.
|
| Responsibilities:
|   - Redact secrets out of anything before it reaches the audit table
|   - Reduce a before/after pair to only the fields that changed
|   - Insert one activity_logs row, without ever failing the request
|   - Provide route-level middleware that logs successful mutations
|
| Exports:
|   record()        write one audit row directly
|   logActivity()   Express middleware wrapping a mutating route
|   diff()          before/after reducer (exported for tests)
|   redact()        secret stripper (exported for tests)
|   ACTIVITY_ACTIONS  re-exported from config/constants for caller
|                     convenience, so a route needs one require, not two
|
| Used by:
|   backend/modules/payments/payment.routes.js
|   backend/modules/tenders/tender.routes.js
|   backend/modules/auth/auth.routes.js
|   backend/modules/workerMoney/workerAllocation.routes.js
|   backend/modules/workerMoney/workerExpense.routes.js
|   backend/modules/dailyUpdateApprovals/dailyUpdateApproval.routes.js
|   backend/modules/notifications/activity.controller.js (the read side)
|   backend/tests/activityLog.test.js
|
| Depends on:
|   database/pool.js   for the INSERT
|   config/constants.js  for the ACTIVITY_ACTIONS vocabulary
|
| Database tables touched:
|   activity_logs (INSERT only — reads live in activity.controller.js)
|
| Frontend surface:
|   the rows written here are what frontend/src/pages/ActivityPage.jsx
|   displays.
|
| Known limitation:
|   Because logActivity hooks res.json, it only ever sees the record as it
|   ended up — never its prior value. old_data is therefore empty for
|   creates and updates. Recorded as F-05 in
|   docs/repository-reference/findings.md.
|
*/

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
 *
 * Security:
 * The audit trail is readable by admins through the Activity page, and is
 * retained far longer than any individual record. Anything here would be a
 * credential or an identity document leaking into a long-lived, widely
 * readable table — password hashes from a user update, reset tokens from a
 * forgotten-password flow, and the encrypted worker banking fields.
 *
 * Matching is case-insensitive (see redact), so "Authorization" and
 * "authorization" are both caught. Add to this set rather than filtering at
 * a call site: a new module that logs a sensitive field would otherwise
 * silently start storing it.
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

  /*
   * Plain-text payment identifiers — F-12.
   *
   * The three entries above cover the ENCRYPTED worker columns in
   * worker_sensitive_details. Their plain-text counterparts were never
   * listed, so any payload carrying one was written to activity_logs
   * verbatim.
   *
   * This is not hypothetical. tender_banking IS audited — see the
   * logActivity("tender_banking", ...) calls in tender.routes.js — and
   * those rows carry account_number, so every create and update of a
   * tender banking record has been copying an account number into the
   * audit table. subcontractors is not audited today, but adding it would
   * otherwise be an uncontroversial change that quietly started doing the
   * same.
   *
   * Scoped deliberately to the values that enable fraud on their own: an
   * account number, a routing code, a tax file number. bank_name and
   * account_name are NOT redacted — "changed the bank from X to Y" is
   * exactly what an audit trail is for, and neither value is usable
   * without the identifiers above.
   */
  "account_number",
  "ifsc_code",
  "bsb",
  "tfn",
]);

/**
 * Recursively strips sensitive values from an object.
 *
 * Purpose:
 * Guarantees that nothing in REDACTED_KEYS can reach activity_logs, however
 * deeply nested it is inside the record being logged.
 *
 * Parameters:
 * value - any value: object, array, Date, Buffer, primitive, null
 * depth - recursion depth, supplied internally; callers pass nothing
 *
 * Returns:
 * A structurally similar value with sensitive leaves replaced by the string
 * "[redacted]". Primitives are returned unchanged.
 *
 * Side effects:
 * None — a new object is built rather than the input mutated. That matters
 * because the value being logged is usually the same object about to be
 * serialised into the HTTP response.
 *
 * Security:
 * This is the only barrier between a controller's payload and a long-lived
 * audit table. It fails safe on depth: beyond six levels the value is
 * returned as-is rather than walked further.
 *
 * Performance:
 * The depth cap also bounds the work per log write and makes a cyclic
 * object impossible to hang on — a self-referencing row would otherwise
 * recurse until the stack gave out.
 */
const redact = (value, depth = 0) => {
  if (value == null) {
    return value;
  }

  /*
   * F-08. The cap used to return the subtree untouched, which failed OPEN:
   * anything in REDACTED_KEYS deeper than six levels was written to
   * activity_logs verbatim. Since F-12 that list includes payment
   * identifiers, so the failure mode was an account number surviving into a
   * table retained longer and read more widely than the register it came
   * from.
   *
   * No current payload nests anywhere near this deep. That is exactly why it
   * must fail closed: the guard only ever runs on a shape nobody
   * anticipated, and an unanticipated shape is the one not to trust.
   */
  if (depth > 6) {
    return "[truncated]";
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      redact(item, depth + 1)
    );
  }

  if (typeof value !== "object") {
    return value;
  }

  /*
   * node-pg returns TIMESTAMPTZ columns as Date objects, and a Date has no
   * enumerable own properties — walking into one the way we walk a plain
   * object returns {} and loses the timestamp. Every created_at and
   * updated_at in the trail was being stored as an empty object.
   */
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return "[binary]";
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
 *
 * Parameters:
 * before - the record as it was, or null when there was no prior version
 * after  - the record as it now is, or null for a delete
 *
 * Returns:
 * { old, new } — two redacted objects. When both inputs are present these
 * contain only the differing keys; when either is missing the whole of each
 * side is returned instead, because there is nothing to compare against.
 *
 * Side effects:
 * None.
 *
 * Notes:
 * In practice `before` is almost always null, because logActivity can only
 * observe the response. This function is nevertheless written and tested for
 * the general case so that a caller invoking record() directly — which can
 * supply a genuine `before` — gets a real delta. See F-05 in
 * docs/repository-reference/findings.md.
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

  /*
   * Iterate the union of both key sets, not just `before`'s. A column added
   * by the update — or one dropped from the payload entirely — is a change,
   * and walking only one side would miss it in one direction.
   */
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
 *
 * Purpose:
 * The single INSERT point for the audit trail. Everything that ends up in
 * activity_logs passes through here.
 *
 * Parameters (one options object):
 * req        - the Express request; supplies the actor (user id), the
 *              tenant (company id), the IP and the user agent
 * action     - a value from ACTIVITY_ACTIONS, e.g. "create"
 * module     - which area of the product acted, e.g. "payments"
 * recordId   - the id of the row acted on, or null
 * entityType - what kind of thing it was; defaults to `module`
 * before     - prior state, or null
 * after      - resulting state, or null
 *
 * Returns:
 * A promise that always resolves — never rejects, because the rejection is
 * swallowed by the .catch below. Returned only so tests can await the write.
 *
 * Side effects:
 * One INSERT into activity_logs. Writes to console.error if that fails.
 *
 * Business rules:
 * company_id and user_id are read from the authenticated request rather than
 * taken as arguments, so a caller cannot attribute an action to another
 * tenant or another user.
 *
 * Security:
 * Payloads pass through diff() and therefore redact() before storage, so
 * secrets never reach the table.
 *
 * Performance:
 * Fire-and-forget by design. Callers do not await, so the INSERT runs
 * alongside the response rather than delaying it. The trade-off is that a
 * write failing after the response has been sent can only be logged, which
 * is the deliberate choice described in the banner above.
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
 * The keys modules return their created or updated record under.
 *
 * Kept as a list rather than a chain of ?? so a new module only has to add
 * its key here.
 */
const ENTITY_KEYS = [
  "payment",
  "entry",
  "labour",
  "item",
  "receipt",
  "expense",
  "allocation",
  "siteLog",
  "approval",
  "tender",
  "worker",
  "subcontractor",
  "invoice",
  "site",
  "document",
  "material",
  "banking",
  "finance",
  "assignment",
  "user",
  "request",
];

/**
 * The id this row is about: the returned record's, or the one addressed in
 * the path when the response carries no body (a delete, typically).
 *
 * Purpose:
 * Without an id the audit row records that *something* was deleted but not
 * what, which is exactly the case an audit trail exists to answer.
 *
 * Parameters:
 * entity - the record found in the response body, or null
 * req    - the Express request, used as the fallback source of the id
 *
 * Returns:
 * A finite number, or null when no usable id could be found. Never NaN.
 *
 * Side effects:
 * None.
 */
const resolveRecordId = (entity, req) => {
  if (entity?.id != null) {
    return Number(entity.id);
  }

  const fromPath =
    req?.params?.id ??
    req?.params?.userId ??
    null;

  const parsed = Number(fromPath);

  // Number(undefined) is NaN, and NaN ?? null is still NaN — which
  // Postgres rejects for a bigint column. Check the result, not the input.
  return Number.isFinite(parsed)
    ? parsed
    : null;
};

/**
 * Express middleware that logs a successful mutating request.
 *
 * Hooks res.json so the created or updated record is available, and only
 * records when the response was a success.
 *
 * Purpose:
 * Lets a route opt into auditing with one line at the route definition,
 * rather than each controller remembering to call record() on every exit
 * path. A controller that returns early still gets logged, because the hook
 * sits on the response rather than in the controller.
 *
 * Parameters:
 * module - the area of the product, stored on the row
 * action - a value from ACTIVITY_ACTIONS
 *
 * Returns:
 * Express middleware (req, res, next).
 *
 * Side effects:
 * Replaces res.json for the lifetime of this request, and — if the response
 * is a success — triggers an unawaited INSERT into activity_logs.
 *
 * Business rules:
 * Only successful mutations are recorded. A rejected or failed attempt
 * produces no audit row, so the trail reflects what happened rather than
 * what was tried.
 *
 * Usage:
 *   router.post(
 *     "/",
 *     logActivity("payments", ACTIVITY_ACTIONS.CREATE),
 *     asyncHandler(controller.createPayment)
 *   );
 *
 * Notes:
 * Mount this before the controller. Monkey-patching res.json is unusual, but
 * it is the only place where both the request context and the resulting
 * record are in scope at once.
 */
const logActivity = (
  module,
  action
) => (req, res, next) => {
  const originalJson =
    res.json.bind(res);

  /*
   * Wrap rather than replace: the original is captured first and always
   * called at the end, so the response goes out exactly as the controller
   * intended whether or not the audit write succeeds.
   */
  res.json = (body) => {
    /*
     * Two independent ways a request can have failed. The status code
     * catches a controller that set 4xx/5xx explicitly; the body flag
     * catches one that returned 200 with { success: false }, which parts of
     * this API do for soft validation failures.
     */
    const succeeded =
      res.statusCode < 400 &&
      body?.success !== false;

    if (succeeded) {
      // Find the returned entity under whichever key the module used.
      const entity =
        ENTITY_KEYS.reduce(
          (found, key) =>
            found ?? body?.[key] ?? null,
          null
        );

      record({
        req,
        action,
        module,
        recordId: resolveRecordId(
          entity,
          req
        ),
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
