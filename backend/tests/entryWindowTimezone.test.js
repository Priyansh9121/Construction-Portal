/* describe / it / expect / vi come from Vitest globals (globals: true in
   vitest.config.mjs), because a CommonJS file cannot require("vitest"). */

const {
  daysAgo,
  todayInCompanyTimezone,
} = require("../modules/siteOperations/entryWindow.service");

/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Regression coverage for F-13: the backdating window must be measured
| against the SITE's calendar day, not the server's.
|
| The bug:
|   siteLog.controller.js computed the age of an entry with `new Date()`
|   and setHours(0,0,0,0), which floors to the HOST's midnight. On a UTC
|   host serving a company in Asia/Kolkata (UTC+5:30) the two calendars
|   disagree from 18:30 UTC onwards, so a supervisor recording work at 8pm
|   local was told their own current day was in the future and given a 400.
|
|   entryWindow.service.js already solved this with Intl-based resolution
|   in the configured timezone. The controller now delegates to its
|   daysAgo() rather than repeating the arithmetic.
|
| Why these are unit tests rather than HTTP tests:
|   The defect only appears at particular instants — a few hours of each
|   day, and only for some timezones. An integration test would pass or
|   fail depending on the wall-clock time it happened to run at, which is
|   worse than no test. Freezing the clock with vi.setSystemTime makes the
|   boundary reproducible.
|
| Deliberately NOT hard-coding a UTC offset anywhere here. Australia and
| much of the northern hemisphere observe daylight saving, so an offset
| that is right in July is wrong in January. The DST cases below exist to
| pin that down.
|
| Connected to:
|   backend/modules/siteOperations/entryWindow.service.js  daysAgo,
|                                                          todayInCompanyTimezone
|   backend/modules/siteLogs/siteLog.controller.js         createSiteLog
|   backend/config/env.js                                  DEFAULT_TIMEZONE
|
*/

/**
 * Freezes the system clock for one assertion and always restores it.
 *
 * vi.useFakeTimers replaces the global timer functions as well as the
 * clock, so leaving them installed would affect unrelated suites — hence
 * the finally.
 *
 * @param {string} isoInstant - a UTC instant, e.g. "2026-08-03T19:00:00Z"
 * @param {Function} run - assertions to make while the clock is frozen
 */
const atInstant = (isoInstant, run) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoInstant));

  try {
    run();
  } finally {
    vi.useRealTimers();
  }
};

describe("todayInCompanyTimezone (F-13)", () => {
  /*
   * The exact condition that produced the bug. At 19:00 UTC it is already
   * the 4th in Kolkata (00:30) while still the 3rd in UTC.
   */
  it("resolves the local calendar day, not the UTC day", () => {
    atInstant("2026-08-03T19:00:00Z", () => {
      expect(
        todayInCompanyTimezone("Asia/Kolkata")
      ).toBe("2026-08-04");

      expect(
        todayInCompanyTimezone("UTC")
      ).toBe("2026-08-03");
    });
  });

  /*
   * The same disagreement in the other direction: a timezone behind UTC is
   * still on the previous day just after UTC midnight.
   */
  it("handles timezones behind UTC", () => {
    atInstant("2026-08-04T02:00:00Z", () => {
      expect(
        todayInCompanyTimezone("America/New_York")
      ).toBe("2026-08-03");

      expect(
        todayInCompanyTimezone("UTC")
      ).toBe("2026-08-04");
    });
  });

  /*
   * Melbourne observes daylight saving, so its offset is +10 in winter and
   * +11 in summer. These two assertions would both be wrong if the
   * implementation used a fixed offset instead of Intl.
   *
   * 2026-01-15 is AEDT (+11); 2026-07-15 is AEST (+10).
   */
  it("follows daylight saving in Australia/Melbourne", () => {
    // 14:00 UTC in January is 01:00 on the 16th in Melbourne (+11).
    atInstant("2026-01-15T14:00:00Z", () => {
      expect(
        todayInCompanyTimezone("Australia/Melbourne")
      ).toBe("2026-01-16");
    });

    // 14:00 UTC in July is 00:00 on the 16th in Melbourne (+10).
    atInstant("2026-07-15T14:00:00Z", () => {
      expect(
        todayInCompanyTimezone("Australia/Melbourne")
      ).toBe("2026-07-16");
    });

    /*
     * The discriminating case. At 13:30 UTC:
     *   +11 (January) -> 00:30 next day
     *   +10 (July)    -> 23:30 same day
     * A fixed-offset implementation must get one of these wrong.
     */
    atInstant("2026-01-15T13:30:00Z", () => {
      expect(
        todayInCompanyTimezone("Australia/Melbourne")
      ).toBe("2026-01-16");
    });

    atInstant("2026-07-15T13:30:00Z", () => {
      expect(
        todayInCompanyTimezone("Australia/Melbourne")
      ).toBe("2026-07-15");
    });
  });

  /*
   * An unknown timezone must not throw. A company row with a mistyped
   * timezone would otherwise make every dated entry fail with a 500
   * instead of merely being measured against UTC.
   */
  it("falls back to UTC for an unknown timezone", () => {
    atInstant("2026-08-03T19:00:00Z", () => {
      expect(
        todayInCompanyTimezone("Not/AZone")
      ).toBe("2026-08-03");
    });
  });
});

