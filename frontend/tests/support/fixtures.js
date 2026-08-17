/**
 * ===========================================================================
 * TEST FIXTURE CREDENTIALS
 * ===========================================================================
 *
 * File purpose:
 * The single place the browser suites get their sign-in credentials from, and
 * the single place that refuses to run against anything but a local stack.
 *
 * Why there are no defaults:
 * These suites previously carried literal fallback passwords
 * (`|| "local-…-2026"`). They only ever worked against `.local.test` accounts
 * on a local database, so they were not secrets in the usual sense — but a
 * password-shaped string in a tracked file is still something a scanner
 * flags, something that gets copied into a real environment by accident, and
 * something that quietly stops anyone noticing the variable was never set.
 *
 * So every credential is REQUIRED and read from the environment. A missing
 * one fails immediately with the exact variable name and the command that
 * creates the fixture, which is more useful than a mysterious 401 twenty
 * seconds into a run.
 *
 * Required variables:
 *   LOCAL_ADMIN_FIXTURE_EMAIL / LOCAL_ADMIN_FIXTURE_PASSWORD
 *   LOCAL_WORKER_FIXTURE_EMAIL / LOCAL_WORKER_FIXTURE_PASSWORD
 *   LOCAL_SUBCONTRACTOR_FIXTURE_EMAIL / LOCAL_SUBCONTRACTOR_FIXTURE_PASSWORD
 *
 * Emails do have defaults — they are not secrets, and they must match what
 * `backend/scripts/createLocalPortalFixtures.js` creates.
 *
 * See DEPLOYMENT.md for the full setup, and `.env.example` for the variable
 * list with blank values.
 */

export const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5173";
export const API_URL = process.env.E2E_API_URL || "http://127.0.0.1:5051";

/** Only localhost. These suites sign in and walk the whole application. */
const isLocal = (url) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(new URL(url).origin);

export function assertLocalTarget() {
  if (!isLocal(BASE_URL) || !isLocal(API_URL)) {
    throw new Error(
      "Refusing to run: these suites sign in and must only target a local dev stack.\n" +
        `  E2E_BASE_URL = ${BASE_URL}\n  E2E_API_URL  = ${API_URL}`
    );
  }
}

/** Where each fixture comes from, so a failure can say how to create it. */
const SETUP = {
  admin:
    "cd backend && BREAK_GLASS_ADMIN_EMAIL=… BREAK_GLASS_ADMIN_PASSWORD=… " +
    "BREAK_GLASS_ADMIN_COMPANY_ID=1 node scripts/createBreakGlassAdmin.js",
  worker:
    "cd backend && LOCAL_WORKER_FIXTURE_PASSWORD=… " +
    "LOCAL_SUBCONTRACTOR_FIXTURE_PASSWORD=… node scripts/createLocalPortalFixtures.js",
  subcontractor:
    "cd backend && LOCAL_WORKER_FIXTURE_PASSWORD=… " +
    "LOCAL_SUBCONTRACTOR_FIXTURE_PASSWORD=… node scripts/createLocalPortalFixtures.js",
};

