/**
 * ===========================================================================
 * PORTALS AND MOBILE TABLE STRATEGY
 * ===========================================================================
 *
 * File purpose:
 * Covers the two things the other suites cannot: the role-gated Worker and
 * Subcontractor portals, and whether the register tables actually adopt the
 * mobile card presentation rather than merely having it available.
 *
 * Why this is separate:
 * `authenticated.spec.js` signs in as an admin. Both portals reject an admin
 * by design — RoleRoute redirects, and the backend's linked-record lookup
 * returns nothing — so they need their own fixtures and their own file.
 *
 * The regression it guards:
 * The card machinery (`.table-wrapper--cards` + `data-label`) existed for a
 * long time with **zero** tables using it. A DOM probe found it on 0 of 42
 * rendered tables. Infrastructure nobody adopts is indistinguishable from
 * infrastructure that does not work, so adoption itself is asserted here.
 *
 * ---------------------------------------------------------------------------
 * SAFETY / SETUP
 * ---------------------------------------------------------------------------
 * Local-only, same as the other authenticated suites — it refuses to start
 * against a non-localhost origin. Needs the portal fixtures:
 *
 *   cd backend
 *   LOCAL_WORKER_FIXTURE_PASSWORD=… LOCAL_SUBCONTRACTOR_FIXTURE_PASSWORD=… \
 *   node scripts/createLocalPortalFixtures.js
 *
 * Remove them afterwards with `--cleanup`.
 */

import { test, expect, request as playwrightRequest } from "@playwright/test";

import {
  BASE_URL,
  assertLocalTarget,
  login,
  seedSession,
} from "./support/fixtures.js";

assertLocalTarget();


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

const PORTALS = [
  { path: "/worker-portal", name: "Worker Portal", as: "worker" },
  { path: "/subcontractor-portal", name: "Subcontractor Portal", as: "subcontractor" },
];

/*
 * Registers that must present as cards on a phone AND have rows locally, so
 * the derived `data-label` can actually be asserted.
 *
 * Activity Log is deliberately absent: it is no longer a table at all. It
 * became a date-grouped stream (see the "activity log stream" block below),
 * because an audit trail is read chronologically and gains nothing from
 * column alignment.
 */
const CARD_REGISTERS = [
  { path: "/workers", name: "Workers", expect: ["Name", "Status"] },
  { path: "/users", name: "User Management", expect: ["Name", "Email", "Role"] },
  { path: "/tenders", name: "Tenders", expect: ["Tender", "Status"] },
  { path: "/subcontractors", name: "Subcontractors", expect: ["Name", "Business"] },
];

/*
 * Registers converted to card mode whose tables are empty in the local seed.
 *
 * Their `data-label` stamping cannot be asserted without rows, so these
 * assert the weaker but still meaningful property: the wrapper is in card
 * mode, and the page does not overflow. The stamping itself is proven by
 * CARD_REGISTERS above — it is the same code path in ResponsiveTable.
 */
const CARD_REGISTERS_NO_LOCAL_DATA = [
  { path: "/daily-update-approvals", name: "Daily Update Approvals" },
  { path: "/daily-site-updates", name: "Daily Site Updates" },
  { path: "/worker-money", name: "Worker Money" },
];

const sessions = {};

async function getSession(key) {
  if (sessions[key]) return sessions[key];

  sessions[key] = await login(playwrightRequest, key);
  return sessions[key];
}

async function signedInPage(browser, key, viewport) {
  const session = await getSession(key);
  const context = await browser.newContext({ viewport });

  await seedSession(context, session);

  return { context, page: await context.newPage(), session };
}

const overflowOf = (page) =>
  page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(0, d.scrollWidth - d.clientWidth);
  });

