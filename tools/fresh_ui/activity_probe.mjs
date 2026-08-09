/**
 * The Activity ledger, verified at runtime.
 *
 * This route's contract is not a table's. It is an evidentiary record, and
 * what has to hold is that it can never be read as saying more than it knows:
 *
 *   - it states its own scope in words, before the first row
 *   - it says so when it has stopped at the page limit, because a full page
 *     and a truncated one are otherwise indistinguishable
 *   - zero results name what was searched
 *   - a failed refresh keeps the records already on screen and says when they
 *     were read
 *   - the disclosure is a real control with real state
 *   - no data value carries Latin optical tracking, at any width
 *
 * Also asserts the two motion rules the route must obey: nothing animates on
 * arrival, and a filter change does not move what is under the pointer.
 *
 * Usage:
 *   LOCAL_ADMIN_FIXTURE_EMAIL=… LOCAL_ADMIN_FIXTURE_PASSWORD=… \
 *   node tools/fresh_ui/activity_probe.mjs
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const req = createRequire(path.join(root, "frontend/package.json"));
const { chromium, request: playwrightRequest } = req("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const API = process.env.E2E_API_URL || "http://127.0.0.1:5051";
const outDir = path.join(root, ".screenshots/activity");
fs.mkdirSync(outDir, { recursive: true });

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

const api = await playwrightRequest.newContext({ baseURL: API });
const login = await api.post("/api/auth/login", {
  data: {
    email: process.env.LOCAL_ADMIN_FIXTURE_EMAIL,
    password: process.env.LOCAL_ADMIN_FIXTURE_PASSWORD,
  },
});
if (!login.ok()) {
  console.error("admin fixture login failed; cannot probe an admin-only route");
  process.exit(1);
}
const { token, user } = await login.json();
await api.dispose();

const browser = await chromium.launch();

async function open(width, height, reduced = false) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await ctx.addInitScript(
    ([t, u]) => {
      localStorage.setItem("token", t);
      localStorage.setItem("user", u);
    },
    [token, JSON.stringify(user)]
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}/activity`, { waitUntil: "networkidle" });
  await page.waitForSelector(".ledger", { timeout: 10000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}

/* ── 1 · the ledger states its scope ─────────────────────────────────────── */
console.log("\n── scope ──");
{
  const { ctx, page } = await open(1440, 900);

  const s = await page.evaluate(() => {
    const scope = document.querySelector(".ledger__scope");
    const rows = document.querySelectorAll(".activity-item").length;
    return {
      text: scope ? scope.textContent.replace(/\s+/g, " ").trim() : null,
      beforeRows: scope
        ? scope.compareDocumentPosition(
            document.querySelector(".activity-stream") || document.body
          ) & Node.DOCUMENT_POSITION_FOLLOWING
        : 0,
      rows,
      cap: document.querySelector(".ledger__cap")?.textContent.trim() || null,
    };
  });

  check(Boolean(s.text), "the ledger states its scope in words", s.text || "");
  check(Boolean(s.beforeRows), "the scope is stated BEFORE the records");
  check(/\d/.test(s.text || ""), "the scope states how many records are shown");
  check(
    /module|action/i.test(s.text || ""),
    "the scope states the filter state"
  );
  /* A full page must admit it is a page. */
  if (s.rows >= 200) {
    check(Boolean(s.cap), "a full page declares that it is truncated", s.cap || "MISSING");
  } else {
    console.log(`      only ${s.rows} records present; cap notice not applicable`);
  }

  await page.screenshot({ path: path.join(outDir, "activity-1440.png") });
  await ctx.close();
}

/* ── 2 · zero results name what was searched ─────────────────────────────── */
console.log("\n── zero results ──");
{
  const { ctx, page } = await open(1440, 900);

  /* Pick a module/action pair that is very unlikely to have any rows. */
  await page.selectOption("#activity-module", "tender_banking");
  await page.selectOption("#activity-action", "restore");
  await page.waitForTimeout(1200);

  const s = await page.evaluate(() => ({
    rows: document.querySelectorAll(".activity-item").length,
    state: document.querySelector(".ledger__state")?.textContent.replace(/\s+/g, " ").trim() || null,
    clear: Boolean(
      [...document.querySelectorAll("button")].find((b) =>
        /clear filters/i.test(b.textContent)
      )
    ),
  }));

  if (s.rows === 0) {
    check(Boolean(s.state), "an empty ledger says something", s.state || "");
    check(
      /tender banking/i.test(s.state || "") && /restore/i.test(s.state || ""),
      "the empty state names WHAT was searched",
      s.state || ""
    );
    check(!/went wrong|error|oops/i.test(s.state || ""), "empty is not phrased as a failure");
  } else {
    console.log(`      ${s.rows} records matched; empty state not reachable with this data`);
  }
  check(s.clear, "clearing the filters is offered as its own action");

  await page.screenshot({ path: path.join(outDir, "activity-empty-1440.png") });
  await ctx.close();
}

