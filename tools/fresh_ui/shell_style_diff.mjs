/**
 * Computed-style snapshot of the SHELL surfaces themselves.
 *
 * The leak probe watches page CONTENT. This watches the shell, which is what
 * matters when deleting a legacy shell stylesheet: the risk is that a system
 * rule silently depended on legacy residue for a property it never restated.
 * SHELL-007, 008, 009 and 013 were all that failure.
 *
 * Captures every surface with the overlays OPEN, since a closed overlay has no
 * computed style to compare.
 *
 * Usage:
 *   node tools/fresh_ui/shell_style_diff.mjs before.json
 *   node tools/fresh_ui/shell_style_diff.mjs after.json --compare before.json
 *
 * Local dev server only.
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
  console.error("usage: shell_style_diff.mjs <out.json> [--compare <baseline.json>]");
  process.exit(1);
}

const PROPS = [
  "display", "position", "zIndex", "color", "backgroundColor",
  "borderTopWidth", "borderTopColor", "borderRightWidth", "borderRightColor",
  "borderBottomWidth", "borderBottomColor", "borderLeftWidth", "borderLeftColor",
  "borderRadius", "boxShadow", "fontFamily", "fontSize", "fontWeight",
  "letterSpacing", "textTransform", "padding", "margin", "minHeight",
  "width", "opacity", "transform", "outlineColor", "outlineWidth",
];

const SURFACES = [
  ["sidebar", ".sidebar"],
  ["sidebar-group-heading", ".sidebar-group-heading"],
  ["sidebar-link", ".sidebar-link:not(.active-link)"],
  ["sidebar-link-active", ".sidebar-link.active-link"],
  ["sidebar-user", ".sidebar-user"],
  ["sidebar-avatar", ".sidebar-avatar"],
  ["topbar", ".topbar"],
  ["topbar-heading", ".topbar-heading h1"],
  ["sidebar-toggle", ".sidebar-toggle"],
  ["account-trigger", ".account-trigger"],
  ["account-panel", ".account-panel"],
  ["account-identity", ".account-identity"],
  ["account-action", ".account-action"],
  ["notification-button", ".notification-button"],
  ["notification-panel", ".notification-panel"],
  ["command-backdrop", ".command-backdrop"],
  ["command-modal", ".command-modal"],
  ["command-input", ".command-header input"],
  ["command-result", ".command-results button:not(.is-selected)"],
  ["command-result-selected", ".command-results button.is-selected"],
  ["app-layout", ".app-layout"],
  ["main-content", ".main-content"],
  ["page-content", ".page-content"],
  ["skip-link", ".skip-link"],
];

const api = await playwrightRequest.newContext({ baseURL: API });
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
await page.waitForTimeout(600);

/* Open every overlay so each has a live computed style, then focus the skip
 * link so its revealed state is what gets measured. */
await page.locator(".account-trigger").click();
await page.waitForSelector(".account-panel");
await page.locator(".notification-button").click();
await page.waitForSelector(".notification-panel");
await page.keyboard.press("Control+k");
await page.waitForSelector(".command-modal");
await page.waitForTimeout(600);
await page.evaluate(() => document.querySelector(".skip-link")?.focus());
await page.waitForTimeout(200);

const result = await page.evaluate(
  ({ surfaces, props }) => {
    const out = {};
    for (const [label, selector] of surfaces) {
      const el = document.querySelector(selector);
      if (!el) {
        out[label] = "absent";
        continue;
      }
      const cs = getComputedStyle(el);
      out[label] = Object.fromEntries(props.map((p) => [p, cs[p]]));
    }
    return out;
  },
  { surfaces: SURFACES, props: PROPS }
);

await browser.close();
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`shell snapshot written to ${outPath}`);

const absent = Object.entries(result).filter(([, v]) => v === "absent").map(([k]) => k);
if (absent.length) console.log(`  surfaces not captured: ${absent.join(", ")}`);

if (!comparePath) process.exit(0);

const before = JSON.parse(fs.readFileSync(comparePath, "utf8"));
const diffs = [];

for (const [label, value] of Object.entries(result)) {
  const prev = before[label];
  if (JSON.stringify(prev) === JSON.stringify(value)) continue;
  if (prev === undefined) { diffs.push(`${label}: no baseline`); continue; }
  if (prev === "absent" || value === "absent") {
    diffs.push(`${label}: presence changed`);
    continue;
  }
  for (const prop of Object.keys(value)) {
    if (prev[prop] !== value[prop]) {
      diffs.push(`${label} / ${prop}\n    before ${prev[prop]}\n    after  ${value[prop]}`);
    }
  }
}

console.log("\nSHELL SURFACE COMPUTED-STYLE DIFF");
console.log(diffs.length ? diffs.map((d) => `  ${d}`).join("\n") : "  no change");
console.log(
  diffs.length
    ? `\n${diffs.length} difference(s). Each must be classified EXPECTED or UNEXPECTED.`
    : "\nNo shell surface changed. The deleted rules were fully superseded."
);
process.exit(0);