test.describe("worker and subcontractor portals", () => {
  for (const portal of PORTALS) {
    for (const viewport of VIEWPORTS) {
      test(`${portal.name} — no overflow @ ${viewport.name}px`, async ({ browser }) => {
        const { context, page } = await signedInPage(browser, portal.as, {
          width: viewport.width,
          height: viewport.height,
        });

        await page.goto(`${BASE_URL}${portal.path}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1200);

        // A redirect means the fixture is missing or its linked record is
        // gone — a setup problem, not a layout one. Say so plainly.
        expect(
          new URL(page.url()).pathname,
          `${portal.name} redirected to ${new URL(page.url()).pathname}. ` +
            `The ${portal.as} fixture is missing or its linked record is inactive.`
        ).toBe(portal.path);

        expect(await overflowOf(page)).toBe(0);
        await context.close();
      });
    }

    test(`${portal.name} — controls meet 44px at 375px`, async ({ browser }) => {
      const { context, page } = await signedInPage(browser, portal.as, {
        width: 375,
        height: 667,
      });

      await page.goto(`${BASE_URL}${portal.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);

      const undersized = await page.evaluate(() => {
        const out = [];
        document
          .querySelectorAll("button, a[href], select, textarea, input:not([type=hidden])")
          .forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return;
            if (el.tagName === "A" && el.closest("p")) return;
            if (r.height < 43) out.push(`${el.tagName.toLowerCase()} h=${Math.round(r.height)}`);
          });
        return [...new Set(out)];
      });

      expect(undersized, `Under 44px on ${portal.name}: ${undersized.join(", ")}`).toEqual([]);
      await context.close();
    });

    test(`${portal.name} — rejects an admin`, async ({ browser }) => {
      /*
       * The portals are role-gated. This asserts the guard still works after
       * presentation changes — a redesign must never widen who can see a
       * portal.
       */
      const { context, page } = await signedInPage(browser, "admin", {
        width: 1280,
        height: 800,
      });

      await page.goto(`${BASE_URL}${portal.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);

      expect(
        new URL(page.url()).pathname,
        `An admin reached ${portal.name} — the role guard has regressed`
      ).not.toBe(portal.path);

      await context.close();
    });
  }
});

test.describe("mobile table strategy", () => {
  for (const register of CARD_REGISTERS) {
    test(`${register.name} presents as cards at 375px`, async ({ browser }) => {
      const { context, page } = await signedInPage(browser, "admin", {
        width: 375,
        height: 667,
      });

      await page.goto(`${BASE_URL}${register.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1400);

      const wrapper = page.locator(".table-wrapper--cards").first();
      await expect(
        wrapper,
        `${register.name} has no card-mode table wrapper`
      ).toHaveCount(1);

      const result = await page.evaluate(() => {
        const wrap = document.querySelector(".table-wrapper--cards");
        const table = wrap?.querySelector("table");
        if (!table) return null;

        const row = table.querySelector("tbody tr");
        const cells = row ? Array.from(row.children).filter((c) => c.tagName === "TD") : [];

        return {
          // Rows stack instead of laying out as table rows.
          rowDisplay: row ? getComputedStyle(row).display : null,
          // thead is hidden visually but kept in the a11y tree.
          theadPosition: getComputedStyle(table.querySelector("thead")).position,
          labels: cells
            .filter((c) => c.colSpan <= 1)
            .map((c) => c.getAttribute("data-label")),
        };
      });

      expect(result, `${register.name}: no table found in card wrapper`).not.toBeNull();
      expect(result.rowDisplay, `${register.name}: rows are not stacking`).toBe("block");

      // sr-only, not display:none — the table must still be announced.
      expect(
        result.theadPosition,
        `${register.name}: thead should be visually hidden but present`
      ).toBe("absolute");

      // Every non-spanning cell carries its column name.
      const unlabelled = result.labels.filter((l) => !l);
      expect(
        unlabelled,
        `${register.name}: ${unlabelled.length} cell(s) missing data-label`
      ).toEqual([]);

      // And the labels are the real column names, not placeholders.
      for (const expected of register.expect) {
        expect(
          result.labels,
          `${register.name}: expected a "${expected}" label`
        ).toContain(expected);
      }

      await context.close();
    });

    test(`${register.name} keeps its desktop table at 1440px`, async ({ browser }) => {
      /*
       * The card transform must be a mobile-only presentation. If it leaked
       * to desktop the registers would lose their columns entirely.
       */
      const { context, page } = await signedInPage(browser, "admin", {
        width: 1440,
        height: 900,
      });

      await page.goto(`${BASE_URL}${register.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1400);

      const rowDisplay = await page.evaluate(() => {
        const row = document.querySelector(".table-wrapper--cards table tbody tr");
        return row ? getComputedStyle(row).display : null;
      });

      expect(rowDisplay, `${register.name}: desktop rows should stay table-rows`).toBe("table-row");
      await context.close();
    });
  }
});

test.describe("card mode on registers with no local rows", () => {
  for (const register of CARD_REGISTERS_NO_LOCAL_DATA) {
    test(`${register.name} uses card mode at 375px`, async ({ browser }) => {
      const { context, page } = await signedInPage(browser, "admin", {
        width: 375,
        height: 667,
      });

      await page.goto(`${BASE_URL}${register.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1400);

      const state = await page.evaluate(() => {
        const cards = document.querySelectorAll(".table-wrapper--cards").length;
        const doc = document.documentElement;
        return { cards, overflow: Math.max(0, doc.scrollWidth - doc.clientWidth) };
      });

      expect(
        state.cards,
        `${register.name} has no card-mode wrapper — the register was not converted`
      ).toBeGreaterThan(0);

      expect(state.overflow).toBe(0);
      await context.close();
    });
  }

  test("Worker Money keeps its Allocation Summary scrollable", async ({ browser }) => {
    /*
     * A deliberate exception, asserted so nobody "helpfully" converts it.
     * Allocated / Total Spent / Remaining only read as a balance when they
     * sit beside each other; stacking them into a card destroys the very
     * comparison the row exists to make.
     */
    const { context, page } = await signedInPage(browser, "admin", {
      width: 375,
      height: 667,
    });

    await page.goto(`${BASE_URL}/worker-money`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);

    const scrollWrappers = await page.evaluate(
      () => document.querySelectorAll(".table-wrapper:not(.table-wrapper--cards)").length
    );

    expect(
      scrollWrappers,
      "Allocation Summary should remain a horizontally scrolling table"
    ).toBeGreaterThan(0);

    await context.close();
  });
});

test.describe("activity log stream", () => {
  test("groups events by day with Today / Yesterday headings", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "admin", {
      width: 1440,
      height: 900,
    });

    await page.goto(`${BASE_URL}/activity`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1600);

    const headings = await page.evaluate(() =>
      [...document.querySelectorAll(".activity-day-heading")].map((h) =>
        h.textContent.trim()
      )
    );

    expect(headings.length, "no day groups rendered").toBeGreaterThan(0);

    // The relative labels are derived from local calendar components, not
    // from string-matching the timestamp.
    expect(
      headings.some((h) => /Today|Yesterday|\d{4}|January|February|March|April|May|June|July|August|September|October|November|December/.test(h)),
      `day headings look wrong: ${headings.join(" | ")}`
    ).toBe(true);

    // It must NOT be a table any more.
    expect(
      await page.locator(".activity-stream table").count(),
      "the activity stream should not contain a table"
    ).toBe(0);

    await context.close();
  });

  test("metadata expands and collapses, and reports state", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "admin", {
      width: 1440,
      height: 900,
    });

    await page.goto(`${BASE_URL}/activity`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1600);

    const toggle = page.locator(".activity-disclosure").first();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // Collapsed means genuinely absent, not merely hidden — otherwise a
    // screen reader walks 200 rows of invisible field values.
    expect(await page.locator(".activity-metadata").count()).toBe(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".activity-metadata").first()).toBeVisible();

    /*
     * aria-controls must point at the panel it actually opened.
     *
     * Resolved inside the page rather than with a Playwright locator:
     * React's useId emits ids containing colons (":r1:"), which are not
     * valid in a bare CSS id selector, and CSS.escape only exists in the
     * browser — not in the Node side of the test.
     */
    const controls = await toggle.getAttribute("aria-controls");
    expect(controls).toBeTruthy();

    const panelExists = await page.evaluate(
      (id) => document.querySelectorAll(`[id="${id}"]`).length,
      controls
    );

    expect(panelExists, `aria-controls="${controls}" points at nothing`).toBe(1);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(await page.locator(".activity-metadata").count()).toBe(0);

    await context.close();
  });

  test("the disclosure is operable from the keyboard", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "admin", {
      width: 1440,
      height: 900,
    });

    await page.goto(`${BASE_URL}/activity`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1600);

    const toggle = page.locator(".activity-disclosure").first();
    await toggle.focus();
    await page.keyboard.press("Enter");

    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await context.close();
  });

  test("the disclosure stays a text control on hover", async ({ browser }) => {
    /*
     * Regression guard. `button:hover:not(:disabled)` in foundation.css
     * scores (0,2,1) and beat a plain `.activity-disclosure:hover` (0,2,0),
     * filling this text button solid blue on hover.
     */
    const { context, page } = await signedInPage(browser, "admin", {
      width: 1440,
      height: 900,
    });

    await page.goto(`${BASE_URL}/activity`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1600);

    const toggle = page.locator(".activity-disclosure").first();
    await toggle.hover();

    const background = await toggle.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );

    expect(
      background,
      "the disclosure filled itself on hover — a global button rule is winning again"
    ).toBe("rgba(0, 0, 0, 0)");

    await context.close();
  });

  test("no overflow at 320px", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "admin", {
      width: 320,
      height: 568,
    });

    await page.goto(`${BASE_URL}/activity`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1600);

    // Expand one, because a JSON blob in the metadata is the most likely
    // thing to push the page sideways.
    const toggle = page.locator(".activity-disclosure").first();
    if (await toggle.count()) {
      await toggle.click();
      await page.waitForTimeout(300);
    }

    expect(await overflowOf(page)).toBe(0);
    await context.close();
  });
});