function required(name, role) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}.\n\n` +
        `The browser suites carry no default passwords. Set it to the value you\n` +
        `used when creating the ${role} fixture:\n\n  ${SETUP[role]}\n\n` +
        `See DEPLOYMENT.md → "Local fixtures".`
    );
  }

  return value;
}

/**
 * Credentials for one fixture role.
 *
 * Called lazily from a test's beforeAll rather than at import time, so a
 * suite that does not need a given role never demands its variables.
 */
export function credentials(role) {
  switch (role) {
    case "admin":
      return {
        email:
          process.env.LOCAL_ADMIN_FIXTURE_EMAIL || "ui-redesign-e2e@local.test",
        password: required("LOCAL_ADMIN_FIXTURE_PASSWORD", "admin"),
      };

    case "worker":
      return {
        email:
          process.env.LOCAL_WORKER_FIXTURE_EMAIL || "worker-fixture@local.test",
        password: required("LOCAL_WORKER_FIXTURE_PASSWORD", "worker"),
      };

    case "subcontractor":
      return {
        email:
          process.env.LOCAL_SUBCONTRACTOR_FIXTURE_EMAIL ||
          "subcontractor-fixture@local.test",
        password: required(
          "LOCAL_SUBCONTRACTOR_FIXTURE_PASSWORD",
          "subcontractor"
        ),
      };

    default:
      throw new Error(`Unknown fixture role: ${role}`);
  }
}

/*
|--------------------------------------------------------------------------
| Is the API actually running the code on disk?
|--------------------------------------------------------------------------
|
| WHY THIS EXISTS
|
| A backend process that had been running for three days once held port 5051.
| `npm start` could not bind, failed quietly, and the health check answered
| 200 from the OLD process. A suite written to prove a bug was fixed then ran
| against code that predated the fix and reported the bug as still live.
|
| That is the worst failure mode a test suite has: not a red build, but a
| CONFIDENT WRONG ANSWER about the product. Three specs failed and the honest
| reading of the evidence was "the fix does not work."
|
| WHAT IT COSTS
|
| Nothing on the server. /api/health already returns `uptime_seconds`, so the
| server's start time is `now - uptime_seconds` and no endpoint changed.
|
| HOW IT DECIDES
|
| If the API started BEFORE the most recently modified backend source file,
| it cannot be running that file. That is the whole test.
|
| THE TRADE-OFF, DELIBERATELY ONE-SIDED
|
| Touching a file without changing it — a checkout, a rebase, a formatter —
| makes this ask for a restart it did not strictly need. That is the cheap
| error. The expensive error is the one this replaces: believing a stale
| process and drawing a false conclusion about the code. A needless restart
| costs seconds; a false verdict cost most of a session.
|
| Set E2E_SKIP_FRESHNESS=1 to bypass it.
|
*/
const BACKEND_DIR = new URL("../../../backend/", import.meta.url).pathname;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "logs",
  "uploads",
  "coverage",
  "test-results",
]);

/** Newest mtime under backend/, ignoring anything not loaded by the server. */
async function newestBackendChange(fs, path, dir = BACKEND_DIR, best = 0) {
  let entries;

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return best;
  }

  let newest = best;

  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      newest = await newestBackendChange(fs, path, full, newest);
      continue;
    }

    if (!/\.(js|mjs|cjs|json|sql)$/.test(entry.name)) continue;

    try {
      const { mtimeMs } = await fs.stat(full);
      if (mtimeMs > newest) newest = mtimeMs;
    } catch {
      /* a file that vanished mid-walk cannot be what the server is running */
    }
  }

  return newest;
}

/**
 * Fails if the API process predates the newest backend source change.
 *
 * Call it from beforeAll in any suite whose result depends on backend
 * behaviour. Never throws for a reason other than staleness: if health cannot
 * be reached at all, that is left for the suite's own failure to report,
 * because "server is down" is already obvious and this should not mask it.
 */
export async function assertServerFresh(requestContextFactory) {
  if (process.env.E2E_SKIP_FRESHNESS === "1") return;

  const [fs, path] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);

  const ctx = await requestContextFactory.newContext();

  let uptimeSeconds;

  try {
    const res = await ctx.get(`${API_URL}/api/health`);
    uptimeSeconds = (await res.json())?.uptime_seconds;
  } catch {
    return; // unreachable is the suite's problem to report, not ours
  } finally {
    await ctx.dispose();
  }

  if (typeof uptimeSeconds !== "number") return;

  const startedAt = Date.now() - uptimeSeconds * 1000;
  const changedAt = await newestBackendChange(fs.default ?? fs, path.default ?? path);

  if (!changedAt || startedAt >= changedAt) return;

  const staleBy = Math.round((changedAt - startedAt) / 1000);

  throw new Error(
    `The API on ${API_URL} is running code older than your working tree.\n\n` +
      `  API started : ${new Date(startedAt).toISOString()}\n` +
      `  backend/ last changed : ${new Date(changedAt).toISOString()}\n` +
      `  stale by : ${staleBy}s\n\n` +
      `Anything this suite reports would describe the OLD code, so a "fixed" bug\n` +
      `can look broken and a broken one can look fixed. Restart the API:\n\n` +
      `  ps -eo pid,lstart,command | grep "node server.js"   # find the old one\n` +
      `  kill <pid>\n` +
      `  cd backend && RATE_LIMIT_MAX=100000 AUTH_RATE_LIMIT_MAX=100000 npm start\n\n` +
      `A previous process holding the port makes npm start fail quietly, so\n` +
      `check the PID actually changed. Set E2E_SKIP_FRESHNESS=1 to bypass.`
  );
}

/** Signs in and returns { token, user }. Throws with actionable guidance. */
export async function login(requestContextFactory, role) {
  const { email, password } = credentials(role);
  const ctx = await requestContextFactory.newContext();

  const res = await ctx.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  });

  const body = await res.json();
  await ctx.dispose();

  if (!body?.token) {
    throw new Error(
      `Login failed for the '${role}' fixture (${email}).\n` +
        `Server said: ${body?.message || res.status()}\n\n` +
        `Create or reset it with:\n  ${SETUP[role]}`
    );
  }

  return body;
}

/** Seeds a signed-in session into a browser context before the app boots. */
export async function seedSession(context, session) {
  await context.addInitScript(
    ([token, user]) => {
      localStorage.setItem("token", token);
      localStorage.setItem("user", user);
    },
    [session.token, JSON.stringify(session.user)]
  );
}
