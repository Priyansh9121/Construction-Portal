/**
 * Capture the Login under a PINNED clock, so composition can be judged.
 *
 * WHY THIS EXISTS
 * ---------------
 * The world runs on real Asia/Kolkata time with an astronomically correct sun,
 * which is right for the product and useless for review: the same frame is a
 * bright midday elevation at one hour and a near-black night at another, and
 * two captures taken an hour apart differ for reasons that have nothing to do
 * with the change being judged. A composition decision made against a night
 * frame is a composition decision made blind.
 *
 * This freezes Date before any application code runs, so the sun, the moon and
 * every grade lookup resolve to one fixed instant.
 *
 *   node tools/fresh_ui/compose_check.mjs                       # 10:20 IST
 *   node tools/fresh_ui/compose_check.mjs --at 2026-08-13T12:30:00Z
 *   node tools/fresh_ui/compose_check.mjs --out .screenshots/x/a.png
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(path.join(root, "frontend/package.json"))("@playwright/test");

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

/* 04:50 UTC = 10:20 Asia/Kolkata: a high, slightly raking morning sun. Chosen
 * because it models the facade rather than flattening it, which is the light a
 * composition should be judged under. */
const at = flag("at", "2026-08-13T04:50:00Z");
const out = path.resolve(root, flag("out", ".screenshots/camera/daylight.png"));
const url = flag("url", "http://localhost:5173/login");

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: +flag("w", 1440), height: +flag("h", 900) },
  deviceScaleFactor: +flag("dpr", 2),
});

/* Before ANY application script: the world reads the clock during construction,
 * so patching afterwards would be too late. */
await page.addInitScript((iso) => {
  const FIXED = new Date(iso).getTime();
  const Original = Date;
  // eslint-disable-next-line no-global-assign
  Date = class extends Original {
    constructor(...a) { return a.length ? new Original(...a) : new Original(FIXED); }
    static now() { return FIXED; }
  };
}, at);

await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForFunction(
  () => document.querySelector("canvas")?.dataset.worldState === "ready",
  null, { timeout: 30000 },
).catch(() => console.warn("world never reported READY; capturing anyway"));
/* The entry flight settles; capturing during it compares two different shots. */
await page.waitForTimeout(6000);

fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out });
console.log(`captured ${path.relative(root, out)}  at ${at}`);
await browser.close();
