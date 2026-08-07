/**
 * SHELL-018: the sidebar and the command palette must agree on reachability.
 *
 * The palette previously carried its own hard-coded destination array, which
 * had drifted from the sidebar in both directions. This compares what the two
 * surfaces actually render, per role, at runtime.
 *
 * The asymmetry is deliberate:
 *   - a path in the PALETTE but not the SIDEBAR is a FAILURE. The palette
 *     would be offering somewhere the shell says this role cannot reach.
 *   - the reverse is only reported, since a surface may legitimately omit an
 *     entry for its own reasons.
 *
 * Roles are read from the real fixtures. Portal roles are checked too, and are
 * expected to render NO shell at all: /worker-portal and
 * /subcontractor-portal mount outside AppLayout.
 *
 * Read-only. Uses shared fixtures for sign-in only and mutates nothing
 * (AUTH-018).
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium, request: playwrightRequest } = requireFromFrontend("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const API = process.env.E2E_API_URL || "http://127.0.0.1:5051";

const ROLES = [
  ["admin", process.env.LOCAL_ADMIN_FIXTURE_EMAIL, process.env.LOCAL_ADMIN_FIXTURE_PASSWORD, "/dashboard", true],
  ["worker", process.env.LOCAL_WORKER_FIXTURE_EMAIL, process.env.LOCAL_WORKER_FIXTURE_PASSWORD, "/worker-portal", false],
  ["subcontractor", process.env.LOCAL_SUBCONTRACTOR_FIXTURE_EMAIL, process.env.LOCAL_SUBCONTRACTOR_FIXTURE_PASSWORD, "/subcontractor-portal", false],
];

/* Routes AdminLayout restricts to admin. */
const ADMIN_ONLY = ["/daily-update-approvals", "/users"];

const browser = await chromium.launch();
let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

for (const [role, email, password, home, hasShell] of ROLES) {
  if (!email || !password) {
    console.log(`skip  ${role}: fixture credentials not set`);
    continue;
  }

  const api = await playwrightRequest.newContext({ baseURL: API });
  const login = await api.post("/api/auth/login", { data: { email, password } });
  if (!login.ok()) {
    check(false, `${role} fixture signs in`);
    await api.dispose();
    continue;
  }
  const { token, user } = await login.json();
  await api.dispose();

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(
    ([t, u]) => {
      localStorage.setItem("token", t);
      localStorage.setItem("user", u);
    },
    [token, JSON.stringify(user)]
  );
  const page = await context.newPage();
  await page.goto(`${BASE}${home}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const shellPresent = await page.evaluate(() =>
    Boolean(document.querySelector(".sidebar"))
  );

  if (!hasShell) {
    /* Portal roles render outside AppLayout, so there is no shell to compare
     * and no palette to mislead them with. */
    check(!shellPresent, `${role} renders NO shell (portal is outside AppLayout)`);
    await context.close();
    continue;
  }

  check(shellPresent, `${role} renders the shell`);

  const sidebarPaths = await page.evaluate(() =>
    [...document.querySelectorAll(".sidebar-link")].map((a) =>
      new URL(a.href).pathname
    )
  );

  await page.keyboard.press("Control+k");
  await page.waitForSelector(".command-modal");
  await page.waitForTimeout(500);

  const palette = await page.evaluate(() => {
    const opts = [...document.querySelectorAll('[role="option"]')];
    return {
      paths: opts.map((o) => o.querySelector("small")?.textContent?.trim()),
      labels: opts.map((o) => o.querySelector("span")?.textContent?.trim()),
    };
  });

  console.log(`\n  ${role}: sidebar ${sidebarPaths.length} / palette ${palette.paths.length}`);

  // The failure direction: palette offering what sidebar does not.
  const extra = palette.paths.filter((p) => !sidebarPaths.includes(p));
  check(
    extra.length === 0,
    `${role} palette offers nothing the sidebar withholds`,
    extra.length ? extra.join(", ") : ""
  );

  // Reported only.
  const missing = sidebarPaths.filter((p) => !palette.paths.includes(p));
  if (missing.length) {
    console.log(`  info  in sidebar but not palette: ${missing.join(", ")}`);
  }

  // Admin-only routes must be absent for a non-admin, and searching must not
  // surface them either.
  const isAdmin = String(user.role).toLowerCase() === "admin";
  for (const restricted of ADMIN_ONLY) {
    const present = palette.paths.includes(restricted);
    check(
      isAdmin ? present : !present,
      `${role} ${isAdmin ? "sees" : "does NOT see"} ${restricted}`
    );
  }

  if (!isAdmin) {
    await page.fill(".command-header input", "approv");
    await page.waitForTimeout(200);
    const found = await page.evaluate(() =>
      [...document.querySelectorAll('[role="option"]')].map(
        (o) => o.querySelector("small")?.textContent?.trim()
      )
    );
    check(
      !found.includes("/daily-update-approvals"),
      `${role} cannot SEARCH an admin-only destination`,
      found.join(", ") || "no results"
    );
  }

  // A visible result still activates.
  await page.fill(".command-header input", "Tenders");
  await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/tenders/, { timeout: 5000 });
  check(true, `${role} Enter still navigates to a visible destination`);

  await context.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nsidebar and palette agree for every role");
process.exit(failures ? 1 : 0);