describe("daysAgo (F-13)", () => {
  /*
   * The headline regression: an evening entry on the site's own current
   * day must read as 0 days old, not -1.
   *
   * Before the fix, siteLog.controller.js measured against the host's
   * midnight and returned -1 here, which its `diffDays < 0` branch
   * reported as "Future daily updates are not allowed."
   */
  it("treats the site's current day as today, not the future", () => {
    atInstant("2026-08-03T19:00:00Z", () => {
      // 2026-08-04 is already today in Kolkata.
      expect(
        daysAgo("2026-08-04", "Asia/Kolkata")
      ).toBe(0);

      // The same date measured against UTC is still tomorrow.
      expect(
        daysAgo("2026-08-04", "UTC")
      ).toBe(-1);
    });
  });

  it("counts whole calendar days back", () => {
    atInstant("2026-08-03T06:00:00Z", () => {
      expect(
        daysAgo("2026-08-03", "Asia/Kolkata")
      ).toBe(0);

      expect(
        daysAgo("2026-08-02", "Asia/Kolkata")
      ).toBe(1);

      expect(
        daysAgo("2026-08-01", "Asia/Kolkata")
      ).toBe(2);

      // Beyond the two-day window — the case that needs office approval.
      expect(
        daysAgo("2026-07-31", "Asia/Kolkata")
      ).toBe(3);
    });
  });

  it("returns a negative number for a genuinely future date", () => {
    atInstant("2026-08-03T06:00:00Z", () => {
      expect(
        daysAgo("2026-08-05", "Asia/Kolkata")
      ).toBe(-2);
    });
  });

  /*
   * Day counting must not drift across a daylight-saving boundary.
   *
   * Melbourne's 2026 DST change is in early April. Counting from 10 April
   * back to 1 April crosses it; a naive implementation subtracting
   * milliseconds and dividing by 86,400,000 would land on 8.96 days and
   * floor to 8.
   */
  it("does not drift across a daylight-saving transition", () => {
    atInstant("2026-04-10T02:00:00Z", () => {
      expect(
        daysAgo("2026-04-01", "Australia/Melbourne")
      ).toBe(9);
    });
  });

  /*
   * Accepts a full timestamp as well as a bare date, because the frontend
   * sends whichever its date control produced.
   */
  it("accepts a full timestamp, not only YYYY-MM-DD", () => {
    atInstant("2026-08-03T06:00:00Z", () => {
      expect(
        daysAgo(
          "2026-08-02T14:23:11.000Z",
          "Asia/Kolkata"
        )
      ).toBe(1);
    });
  });

  /*
   * Unusable input returns null rather than NaN. This matters: every
   * comparison against NaN is false, so a NaN age would slip past both the
   * future check and the window check and be written to the database.
   * createSiteLog now rejects null explicitly.
   */
  it("returns null for input that is not a date", () => {
    expect(daysAgo("not-a-date")).toBeNull();
    expect(daysAgo("")).toBeNull();
    expect(daysAgo(null)).toBeNull();
    expect(daysAgo(undefined)).toBeNull();
  });
});
