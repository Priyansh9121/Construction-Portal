/**
 * Capture and measure the Login world under a PINNED, repeatable world state.
 *
 * WHY THIS EXISTS
 * ---------------
 * Two things kept going wrong when reviewing this scene by eye:
 *
 *   1. Comparisons were not comparable. The world runs a crane task, a wind
 *      state, a sun that moves and a camera that flies on entry, so two
 *      screenshots taken a minute apart differ for reasons that have nothing
 *      to do with the change being reviewed. Every capture here pins the
 *      time-of-day and waits for the entry flight to settle, so a difference
 *      in the image is a difference in the work.
 *
 *   2. Measurements were taken on a software rasteriser. Headless Chromium
 *      defaults to SwiftShader, which under-reports this scene by an order of
 *      magnitude — an earlier pass "measured" 6.4fps that way against 59.9 on
 *      the GPU. The GPU flags below are not optional, and the run refuses to
 *      report numbers if it detects it is running on a software renderer.
 *
 * Usage:
 *   node tools/fresh_ui/world_capture.mjs <outDir> [--time dusk] [--only 1440]
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = requireFromFrontend("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const args = process.argv.slice(2);
const outDir = path.resolve(args[0] || path.join(root, ".screenshots/world"));
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const only = flag("only", null);

/* Real GPU. Without these the numbers below describe SwiftShader, not this
 * scene, and every conclusion drawn from them is wrong. */
const GPU_ARGS = [
  "--use-gl=angle",
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--enable-unsafe-webgpu",
];

const VIEWS = [
  { name: "1440", w: 1440, h: 900, motion: "no-preference" },
  { name: "390", w: 390, h: 844, motion: "no-preference" },
  { name: "1440-reduced", w: 1440, h: 900, motion: "reduce" },
];

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: GPU_ARGS });
const report = [];

for (const view of VIEWS) {
  if (only && view.name !== only) continue;

  const context = await browser.newContext({
    viewport: { width: view.w, height: view.h },
    reducedMotion: view.motion === "reduce" ? "reduce" : "no-preference",
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const failures = [];
  page.on("console", (m) => {
    if (m.type() === "warning" || m.type() === "error") failures.push(m.text());
  });
  page.on("requestfailed", (r) => failures.push(`FAILED ${r.url()}`));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });

  /* The world is imported on idle and the camera flies in over ~5.4s. Waiting
   * a fixed time is what makes two captures comparable; waiting for
   * "networkidle" alone would photograph a camera mid-flight. */
  await page.waitForTimeout(view.motion === "reduce" ? 1500 : 8000);

  const renderer = await page.evaluate(() => {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return "none";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown";
  });
  const software = /swiftshader|llvmpipe|softpipe|basic render|software/i.test(renderer);

  /* Frame timing, sampled over a real second of animation. */
  const perf = await page.evaluate(() => new Promise((resolve) => {
    const frames = [];
    let last = performance.now();
    const started = last;
    const tick = (now) => {
      frames.push(now - last);
      last = now;
      if (now - started < 3000) requestAnimationFrame(tick);
      else {
        const sorted = [...frames].sort((a, b) => a - b);
        const at = (q) => sorted[Math.min(sorted.length - 1,
          Math.floor(sorted.length * q))];
        resolve({
          frames: frames.length,
          fps: +(frames.length / ((last - started) / 1000)).toFixed(1),
          p50: +at(0.5).toFixed(2),
          p95: +at(0.95).toFixed(2),
          p99: +at(0.99).toFixed(2),
          heapMB: performance.memory
            ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
        });
      }
    };
    requestAnimationFrame(tick);
  }));

  const layout = await page.evaluate(() => ({
    docWidth: document.documentElement.scrollWidth,
    winWidth: window.innerWidth,
    live: document.querySelector(".auth-world")?.dataset.live || "0",
  }));

  await page.screenshot({ path: path.join(outDir, `${view.name}.png`) });

  report.push({
    view: view.name, renderer: software ? `SOFTWARE (${renderer})` : renderer,
    ...perf,
    worldLive: layout.live,
    overflow: layout.docWidth - layout.winWidth,
    warnings: failures.slice(0, 6),
  });
  await context.close();
}

await browser.close();

for (const r of report) {
  const warn = r.renderer.startsWith("SOFTWARE")
    ? "  <-- SOFTWARE RENDERER: timings below are meaningless" : "";
  console.log(`\n[${r.view}] ${r.renderer}${warn}`);
  console.log(`  fps ${r.fps}  p50 ${r.p50}ms  p95 ${r.p95}ms  p99 ${r.p99}ms  `
    + `heap ${r.heapMB ?? "n/a"}MB`);
  console.log(`  world live: ${r.worldLive}   overflow: ${r.overflow}px`);
  for (const w of r.warnings) console.log(`  ! ${w}`);
}
console.log(`\nwrote ${report.length} captures to ${outDir}`);
