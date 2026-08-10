/**
 * V3: the page's rhythm must express semantic distance.
 *
 * Gates RELATIONSHIPS, not pixel values. A specific gap is an implementation
 * detail that later units may legitimately retune; the ORDER of the intervals
 * is the design, and breaking it means two sections no longer say how closely
 * they are related.
 *
 * The contract, in reading order:
 *
 *   Health -> Trend        kin        the tightest gap between two sections:
 *                                     diagnosis and its own context
 *   Attention -> Health    sequence   coupled, different questions
 *   Trend -> Approaching   chapter    money gives way to time
 *   Approaching -> Pipeline chapter   time gives way to operations
 *   Pipeline -> Activity   epilogue   the largest: present gives way to past
 *
 * The deadline horizon was added to the page between Trend and Pipeline, and
 * this probe went on measuring Trend -> Pipeline — a "gap" of 291px that was
 * really an entire section. It reported a rhythm the page did not have.
 * A probe that names sections positionally decays the moment one is inserted;
 * both chapter adjacencies are named explicitly now.
 *
 * Checked with real data and with every list empty, because a rhythm tuned on
 * populated rows can collapse into dead zones when sections recede.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium, request } = requireFromFrontend("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const API = process.env.E2E_API_URL || "http://127.0.0.1:5051";

const SEED = [
  { id: 9001, payment_type: "Income", amount: 255000, payment_date: "2026-06-12", created_at: "2026-06-12T09:00:00Z" },
  { id: 9002, payment_type: "Expense", amount: 120000, payment_date: "2026-07-20", created_at: "2026-07-20T09:00:00Z" },
];

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

const api = await request.newContext({ baseURL: API });
const login = await api.post("/api/auth/login", {
  data: {
    email: process.env.LOCAL_ADMIN_FIXTURE_EMAIL,
    password: process.env.LOCAL_ADMIN_FIXTURE_PASSWORD,
  },
});
if (!login.ok()) { console.error("admin fixture login failed"); process.exit(1); }
const { token, user } = await login.json();
await api.dispose();

const browser = await chromium.launch();

for (const empty of [false, true]) {
  for (const width of [390, 768, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(
      ([t, u]) => { localStorage.setItem("token", t); localStorage.setItem("user", u); },
      [token, JSON.stringify(user)]
    );
    await context.route("**/api/**", async (r) => {
      const url = r.request().url();
      if (!/\/(payments|invoices|tenders|workers|sites|subcontractors)/.test(url)) return r.continue();
      if (empty) {
        return r.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ payments: [], invoices: [], tenders: [], data: [] }) });
      }
      if (/\/payments/.test(url) && r.request().method() === "GET") {
        return r.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ payments: SEED }) });
      }
      return r.continue();
    });

    const page = await context.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1800);

    const m = await page.evaluate(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
      };
      const s = {
        attention: box(".ui-attention"),
        health: box(".ui-health"),
        chart: box(".ui-chart"),
        pipe: box(".ui-pipe"),
        deadline: box(".ui-dl"),
        activity: box(".ui-activity"),
      };
      const gap = (a, b) => (s[a] && s[b] ? Math.round(s[b].top - s[a].bottom) : null);
      return {
        present: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Boolean(v)])),
        sequence: gap("attention", "health"),
        kin: gap("health", "chart"),
        chapter: gap("chart", "deadline"),
        chapterTwo: gap("deadline", "pipe"),
        epilogue: gap("pipe", "activity"),
        order: ["attention", "health", "chart", "pipe", "activity"]
          .filter((k) => s[k]).map((k) => s[k].top),
        overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        height: document.documentElement.scrollHeight,
      };
    });

    const tag = `${empty ? "empty" : "populated"} ${width}`;

    check(Object.values(m.present).every(Boolean), `${tag} all five sections render`);
    check(
      m.order.every((t, i) => i === 0 || t > m.order[i - 1]),
      `${tag} sections in reading order, none overlapping`
    );
    check([m.sequence, m.kin, m.chapter, m.chapterTwo, m.epilogue].every((g) => g !== null && g >= 0),
      `${tag} no negative or missing gap`,
      `seq=${m.sequence} kin=${m.kin} ch=${m.chapter}/${m.chapterTwo} ep=${m.epilogue}`);

    /* The design, as an ordering rather than as numbers. */
    check(m.kin < m.sequence, `${tag} kin < sequence`, `${m.kin} < ${m.sequence}`);
    check(m.sequence < m.chapter, `${tag} sequence < chapter`, `${m.sequence} < ${m.chapter}`);
    check(m.chapter < m.epilogue, `${tag} chapter < epilogue`, `${m.chapter} < ${m.epilogue}`);
    /* The two chapter breaks are one interval used twice, so they must match.
     * A page whose chapter breaks differ has no rhythm, only spacing. */
    check(m.chapter === m.chapterTwo, `${tag} both chapter breaks are equal`,
      `${m.chapter} = ${m.chapterTwo}`);
    check(m.overflow === 0, `${tag} no document overflow`);

    await context.close();
  }
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\ncomposition rhythm holds, populated and empty");
process.exit(failures ? 1 : 0);
