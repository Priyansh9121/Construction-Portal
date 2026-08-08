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
 * PROBE DEFECT FIXED (SHELL-024)
 * The first version opened the account menu, the notification panel and the
 * palette in sequence and then measured once. That silently lost every account
 * surface: the dropdowns are mutually exclusive, so opening notifications
 * dismisses the account menu. Each overlay is now opened, measured and closed
 * in its own pass, and the results are merged.
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
  "backdropFilter", "webkitBackdropFilter", "filter",
];

const SURFACES = [
  ["sidebar", ".sidebar"],
  ["sidebar-group-heading", ".sidebar-group-heading"],
  ["sidebar-link", ".sidebar-link:not(.active-link)"],
  ["sidebar-link-active", ".sidebar-link.active-link"],
  ["sidebar-link-icon", ".sidebar-link:not(.active-link) .icon"],
  ["sidebar-link-active-icon", ".sidebar-link.active-link .icon"],
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

const measure = (only) =>
  page.evaluate(
    ({ surfaces, props, only }) => {
      const out = {};
      for (const [label, selector] of surfaces) {
        if (only && !only.includes(label)) continue;
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
    { surfaces: SURFACES, props: PROPS, only }
  );

const ACCOUNT = ["account-panel", "account-identity", "account-action"];
const NOTIFY = ["notification-panel"];
const PALETTE = [
  "command-backdrop", "command-modal", "command-input",
  "command-result", "command-result-selected",
];
const OVERLAY = new Set([...ACCOUNT, ...NOTIFY, ...PALETTE]);
const BASE_SURFACES = SURFACES.map(([l]) => l).filter((l) => !OVERLAY.has(l));

/* The skip link only has a meaningful computed style once focused. */
await page.evaluate(() => document.querySelector(".skip-link")?.focus());
await page.waitForTimeout(150);
const result = await measure(BASE_SURFACES);

/* Each overlay gets its own pass. The account menu and the notification panel
 * are mutually exclusive dropdowns, so measuring them together loses one. */
await page.locator(".account-trigger").click();
await page.waitForSelector(".account-panel");
await page.waitForTimeout(400);
Object.assign(result, await measure(ACCOUNT));
await page.keyboard.press("Escape");
await page.waitForTimeout(250);

await page.locator(".notification-button").click();
await page.waitForSelector(".notification-panel");
await page.waitForTimeout(400);
Object.assign(result, await measure(NOTIFY));
await page.keyboard.press("Escape");
await page.waitForTimeout(250);

/* 600ms clears the 220ms palette entrance. SHELL-010: a short wait measured a
 * mid-animation transform and reported a 43px target. */
await page.keyboard.press("Control+k");
await page.waitForSelector(".command-modal");
await page.waitForTimeout(600);
Object.assign(result, await measure(PALETTE));

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