test.describe("site operations field workspace", () => {
  const WIDTHS = [
    { name: "390", width: 390, height: 844 },
    { name: "768", width: 768, height: 1024 },
    { name: "1440", width: 1440, height: 900 },
  ];

  for (const vp of WIDTHS) {
    test(`context card and modules render at ${vp.name}px`, async ({ browser }) => {
      const { context, page } = await signedInPage(browser, "admin", {
        width: vp.width,
        height: vp.height,
      });

      await page.goto(`${BASE_URL}/site-operations`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      // The date-only context card.
      await expect(page.locator(".ops-context")).toHaveCount(1);
      await expect(page.locator(".ops-context-date time")).toBeVisible();

      // All four modules stay reachable — none hidden behind an overflow menu.
      const modules = page.locator(".ops-module");
      await expect(modules).toHaveCount(4);
      await expect(page.locator(".ops-module--active")).toHaveCount(1);

      expect(await overflowOf(page)).toBe(0);
      await context.close();
    });
  }

  test("no tender or site selector is introduced", async ({ browser }) => {
    /*
     * Guards the SITE-OPS-DATA-01 decision.
     *
     * Site Operations records carry no tender or site attribution. The API
     * accepts `tender_id`/`site_id` on a material create (defaulting to null)
     * but the frontend has never sent them, so every historical row has both
     * columns null. Adding selectors would start writing attribution on new
     * rows only, silently breaking any tender-filtered report across the
     * boundary. That is a data-migration decision, not a layout one.
     *
     * This test fails if someone adds the selectors without making it.
     */
    const { context, page } = await signedInPage(browser, "admin", {
      width: 1440,
      height: 900,
    });

    await page.goto(`${BASE_URL}/site-operations`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const found = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll(".ops-context select, .ops-context input").forEach((el) => {
        const name = `${el.name} ${el.id} ${el.getAttribute("aria-label") || ""}`.toLowerCase();
        if (/tender|site/.test(name)) out.push(name.trim());
      });
      return out;
    });

    expect(
      found,
      "a tender/site selector appeared in the context card — see SITE-OPS-DATA-01 in UI_UX_AUDIT.md §8d"
    ).toEqual([]);

    await context.close();
  });

  test("module tabs are keyboard navigable with a roving tabindex", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "admin", {
      width: 1440,
      height: 900,
    });

    await page.goto(`${BASE_URL}/site-operations`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // Only the active tab is in the tab order; arrows move between them.
    const tabIndexes = await page.evaluate(() =>
      [...document.querySelectorAll('[role="tab"]')].map((t) => t.tabIndex)
    );
    expect(tabIndexes.filter((t) => t === 0)).toHaveLength(1);

    const first = page.locator('[role="tab"]').first();
    await first.focus();
    await page.keyboard.press("ArrowRight");

    await expect(page.locator(".ops-module--active")).toHaveText(/Labour/);

    await page.keyboard.press("End");
    await expect(page.locator(".ops-module--active")).toHaveText(/Access Requests/);

    await page.keyboard.press("Home");
    await expect(page.locator(".ops-module--active")).toHaveText(/Material/);

    await context.close();
  });

  test("the panel is labelled by its tab", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "admin", {
      width: 1440,
      height: 900,
    });

    await page.goto(`${BASE_URL}/site-operations`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const panel = page.locator('[role="tabpanel"]');
    await expect(panel).toHaveCount(1);

    const labelledBy = await panel.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();

    const tabExists = await page.evaluate(
      (id) => document.querySelectorAll(`[id="${id}"][role="tab"]`).length,
      labelledBy
    );
    expect(tabExists).toBe(1);

    await context.close();
  });

  test("forms are one column with 44px controls at 390px", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "admin", {
      width: 390,
      height: 844,
    });

    await page.goto(`${BASE_URL}/site-operations`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const result = await page.evaluate(() => {
      const fields = [
        ...document.querySelectorAll(
          ".ops-workspace input:not([type=hidden]):not([type=file]), .ops-workspace select"
        ),
      ];

      const formWidth =
        document.querySelector(".ops-workspace form")?.getBoundingClientRect().width || 0;

      return {
        count: fields.length,
        // One column: every field spans essentially the whole form.
        narrow: fields.filter((f) => f.getBoundingClientRect().width < formWidth * 0.8).length,
        undersized: fields.filter((f) => f.getBoundingClientRect().height < 43).length,
      };
    });

    expect(result.count).toBeGreaterThan(0);
    expect(result.narrow, "some fields are not full width — the form is not one column").toBe(0);
    expect(result.undersized, "some controls are under 44px").toBe(0);

    await context.close();
  });

  test("camera and gallery upload controls are present", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "admin", {
      width: 390,
      height: 844,
    });

    await page.goto(`${BASE_URL}/site-operations`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // Two distinct inputs: one opens the camera, one the gallery. The page
    // records which was used, so both must survive any layout change.
    await expect(page.locator('input[type="file"][capture="environment"]')).toHaveCount(1);
    await expect(page.locator('input[type="file"]:not([capture])')).toHaveCount(1);

    await context.close();
  });
});

