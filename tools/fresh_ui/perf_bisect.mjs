/**
 * Bisect what actually costs frame time on the real Login, at REAL DPR.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every previous performance number in this project was measured with
 * Playwright's `deviceScaleFactor: 1`, while production caps the renderer at
 * DPR 2. On a Retina display that is a QUARTER of the real pixel load, which
 * is exactly why the harness reported a comfortable 60 fps while the actual
 * page felt laggy. FPS was never the wrong metric -- the resolution was.
 *
 * This runs at the real device pixel ratio and measures the four things a
 * user actually does, separately, because an average hides a hitch.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const req = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = req("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const DPR = Number(process.env.PERF_DPR || 2);

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--enable-gpu", "--ignore-gpu-blocklist"],
});

/** Frame-time distribution over a window, while `drive` perturbs the page. */
const SAMPLE = `(ms) => new Promise((resolve) => {
  const f = []; let last = performance.now(); const t0 = last;
  const tick = (now) => { f.push(now - last); last = now;
    if (now - t0 < ms) requestAnimationFrame(tick);
    else {
      const s = [...f].sort((a,b)=>a-b);
      const q = (p) => s[Math.min(s.length-1, Math.floor(s.length*p))];
      const over = (t) => f.filter((x)=>x>t).length;
      resolve({ frames: f.length, fps: +(f.length/((last-t0)/1000)).toFixed(1),
        p50:+q(.5).toFixed(1), p90:+q(.9).toFixed(1), p95:+q(.95).toFixed(1),
        p99:+q(.99).toFixed(1), max:+Math.max(...f).toFixed(1),
        over20: over(20), over33: over(33), over50: over(50), over100: over(100) });
    } };
  requestAnimationFrame(tick);
})`;

async function scenario(page, name, drive) {
  const run = page.evaluate(`(${SAMPLE})(2600)`);
  await drive();
  return { name, ...(await run) };
}

async function measure(page, label) {
  const out = [];
  out.push(await scenario(page, "idle", async () => page.waitForTimeout(2600)));
  out.push(await scenario(page, "pointer", async () => {
    for (let i = 0; i < 50; i += 1) {
      await page.mouse.move(700 + Math.sin(i / 4) * 380, 420 + Math.cos(i / 5) * 200);
      await page.waitForTimeout(45);
    }
  }));
  out.push(await scenario(page, "drag", async () => {
    await page.mouse.move(1050, 640); await page.mouse.down();
    for (let i = 0; i < 50; i += 1) {
      await page.mouse.move(1050 - i * 18, 640 + Math.sin(i / 6) * 40);
      await page.waitForTimeout(45);
    }
    await page.mouse.up();
  }));
  out.push(await scenario(page, "wheel", async () => {
    await page.mouse.move(1050, 640);
    for (let i = 0; i < 50; i += 1) { await page.mouse.wheel(0, 40); await page.waitForTimeout(45); }
  }));
  console.log(`\n### ${label}`);
  for (const r of out) {
    console.log(`  ${r.name.padEnd(8)} fps ${String(r.fps).padStart(5)}  `
      + `p50 ${String(r.p50).padStart(5)}  p95 ${String(r.p95).padStart(6)}  `
      + `p99 ${String(r.p99).padStart(6)}  max ${String(r.max).padStart(6)}  `
      + `>20:${String(r.over20).padStart(3)} >33:${String(r.over33).padStart(3)} `
      + `>50:${String(r.over50).padStart(3)} >100:${String(r.over100).padStart(2)}`);
  }
  return out;
}

const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR,
});
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.waitForTimeout(9000);

console.log(await page.evaluate(() => {
  const c = document.querySelector("canvas");
  const p = c?.__perf;
  const gl = p?.renderer?.getContext?.();
  const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
  const sz = p ? p.renderer.getDrawingBufferSize(new p.THREE.Vector2()) : null;
  return {
    gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "?",
    devicePixelRatio: window.devicePixelRatio,
    rendererPixelRatio: p?.renderer.getPixelRatio(),
    cssCanvas: [c.clientWidth, c.clientHeight],
    drawingBuffer: sz ? [sz.x, sz.y] : null,
    megapixels: sz ? +((sz.x * sz.y) / 1e6).toFixed(2) : null,
    calls: p?.renderer.info.render.calls,
    triangles: p?.renderer.info.render.triangles,
    geometries: p?.renderer.info.memory.geometries,
    textures: p?.renderer.info.memory.textures,
    shadowsEnabled: p?.renderer.shadowMap.enabled,
  };
}));

await measure(page, `A. FULL PRODUCTION (DPR ${DPR})`);

for (const dpr of [1.5, 1.25, 1.0]) {
  await page.evaluate((d) => {
    const p = document.querySelector("canvas").__perf;
    p.renderer.setPixelRatio(d);
    p.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }, dpr);
  await page.waitForTimeout(700);
  await measure(page, `B. DPR ${dpr}`);
}

await page.evaluate(() => {
  const p = document.querySelector("canvas").__perf;
  p.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  p.renderer.setSize(window.innerWidth, window.innerHeight, false);
  p.renderer.shadowMap.enabled = false;
  p.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
});
await page.waitForTimeout(900);
await measure(page, "C. NATIVE DPR, SHADOWS OFF");

await browser.close();
