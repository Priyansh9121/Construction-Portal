/**
 * ===========================================================================
 * AUTHENTICATED RESPONSIVE SUITE
 * ===========================================================================
 *
 * File purpose:
 * Drives every authenticated route in a real browser at the nine target
 * widths and asserts the things a build cannot tell you — that no page is
 * wider than the screen, that every control can actually be tapped, and that
 * the navigation drawer behaves for a keyboard user.
 *
 * Why this exists separately from responsive.spec.js:
 * That file covers the four public routes and needs no session. This one
 * needs a signed-in user, so it is kept apart: if the login fixture cannot
 * be satisfied the public suite still runs and still means something.
 *
 * What it caught:
 * On the pre-redesign code this suite failed 108 of its 144 overflow
 * assertions — every authenticated route overflowed horizontally at almost
 * every width, including 74px at 1440px on the register pages. The two
 * causes were a `.topbar-actions` cluster that refused to shrink and a
 * `table { min-width: 640px }` rule applied to 19 tables that had no
 * scrolling wrapper.
 *
 * ---------------------------------------------------------------------------
 * SAFETY — READ BEFORE RUNNING
 * ---------------------------------------------------------------------------
 * This suite SIGNS IN and navigates the live application. It must only ever
 * be pointed at a local development stack.
 *
 *   - E2E_BASE_URL must be a localhost origin. The suite refuses to start
 *     otherwise, rather than trusting the operator to remember.
 *   - It only reads. It opens pages and measures layout; it submits no
 *     forms, creates nothing and deletes nothing.
 *   - The account it uses is a local-only fixture (see SETUP below). Do not
 *     put a real credential in this file or in CI.
 *
 * ---------------------------------------------------------------------------
 * SETUP
 * ---------------------------------------------------------------------------
 * The suite needs a local admin. Create one against the LOCAL database:
 *
 *   cd backend
 *   BREAK_GLASS_ADMIN_EMAIL='ui-redesign-e2e@local.test' \
 *   BREAK_GLASS_ADMIN_PASSWORD="$LOCAL_ADMIN_FIXTURE_PASSWORD" \
 *   BREAK_GLASS_ADMIN_COMPANY_ID=1 \
 *   node scripts/createBreakGlassAdmin.js
 *
 * Then, in three terminals:
 *
 *   cd backend  && RATE_LIMIT_MAX=100000 AUTH_RATE_LIMIT_MAX=100000 npm start
 *   cd frontend && npm run dev
 *   cd frontend && npx playwright test tests/authenticated.spec.js
 *
 * The raised rate limit matters: this suite issues roughly 150 page loads,
 * and the default limiter returns 429 partway through, which silently
 * empties the tables and makes the layout assertions meaningless.
 *
 * Credentials come from LOCAL_ADMIN_FIXTURE_PASSWORD — there are no
 * defaults in this file. See tests/support/fixtures.js.
 */

import { test, expect, request as playwrightRequest } from "@playwright/test";

import {
  BASE_URL,
  assertLocalTarget,
  login,
  seedSession,
} from "./support/fixtures.js";


assertLocalTarget();

/** The nine widths the redesign targets. */
const VIEWPORTS = [
  { name: "320", width: 320, height: 568 },
  { name: "375", width: 375, height: 667 },
  { name: "390", width: 390, height: 844 },
  { name: "414", width: 414, height: 896 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
];

/*
 * Every authenticated route an admin can reach.
 *
 * `/tenders/:id` needs a real id. TENDER_ID defaults to a tender that
 * exists in the local seed; override it if your database differs.
 */
const TENDER_ID = process.env.E2E_TENDER_ID || "229";

const ROUTES = [
  { path: "/dashboard", name: "Dashboard" },
  { path: "/tenders", name: "Tenders" },
  { path: `/tenders/${TENDER_ID}`, name: "Tender Details" },
  { path: "/payments", name: "Payments" },
  { path: "/invoices", name: "Invoices" },
  { path: "/workers", name: "Workers" },
  { path: "/worker-money", name: "Worker Money" },
  { path: "/subcontractors", name: "Subcontractors" },
  { path: "/daily-site-updates", name: "Daily Site Updates" },
  { path: "/daily-update-approvals", name: "Daily Update Approvals" },
  { path: "/site-operations", name: "Site Operations" },
  { path: "/masters", name: "Master Data" },
  { path: "/users", name: "User Management" },
  { path: "/activity", name: "Activity Log" },
  { path: "/reports", name: "Reports" },
  { path: "/settings", name: "Settings" },
];

/** Signs in once as the admin fixture. Credentials come from the environment. */
async function getSession() {
  return login(playwrightRequest, "admin");
}

/** Seeds the session into localStorage before the app boots. */
async function signIn(context, session) {
  return seedSession(context, session);
}

/** Pixels by which the document exceeds the viewport. 0 means no sideways scroll. */
async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
}

/**
 * Names the elements that actually cause the overflow.
 *
 * An element only counts if nothing between it and <body> clips or scrolls —
 * otherwise a wide table inside its own scroll wrapper, which is working
 * exactly as intended, is reported as a fault. `body` is excluded from the
 * walk on purpose: it carries `overflow-x: hidden` as a last-resort guard,
 * and treating that as clipping would mark every element innocent.
 */
