/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Regression cover for the DEFAULT_TIMEZONE validation in config/env.js.
|
| The defect: `backend/.env` carried DEFAULT_TIMEZONE=India/Kolkata, which
| is not an IANA zone name — the real one is Asia/Kolkata. Nothing rejected
| it, because the value is only resolved much later inside
| entryWindow.service.js, which catches the RangeError and falls back to
| UTC.
|
| So every company registered without an explicit timezone stored the bad
| string, and "today" for the supervisor backdated-entry rule was computed
| in UTC rather than IST — a 5.5 hour shift. An evening entry in India
| could be judged a future date and refused. That is the exact defect
| finding F-13 fixed in code, reintroduced through configuration.
|
| These tests pin the two behaviours that stop it recurring silently:
|   - a bad zone ABORTS the boot in production
|   - a bad zone warns and falls back to a real zone elsewhere
|
| config/env.js is read once at require time and frozen, so each case
| reloads it with vi.resetModules() under a patched process.env.
|
*/

/*
 * describe/it/expect/vi are ambient: vitest.config.mjs sets `globals: true`
 * because a CommonJS test file cannot require("vitest").
 */

/**
 * Loads a fresh copy of config/env.js under the supplied environment.
 *
 * The module caches and freezes its result, so a plain require would return
 * whatever the first test produced.
 */
/*
 * vi.resetModules() governs Vitest's own module runner and does NOT clear
 * Node's CommonJS require cache, so a second require returned the first
 * test's frozen result and every override appeared to be ignored. Deleting
 * the entry by resolved path is what actually forces re-execution.
 */
const ENV_MODULE = require.resolve("../config/env");

const loadEnvWith = (overrides) => {
  delete require.cache[ENV_MODULE];

  const previous = { ...process.env };

  Object.assign(process.env, overrides);

  try {
    return require("../config/env");
  } finally {
    // Restore immediately so one case cannot leak into the next.
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, previous);

    // Leave no patched copy behind for the next test to pick up.
    delete require.cache[ENV_MODULE];
  }
};

/*
 * A valid connection string and a long-enough secret, so the module gets
 * past its own required-value checks and reaches the timezone logic.
 */
const BASE = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  JWT_SECRET: "test-only-secret-padded-well-past-thirty-two-chars",
};

describe("DEFAULT_TIMEZONE validation", () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.resetModules();
  });

  it("accepts a real IANA zone unchanged", () => {
    const env = loadEnvWith({
      ...BASE,
      NODE_ENV: "development",
      DEFAULT_TIMEZONE: "Asia/Kolkata",
    });

    expect(env.DEFAULT_TIMEZONE).toBe("Asia/Kolkata");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("accepts a second real zone, so the check is not hard-coded to one", () => {
    const env = loadEnvWith({
      ...BASE,
      NODE_ENV: "development",
      DEFAULT_TIMEZONE: "Australia/Melbourne",
    });

    expect(env.DEFAULT_TIMEZONE).toBe("Australia/Melbourne");
  });

  it("rejects India/Kolkata — the exact string that caused the defect", () => {
    const env = loadEnvWith({
      ...BASE,
      NODE_ENV: "development",
      DEFAULT_TIMEZONE: "India/Kolkata",
    });

    // Falls back to a zone that actually resolves, rather than to UTC.
    expect(env.DEFAULT_TIMEZONE).toBe("Asia/Kolkata");
    expect(warnSpy).toHaveBeenCalled();

    const warning = String(warnSpy.mock.calls[0][0]);
    expect(warning).toContain("India/Kolkata");
    expect(warning).toContain("not a valid IANA timezone");
  });

  it("aborts the boot in production rather than degrading to UTC", () => {
    expect(() =>
      loadEnvWith({
        ...BASE,
        NODE_ENV: "production",
        DEFAULT_TIMEZONE: "India/Kolkata",
      })
    ).toThrow(/not a valid IANA timezone/);
  });

  it("defaults to Asia/Kolkata when the variable is unset", () => {
    const env = loadEnvWith({
      ...BASE,
      NODE_ENV: "development",
      DEFAULT_TIMEZONE: "",
    });

    expect(env.DEFAULT_TIMEZONE).toBe("Asia/Kolkata");
  });

  it("agrees with DEFAULTS.COMPANY_TIMEZONE in config/constants.js", () => {
    /*
     * F-04: the two defaults for the same concept disagreed by ten and a
     * half hours. The environment wins at registration, so nothing broke —
     * but the next person to touch the entry-window logic would have had
     * two contradictory answers to "what is the default zone".
     */
    const env = loadEnvWith({
      ...BASE,
      NODE_ENV: "development",
      DEFAULT_TIMEZONE: "",
    });

    const { DEFAULTS } = require("../config/constants");

    expect(DEFAULTS.COMPANY_TIMEZONE).toBe(env.DEFAULT_TIMEZONE);
    expect(DEFAULTS.COMPANY_CURRENCY).toBe(env.DEFAULT_CURRENCY);
  });

  it("resolves a real zone through Intl, proving the guard is meaningful", () => {
    /*
     * Guards the guard: if Intl silently accepted anything, every case
     * above would pass while proving nothing.
     */
    expect(() =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "India/Kolkata",
      }).format(new Date())
    ).toThrow(RangeError);

    expect(() =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
      }).format(new Date())
    ).not.toThrow();
  });
});
