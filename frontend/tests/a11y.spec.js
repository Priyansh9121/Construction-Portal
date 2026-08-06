/**
 * ===========================================================================
 * ACCESSIBILITY AUDIT — axe-core
 * ===========================================================================
 *
 * File purpose:
 * Runs axe-core against every route the portal has, at a desktop and a mobile
 * width, and fails on any violation that is not explicitly and justifiably
 * excepted.
 *
 * Why a separate suite:
 * `responsive.spec.js` and `authenticated.spec.js` assert layout and
 * interaction. This asserts conformance. Keeping them apart means an axe
 * regression is legible on its own, and the layout suites stay fast.
 *
 * Dependency:
 * `@axe-core/playwright` is a **devDependency**. It ships nothing to users —
 * verify with `npm ls @axe-core/playwright --prod` (empty) and by the
 * production bundle size, which is unchanged.
 *
 * SAFETY: as with the other authenticated suite, this signs in and must only
 * be pointed at a local dev stack. It refuses to start otherwise.
 *
 * Setup — see DEPLOYMENT.md. In short:
 *   cd backend  && node scripts/createBreakGlassAdmin.js        (admin)
 *   cd backend  && node scripts/createLocalPortalFixtures.js    (portals)
 *   cd backend  && RATE_LIMIT_MAX=100000 AUTH_RATE_LIMIT_MAX=100000 npm start
 *   cd frontend && npm run dev
 *   cd frontend && npm run test:a11y
 *
 * ---------------------------------------------------------------------------
 * ON EXCEPTIONS
 * ---------------------------------------------------------------------------
 * Rules are NOT disabled to manufacture a pass. `DOCUMENTED_EXCEPTIONS` below
 * is empty unless something is genuinely un-fixable from the presentation
 * layer, and every entry must carry the rule id, the element, the reason and
 * the remediation plan. An empty list is the goal, not a formality.
 */

import { test, expect } from "@playwright/test";
import { request as playwrightRequest } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { BASE_URL, assertLocalTarget, login } from "./support/fixtures.js";

assertLocalTarget();


const TENDER_ID = process.env.E2E_TENDER_ID || "229";

/** Route, and which account can reach it. `null` = no sign-in needed. */
const ROUTES = [
  { path: "/login", name: "Login", as: null },
  { path: "/register", name: "Register", as: null },
  { path: "/forgot-password", name: "Forgot Password", as: null },
  { path: "/reset-password", name: "Reset Password", as: null },

  { path: "/dashboard", name: "Dashboard", as: "admin" },
  { path: "/tenders", name: "Tenders", as: "admin" },
  { path: `/tenders/${TENDER_ID}`, name: "Tender Details", as: "admin" },
  { path: "/payments", name: "Payments", as: "admin" },
  { path: "/invoices", name: "Invoices", as: "admin" },
  { path: "/workers", name: "Workers", as: "admin" },
  { path: "/worker-money", name: "Worker Money", as: "admin" },
  { path: "/subcontractors", name: "Subcontractors", as: "admin" },
  { path: "/daily-site-updates", name: "Daily Site Updates", as: "admin" },
  { path: "/daily-update-approvals", name: "Daily Update Approvals", as: "admin" },
  { path: "/site-operations", name: "Site Operations", as: "admin" },
  { path: "/masters", name: "Master Data", as: "admin" },
  { path: "/users", name: "User Management", as: "admin" },
  { path: "/activity", name: "Activity Log", as: "admin" },
  { path: "/reports", name: "Reports", as: "admin" },
  { path: "/settings", name: "Settings", as: "admin" },

  { path: "/worker-portal", name: "Worker Portal", as: "worker" },
  { path: "/subcontractor-portal", name: "Subcontractor Portal", as: "subcontractor" },
];

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 667 },
  { name: "desktop", width: 1440, height: 900 },
];

/*
 * Justified, documented exceptions.
 *
 * Each entry MUST carry: rule, selector, reason, remediation. Adding one is a
 * deliberate act with an owner, not a way to turn a rule off.
 */
const DOCUMENTED_EXCEPTIONS = [];

const sessions = {};

async function getSession(key) {
  if (sessions[key]) return sessions[key];

  sessions[key] = await login(playwrightRequest, key);
  return sessions[key];
}

/** Formats violations so a failure names the rule, impact and element. */
function describe(violations) {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 3)
        .map((n) => `      ${n.target.join(" ")}`)
        .join("\n");
      return `  [${v.impact}] ${v.id} — ${v.help}\n${nodes}\n      ${v.helpUrl}`;
    })
    .join("\n\n");
}

test.describe("axe accessibility audit", () => {
  for (const route of ROUTES) {
    for (const viewport of VIEWPORTS) {
      test(`${route.name} @ ${viewport.name}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
        });

        if (route.as) {
          const session = await getSession(route.as);
          await context.addInitScript(
            ([token, user]) => {
              localStorage.setItem("token", token);
              localStorage.setItem("user", user);
            },
            [session.token, JSON.stringify(session.user)]
          );
        }

        const page = await context.newPage();
        await page.goto(`${BASE_URL}${route.path}`, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForTimeout(1400);

        if (route.as) {
          expect(
            new URL(page.url()).pathname,
            `${route.name} redirected — fixture or role problem, not an a11y result`
          ).not.toBe("/login");
        }

        const results = await new AxeBuilder({ page })
          // The four WCAG tags that matter for an AA target.
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        const excepted = new Set(DOCUMENTED_EXCEPTIONS.map((e) => e.rule));
        const violations = results.violations.filter((v) => !excepted.has(v.id));

        expect(
          violations,
          violations.length
            ? `${route.name} @ ${viewport.name} — ${violations.length} axe violation(s):\n\n${describe(violations)}`
            : ""
        ).toEqual([]);

        await context.close();
      });
    }
  }
});
