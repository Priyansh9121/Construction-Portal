/**
 * ===========================================================================
 * THE SUPERVISOR GATE
 * ===========================================================================
 *
 * File purpose:
 * Proves that a `worker` login can open Site Operations and reach the form
 * that records material — the single thing that was false for the whole life
 * of this product until 2026-08-19.
 *
 * WHY THIS SPEC EXISTS
 *
 * Production's site-operations tables held zero rows: no material entry, no
 * labour entry, no supervisor expense, no fund receipt, no access request.
 * Not one, ever. The recording endpoints were open to any authenticated
 * caller and the API answered a worker 200 on every read — but
 * `AppRoutes.jsx` wrapped the route in `AdminManagerLayout`, so the one role
 * the module was built for was redirected to `/worker-portal` in silence.
 *
 * Nothing caught it. The backend suite passed because supertest holds an
 * admin token and never renders a router. The a11y and responsive suites
 * passed because they sign in as an admin too. A green suite is not evidence
 * that a role can reach a screen — only a browser holding that role's token
 * is, which is exactly what this file is.
 *
 * WHAT EACH TEST GUARDS
 *
 *   1. The gate itself. A worker reaches /site-operations and sees the
 *      record form. If someone re-wraps the route in an office-only layout,
 *      this fails.
 *
 *   2. The site field. Every write in the module requires a site as of the
 *      same date, and the picker is fed by /api/site-operations/sites
 *      because /api/sites is office-only. If a supervisor's picker goes
 *      empty they cannot record anything, and the screen is decoration.
 *
 *   3. The office controls stay office-only. `isOffice` is false for a real
 *      user for the first time, so this asserts the approve/reject column is
 *      absent for a supervisor. The backend refuses them regardless; this
 *      guards the page from offering a control that would 403.
 *
 *   4. The navigation tells the truth. A supervisor's sidebar offers exactly
 *      the destinations they can open — Site Operations, and nothing else.
 *      `config/navigation.js` exists to stop a link that leads to a
 *      redirect, and admitting a new role to the shell is precisely when
 *      that can regress.
 *
 *   5. Site Updates stays shut. That screen writes `daily_site_logs`
 *      directly; a supervisor's update belongs in `daily_update_approvals`
 *      via the worker portal, and only becomes a site log once the office
 *      approves it. Admitting them there would route them around their own
 *      approval step.
 *
 * ---------------------------------------------------------------------------
 * SAFETY — READ BEFORE RUNNING
 * ---------------------------------------------------------------------------
 * This suite SIGNS IN. It reads only — it opens pages and inspects controls,
 * and submits nothing. `assertLocalTarget()` refuses any non-localhost
 * target rather than trusting the operator to remember.
 *
 * ---------------------------------------------------------------------------
 * SETUP
 * ---------------------------------------------------------------------------
 *   cd backend  && node scripts/createLocalPortalFixtures.js
 *   cd backend  && RATE_LIMIT_MAX=100000 AUTH_RATE_LIMIT_MAX=1000 \
 *                  PASSWORD_RESET_RATE_LIMIT_MAX=100000 npm start
 *   cd frontend && npm run dev
 *   cd frontend && npx playwright test tests/supervisor-gate.spec.js
 *
 * Credentials come from LOCAL_WORKER_FIXTURE_PASSWORD. There are no
 * defaults in this file; see tests/support/fixtures.js.
 */

import {
  test,
  expect,
  request as playwrightRequest,
} from "@playwright/test";

import {
  BASE_URL,
  assertLocalTarget,
  login,
  seedSession,
} from "./support/fixtures.js";

assertLocalTarget();

/** A phone. Supervisors are not at a desk, and this is the real condition. */
const PHONE = { width: 390, height: 844 };

let session;

test.beforeAll(async () => {
  session = await login(playwrightRequest, "worker");
});

test.describe("a supervisor can reach Site Operations", () => {
  test.use({ viewport: PHONE });

  test("the route opens rather than redirecting to the portal", async ({
    context,
    page,
  }) => {
    await seedSession(context, session);
    await page.goto(`${BASE_URL}/site-operations`);

    // The failure this guards is a REDIRECT, so assert the URL first: a
    // bounced worker lands on /worker-portal and every other assertion
    // below would then be describing the wrong screen.
    await expect(page).toHaveURL(/\/site-operations$/);

    // The shell's topbar carries an <h1> with the same text as the page's
    // own, so this is scoped to the content region rather than the document.
    await expect(
      page
        .locator("#main-content")
        .getByRole("heading", { name: "Site Operations" })
    ).toBeVisible();
  });

  test("the record form is present and its site picker is populated", async ({
    context,
    page,
  }) => {
    await seedSession(context, session);
    await page.goto(`${BASE_URL}/site-operations`);

    const form = page.locator("form", {
      has: page.getByRole("heading", { name: "Record material received" }),
    });

    await expect(form).toBeVisible();

    // /api/sites is office-only, so this list arrives from the module's own
    // endpoint. An empty picker means a supervisor cannot submit at all.
    const site = form.getByLabel("Site");

    await expect(site).toBeVisible();
    await expect
      .poll(async () => site.locator("option").count(), {
        message: "the site picker never loaded any sites",
      })
      .toBeGreaterThan(1);

    await expect(form.getByRole("button", { name: /Record material/i })).toBeVisible();
  });

  test("the office decision controls are not offered", async ({
    context,
    page,
  }) => {
    await seedSession(context, session);
    await page.goto(`${BASE_URL}/site-operations`);

    await expect(
      page.getByRole("heading", { name: "Record material received" })
    ).toBeVisible();

    // isOffice is false here for the first time in the product's life.
    await expect(
      page.getByRole("columnheader", { name: "Decision" })
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  });

  test("Site Updates stays office-only", async ({ context, page }) => {
    await seedSession(context, session);
    await page.goto(`${BASE_URL}/daily-site-updates`);

    // Bounced on purpose: that screen writes daily_site_logs directly, and a
    // supervisor's update belongs in the approval queue instead.
    await expect(page).toHaveURL(/\/worker-portal$/);
  });

});

/*
 * The navigation is asserted at a desktop width, in its own context: below
 * 1024 the sidebar is a closed drawer, and a closed drawer is out of the
 * accessibility tree, so a role-based query there reports "no links" whether
 * the fix works or not.
 */
test.describe("the navigation tells a supervisor the truth", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("offers exactly the one destination they may open", async ({
    context,
    page,
  }) => {
    await seedSession(context, session);
    await page.goto(`${BASE_URL}/site-operations`);

    const links = page.locator("#app-sidebar a");

    await expect(links).toHaveCount(1);
    expect(
      (await links.allTextContents()).map((label) => label.trim())
    ).toEqual(["Site Operations"]);
  });
});
