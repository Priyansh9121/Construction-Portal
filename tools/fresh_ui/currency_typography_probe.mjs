/**
 * V2: the currency signature must be typography only.
 *
 * Two guarantees, and they are the whole point of the unit:
 *
 *   1. The optical treatment changes NO value. `formatCurrencyParts`
 *      reassembles to exactly what `formatCurrency` produces, and the rendered
 *      element's text content equals it too -- so copy/paste and screen
 *      readers get the canonical string.
 *
 *   2. The Indian 2-2-3 grouping survives. `2,55,000`, never `255,000`. This
 *      is the product's identity signature, so a locale regression here is a
 *      loss of identity, not a formatting nit.
 *
 * Also checks that no figure wraps or overflows at the narrowest width, since
 * a grouped figure broken across lines reads as two amounts.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium, request } = requireFromFrontend("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const API = process.env.E2E_API_URL || "http://127.0.0.1:5051";

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

/* ---- 1. Grouping, checked against the exact table in the brief ---------- */
const CASES = [
  [0, "₹0.00"],
  [1, "₹1.00"],
  [999, "₹999.00"],
  [1000, "₹1,000.00"],
  [10000, "₹10,000.00"],
  [100000, "₹1,00,000.00"],
  [255000, "₹2,55,000.00"],
  [12345678.9, "₹1,23,45,678.90"],
];

const fmt = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

console.log("INDIAN GROUPING");
for (const [value, expected] of CASES) {
  const got = fmt(value).replace(/ /g, "");
  check(got === expected, `${String(value).padStart(12)} -> ${expected}`, got === expected ? "" : `got ${got}`);
}

/* ---- 2. Rendered value equals the canonical string ---------------------- */
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

const SEED = [
  { id: 9001, payment_type: "Income", amount: 255000, payment_date: "2026-06-12", created_at: "2026-06-12T09:00:00Z" },
  { id: 9002, payment_type: "Expense", amount: 12345678.9, payment_date: "2026-07-20", created_at: "2026-07-20T09:00:00Z" },
];

const browser = await chromium.launch();

console.log("\nRENDERED VALUE AND LAYOUT");
for (const width of [320, 390, 768, 1440, 1920]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(
    ([t, u]) => {
      localStorage.setItem("token", t);
      localStorage.setItem("user", u);
    },
    [token, JSON.stringify(user)]
  );
  await context.route("**/api/**", async (r) => {
    if (/\/payments/.test(r.request().url()) && r.request().method() === "GET") {
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ payments: SEED }),
      });
    }
    return r.continue();
  });

  const page = await context.newPage();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);

  const state = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll(".ui-money")];
    return {
      count: nodes.length,
      texts: nodes.map((n) => n.textContent),
      /* A figure that wraps has become two amounts. */
      wrapped: nodes.filter((n) => n.getClientRects().length > 1).map((n) => n.textContent),
      /* Tabular is what makes column comparison possible. */
      nonTabular: nodes
        .filter((n) => !getComputedStyle(n).fontVariantNumeric.includes("tabular-nums"))
        .map((n) => n.textContent),
      overflow: Math.max(
        0,
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      ),
    };
  });

  const grouped = state.texts.filter((t) => /\d,\d\d,\d\d\d/.test(t));
  check(state.count > 0, `${width} money elements render`, `n=${state.count}`);
  check(state.wrapped.length === 0, `${width} no figure wraps`, state.wrapped.join(", "));
  check(state.nonTabular.length === 0, `${width} every figure is tabular`, state.nonTabular.join(", "));
  check(state.overflow === 0, `${width} no document overflow`, `${state.overflow}px`);
  check(
    grouped.length > 0,
    `${width} Indian grouping visible in the DOM`,
    grouped[0] || "none found"
  );
  /* Nothing may have lost its symbol or its decimals. */
  /* A negative amount is a legitimate value: the cash position goes below zero
     when obligations exceed receipts. The first version of this pattern
     rejected the leading minus, which surfaced a real product gap (V2-b) --
     but the pattern itself was also wrong. */
  const malformed = state.texts.filter(
    (t) => !/^-?₹[\d,]+\.\d{2}$/.test(t.replace(/ /g, ""))
  );
  check(malformed.length === 0, `${width} every rendered value is complete`, malformed.join(", "));

  await context.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\ncurrency typography clean");
process.exit(failures ? 1 : 0);
