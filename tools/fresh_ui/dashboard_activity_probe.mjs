/**
 * D4 runtime checks for the Dashboard activity stream.
 *
 * Asserts the properties that unit tests cannot see: real chronological order
 * in the DOM, day grouping from LOCAL date components, the item cap, absence
 * of the retired tab strip and of the amber unknown-status fallback
 * (SHELL-029), a single route to full history, and clean wrapping of long
 * Latin and Gujarati object names.
 *
 * Read-only. Signs in with the shared admin fixture and mutates nothing.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium, request } = requireFromFrontend("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const API = process.env.E2E_API_URL || "http://127.0.0.1:5051";

const LONG_LATIN =
  "Riverside Industrial Park Phase Two Structural Steelwork And Foundation Package";
const LONG_GUJARATI =
  "રિવરસાઇડ ઔદ્યોગિક ઉદ્યાન બીજા તબક્કાનું માળખાકીય સ્ટીલવર્ક અને પાયાનું પેકેજ";

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

for (const width of [320, 390, 768, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(
    ([t, u]) => {
      localStorage.setItem("token", t);
      localStorage.setItem("user", u);
    },
    [token, JSON.stringify(user)]
  );
  const page = await context.newPage();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const state = await page.evaluate(() => {
    const items = [...document.querySelectorAll(".ui-activity__item")];
    return {
      present: Boolean(document.querySelector(".ui-activity")),
      tabs: document.querySelectorAll('[role="tab"]').length,
      amberBadges: document.querySelectorAll(".badge.yellow").length,
      count: items.length,
      /* Machine-readable instants, in DOM order. */
      times: items.map(
        (i) => i.querySelector("time")?.getAttribute("datetime") || null
      ),
      dayHeadings: [...document.querySelectorAll(".ui-activity__day")].map((h) =>
        h.textContent.trim()
      ),
      historyLinks: [
        ...document.querySelectorAll('.ui-activity a[href*="/activity"]'),
      ].length,
      /* No object should be listed twice after merging three sources. */
      keys: items.map((i) => i.querySelector(".ui-activity__action")?.textContent),
    };
  });

  check(state.present, `${width} activity section renders`);
  check(state.tabs === 0, `${width} retired tab strip is absent`, `tabs=${state.tabs}`);
  check(
    state.amberBadges === 0,
    `${width} no amber unknown-status fallback (SHELL-029)`,
    `badges=${state.amberBadges}`
  );
  check(state.count <= 8, `${width} item cap respected`, `items=${state.count}`);
  check(
    state.historyLinks === 1,
    `${width} exactly one route to full history`,
    `links=${state.historyLinks}`
  );

  const parsed = state.times.map((t) => (t ? Date.parse(t) : NaN));
  const ordered = parsed.every(
    (t, i) => i === 0 || (Number.isFinite(t) && t <= parsed[i - 1])
  );
  check(ordered, `${width} newest first`, state.times.filter(Boolean).join(" > "));

  check(
    new Set(state.keys).size === state.keys.length || state.keys.length === 0,
    `${width} no object duplicated across merged sources`
  );

  /* Day headings must come from local date components, so an event stamped
   * today must group under "Today" rather than a formatted date. */
  const localGrouping = await page.evaluate(() => {
    const items = [...document.querySelectorAll(".ui-activity__item")];
    if (items.length === 0) return { skip: true };
    const iso = items[0].querySelector("time")?.getAttribute("datetime");
    if (!iso) return { skip: true };
    const d = new Date(iso);
    const today = new Date();
    const sameLocalDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    const heading = document
      .querySelector(".ui-activity__day")
      ?.textContent.trim();
    return { sameLocalDay, heading };
  });
  if (!localGrouping.skip) {
    check(
      localGrouping.sameLocalDay
        ? localGrouping.heading === "Today"
        : localGrouping.heading !== "Today",
      `${width} day heading matches the local calendar day`,
      `heading=${localGrouping.heading}`
    );
  }

  for (const [label, text] of [
    ["latin", LONG_LATIN],
    ["gujarati", LONG_GUJARATI],
  ]) {
    const wrap = await page.evaluate((t) => {
      const el = document.querySelector(".ui-activity__subject");
      if (!el) return { skip: true };
      el.textContent = ` · ${t}`;
      const doc = document.documentElement;
      const time = document.querySelector(".ui-activity__time");
      const action = el.closest(".ui-activity__action");
      return {
        docOverflow: Math.max(0, doc.scrollWidth - doc.clientWidth),
        actionOverflow: Math.max(0, action.scrollWidth - action.clientWidth),
        timeVisible: time ? time.getBoundingClientRect().width > 0 : false,
      };
    }, text);

    if (wrap.skip) continue;
    check(
      wrap.docOverflow === 0 && wrap.actionOverflow === 0 && wrap.timeVisible,
      `${width} ${label} long name wraps without overflow`,
      `doc=${wrap.docOverflow} action=${wrap.actionOverflow}`
    );
  }

  await context.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nactivity stream clean");
process.exit(failures ? 1 : 0);
