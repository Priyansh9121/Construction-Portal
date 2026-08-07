/**
 * Shell leak probe — frame-aware.
 *
 * WHY THIS WAS REWRITTEN
 * ----------------------
 * The first version treated ANY difference as leakage. That was correct while
 * the shell units changed only overlays and navigation, which must not move
 * page content at all. It becomes wrong for the frame units (S-A4a, S-A4b),
 * where changing the sidebar offset or the content gutter is the POINT.
 *
 * A probe that flags intended geometry alongside real leakage trains you to
 * ignore it, which is worse than having no probe. So results are now
 * classified into two buckets that are reported separately:
 *
 *   A. FRAME GEOMETRY — the rects of .app-layout, .main-content and
 *      .page-content, plus the viewport. These MAY change during frame work.
 *      Differences are reported as information, never as failure.
 *
 *   B. DESCENDANT STYLE — computed visual properties of representative page
 *      components. These must NOT change on an unmigrated route, whatever the
 *      frame does. Any difference here is a failure and exits non-zero.
 *
 * The split is deliberately narrow. Bucket A is three named elements and the
 * viewport, nothing else. Everything else a page renders lives in bucket B.
 * Widening A to silence a finding would defeat the whole instrument.
 *
 * ONE DELIBERATE EXCLUSION IN BUCKET B:
 * element WIDTH and HEIGHT are not sampled. A narrower content column reflows
 * a table or a card to a different size without any style having changed, and
 * that is geometry, not leakage. Colour, type, border, radius, shadow and
 * spacing ARE sampled, because none of those can change from reflow alone.
 *
 * LIMITATIONS
 *   - Samples the FIRST match of each selector. A route styling its second
 *     button differently is not covered.
 *   - A missing sample is recorded as "absent" and compared as such, so a
 *     component disappearing is caught, but a route that never had one cannot
 *     report on it.
 *   - Computed styles only. It cannot see what a screenshot sees; SHELL-007
 *     and SHELL-013 were both found by eye, not here.
 *
 * USAGE
 *   node tools/fresh_ui/shell_leak_probe.mjs baseline.json
 *   node tools/fresh_ui/shell_leak_probe.mjs after.json --compare baseline.json
 *
 * Local dev server only. Reads; never writes to the app.
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

const ROUTES = [
  ["dashboard", "/dashboard"],
  ["tenders", "/tenders"],
  ["payments", "/payments"],
  ["users", "/users"],
  ["site-operations", "/site-operations"],
];

/* Bucket A: the frame. Named explicitly and kept short on purpose. */
const FRAME = [
  ["app-layout", ".app-layout"],
  ["main-content", ".main-content"],
  ["page-content", ".page-content"],
];

/* Bucket B: representative page components, sampled inside main only. */
const COMPONENTS = [
  ["button", "main button, .page-content button"],
  ["badge", "main .badge, .page-content .badge"],
  ["input", "main input, .page-content input"],
  ["select", "main select, .page-content select"],
  ["table-header", "main th, .page-content th"],
  ["table-cell", "main td, .page-content td"],
  ["card", "main .card, .page-content .card"],
  ["heading", "main h1, main h2, .page-content h2"],
  ["link", "main a, .page-content a"],
];

/* Visual properties only. Width and height are excluded: see the header. */
const STYLE_PROPS = [
  "color", "backgroundColor", "backgroundImage",
  "borderTopWidth", "borderTopColor", "borderTopStyle", "borderRadius",
  "boxShadow", "fontFamily", "fontSize", "fontWeight", "lineHeight",
  "letterSpacing", "textTransform", "padding", "opacity",
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
  await page.waitForTimeout(500);

  result[name] = await page.evaluate(
    ({ frame, components, props }) => {
      const out = { geometry: {}, styles: {} };

      out.geometry.__viewport = {
        w: window.innerWidth,
        h: window.innerHeight,
      };

      for (const [label, selector] of frame) {
        const el = document.querySelector(selector);
        if (!el) {
          out.geometry[label] = "absent";
          continue;
        }
        const r = el.getBoundingClientRect();
        out.geometry[label] = {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      }

      for (const [label, selector] of components) {
        const el = document.querySelector(selector);
        if (!el) {
          out.styles[label] = "absent";
          continue;
        }
        const cs = getComputedStyle(el);
        out.styles[label] = Object.fromEntries(props.map((p) => [p, cs[p]]));
      }

      return out;
    },
    { frame: FRAME, components: COMPONENTS, props: STYLE_PROPS }
  );
}

await browser.close();
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`probe written to ${outPath}`);

if (!comparePath) {
  const absent = [];
  for (const [route, data] of Object.entries(result)) {
    for (const [label, value] of Object.entries(data.styles)) {
      if (value === "absent") absent.push(`${route}/${label}`);
    }
  }
  console.log(
    absent.length
      ? `\nbaseline captured. Samples not present on their route (recorded, not substituted):\n  ${absent.join("\n  ")}`
      : "\nbaseline captured. Every component sample was present on every route."
  );
  process.exit(0);
}

if (!fs.existsSync(comparePath)) {
  console.error(`baseline not found: ${comparePath}`);
  process.exit(1);
}

const before = JSON.parse(fs.readFileSync(comparePath, "utf8"));
const geometryDiffs = [];
const styleDiffs = [];

for (const route of Object.keys(result)) {
  for (const [label, value] of Object.entries(result[route].geometry)) {
    const prev = JSON.stringify(before[route]?.geometry?.[label]);
    const next = JSON.stringify(value);
    if (prev !== next) geometryDiffs.push(`${route} / ${label}\n    before ${prev}\n    after  ${next}`);
  }

  for (const [label, value] of Object.entries(result[route].styles)) {
    const prevAll = before[route]?.styles?.[label];
    if (JSON.stringify(prevAll) === JSON.stringify(value)) continue;

    if (prevAll === undefined) {
      styleDiffs.push(`${route} / ${label}: no baseline entry`);
      continue;
    }
    if (prevAll === "absent" || value === "absent") {
      styleDiffs.push(`${route} / ${label}: presence changed (${prevAll === "absent" ? "absent" : "present"} -> ${value === "absent" ? "absent" : "present"})`);
      continue;
    }
    for (const prop of Object.keys(value)) {
      if (prevAll[prop] !== value[prop]) {
        styleDiffs.push(`${route} / ${label} / ${prop}\n    before ${prevAll[prop]}\n    after  ${value[prop]}`);
      }
    }
  }
}

console.log("\nA. FRAME GEOMETRY — informational, may change during frame work");
console.log(
  geometryDiffs.length
    ? geometryDiffs.map((d) => `  ${d}`).join("\n")
    : "  no change"
);

console.log("\nB. DESCENDANT STYLE — must not change on an unmigrated route");
console.log(
  styleDiffs.length
    ? styleDiffs.map((d) => `  ${d}`).join("\n")
    : "  no change"
);

console.log(
  styleDiffs.length
    ? `\nFAIL: ${styleDiffs.length} descendant style difference(s). The shell has leaked.`
    : "\nPASS: no descendant style change on any probed route."
);

process.exit(styleDiffs.length ? 1 : 0);
