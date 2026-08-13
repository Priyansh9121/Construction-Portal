/**
 * Compare what the Login world does in a browser LOCALLY against what it does
 * in PRODUCTION, and record the first place the two diverge.
 *
 * Every static asset can return 200 with the right MIME type and the right
 * bytes and the world can still be missing, because the divergence can happen
 * after the fetch -- in a decoder, under a header that only production sends.
 * curl cannot see that. This runs a real browser against both and records
 * console output, page errors, failed requests and every /world/ response.
 *
 *     node tools/fresh_ui/deploy_parity.mjs
 *     node tools/fresh_ui/deploy_parity.mjs --only prod
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(path.join(root, "frontend/package.json"))("@playwright/test");

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const only = flag("only", null);

const TARGETS = [
  { name: "LOCAL", url: "http://localhost:5173/login" },
  { name: "PRODUCTION", url: "https://construction-portal-one.vercel.app/login" },
].filter((t) => !only || t.name.toLowerCase().startsWith(only.toLowerCase()));

/* Real GPU. Under SwiftShader the world takes a different path and the
 * comparison stops describing the thing being diagnosed. */
const GPU_ARGS = ["--use-gl=angle", "--use-angle=metal", "--enable-gpu",
                  "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"];

async function probe({ name, url }) {
  const browser = await chromium.launch({ args: GPU_ARGS });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

  const console_ = [], errors = [], failed = [], world = [];
  page.on("console", (m) => console_.push({ type: m.type(), text: m.text() }));
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("requestfailed", (r) =>
    failed.push({ url: r.url(), reason: r.failure()?.errorText || "?" }));
  page.on("response", async (r) => {
    if (!r.url().includes("/world/")) return;
    world.push({
      url: r.url().split("/world/")[1],
      status: r.status(),
      type: r.headers()["content-type"] || "?",
      size: r.headers()["content-length"] || "?",
    });
  });

  let nav = "ok";
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  } catch (e) { nav = String(e.message).split("\n")[0]; }
  await page.waitForTimeout(9000);

  /* What the SCENE actually contains, not what the network said. A layer can
   * fetch cleanly and still never reach the graph. */
  const scene = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return { canvas: false };
    if (!c.__perf) return { canvas: true, perf: false };
    const { scene } = c.__perf;
    const layers = {}, names = [];
    scene.traverse((o) => {
      if (o.name && o.name.startsWith("login-site-")) layers[o.name] = true;
      if (o.isMesh) names.push(o.name || "(unnamed)");
    });
    return {
      canvas: true, perf: true,
      layers: Object.keys(layers).sort(),
      meshCount: names.length,
      live: document.documentElement.dataset.world || document.querySelector("[data-world]")?.dataset?.world || "?",
    };
  }).catch((e) => ({ evalError: String(e.message).split("\n")[0] }));

  await page.screenshot({ path: path.join(root, `.screenshots/parity/${name.toLowerCase()}.png`) });
  await browser.close();
  return { name, url, nav, scene, world, errors, console_, failed };
}

fs.mkdirSync(path.join(root, ".screenshots/parity"), { recursive: true });
const results = [];
for (const t of TARGETS) results.push(await probe(t));

const INTEREST = /world|glb|gltf|meshopt|texture|404|cors|decode|fetch|webgl|wasm|csp|content security/i;

for (const r of results) {
  console.log(`\n${"=".repeat(64)}\n${r.name}  ${r.url}\n${"=".repeat(64)}`);
  console.log(`nav: ${r.nav}`);
  console.log(`scene: ${JSON.stringify(r.scene)}`);
  console.log(`\n-- /world/ requests (${r.world.length}) --`);
  for (const w of r.world) console.log(`  ${String(w.status).padEnd(4)} ${String(w.type).padEnd(20)} ${String(w.size).padEnd(9)} ${w.url}`);
  console.log(`\n-- page errors (${r.errors.length}) --`);
  for (const e of r.errors) console.log(`  ${e}`);
  console.log(`\n-- failed requests (${r.failed.length}) --`);
  for (const f of r.failed) console.log(`  ${f.reason}  ${f.url}`);
  const hot = r.console_.filter((c) => c.type === "error" || c.type === "warning" || INTEREST.test(c.text));
  console.log(`\n-- console of interest (${hot.length} of ${r.console_.length}) --`);
  for (const c of hot) console.log(`  [${c.type}] ${c.text.slice(0, 300)}`);
}