async function offendingElements(page) {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const out = [];

    const isClipped = (el) => {
      let parent = el.parentElement;

      while (parent && parent !== document.body && parent !== document.documentElement) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (overflowX === "hidden" || overflowX === "auto" || overflowX === "scroll") {
          return true;
        }
        parent = parent.parentElement;
      }

      return false;
    };

    document.querySelectorAll("*").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.right <= limit + 1) return;
      if (getComputedStyle(el).position === "fixed") return;
      if (isClipped(el)) return;

      const cls =
        typeof el.className === "string" && el.className
          ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "";

      out.push(`${el.tagName.toLowerCase()}${cls} (w=${Math.round(rect.width)}, right=${Math.round(rect.right)})`);
    });

    return [...new Set(out)].slice(0, 6);
  });
}

test.describe("authenticated routes", () => {
  let session;

  test.beforeAll(async () => {
    session = await getSession();
  });

  test.describe("no horizontal overflow", () => {
    for (const route of ROUTES) {
      for (const viewport of VIEWPORTS) {
        test(`${route.name} @ ${viewport.name}px`, async ({ browser }) => {
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
          });

          await signIn(context, session);
          const page = await context.newPage();

          await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "domcontentloaded" });
          // Registers fetch after mount; measuring too early tests an empty page.
          await page.waitForTimeout(1200);

          // A redirect to /login means the fixture expired, not a layout bug.
          expect(
            new URL(page.url()).pathname,
            `${route.name} redirected away — session or role problem, not layout`
          ).not.toBe("/login");

          const overflow = await horizontalOverflow(page);

          if (overflow > 0) {
            const culprits = await offendingElements(page);
            throw new Error(
              `${route.name} overflows by ${overflow}px at ${viewport.width}px.\n` +
                `Caused by:\n  ${culprits.join("\n  ") || "(no unclipped element found)"}`
            );
          }

          expect(overflow).toBe(0);
          await context.close();
        });
      }
    }
  });

  test.describe("touch targets", () => {
    for (const route of ROUTES) {
      test(`${route.name} controls meet 44px at 375px`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
        await signIn(context, session);
        const page = await context.newPage();

        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1200);

        const undersized = await page.evaluate(() => {
          const MIN = 44;
          const out = [];

          document.querySelectorAll("button, a[href], select, textarea, input:not([type=hidden])").forEach((el) => {
            const rect = el.getBoundingClientRect();

            // Not rendered.
            if (rect.width === 0 && rect.height === 0) return;

            // WCAG 2.2 exempts a link inside a block of prose.
            if (el.tagName === "A" && el.closest("p")) return;

            if (rect.height < MIN - 1) {
              const cls =
                typeof el.className === "string" && el.className
                  ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
                  : "";
              out.push(`${el.tagName.toLowerCase()}${cls} h=${Math.round(rect.height)}`);
            }
          });

          return [...new Set(out)];
        });

        expect(undersized, `Controls under 44px on ${route.name}: ${undersized.join(", ")}`).toEqual([]);
        await context.close();
      });
    }
  });

  test.describe("navigation drawer", () => {
    test("opens, traps focus, closes on Escape and restores focus", async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
      await signIn(context, session);
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

      const toggle = page.locator(".sidebar-toggle");
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");

      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(".sidebar[data-open='true']")).toBeVisible();

      // Focus should have moved into the drawer, not stayed on the trigger.
      const focusInDrawer = await page.evaluate(
        () => !!document.activeElement?.closest("#app-sidebar")
      );
      expect(focusInDrawer, "focus did not move into the drawer").toBe(true);

      await page.keyboard.press("Escape");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");

      // And it must come back to the button that opened it.
      const focusRestored = await page.evaluate(() =>
        document.activeElement?.classList.contains("sidebar-toggle")
      );
      expect(focusRestored, "focus did not return to the toggle").toBe(true);

      await context.close();
    });

    test("drawer links are out of the tab order while closed", async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
      await signIn(context, session);
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

      /*
       * The drawer is only moved off-canvas with a transform, and a
       * transformed element stays focusable — so without `inert` Tab walks
       * into a menu the user cannot see.
       */
      const reachable = await page.evaluate(() => {
        const wrapper = document.querySelector("#app-sidebar")?.closest("[inert]");
        return !wrapper;
      });

      expect(reachable, "closed drawer is not inert — keyboard users can tab into it").toBe(false);
      await context.close();
    });

    test("toggle is hidden once the sidebar is permanent", async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await signIn(context, session);
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

      await expect(page.locator(".sidebar-toggle")).toBeHidden();
      await expect(page.locator("#app-sidebar")).toBeVisible();

      await context.close();
    });
  });

  test.describe("navigation semantics", () => {
    test("the current route is marked with aria-current", async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await signIn(context, session);
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/tenders`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

      /*
       * Regression guard. The sidebar used to pass `aria-current={undefined}`
       * to every NavLink, which overrode React Router's default and left the
       * current page unannounced — while the file's own documentation
       * claimed the opposite.
       */
      const current = page.locator('#app-sidebar a[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(/Tenders/);

      await context.close();
    });
  });
});
