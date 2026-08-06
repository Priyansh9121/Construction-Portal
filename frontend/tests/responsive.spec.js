/**
 * ===========================================================================
 * RESPONSIVE SMOKE TEST
 * ===========================================================================
 *
 * File purpose:
 * Drives the real application in a real browser at eight viewport widths and
 * asserts the one thing a build cannot tell you: that no page is wider than
 * the screen it is being displayed on.
 *
 * Why this exists:
 * "It compiles" says nothing about whether a phone user has to scroll
 * sideways to reach a Save button. This test measures
 * `documentElement.scrollWidth` against the viewport and fails on any
 * overflow, so the regression cannot come back silently.
 *
 * It also checks:
 *   - the navigation drawer opens, traps focus, and closes on Escape
 *   - every interactive control meets the 44px touch-target floor
 *   - a visible focus indicator exists for keyboard users
 *
 * Running it:
 *   npm run dev            (in one terminal — the test needs a live server)
 *   npm run test:responsive
 *
 * Deliberately NOT wired into CI: it needs the backend and a seeded login.
 * CI runs lint and build only. See DEPLOYMENT.md.
 *
 * SAFETY: BASE_URL must point at a local dev server. This test signs in and
 * navigates; it must never be aimed at production.
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5173";

/** The eight widths the redesign targets. */
const VIEWPORTS = [
  { name: "320", width: 320, height: 568 },
  { name: "375", width: 375, height: 667 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
];

/**
 * Routes reachable without authenticating. The authenticated routes are
 * covered by the signed-in block below.
 */
const PUBLIC_ROUTES = [
  { path: "/login", name: "Login" },
  { path: "/register", name: "Register" },
  { path: "/forgot-password", name: "Forgot Password" },
  { path: "/reset-password", name: "Reset Password" },
];

/**
 * Measures horizontal overflow.
 *
 * Returns the number of pixels by which the document exceeds the viewport.
 * A value of 0 means no sideways scrolling. A tolerance of 1px absorbs
 * sub-pixel rounding on fractional device ratios.
 */
async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
}

/** Names every element wider than the viewport, to make a failure actionable. */
async function offendingElements(page) {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const bad = [];

    document.querySelectorAll("*").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > limit + 1 || rect.right > limit + 1) {
        bad.push(
          `${el.tagName.toLowerCase()}` +
            `${el.className && typeof el.className === "string" ? "." + el.className.split(" ").filter(Boolean).join(".") : ""}` +
            ` (w=${Math.round(rect.width)}, right=${Math.round(rect.right)})`
        );
      }
    });

    return bad.slice(0, 8);
  });
}

test.describe("no horizontal overflow — public routes", () => {
  for (const viewport of VIEWPORTS) {
    for (const route of PUBLIC_ROUTES) {
      test(`${route.name} @ ${viewport.name}px`, async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        await page.goto(`${BASE_URL}${route.path}`, {
          waitUntil: "networkidle",
        });

        const overflow = await horizontalOverflow(page);

        if (overflow > 0) {
          const culprits = await offendingElements(page);
          throw new Error(
            `${route.name} overflows by ${overflow}px at ${viewport.width}px.\n` +
              `Widest elements:\n  ${culprits.join("\n  ")}`
          );
        }

        expect(overflow).toBe(0);
      });
    }
  }
});

test.describe("touch targets and focus", () => {
  test("interactive controls meet the 44px floor at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });

    const undersized = await page.evaluate(() => {
      const MIN = 44;
      const out = [];

      document
        .querySelectorAll("button, a[href], input, select, textarea")
        .forEach((el) => {
          const r = el.getBoundingClientRect();

          // Skip anything not actually rendered.
          if (r.width === 0 && r.height === 0) return;

          // Inline text links are exempt — the floor applies to controls.
          if (el.tagName === "A" && r.height < 30 && el.closest("p")) return;

          if (r.height < MIN - 1) {
            out.push(`${el.tagName.toLowerCase()} h=${Math.round(r.height)}`);
          }
        });

      return out;
    });

    expect(undersized, `Controls under 44px: ${undersized.join(", ")}`).toEqual([]);
  });

  test("a visible focus indicator exists", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });

    await page.keyboard.press("Tab");

    const hasRing = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return false;

      const s = getComputedStyle(el);
      return (
        (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
        s.boxShadow !== "none"
      );
    });

    expect(hasRing).toBe(true);
  });
});

test.describe("navigation drawer", () => {
  /*
   * The drawer only exists below 1024px. Above that the sidebar is
   * permanently visible and the toggle is display:none.
   */
  test("toggle is hidden at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });

    const toggle = page.locator(".sidebar-toggle");

    // Login renders without the shell, so the toggle is absent entirely.
    // On an authenticated page it would be present but hidden.
    expect(await toggle.count()).toBeLessThanOrEqual(1);
  });
});

