/**
 * ===========================================================================
 * PASSWORD RESET RATE LIMIT — configuration contract
 * ===========================================================================
 *
 * middleware/rateLimiter.js hard-coded 60 minutes and 5 requests for the
 * password-reset endpoint. Those became environment-overridable so a local
 * end-to-end run can exercise the recovery flow more than five times an hour.
 *
 * The whole point of that change is that PRODUCTION BEHAVIOUR IS UNCHANGED
 * when the variables are absent, so that is what these assert. A regression
 * here would quietly relax a limiter guarding account enumeration and
 * mail-bombing.
 *
 * config/env.js is read once at require time, so each case resets the module
 * registry and re-imports with a different process.env.
 */

/*
 * No vitest import. vitest.config.mjs sets `globals: true`, so describe, it,
 * expect and vi arrive as globals and the suites stay CommonJS like every
 * other backend file. Requiring vitest fails outright; importing it would
 * break the eslint sourceType.
 */

const VARIABLES = [
  "PASSWORD_RESET_RATE_LIMIT_WINDOW_MS",
  "PASSWORD_RESET_RATE_LIMIT_MAX",
];

/** Load a fresh config/env.js under a given environment. */
function loadEnv(overrides = {}) {
  vi.resetModules();

  for (const name of VARIABLES) {
    delete process.env[name];
  }
  Object.assign(process.env, overrides);

  /* config/env.js parses process.env once at require time, so the registry
   * must be reset before each case. delete on the cache is what makes the
   * re-require actually re-read. */
  delete require.cache[require.resolve("../config/env.js")];
  return require("../config/env.js");
}

let saved;

beforeEach(() => {
  saved = {};
  for (const name of VARIABLES) saved[name] = process.env[name];
});

afterEach(() => {
  for (const name of VARIABLES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  vi.resetModules();
});

describe("password reset rate limit configuration", () => {
  it("defaults to 60 minutes and 5 requests when unset", () => {
    const env = loadEnv();

    expect(env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS).toBe(60 * 60 * 1000);
    expect(env.PASSWORD_RESET_RATE_LIMIT_MAX).toBe(5);
  });

  it("honours valid overrides", () => {
    const env = loadEnv({
      PASSWORD_RESET_RATE_LIMIT_WINDOW_MS: "900000",
      PASSWORD_RESET_RATE_LIMIT_MAX: "100000",
    });

    expect(env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS).toBe(900000);
    expect(env.PASSWORD_RESET_RATE_LIMIT_MAX).toBe(100000);
  });

  /*
   * The project's parseInteger returns the fallback for anything invalid
   * rather than throwing, and that policy is applied to every bounded integer
   * in config/env.js. For a limiter the fallback is the STRICTER production
   * value, so a typo fails in the secure direction: the endpoint keeps
   * 5-per-hour rather than becoming unbounded.
   */
  it.each([
    ["non-numeric", "abc"],
    ["empty", ""],
    ["fractional", "1.5"],
    ["negative", "-1"],
    ["zero", "0"],
    ["above the ceiling", "999999999"],
  ])("falls back to the strict default for a %s max", (_label, value) => {
    const env = loadEnv({ PASSWORD_RESET_RATE_LIMIT_MAX: value });

    expect(env.PASSWORD_RESET_RATE_LIMIT_MAX).toBe(5);
  });

  it.each([
    ["non-numeric", "abc"],
    ["below the floor", "10"],
    ["above the ceiling", "999999999999"],
  ])("falls back to the strict default for a %s window", (_label, value) => {
    const env = loadEnv({ PASSWORD_RESET_RATE_LIMIT_WINDOW_MS: value });

    expect(env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS).toBe(60 * 60 * 1000);
  });

  it("never disables the limiter, whatever the configuration", () => {
    const env = loadEnv({ PASSWORD_RESET_RATE_LIMIT_MAX: "100000" });

    expect(env.PASSWORD_RESET_RATE_LIMIT_MAX).toBeGreaterThan(0);
    expect(Number.isInteger(env.PASSWORD_RESET_RATE_LIMIT_MAX)).toBe(true);
  });
});
