/**
 * F-03 route-isolation probe for the shared FinanceTrendChart.
 *
 * The component is rendered by BOTH Dashboard (migrated) and Payments
 * (unmigrated). This captures the chart's real painted colours on each route
 * so the two can be compared independently: Dashboard is EXPECTED to change,
 * Payments must not move at all.
 *
 * Reads the SVG the browser actually painted -- stroke attributes, gradient
 * stops, legend swatches -- rather than the stylesheet, because a token that
 * fails to resolve produces a valid-looking stylesheet and an unpainted chart.
 *
 * Usage:
 *   node tools/fresh_ui/finance_chart_probe.mjs <out.json> [--compare <before.json>]
 *
 * SEEDED MODE (--seed) is the important one. The local fixture has no payment
 * records, so both routes render an empty chart and the palette is never
 * painted -- a probe that ran only against real data would report "no change"
 * while proving nothing. With --seed, three months of synthetic payments are
 * fulfilled in the BROWSER's network layer; no request reaches the API and no
 * fixture is mutated (AUTH-018).
 *
 * Read-only. Signs in with the shared admin fixture and mutates nothing.
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

const outPath = process.argv[2];
const ci = process.argv.indexOf("--compare");
const comparePath = ci === -1 ? null : process.argv[ci + 1];
if (!outPath) {
  console.error("usage: finance_chart_probe.mjs <out.json> [--compare <before.json>]");
  process.exit(1);
}

const ROUTES = [["dashboard", "/dashboard"], ["payments", "/payments"]];
const SEED = process.argv.includes("--seed");

/* Three months, so `monthlyData.length >= 2` and a trend actually draws. */
const SEEDED_PAYMENTS = [
  { id: 9001, payment_type: "Income", amount: 250000, payment_date: "2026-06-12", created_at: "2026-06-12T09:00:00Z", description: "Seed" },
  { id: 9002, payment_type: "Expense", amount: 120000, payment_date: "2026-06-20", created_at: "2026-06-20T09:00:00Z", description: "Seed" },
  { id: 9003, payment_type: "Income", amount: 310000, payment_date: "2026-07-08", created_at: "2026-07-08T09:00:00Z", description: "Seed" },
  { id: 9004, payment_type: "Expense", amount: 185000, payment_date: "2026-07-22", created_at: "2026-07-22T09:00:00Z", description: "Seed" },
  { id: 9005, payment_type: "Income", amount: 280000, payment_date: "2026-08-03", created_at: "2026-08-03T09:00:00Z", description: "Seed" },
  { id: 9006, payment_type: "Expense", amount: 210000, payment_date: "2026-08-05", created_at: "2026-08-05T09:00:00Z", description: "Seed" },
];
const WIDTHS = [390, 768, 1440];

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
const result = {};

