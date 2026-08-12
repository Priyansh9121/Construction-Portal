/**
 * Capture the Login control station in each of its interaction states.
 *
 * The states are the point of the surface: "every touch should feel alive"
 * only means something if rest, hover, focus and press are visibly different
 * from each other. Reading the CSS cannot tell you whether they are, because
 * the difference that matters is a few pixels of shadow.
 *
 * Crops tightly to the card, so the states can be compared side by side
 * instead of hunting for a button inside a 1440-wide frame.
 *
 * Usage: node tools/fresh_ui/auth_states.mjs [outDir]
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = requireFromFrontend("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const outDir = path.resolve(process.argv[2] || path.join(root, ".screenshots/auth-states"));
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.waitForTimeout(7000);          // let the world's entry flight settle

const card = page.locator(".auth-card");
const submit = page.locator(".auth-submit");

const shot = async (name) => {
  await page.waitForTimeout(320);         // past the 120ms mechanism transition
  await card.screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log(`  ${name}`);
};

await shot("1-rest");

await page.locator("#login-email").focus();
await shot("2-email-focus");

await page.locator("#login-email").fill("site.manager@example.com");
await page.locator("#login-password").focus();
await page.locator("#login-password").fill("not-a-real-password");
await shot("3-password-focus");

await submit.hover();
await shot("4-submit-hover");

/* Press and HOLD, so the seated state is photographed rather than a frame
 * from the release. Released afterwards without submitting. */
const box = await submit.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await shot("5-submit-pressed");
await page.mouse.up();

console.log(`\nwrote to ${outDir}`);
await browser.close();