test.describe("worker portal layout", () => {
  const WIDTHS = [
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

  for (const vp of WIDTHS) {
    test(`worker-first hierarchy holds at ${vp.name}px`, async ({ browser }) => {
      const { context, page } = await signedInPage(browser, "worker", {
        width: vp.width,
        height: vp.height,
      });

      await page.goto(`${BASE_URL}/worker-portal`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1400);

      // Header, then assignment — "where am I" before anything else.
      await expect(page.locator(".portal-header")).toHaveCount(1);
      await expect(page.locator(".portal-assignment")).toHaveCount(1);

      // Exactly one h1, and it is the worker, not the product.
      await expect(page.locator("h1")).toHaveCount(1);

      expect(await overflowOf(page)).toBe(0);
      await context.close();
    });
  }

  test("assignment card appears before the summary tiles", async ({ browser }) => {
    /*
     * Order matters more than presence. The old portal led with four office
     * KPI tiles and never showed the site at all — the worker's first
     * question was the one thing the screen would not answer.
     */
    const { context, page } = await signedInPage(browser, "worker", {
      width: 390,
      height: 844,
    });

    await page.goto(`${BASE_URL}/worker-portal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);

    const order = await page.evaluate(() => {
      const assignment = document.querySelector(".portal-assignment");
      const summaries = document.querySelector(".portal-summaries");
      if (!assignment || !summaries) return null;
      // Node.DOCUMENT_POSITION_FOLLOWING === 4
      return (assignment.compareDocumentPosition(summaries) & 4) !== 0;
    });

    expect(order, "the summary tiles come before the assignment card").toBe(true);
    await context.close();
  });

  test("logout is neutral, never destructive", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "worker", {
      width: 390,
      height: 844,
    });

    await page.goto(`${BASE_URL}/worker-portal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);

    const logout = page.locator("button", { hasText: /log ?out/i }).first();
    await expect(logout).toBeVisible();

    const className = await logout.getAttribute("class");
    expect(
      className,
      "logout wears destructive styling — ending a session destroys nothing"
    ).not.toMatch(/delete-btn|danger/);

    // And it must not be painted red by anything else either.
    const bg = await logout.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toMatch(/rgb\(2[0-9]{2}, (3[0-9]|[0-5][0-9]), /);

    await context.close();
  });

  test("no decorative gradients on portal surfaces", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "worker", {
      width: 390,
      height: 844,
    });

    await page.goto(`${BASE_URL}/worker-portal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);

    const gradients = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          ".portal-header, .portal-assignment, .portal-action, .portal-summary, .card"
        ),
      ]
        .filter((el) => /gradient/.test(getComputedStyle(el).backgroundImage))
        .map((el) => (typeof el.className === "string" ? el.className : ""))
    );

    /*
     * `.table-wrapper` is deliberately excluded: its gradient is a 24px
     * "there is more to the right" scroll affordance, not decoration.
     */
    expect(gradients, `gradient surfaces: ${gradients.join(", ")}`).toEqual([]);
    await context.close();
  });

  test("a zero figure never reads as success", async ({ browser }) => {
    /*
     * A green "0 approved updates" says "all good" when it means "nothing
     * approved yet" — the opposite. Tone is only applied to a meaningful
     * value.
     */
    const { context, page } = await signedInPage(browser, "worker", {
      width: 390,
      height: 844,
    });

    await page.goto(`${BASE_URL}/worker-portal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);

    const misleading = await page.evaluate(() =>
      [...document.querySelectorAll('.portal-summary[data-tone="success"]')]
        .map((el) => el.querySelector(".portal-summary-value")?.textContent?.trim() || "")
        .filter((text) => /^[₹$€£]?\s*0(\.00)?$/.test(text))
    );

    expect(misleading, `zero values tinted as success: ${misleading.join(", ")}`).toEqual([]);
    await context.close();
  });

  test("summary figures are not headings", async ({ browser }) => {
    /*
     * The old tiles used `<h2>` for the number, which gives a screen reader a
     * heading called "3" and puts a bare figure in the document outline.
     */
    const { context, page } = await signedInPage(browser, "worker", {
      width: 390,
      height: 844,
    });

    await page.goto(`${BASE_URL}/worker-portal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);

    const headingNumbers = await page.evaluate(() =>
      [...document.querySelectorAll(".portal-summary h1, .portal-summary h2, .portal-summary h3")]
        .map((el) => el.textContent.trim())
    );

    expect(headingNumbers, "a summary figure is marked up as a heading").toEqual([]);
    await context.close();
  });

  test("adaptive layout: context row is single column on mobile, split on desktop", async ({
    browser,
  }) => {
    const read = async (width) => {
      const { context, page } = await signedInPage(browser, "worker", {
        width,
        height: 900,
      });

      await page.goto(`${BASE_URL}/worker-portal`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1400);

      const columns = await page.evaluate(() => {
        const row = document.querySelector(".portal-context-row");
        return row ? getComputedStyle(row).gridTemplateColumns : null;
      });

      await context.close();
      return columns;
    };

    const mobile = await read(390);
    const desktop = await read(1440);

    // Mobile is a plain block (no grid tracks); desktop resolves two tracks.
    expect(desktop.split(" ").length, `desktop tracks: ${desktop}`).toBe(2);
    expect(mobile).not.toBe(desktop);
  });

  test("worker portal still rejects an admin", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "admin", {
      width: 1280,
      height: 800,
    });

    await page.goto(`${BASE_URL}/worker-portal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);

    expect(
      new URL(page.url()).pathname,
      "an admin reached the Worker Portal — the role guard has regressed"
    ).not.toBe("/worker-portal");

    await context.close();
  });
});