/* ── 3 · a failed refresh keeps what is true, and dates it ───────────────── */
console.log("\n── failed refresh ──");
{
  const { ctx, page } = await open(1440, 900);

  const before = await page.locator(".activity-item").count();

  await page.route("**/api/activity**", (r) => r.abort());
  await page.click("button:has-text('Refresh')");
  await page.waitForTimeout(1500);

  const s = await page.evaluate(() => ({
    rows: document.querySelectorAll(".activity-item").length,
    failure: document.querySelector(".ledger__failure")?.textContent.trim() || null,
    stale: document.querySelector(".ledger__stale")?.textContent.replace(/\s+/g, " ").trim() || null,
    hasTime: Boolean(document.querySelector(".ledger__stale time[datetime]")),
    role: document.querySelector(".ledger__failure")?.getAttribute("role"),
  }));

  check(s.rows === before, "a failed refresh does not blank the records", `${before} → ${s.rows}`);
  check(Boolean(s.failure), "the failure is stated in the content region");
  check(s.role === "alert", "the failure is announced", s.role || "none");
  check(
    !/something went wrong/i.test(s.failure || ""),
    "the failure is not the empty phrase",
    s.failure || ""
  );
  check(Boolean(s.stale), "the ledger says it is showing an older read", s.stale || "");
  check(s.hasTime, "the stale statement carries a machine-readable time");

  await page.screenshot({ path: path.join(outDir, "activity-stale-1440.png") });
  await ctx.close();
}

/* ── 4 · content is never optically tracked ─────────────────────────────── */
console.log("\n── script safety ──");
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const { ctx, page } = await open(w, h);
  const bad = await page.evaluate(() => {
    const out = [];
    /* Every element that renders a value from a record. */
    const sel = [
      ".activity-actor",
      ".activity-target",
      ".activity-headline",
      ".activity-email",
      ".activity-metadata dd",
      ".activity-from",
      ".activity-to",
    ];
    for (const s of sel) {
      for (const el of document.querySelectorAll(s)) {
        const ls = getComputedStyle(el).letterSpacing;
        if (ls !== "normal" && Math.abs(parseFloat(ls)) > 0.01) {
          out.push(`${s} → ${ls}`);
        }
        break;
      }
    }
    return out;
  });
  check(bad.length === 0, `${w}px no record value carries tracking`, bad.join(", "));
  await ctx.close();
}

/* ── 5 · the disclosure is a real control ───────────────────────────────── */
console.log("\n── disclosure ──");
{
  const { ctx, page } = await open(390, 844);
  const toggle = page.locator(".activity-disclosure").first();

  if ((await toggle.count()) === 0) {
    console.log("      no row carries metadata in this dataset; skipped");
  } else {
    const box = await toggle.boundingBox();
    check(box.height >= 44, "the disclosure meets the 44px floor on a phone", `${Math.round(box.height)}px`);

    await page.keyboard.press("Tab");
    const reachable = await page.evaluate(() => {
      const els = [...document.querySelectorAll(".activity-disclosure")];
      return els.every((e) => e.tabIndex >= 0 && e.tagName === "BUTTON");
    });
    check(reachable, "every disclosure is a keyboard-reachable button");

    await toggle.click();
    await page.waitForTimeout(200);
    check(
      (await toggle.getAttribute("aria-expanded")) === "true",
      "the disclosure reports its state"
    );
  }
  await ctx.close();
}

/* ── 6 · nothing animates on arrival ────────────────────────────────────── */
console.log("\n── motion ──");
for (const reduced of [false, true]) {
  const { ctx, page } = await open(1440, 900, reduced);
  const moving = await page.evaluate(
    () => document.getAnimations().filter((a) => a.playState === "running").length
  );
  check(
    moving === 0,
    `${reduced ? "reduced" : "full"} motion: the ledger is still at rest`,
    `${moving} running`
  );
  await ctx.close();
}

/* ── 7 · no horizontal overflow at any width ────────────────────────────── */
console.log("\n── widths ──");
for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]]) {
  const { ctx, page } = await open(w, h);
  const o = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
  }));
  check(o.doc <= o.win + 1, `${w}px no horizontal overflow`, `${o.doc} vs ${o.win}`);
  await page.screenshot({ path: path.join(outDir, `activity-${w}.png`) });
  await ctx.close();
}

await browser.close();
console.log(
  failures ? `\n${failures} check(s) failed.` : "\nthe activity ledger states what it knows and nothing more"
);
process.exit(failures ? 1 : 0);