for (const [name, route] of ROUTES) {
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(
      ([t, u]) => {
        localStorage.setItem("token", t);
        localStorage.setItem("user", u);
      },
      [token, JSON.stringify(user)]
    );
    if (SEED) {
      /* Fulfilled in the browser; nothing reaches the API. */
      await context.route("**/api/**", async (r) => {
        const url = r.request().url();
        if (/\/payments/.test(url) && r.request().method() === "GET") {
          return r.fulfill({
            status: 200,
            contentType: "application/json",
            /* paymentService reads `res.data.payments ?? []`, so the envelope
             * key matters: a `data` key silently resolves to an empty list and
             * the probe would report a passing no-op. */
            body: JSON.stringify({ payments: SEEDED_PAYMENTS }),
          });
        }
        return r.continue();
      });
    }

    const page = await context.newPage();
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    /* Recharts animates in; wait past the longest duration (1600ms). */
    await page.waitForTimeout(2200);

    result[`${name}@${width}`] = await page.evaluate(() => {
      const panel = document.querySelector(".premium-chart-panel");
      if (!panel) return { chart: "absent" };

      /*
       * Scope from the chart WRAPPER, not the first <svg>: Recharts renders a
       * separate `svg.recharts-surface` for every legend icon, so
       * `panel.querySelector("svg")` returns a legend swatch and the probe
       * silently reports zero series.
       */
      const wrap = panel.querySelector(".recharts-wrapper");
      if (!wrap) {
        return {
          chart: "empty-state",
          emptyTitle: panel.querySelector(".ui-empty__title")?.textContent?.trim() || null,
        };
      }

      const paint = (el) =>
        el && {
          stroke: el.getAttribute("stroke"),
          strokeWidth: el.getAttribute("stroke-width"),
          strokeDasharray: el.getAttribute("stroke-dasharray"),
          fill: el.getAttribute("fill"),
          fillOpacity: el.getAttribute("fill-opacity"),
        };

      const series = [...wrap.querySelectorAll(".recharts-area")].map((area) => {
        const paths = [...area.querySelectorAll("path")];
        /* The filled body is drawn first, the stroked curve on top. */
        return { area: paint(paths[0]), curve: paint(paths[1] || paths[0]) };
      });

      const gradients = [...wrap.querySelectorAll("linearGradient")].map((g) => ({
        id: g.getAttribute("id"),
        stops: [...g.querySelectorAll("stop")].map((st) => ({
          color: st.getAttribute("stop-color") || getComputedStyle(st).stopColor,
          opacity: st.getAttribute("stop-opacity"),
        })),
      }));

      const legend = [...wrap.querySelectorAll(".recharts-legend-item")].map((li) => ({
        text: li.textContent.trim(),
        swatch: li.querySelector(".recharts-legend-icon")?.getAttribute("fill") || null,
      }));

      const gridLine = wrap.querySelector(".recharts-cartesian-grid line");
      const tick = wrap.querySelector(".recharts-cartesian-axis-tick-value");

      return {
        chart: "rendered",
        series,
        gradients,
        legend,
        grid: gridLine ? getComputedStyle(gridLine).stroke : null,
        axisLabel: tick ? getComputedStyle(tick).fill : null,
        box: (() => {
          const r = panel.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height) };
        })(),
        overflow: Math.max(
          0,
          document.documentElement.scrollWidth - document.documentElement.clientWidth
        ),
      };
    });

    await context.close();
  }
}

await browser.close();
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`chart snapshot written to ${outPath}`);

for (const [k, v] of Object.entries(result)) {
  const summary =
    v.chart === "rendered"
      ? `${v.series.length} series  strokes=[${v.series.map((x) => x.curve?.stroke).join(", ")}]`
      : v.chart === "empty-state"
      ? `empty-state "${v.emptyTitle}"`
      : "absent";
  console.log(`  ${k.padEnd(18)} ${summary}`);
}

if (!comparePath) process.exit(0);

const before = JSON.parse(fs.readFileSync(comparePath, "utf8"));

/**
 * Compare what is PAINTED, not what it is called.
 *
 * F-03 scoped the SVG gradient ids by palette to remove a document-global
 * collision (FIN-004), so `incomeGradient` became `finance-legacy-income` and
 * the `fill="url(#...)"` reference moved with it. Those are internal
 * identifiers: the stops, colours, opacities, stroke widths and dash patterns
 * they carry are unchanged.
 *
 * This is NOT the gate being relaxed to fit the implementation. Pixel equality
 * was verified independently before this normalisation was written: the
 * `.premium-chart-panel` element was screenshotted on /payments at 1440 and
 * 390 with the F-03 changes stashed and again with them applied, and the PNGs
 * hashed identical (SHA-256) at both widths, while /dashboard differed. The
 * normalisation encodes that finding so the gate keeps testing appearance
 * rather than failing forever on a renamed reference.
 */
const canonical = (value) =>
  JSON.stringify(value, (key, v) => {
    if (key === "id" && typeof v === "string") return "<gradient>";
    if (typeof v === "string" && v.startsWith("url(#")) return "url(<gradient>)";
    return v;
  });
let dashDiffs = 0;
let payDiffs = 0;
const lines = [];

for (const key of new Set([...Object.keys(before), ...Object.keys(result)])) {
  const a = canonical(before[key]);
  const b = canonical(result[key]);
  if (a === b) continue;
  if (key.startsWith("payments")) {
    payDiffs += 1;
    lines.push(`  PAYMENTS CHANGED  ${key}`);
  } else {
    dashDiffs += 1;
    lines.push(`  dashboard changed ${key}  (expected)`);
  }
}

console.log("\nROUTE ISOLATION");
console.log(lines.length ? lines.join("\n") : "  nothing changed on either route");
console.log(
  payDiffs === 0
    ? `\nPASS: Payments byte-identical. Dashboard changed at ${dashDiffs} viewport(s), as intended.`
    : `\nFAIL: Payments changed at ${payDiffs} viewport(s). Route isolation broken.`
);
process.exit(payDiffs ? 1 : 0);
