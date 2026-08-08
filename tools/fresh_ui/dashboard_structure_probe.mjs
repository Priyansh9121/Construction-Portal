/**
 * Structural assertions for the redesigned Dashboard (DASH-002).
 *
 * Screenshots show whether the page LOOKS right. This asserts the structure is
 * right: that the legacy reporting panels are gone, that the four sections of
 * the programme appear in the intended reading order, and that removing the
 * panels left no orphaned links, headings or aria references behind.
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

/* Headings that must NOT appear anywhere on the Dashboard any more. */
const RETIRED = [
  "Finance Health",
  "Invoice Health",
  "Operational Capacity",
  "Project Portfolio",
  "Project Status",
  "Upcoming Tenders",
  "Today's Finance",
  "Suggested Next Actions",
  "Recent Payments",
  "Recent Invoices",
  "Recent Tenders",
  "Recent Workers",
  "Recent Sites",
  "Jump to",
];

/* The intended reading order, top to bottom. */
const EXPECTED_ORDER = [
  "ui-attention",
  "ui-health",
  "ui-pipe",
  "ui-activity",
];

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
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(
  ([t, u]) => {
    localStorage.setItem("token", t);
    localStorage.setItem("user", u);
  },
  [token, JSON.stringify(user)]
);
const page = await context.newPage();
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

const state = await page.evaluate(
  ({ order }) => {
    const scope = document.querySelector(".page-content") || document.body;
    const text = scope.innerText;

    const positions = order.map((cls) => {
      const el = scope.querySelector(`.${cls}`);
      return el ? el.getBoundingClientRect().top + window.scrollY : null;
    });

    const headings = [...scope.querySelectorAll("h1,h2,h3")].map((h) => ({
      level: Number(h.tagName[1]),
      text: h.textContent.trim(),
    }));

    /* Every aria-labelledby must resolve, or a screen reader gets nothing. */
    const danglingAria = [...scope.querySelectorAll("[aria-labelledby]")]
      .map((el) => el.getAttribute("aria-labelledby"))
      .filter((id) => !document.getElementById(id));

    return {
      text,
      positions,
      headings,
      danglingAria,
      legacyPanels: scope.querySelectorAll(".panel").length,
      legacyTiles: scope.querySelectorAll(
        ".highlight-success, .highlight-warning, .highlight-danger"
      ).length,
      ratioRows: scope.querySelectorAll(".v2-ratio").length,
      tabs: scope.querySelectorAll('[role="tab"]').length,
      viewAll: [...scope.querySelectorAll("a")].filter((a) =>
        /view all/i.test(a.textContent)
      ).length,
      lastSection: scope.querySelector(".ui-activity") ? "activity" : null,
    };
  },
  { order: EXPECTED_ORDER }
);

for (const heading of RETIRED) {
  check(!state.text.includes(heading), `retired: "${heading}" absent`);
}

check(
  state.positions.every((p) => p !== null),
  "all four programme sections render",
  state.positions.join(", ")
);
check(
  state.positions.every((p, i) => i === 0 || (p !== null && p > state.positions[i - 1])),
  "sections appear in reading order: attention, health, pipeline, activity"
);

const texts = state.headings.map((h) => h.text);
check(
  new Set(texts).size === texts.length,
  "no duplicate section heading",
  texts.join(" | ")
);

/* Heading levels must not skip, e.g. h2 followed by h4. */
const skips = state.headings.filter(
  (h, i) => i > 0 && h.level - state.headings[i - 1].level > 1
);
check(skips.length === 0, "heading levels never skip a rank", skips.map((h) => h.text).join(", "));

check(state.danglingAria.length === 0, "no aria-labelledby points at a removed id", state.danglingAria.join(", "));
check(state.legacyTiles === 0, "no legacy filled status tiles remain", `count=${state.legacyTiles}`);
check(state.ratioRows === 0, "no legacy ratio rows remain", `count=${state.ratioRows}`);
check(state.tabs === 0, "no legacy tab semantics remain", `count=${state.tabs}`);
check(state.viewAll === 0, 'no orphaned "View all" links remain', `count=${state.viewAll}`);
check(state.lastSection === "activity", "the page ends with the activity stream");

console.log(`\nlegacy .panel wrappers still on the page: ${state.legacyPanels}`);

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\ndashboard structure clean");
process.exit(failures ? 1 : 0);
