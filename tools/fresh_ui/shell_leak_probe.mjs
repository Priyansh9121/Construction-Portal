/**
 * Prove a shell change did not silently restyle unmigrated page content.
 *
 * SHELL-003 and AUTH-020 are the same failure: a selector assumed to belong to
 * one group, defined unscoped in a later cascade layer, quietly changing
 * routes nobody was looking at. Test counts do not detect it, because the
 * assertions are behavioural.
 *
 * So this measures. For each route it samples computed styles on PAGE
 * CONTENT ONLY (inside main, excluding the sidebar and topbar) and reports
 * them, so a before/after run can be diffed. It also measures the content
 * box, which a shell width change would move.
 *
 * Usage:
 *   node tools/fresh_ui/shell_leak_probe.mjs before.json
 *   ...make the shell change...
 *   node tools/fresh_ui/shell_leak_probe.mjs after.json --compare before.json
 *
 * Local dev server only. Reads, never writes to the app.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium, request: playwrightRequest } = requireFromFrontend("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const API = process.env.E2E_API_URL || "http://127.0.0.1:5051";

const outPath = process.argv[2];
const compareIndex = process.argv.indexOf("--compare");
const comparePath = compareIndex === -1 ? null : process.argv[compareIndex + 1];

if (!outPath) {
  console.error("usage: shell_leak_probe.mjs <out.json> [--compare <baseline.json>]");
  process.exit(1);
}

/* Representative unmigrated routes named in the shell brief. */
const ROUTES = [
  ["dashboard", "/dashboard"],
  ["tenders", "/tenders"],
  ["payments", "/payments"],
  ["users", "/users"],
  ["site-operations", "/site-operations"],
];

/* Element kinds most likely to be caught by a stray shell rule. */
const SAMPLES = [
  ["button", "main button"],
  ["badge", "main .badge"],
  ["input", "main input"],
  ["table-cell", "main td"],
  ["card", "main .card"],
  ["heading", "main h1"],
];

const PROPS = [
  "color", "backgroundColor", "borderColor", "borderRadius",
  "fontSize", "fontWeight", "fontFamily", "padding", "minHeight",
];

const api = await playwrightRequest.newContext({ baseURL: API });
const login = await api.post("/api/auth/login", {
  data: {
    email: process.env.LOCAL_ADMIN_FIXTURE_EMAIL,
    password: process.env.LOCAL_ADMIN_FIXTURE_PASSWORD,
  },
});
if (!login.ok()) {
  console.error("admin fixture login failed; cannot probe authenticated routes");
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
const result = {};

for (const [name, route] of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  result[name] = await page.evaluate(
    ({ samples, props }) => {
      const out = {};

      const main = document.querySelector("main");
      out.__contentBox = main
        ? (({ x, width }) => ({ x: Math.round(x), width: Math.round(width) }))(
            main.getBoundingClientRect()
          )
        : null;

      for (const [label, selector] of samples) {
        const el = document.querySelector(selector);
        if (!el) {
          out[label] = null;
          continue;
        }
        const cs = getComputedStyle(el);
        out[label] = Object.fromEntries(props.map((p) => [p, cs[p]]));
      }
      return out;
    },
    { samples: SAMPLES, props: PROPS }
  );
}

await browser.close();
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`probe written to ${outPath}`);

if (comparePath && fs.existsSync(comparePath)) {
  const before = JSON.parse(fs.readFileSync(comparePath, "utf8"));
  let diffs = 0;

  for (const route of Object.keys(result)) {
    for (const key of Object.keys(result[route])) {
      const a = JSON.stringify(before[route]?.[key]);
      const b = JSON.stringify(result[route][key]);
      if (a !== b) {
        diffs += 1;
        console.log(`DIFF  ${route} / ${key}\n  before ${a}\n  after  ${b}`);
      }
    }
  }

  console.log(
    diffs === 0
      ? "\nNo computed-style change on page content across all probed routes."
      : `\n${diffs} difference(s). Each must be intended, or the shell has leaked.`
  );
  process.exit(diffs ? 1 : 0);
}
