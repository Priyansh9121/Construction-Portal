/**
 * Capture the auth routes at the required widths, in both motion modes.
 *
 * Playwright assertions in this project have repeatedly passed while the
 * surface was visually wrong, so these images are reviewed by eye rather than
 * asserted on. Reduced-motion captures use Chromium's real
 * prefers-reduced-motion emulation, not a class toggle.
 *
 * Usage: node tools/fresh_ui/auth_screenshots.mjs [outDir]
 * Reads a local dev server only; writes PNGs and nothing else.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = requireFromFrontend("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const outDir = process.argv[2] || path.join(root, ".screenshots/auth");

const ROUTES = [
  ["login", "/login"],
  ["register", "/register"],
  ["forgot", "/forgot-password"],
  ["reset", "/reset-password?token=sample-token-for-layout-only"],
];

const WIDTHS = [
  [320, 568], [375, 667], [390, 844], [414, 896],
  [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080],
];

const only = process.env.ONLY_WIDTHS
  ? new Set(process.env.ONLY_WIDTHS.split(",").map(Number))
  : null;

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const overflows = [];

for (const motion of ["no-preference", "reduce"]) {
  const context = await browser.newContext({ reducedMotion: motion === "reduce" ? "reduce" : "no-preference" });
  const page = await context.newPage();

  for (const [name, route] of ROUTES) {
    for (const [w, h] of WIDTHS) {
      if (only && !only.has(w)) continue;

      await page.setViewportSize({ width: w, height: h });
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(motion === "reduce" ? 120 : 1400); // let the draw finish

      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        win: window.innerWidth,
      }));
      if (overflow.doc > overflow.win + 1) {
        overflows.push(`${name} @ ${w}: scrollWidth ${overflow.doc} > ${overflow.win}`);
      }

      const suffix = motion === "reduce" ? "-reduced" : "";
      await page.screenshot({ path: path.join(outDir, `${name}-${w}${suffix}.png`), fullPage: false });
    }
  }

  await context.close();
}

await browser.close();

console.log(`screenshots written to ${outDir}`);
console.log(overflows.length ? `HORIZONTAL OVERFLOW:\n  ${overflows.join("\n  ")}` : "no horizontal overflow at any width, either motion mode");
