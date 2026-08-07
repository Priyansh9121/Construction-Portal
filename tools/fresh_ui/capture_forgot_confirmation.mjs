/**
 * Capture the Forgot Password CONFIRMATION state, which the route-level
 * screenshot pass cannot reach because it requires a submission.
 *
 * Also checks the mixed-script case, since the confirmation carries the
 * longest prose on any auth route and is therefore where Gujarati wrapping is
 * most likely to break.
 *
 * Local dev server only. Spends 2 real requests.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = requireFromFrontend("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const outDir = path.join(root, ".screenshots/auth");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
let failures = 0;

for (const [label, motion, widths] of [
  ["normal", "no-preference", [[390, 844], [768, 1024], [1440, 900]]],
  ["reduced", "reduce", [[390, 844]]],
]) {
  const context = await browser.newContext({ reducedMotion: motion });
  const page = await context.newPage();

  for (const [w, h] of widths) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" });
    await page.fill("#forgot-password-email", `capture-${w}-${Date.now()}@local.test`);
    await page.click(".auth-submit");
    await page.waitForSelector('[data-testid="forgot-confirmation"]');
    await page.waitForTimeout(motion === "reduce" ? 100 : 500);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    if (overflow > 1) {
      failures += 1;
      console.log(`FAIL  confirmation ${label} @ ${w}: overflow ${overflow}px`);
    }

    await page.screenshot({
      path: path.join(outDir, `forgot-confirm-${w}-${label}.png`),
    });
  }

  await context.close();
}

// Mixed-script confirmation at the narrowest width.
const context = await browser.newContext();
const page = await context.newPage();
await page.setViewportSize({ width: 320, height: 568 });
await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" });
await page.fill("#forgot-password-email", `gujarati-${Date.now()}@local.test`);
await page.click(".auth-submit");
await page.waitForSelector('[data-testid="forgot-confirmation"]');
await page.evaluate(() => {
  document.querySelector("h1").textContent = "તમારો ઇમેઇલ તપાસો";
  document.querySelector(".auth-success").textContent =
    "જો આ ઇમેઇલ માટે પાત્ર ખાતું હોય, તો પાસવર્ડ રીસેટ સૂચનાઓ મોકલવામાં આવી છે.";
  document.querySelector(".auth-confirm__body p").textContent =
    "લિંક ટૂંક સમયમાં સમાપ્ત થાય છે, તેથી તેનો ઉપયોગ જલદી કરો. જો કંઈ ન આવે તો સ્પામ ફોલ્ડર તપાસો.";
});
await page.waitForTimeout(300);

const gujOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth
);
if (gujOverflow > 1) {
  failures += 1;
  console.log(`FAIL  Gujarati confirmation @ 320: overflow ${gujOverflow}px`);
} else {
  console.log(`pass  Gujarati confirmation @ 320: no overflow`);
}
await page.screenshot({ path: path.join(outDir, "forgot-confirm-320-gujarati.png") });

await browser.close();
console.log(failures ? `\n${failures} failure(s)` : "\nconfirmation state clean at every captured width");
process.exit(failures ? 1 : 0);