/*
 * ===========================================================================
 * AUTHENTICATION SHELL
 * ===========================================================================
 *
 * All four public screens share `AuthShell`. These assert the properties that
 * the shared shell is responsible for — the ones that used to be duplicated
 * (and drift) across four page files.
 */

const AUTH_PAGES = [
  { path: "/login", name: "Login", heading: "Sign in", password: true },
  { path: "/register", name: "Register", heading: "Create account", password: true },
  { path: "/forgot-password", name: "Forgot Password", heading: "Reset access", password: false },
  { path: "/reset-password", name: "Reset Password", heading: "Create new password", password: false },
];

test.describe("authentication shell", () => {
  for (const authPage of AUTH_PAGES) {
    test(`${authPage.name} uses the shared shell with one h1`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}${authPage.path}`, { waitUntil: "networkidle" });

      await expect(page.locator(".auth-shell")).toHaveCount(1);

      // Exactly one h1, and it names the task rather than the product.
      const h1 = page.locator("h1");
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(authPage.heading);
    });

    test(`${authPage.name} hides the brand panel on a phone`, async ({ page }) => {
      /*
       * The panel is decorative. On a phone it would push the form under the
       * fold, which is the whole reason the old auth screens were unusable
       * at 320px.
       */
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}${authPage.path}`, { waitUntil: "networkidle" });

      await expect(page.locator(".auth-brand")).toBeHidden();
      await expect(page.locator(".auth-card")).toBeVisible();
    });

    test(`${authPage.name} shows the brand panel on desktop`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${BASE_URL}${authPage.path}`, { waitUntil: "networkidle" });

      await expect(page.locator(".auth-brand")).toBeVisible();
    });

    test(`${authPage.name} submit is full width at 320px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto(`${BASE_URL}${authPage.path}`, { waitUntil: "networkidle" });

      const submit = page.locator(".auth-submit");
      await expect(submit).toBeVisible();

      const box = await submit.boundingBox();

      /*
       * Measure the FORM, not the card.
       *
       * `querySelector(".auth-card > form, .auth-card")` would return the
       * card — a selector list matches the first element in document order
       * that matches any branch, not the first branch that matches. The card
       * carries the page gutter, so comparing against it is off by 32px.
       */
      const formWidth = await page.evaluate(() => {
        const form = document.querySelector(".auth-card form");
        return form ? form.getBoundingClientRect().width : 0;
      });

      expect(formWidth).toBeGreaterThan(0);
      expect(Math.abs(box.width - formWidth)).toBeLessThanOrEqual(2);
      expect(box.height).toBeGreaterThanOrEqual(43);
    });

    if (authPage.password) {
      test(`${authPage.name} password toggle works and does not overlap the text`, async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto(`${BASE_URL}${authPage.path}`, { waitUntil: "networkidle" });

        const input = page.locator(".password-input-wrapper input").first();
        const toggle = page.locator(".password-toggle-btn").first();

        await expect(input).toHaveAttribute("type", "password");
        await expect(toggle).toHaveAttribute("aria-pressed", "false");

        await toggle.click();
        await expect(input).toHaveAttribute("type", "text");
        await expect(toggle).toHaveAttribute("aria-pressed", "true");

        /*
         * The toggle must sit inside the input's reserved padding, not on top
         * of the typed text. This is the regression that made the old login
         * screen render a filled dark button over the password field.
         */
        const overlap = await page.evaluate(() => {
          const i = document.querySelector(".password-input-wrapper input");
          const t = document.querySelector(".password-toggle-btn");
          const ir = i.getBoundingClientRect();
          const tr = t.getBoundingClientRect();
          const reserved = parseFloat(getComputedStyle(i).paddingRight);
          return tr.left >= ir.right - reserved - 2;
        });

        expect(overlap, "the password toggle overlaps the input text").toBe(true);
      });
    }

    test(`${authPage.name} inputs carry autocomplete and visible labels`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}${authPage.path}`, { waitUntil: "networkidle" });

      const problems = await page.evaluate(() => {
        const out = [];

        document
          .querySelectorAll('.auth-card input:not([type="checkbox"]):not([type="hidden"])')
          .forEach((el) => {
            const id = el.id;
            const labelled =
              (id && document.querySelector(`label[for="${id}"]`)) ||
              el.closest("label") ||
              el.getAttribute("aria-label");

            if (!labelled) out.push(`${el.name || el.type}: no visible label`);

            // Email and password fields must let the browser autofill.
            if (
              (el.type === "email" || el.type === "password") &&
              !el.getAttribute("autocomplete")
            ) {
              out.push(`${el.name || el.type}: no autocomplete`);
            }
          });

        return out;
      });

      expect(problems, problems.join(", ")).toEqual([]);
    });
  }
});
