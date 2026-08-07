/**
 * Boundary B checks for Login that Playwright's existing specs do not cover.
 *
 *  1. ?next= orientation renders a FIXED label for an allow-listed path.
 *  2. A hostile or unknown ?next= renders the normal copy and never echoes
 *     the raw value anywhere in the DOM.
 *  3. Gujarati content does not overflow at the narrowest width.
 *  4. The password toggle and the recovery link both meet 44px.
 *
 * Local dev server only. Reads, never writes.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = requireFromFrontend("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const browser = await chromium.launch();
const page = await browser.newPage();
let failures = 0;

const check = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

// 1. Known destination
await page.goto(`${BASE}/login?next=%2Fpayments`, { waitUntil: "networkidle" });
const known = await page.locator(".auth-card-sub").innerText();
check(/Continue to Payments/i.test(known), "allow-listed ?next= names the destination", `-> "${known}"`);

// 2. Hostile value must not appear anywhere in the DOM
const hostile = "/evil<script>x</script>";
await page.goto(`${BASE}/login?next=${encodeURIComponent(hostile)}`, { waitUntil: "networkidle" });
const sub = await page.locator(".auth-card-sub").innerText();
const bodyHtml = await page.evaluate(() => document.body.innerHTML);
check(/registered account details/i.test(sub), "unknown ?next= falls back to normal copy", `-> "${sub}"`);
check(!bodyHtml.includes("evil"), "raw ?next= value never reaches the DOM");

// 2b. Absolute URL must be refused
await page.goto(`${BASE}/login?next=${encodeURIComponent("https://evil.example/dashboard")}`, { waitUntil: "networkidle" });
const abs = await page.locator(".auth-card-sub").innerText();
check(!/Continue to/i.test(abs), "absolute URL in ?next= is refused");

// 3. Gujarati at the narrowest width
await page.setViewportSize({ width: 320, height: 568 });
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  document.querySelector("h1").textContent = "સાઇન ઇન કરો";
  document.querySelector(".auth-card-sub").textContent =
    "તમારા નોંધાયેલ ખાતાની વિગતો દાખલ કરો અને આગળ વધો";
  document.querySelector('label[for="login-password"]').textContent = "પાસવર્ડ";
  document.querySelector(".auth-submit").textContent = "સાઇન ઇન કરો";
});
await page.waitForTimeout(300);
const guj = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  h1Font: getComputedStyle(document.querySelector("h1")).fontFamily,
}));
check(guj.overflow <= 1, "Gujarati causes no horizontal overflow at 320px", `delta ${guj.overflow}px`);
await page.screenshot({ path: path.join(root, ".screenshots/auth/login-320-gujarati.png") });

// 4. Target sizes
await page.setViewportSize({ width: 375, height: 667 });
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
const targets = await page.evaluate(() => {
  const out = {};
  for (const [key, sel] of [["toggle", ".password-toggle-btn"], ["recovery", ".auth-field__action"]]) {
    const el = document.querySelector(sel);
    const r = el ? el.getBoundingClientRect() : null;
    out[key] = r ? { w: Math.round(r.width), h: Math.round(r.height) } : null;
  }
  return out;
});
for (const [key, box] of Object.entries(targets)) {
  check(box && box.h >= 44, `${key} meets the 44px height floor`, box ? `${box.w}x${box.h}` : "missing");
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nall Login boundary checks pass");
process.exit(failures ? 1 : 0);
