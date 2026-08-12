/**
 * Prove the camera is a body moving through a world, not a model on a turntable.
 *
 * Three claims are made about this rig, and all three are the kind that look
 * true in a screenshot while being false in the code. Each is asserted against
 * measured state rather than judged by eye:
 *
 *   1. A drag can turn PAST 360 degrees and keep going. A rig that clamps, or
 *      one that wraps by shortest-arc, fails here.
 *
 *   2. The camera's WORLD POSITION changes as it turns. If the scene were
 *      being rotated instead, the camera would sit still and only the objects
 *      would move — so a constant eye position is the signature of the exact
 *      failure this rig was written to remove.
 *
 *   3. The wheel MOVES BETWEEN PLACES rather than changing distance. If the
 *      only thing that varies across the journey is radius, it is a zoom.
 *
 * Also writes a frame at each 90 degrees and at each station, so the parallax
 * can be looked at as well as asserted.
 *
 * Usage: node tools/fresh_ui/camera_probe.mjs [outDir]
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = requireFromFrontend("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const outDir = path.resolve(process.argv[2] || path.join(root, ".screenshots/camera"));
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.waitForTimeout(8000);

const probe = () => page.evaluate(
  () => document.querySelector("canvas")?.__camera || null);

const settle = async (ms = 900) => page.waitForTimeout(ms);

const failures = [];
const check = (ok, message) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${message}`);
  if (!ok) failures.push(message);
};

/* ---- 1 & 2: a full turn, and the eye actually moving ------------------- */

const start = await probe();
console.log(`start   ${JSON.stringify(start)}`);

/* Drag from a point clear of the form so the gesture reaches the canvas. */
const originX = 1050;
const originY = 640;
await page.mouse.move(originX, originY);
await page.mouse.down();

const eyes = [];
const turns = [];
let x = originX;
/* 1280 px of viewport maps to 1.15 turns, so ~2400 px of travel is comfortably
 * past two full revolutions. Moved in steps, because a single jump would be
 * one pointermove and the rig integrates deltas. */
for (let step = 0; step < 24; step += 1) {
  x -= 100;
  await page.mouse.move(x, originY);
  await page.waitForTimeout(45);
  if (step % 6 === 5) {
    const p = await probe();
    eyes.push(p.eye);
    turns.push(p.turnedDeg);
    await page.screenshot({ path: path.join(outDir, `turn-${step + 1}.png`) });
  }
}
await page.mouse.up();
await settle(1400);

const turned = await probe();
console.log(`turned  ${JSON.stringify(turned)}`);

check(Math.abs(turned.turnedDeg) > 360,
  `drag exceeded a full turn (${turned.turnedDeg} deg)`);
check(Math.abs(turned.turnedDeg) > 720,
  `drag exceeded two full turns (${turned.turnedDeg} deg)`);

/* The eye must have visited genuinely different places, not wobbled. */
const spread = (i) => {
  const v = eyes.map((e) => e[i]);
  return Math.max(...v) - Math.min(...v);
};
check(spread(0) > 20, `eye travelled in X (${spread(0).toFixed(1)} m)`);
check(spread(2) > 20, `eye travelled in Z (${spread(2).toFixed(1)} m)`);

/* Opposite sides of the turn must put the camera on opposite sides of the
 * target — the definitive difference between orbiting and spinning. */
const opposed = eyes.some((a) => eyes.some((b) =>
  Math.hypot(a[0] - b[0], a[2] - b[2]) > 30));
check(opposed, "camera reached opposing sides of the site");

/* ---- 3: the wheel is a journey, not a zoom ----------------------------- */

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(8000);
/* Put the cursor over the world before wheeling. page.mouse.wheel dispatches
 * at the CURRENT pointer position, which after a reload is wherever the last
 * drag left it — off-canvas, where the guard correctly rejects it. */
await page.mouse.move(1050, 640);

const stations = [];
for (let i = 0; i < 7; i += 1) {
  const p = await probe();
  stations.push(p);
  await page.screenshot({ path: path.join(outDir, `station-${i}-${p.station}.png`) });
  /* Wheel forward roughly one station's worth. */
  for (let k = 0; k < 10; k += 1) {
    await page.mouse.wheel(0, 46);
    await page.waitForTimeout(30);
  }
  await settle(1100);
}

const names = [...new Set(stations.map((s) => s.station))];
const radii = [...new Set(stations.map((s) => s.radius))];
const targets = new Set(stations.map((s) => s.eye.map(Math.round).join(",")));
console.log(`stations visited: ${names.join(" -> ")}`);

check(names.length >= 4, `wheel visited ${names.length} distinct stations`);
check(targets.size >= 4, `wheel produced ${targets.size} distinct eye positions`);
check(radii.length >= 3,
  `stations differ in standing distance (${radii.length} radii) as well as place`);

/* A zoom keeps the camera on one ray from the subject. Check the eye left
 * that ray by comparing bearing spread across stations. */
const bearings = stations.map((s) => Math.atan2(s.eye[0], s.eye[2]));
const bearingSpread = Math.max(...bearings) - Math.min(...bearings);
check(bearingSpread > 0.5,
  `journey changed bearing by ${(bearingSpread * 57.3).toFixed(0)} deg, so it is not a dolly`);

await browser.close();

console.log(`\n${failures.length ? `${failures.length} FAILED` : "all camera claims verified"}`);
console.log(`frames in ${outDir}`);
process.exit(failures.length ? 1 : 0);
