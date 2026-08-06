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
