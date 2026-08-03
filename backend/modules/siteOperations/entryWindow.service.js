/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The backdating rule, defined once for the whole application.
|
| Site staff record what happened on a date, and the office needs that to
| happen promptly — a ledger filled in weeks later is not a record, it is a
| reconstruction. So entries may be made for today or the recent past, and
| anything older needs the office to grant access for that specific date.
|
| This file owns the whole of that decision: what "today" means, how old an
| entry is, whether a grant covers it, and whether the grant has been used.
|
| Responsibilities:
|   - Resolve today's date in the configured timezone, not the server's
|   - Count whole calendar days between a date and today
|   - Decide whether an entry may be recorded, with a usable reason
|   - Find and consume access grants
|
| Exports:
|   MODULES                 the five dated modules this applies to
|   checkEntryWindow()      the decision
|   consumeGrant()          marks a grant used after the entry is written
|   daysAgo()               the day-count helper, exported for reuse
|   todayInCompanyTimezone()  exported for tests
|
| Used by:
|   ./material.controller.js, ./labour.controller.js,
|   ./banking.controller.js  — the dated site-operations entries
|   modules/siteLogs/siteLog.controller.js — imports daysAgo() only; see
|     the note below
|
| Depends on:
|   database/pool.js — for the grant lookup
|   config/env.js    — SUPERVISOR_EDIT_WINDOW_DAYS,
|                      SUPERVISOR_BANKING_GRACE_DAYS, DEFAULT_TIMEZONE
|
| Database tables touched:
|   entry_access_requests — SELECT for a usable grant, UPDATE to consume it
|
| TIMEZONE — the reason this file exists in the form it does.
|
|   "Today" must be the SITE's calendar day, not the host's. A supervisor
|   in IST recording work at 8pm is already on tomorrow's UTC date;
|   measured against UTC, their own current day looks like the future and
|   the entry is refused.
|
|   todayInCompanyTimezone resolves the date through Intl, so it is also
|   correct across daylight-saving transitions — a fixed UTC offset would
|   be right in one season and wrong in the other.
|
|   This was F-13. siteLog.controller.js had its own inline arithmetic
|   using the server clock and has been migrated to daysAgo(). Covered by
|   backend/tests/entryWindowTimezone.test.js.
|
| Remaining limitation:
|   checkEntryWindow calls daysAgo() without a timezone, so it resolves
|   against DEFAULT_TIMEZONE from the environment rather than the
|   company's own `timezone` column. Correct for a single-region
|   deployment; wrong for a deployment serving companies in more than one
|   timezone. Recorded as the remaining action on F-13, and related to
|   F-04.
|
*/

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

/**
 * The five modules that record dated activity and therefore honour the
 * window.
 *
 * Frozen, and used as the `module` value on entry_access_requests — a
 * grant is scoped to one module and one date, so a grant to backdate a
 * material entry does not also permit a backdated banking expense.
 *
 * DAILY_UPDATE is listed here, but note that siteLog.controller.js only
 * imports daysAgo() rather than going through checkEntryWindow, so daily
 * updates do not currently participate in the grant mechanism. See the
 * remaining action on F-13.
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
 *
 * The office. They are the ones who would otherwise be granting the
 * access, so requiring them to grant it to themselves would be
 * ceremony rather than control.
 *
 * Note siteLog.controller.js applies a NARROWER rule — admin only, read
 * from users.role — so a manager can backdate a material entry but not a
 * daily update. That inconsistency is recorded on F-13 and left in place
 * deliberately: widening it is a decision about who may rewrite site
 * history, not a bug fix.
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
 *
 * Parameters (one options object):
 * companyId  - the caller's company
 * userId     - the requester; a grant is personal, not company-wide
 * module     - one of MODULES
 * targetDate - the exact date the grant covers
 *
 * Returns:
 * The grant row, or null.
 *
 * Side effects:
 * One SELECT.
 *
 * Business rules:
 * - Scoped to requested_by, so one supervisor's grant does not let
 *   another backdate an entry.
 * - Matched on the EXACT target_date. A grant for the 1st does not permit
 *   an entry on the 2nd; the office authorises a specific day.
 * - status must be 'granted' — a request that is pending, denied or
 *   already 'used' does not qualify. That last one is what makes a grant
 *   single-use, in combination with consumeGrant.
 * - A null expires_at means no expiry, which is why the condition is
 *   `IS NULL OR > NOW()` rather than a bare comparison.
 *
 * Notes:
 * ORDER BY id DESC LIMIT 1 takes the most recent grant when several
 * exist for the same date — a supervisor who asked twice.
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
  /*
   * Nothing to consume when the entry was allowed on its own merits —
   * inside the window, or by an exempt role. checkEntryWindow returns
   * accessRequestId: null in both cases, and callers pass it through
   * unconditionally rather than branching.
   */
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
