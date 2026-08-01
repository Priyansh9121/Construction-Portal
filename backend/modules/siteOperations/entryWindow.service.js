const pool = require("../../database/pool");

const {
  SUPERVISOR_EDIT_WINDOW_DAYS,
  SUPERVISOR_BANKING_GRACE_DAYS,
  DEFAULT_TIMEZONE,
} = require("../../config/env");

/*
|--------------------------------------------------------------------------
| Entry window
|--------------------------------------------------------------------------
|
| From the site notebook:
|
|   "All of this must be added within 2 days. To add a bill with a date
|    older than 2 days you have to call the company and take access."
|
|   "One extra day is given for adding [banking]. After 2 days, to enter any
|    older entry they must call the company and take access."
|
| So the rule is:
|
|   * future dates are never allowed
|   * within the window, anyone may record
|   * beyond the window, a supervisor needs a granted, unexpired
|     entry_access_request for that exact date and module
|   * admins bypass the window
|
| Every module that records dated site activity — material, labour, banking,
| expenses, daily updates — goes through checkEntryWindow so the rule is
| defined once rather than re-derived per controller.
|
*/

const MODULES = Object.freeze({
  MATERIAL: "material",
  LABOUR: "labour",
  BANKING: "banking",
  EXPENSE: "expense",
  DAILY_UPDATE: "daily_update",
});

/**
 * Roles allowed to record outside the window without a grant.
 */
const WINDOW_EXEMPT_ROLES = new Set([
  "admin",
  "manager",
]);

/**
 * Today's calendar date in the company's timezone, as YYYY-MM-DD.
 *
 * This has to be the site's local date, not the server's UTC date. A
 * supervisor in IST (UTC+5:30) entering work at 8pm is on tomorrow's UTC
 * date; comparing against UTC would reject their own current day as being
 * in the future. The same applies anywhere east of Greenwich for part of
 * every evening.
 *
 * en-CA is used purely because it formats as YYYY-MM-DD.
 */
const todayInCompanyTimezone = (
  timeZone = DEFAULT_TIMEZONE
) => {
  try {
    return new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).format(new Date());
  } catch {
    // Unknown timezone string — fall back to UTC rather than throwing.
    return new Date()
      .toISOString()
      .slice(0, 10);
  }
};

/**
 * Whole calendar days between a date and today, ignoring clock time.
 *
 * Both sides are reduced to a YYYY-MM-DD calendar date first, so the result
 * counts day boundaries rather than elapsed hours. Returns a negative number
 * for a future date, and null when the input is not a usable date.
 */
const daysAgo = (
  value,
  timeZone = DEFAULT_TIMEZONE
) => {
  if (!value) {
    return null;
  }

  // Accept both "2026-08-02" and a full timestamp.
  const raw = String(value).trim();

  const dateOnly = /^\d{4}-\d{2}-\d{2}/
    .exec(raw)?.[0];

  const targetKey = dateOnly
    ? dateOnly
    : (() => {
        const parsed = new Date(raw);

        return Number.isNaN(
          parsed.getTime()
        )
          ? null
          : parsed
              .toISOString()
              .slice(0, 10);
      })();

  if (!targetKey) {
    return null;
  }

  // Parsing "YYYY-MM-DD" with Date.UTC keeps both sides on the same clock,
  // so the subtraction is a pure day count with no DST drift.
  const toEpochDay = (key) => {
    const [y, m, d] = key
      .split("-")
      .map(Number);

    return Date.UTC(y, m - 1, d);
  };

  const target = toEpochDay(
    targetKey
  );

  if (Number.isNaN(target)) {
    return null;
  }

  const today = toEpochDay(
    todayInCompanyTimezone(timeZone)
  );

  return Math.round(
    (today - target) / 86400000
  );
};

/**
 * Looks for a live access grant covering one date and module.
 *
 * A grant is usable when it is granted, not expired, and not already
 * consumed by an earlier entry.
 */
const findUsableGrant = async ({
  companyId,
  userId,
  module,
  targetDate,
}) => {
  const result = await pool.query(
    `
    SELECT id, expires_at
    FROM entry_access_requests
    WHERE company_id = $1
      AND requested_by = $2
      AND module = $3
      AND target_date = $4
      AND status = 'granted'
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY id DESC
    LIMIT 1
    `,
    [
      companyId,
      userId,
      module,
      targetDate,
    ]
  );

  return result.rows[0] || null;
};

/**
 * Decides whether an entry may be recorded for a given date.
 *
 * Returns:
 *   { allowed: true,  accessRequestId }   — proceed; record the grant id
 *   { allowed: false, reason, ... }       — refuse, with a usable message
 *
 * The caller is responsible for turning a refusal into an HTTP response,
 * because the right status differs: a future date is a 400 (bad input)
 * whereas a stale date is a 403 (needs permission).
 */
const checkEntryWindow = async ({
  companyId,
  userId,
  userRole,
  module,
  entryDate,
  windowDays,
}) => {
  const age = daysAgo(entryDate);

  if (age === null) {
    return {
      allowed: false,
      status: 400,
      reason: "INVALID_DATE",
      message:
        "The entry date is not a valid date.",
    };
  }

  if (age < 0) {
    return {
      allowed: false,
      status: 400,
      reason: "FUTURE_DATE",
      message:
        "Entries cannot be recorded for a future date.",
    };
  }

  const limit =
    typeof windowDays === "number"
      ? windowDays
      : module === MODULES.BANKING
      ? SUPERVISOR_EDIT_WINDOW_DAYS +
        SUPERVISOR_BANKING_GRACE_DAYS
      : SUPERVISOR_EDIT_WINDOW_DAYS;

  if (age <= limit) {
    return {
      allowed: true,
      accessRequestId: null,
      daysOld: age,
    };
  }

  if (
    WINDOW_EXEMPT_ROLES.has(
      String(userRole || "")
        .trim()
        .toLowerCase()
    )
  ) {
    return {
      allowed: true,
      accessRequestId: null,
      daysOld: age,
      viaRole: true,
    };
  }

  const grant = await findUsableGrant({
    companyId,
    userId,
    module,
    targetDate: entryDate,
  });

  if (grant) {
    return {
      allowed: true,
      accessRequestId: grant.id,
      daysOld: age,
    };
  }

  return {
    allowed: false,
    status: 403,
    reason: "ACCESS_REQUIRED",
    daysOld: age,
    windowDays: limit,
    message: `This entry is ${age} days old. Entries older than ${limit} days need approval from the office. Request access for ${entryDate} and try again once it is granted.`,
  };
};

/**
 * Marks a grant as consumed.
 *
 * Called after the entry it authorised has been written, so a single grant
 * cannot be reused to backfill an unlimited number of records.
 */
const consumeGrant = async (
  accessRequestId,
  companyId
) => {
  if (!accessRequestId) {
    return;
  }

  await pool.query(
    `
    UPDATE entry_access_requests
    SET status = 'used',
        used_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
      AND company_id = $2
      AND status = 'granted'
    `,
    [accessRequestId, companyId]
  );
};

module.exports = {
  MODULES,
  checkEntryWindow,
  consumeGrant,
  daysAgo,
  todayInCompanyTimezone,
};
