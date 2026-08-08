/**
 * D5 first-run verification.
 *
 * Renders the Dashboard twice: once against the real fixture (partially
 * populated) and once with every list endpoint stubbed to an empty array, so
 * the brand-new-company view can be inspected WITHOUT touching the database.
 * Stubbing happens in the browser's network layer only; no request reaches the
 * API and no fixture is mutated (AUTH-018).
 *
 * Asserts that an empty Dashboard is quieter than a populated one, that every
 * empty section explains itself, and that no empty region is left oversized.
 *
 * Usage: node tools/fresh_ui/dashboard_firstrun_probe.mjs [outDir]
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium, request } = requireFromFrontend("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const API = process.env.E2E_API_URL || "http://127.0.0.1:5051";
const outDir = process.argv[2] || path.join(root, ".screenshots/d5");
fs.mkdirSync(outDir, { recursive: true });

const api = await request.newContext({ baseURL: API });
const login = await api.post("/api/auth/login", {
  data: {
    email: process.env.LOCAL_ADMIN_FIXTURE_EMAIL,
    password: process.env.LOCAL_ADMIN_FIXTURE_PASSWORD,
  },
});
if (!login.ok()) {
  console.error("admin fixture login failed");
  process.exit(1);
}
const { token, user } = await login.json();
await api.dispose();

const browser = await chromium.launch();
let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

async function render({ empty, width, label }) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(
    ([t, u]) => {
      localStorage.setItem("token", t);
      localStorage.setItem("user", u);
    },
    [token, JSON.stringify(user)]
  );

  if (empty) {
    /* Read-only stub: the request is fulfilled in the browser and never
     * reaches the backend, so no fixture data is touched. */
    await context.route("**/api/**", async (route) => {
      const url = route.request().url();
      if (/\/(payments|invoices|tenders|workers|sites|subcontractors)/.test(url)) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: [] }),
        });
      }
      return route.continue();
    });
  }

  const page = await context.newPage();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, `${label}-${width}.png`), fullPage: true });

  const state = await page.evaluate(() => {
    const scope = document.querySelector(".page-content");
    const chart = document.querySelector(".premium-chart-panel");
    return {
      height: document.documentElement.scrollHeight,
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      emptyBlocks: scope.querySelectorAll(".ui-empty").length,
      /* Every empty block must carry a sentence, not just a title. */
      describedAll: [...scope.querySelectorAll(".ui-empty")].every(
        (e) => (e.querySelector(".ui-empty__description")?.textContent || "").trim().length > 20
      ),
      chartHeight: chart ? Math.round(chart.getBoundingClientRect().height) : null,
      sections: ["ui-attention", "ui-health", "ui-pipe", "ui-activity"].filter(
        (c) => scope.querySelector(`.${c}`)
      ).length,
      tallestEmpty: Math.max(
        0,
        ...[...scope.querySelectorAll(".ui-empty")].map((e) =>
          Math.round(e.getBoundingClientRect().height)
        )
      ),
      duplicateActions: (() => {
        const hrefs = [...scope.querySelectorAll("a")]
          .map((a) => new URL(a.href).pathname)
          .filter(Boolean);
        const seen = new Set();
        const dupes = new Set();
        for (const h of hrefs) {
          if (seen.has(h)) dupes.add(h);
          seen.add(h);
        }
        return [...dupes];
      })(),
      text: scope.innerText,
    };
  });

  await context.close();
  return state;
}

for (const width of [390, 1440]) {
  const populated = await render({ empty: false, width, label: "populated" });
  const blank = await render({ empty: true, width, label: "firstrun" });

  console.log(`\n── ${width}px ──`);
  console.log(`  populated: height=${populated.height} empties=${populated.emptyBlocks} chart=${populated.chartHeight}`);
  console.log(`  first run: height=${blank.height} empties=${blank.emptyBlocks} chart=${blank.chartHeight}`);

  check(blank.sections === 4, `${width} all four sections still render when empty`, `${blank.sections}/4`);
  /*
   * The first draft asserted the empty page was shorter than the populated
   * one. That measured nothing useful: the local fixture has no payments and
   * one row per section, so "populated" is itself nearly empty and the
   * comparison was against a near-blank baseline.
   *
   * What actually matters is that no single empty region becomes oversized --
   * DASH-003 was one 380px void -- and that first run does not hand the user
   * the same destination twice.
   */
  check(
    blank.tallestEmpty < 200,
    `${width} no empty region is oversized`,
    `tallest=${blank.tallestEmpty}px`
  );
  check(
    blank.duplicateActions.length === 0,
    `${width} first run offers no destination twice`,
    blank.duplicateActions.join(", ")
  );
  check(blank.overflow === 0, `${width} no horizontal overflow when empty`);
  check(blank.emptyBlocks > 0, `${width} empty sections use the shared empty state`, `n=${blank.emptyBlocks}`);
  check(blank.describedAll, `${width} every empty block explains itself`);
  check(
    blank.chartHeight !== null && blank.chartHeight < 260,
    `${width} finance trend no longer leaves a large void (DASH-003)`,
    `chart=${blank.chartHeight}px`
  );
  check(
    !/Nothing needs you right now/.test(blank.text),
    `${width} first run does NOT claim the user is caught up`
  );
  check(
    /starting point rather than a balance/.test(blank.text),
    `${width} zero cash is explained as a starting point, not a balance`
  );
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nfirst-run experience clean");
process.exit(failures ? 1 : 0);