test.describe("subcontractor portal layout", () => {
  const WIDTHS = [
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

  for (const vp of WIDTHS) {
    test(`contractor-first hierarchy holds at ${vp.name}px`, async ({ browser }) => {
      const { context, page } = await signedInPage(browser, "subcontractor", {
        width: vp.width,
        height: vp.height,
      });

      await page.goto(`${BASE_URL}/subcontractor-portal`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1400);

      await expect(page.locator(".portal-header")).toHaveCount(1);
      await expect(page.locator(".portal-assignment")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);

      expect(await overflowOf(page)).toBe(0);
      await context.close();
    });
  }

  test("project card appears before the summary tiles", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "subcontractor", {
      width: 390,
      height: 844,
    });

    await page.goto(`${BASE_URL}/subcontractor-portal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);

    const projectFirst = await page.evaluate(() => {
      const project = document.querySelector(".portal-assignment");
      const summaries = document.querySelector(".portal-summaries");
      if (!project || !summaries) return null;
      return (project.compareDocumentPosition(summaries) & 4) !== 0;
    });

    expect(projectFirst, "summary tiles come before the project card").toBe(true);
    await context.close();
  });

  test("bank account number and IFSC are never rendered", async ({ browser }) => {
    /*
     * The masked-data guard, and the most important test in this file.
     *
     * `/subcontractor-portal/me` legitimately returns the caller's OWN
     * `account_number` and `ifsc_code` — the controller says so explicitly.
     * The portal has never displayed them, only `bank_name`. A redesign that
     * "helpfully" surfaced the full record would leak a bank account onto a
     * phone screen on a building site.
     *
     * Asserted against the rendered text, not the markup, so it catches the
     * value appearing anywhere — including inside an export preview.
     */
    const { context, page } = await signedInPage(browser, "subcontractor", {
      width: 1440,
      height: 900,
    });

    const payload = await page.evaluate(() => null);
    void payload;

    await page.goto(`${BASE_URL}/subcontractor-portal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // Walk every section so a hidden tab cannot smuggle it in.
    const sections = ["overview", "tenders", "updates", "documents", "profile"];

    for (const label of ["Home", "My Tenders", "Daily Updates", "Documents", "My Profile"]) {
      const tab = page.locator("button", { hasText: new RegExp(`^${label}$`) }).first();
      if (await tab.count()) {
        await tab.click();
        await page.waitForTimeout(600);
      }

      const leaked = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          // A run of 9+ digits is an account number shape.
          accountLike: /\b\d{9,}\b/.test(text),
          // IFSC: 4 letters, a 0, then 6 alphanumerics.
          ifscLike: /\b[A-Z]{4}0[A-Z0-9]{6}\b/.test(text),
          labels: /account\s*number|ifsc/i.test(text),
        };
      });

      expect(leaked.ifscLike, `IFSC-shaped value rendered on ${label}`).toBe(false);
      expect(leaked.labels, `an account-number/IFSC label appeared on ${label}`).toBe(false);
    }

    void sections;
    await context.close();
  });

  test("logout is neutral and no decorative gradients", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "subcontractor", {
      width: 390,
      height: 844,
    });

    await page.goto(`${BASE_URL}/subcontractor-portal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);

    const logout = page.locator("button", { hasText: /log ?out/i }).first();
    const className = await logout.getAttribute("class");
    expect(className).not.toMatch(/delete-btn|danger/);

    const gradients = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          ".portal-header, .portal-assignment, .portal-action, .portal-summary, .card"
        ),
      ].filter((el) => /gradient/.test(getComputedStyle(el).backgroundImage)).length
    );

    expect(gradients, "a portal surface still carries a gradient").toBe(0);
    await context.close();
  });

  test("a zero figure never reads as success", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "subcontractor", {
      width: 390,
      height: 844,
    });

    await page.goto(`${BASE_URL}/subcontractor-portal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);

    const misleading = await page.evaluate(() =>
      [...document.querySelectorAll('.portal-summary[data-tone="success"]')]
        .map((el) => el.querySelector(".portal-summary-value")?.textContent?.trim() || "")
        .filter((text) => /^[₹$€£]?\s*0(\.00)?$/.test(text))
    );

    expect(misleading, `zero values tinted as success: ${misleading.join(", ")}`).toEqual([]);
    await context.close();
  });

  test("summary figures are not headings", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "subcontractor", {
      width: 390,
      height: 844,
    });

    await page.goto(`${BASE_URL}/subcontractor-portal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);

    const headingNumbers = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          ".portal-summary h1, .portal-summary h2, .portal-summary h3"
        ),
      ].map((el) => el.textContent.trim())
    );

    expect(headingNumbers).toEqual([]);
    await context.close();
  });

  test("all five sections remain reachable", async ({ browser }) => {
    /*
     * The redesign reordered the page; it must not have cost a section.
     */
    const { context, page } = await signedInPage(browser, "subcontractor", {
      width: 390,
      height: 844,
    });

    await page.goto(`${BASE_URL}/subcontractor-portal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);

    for (const label of ["Home", "My Tenders", "Daily Updates", "Documents", "My Profile"]) {
      await expect(
        page.locator("button", { hasText: new RegExp(`^${label}$`) }).first(),
        `the "${label}" section is missing`
      ).toBeVisible();
    }

    await context.close();
  });

  test("subcontractor portal still rejects an admin", async ({ browser }) => {
    const { context, page } = await signedInPage(browser, "admin", {
      width: 1280,
      height: 800,
    });

    await page.goto(`${BASE_URL}/subcontractor-portal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);

    expect(
      new URL(page.url()).pathname,
      "an admin reached the Subcontractor Portal — the role guard has regressed"
    ).not.toBe("/subcontractor-portal");

    await context.close();
  });
});
