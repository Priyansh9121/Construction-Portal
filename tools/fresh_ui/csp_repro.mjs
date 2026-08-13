/**
 * Reproduce production's Content-Security-Policy against a local production
 * build, and prove a CSP change fixes the world without waiting on a deploy.
 *
 * WHY THIS EXISTS
 * ---------------
 * The dev server sends no CSP and `vite preview` does not read vercel.json, so
 * the single header that broke production is the one thing local testing never
 * applied. Every asset returned 200 with the right MIME type and the right
 * magic bytes; the divergence was a header, and it only bit at decode time.
 *
 * This serves frontend/dist with the EXACT policy string from
 * frontend/vercel.json and runs a real browser against it, so the fix is
 * verified by reproduction rather than by argument.
 *
 *     node tools/fresh_ui/csp_repro.mjs              # policy as committed
 *     node tools/fresh_ui/csp_repro.mjs --old        # policy without wasm-unsafe-eval
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(path.join(root, "frontend/package.json"))("@playwright/test");

const useOld = process.argv.includes("--old");
const dist = path.join(root, "frontend/dist");

const vercel = JSON.parse(fs.readFileSync(path.join(root, "frontend/vercel.json"), "utf8"));
let csp = vercel.headers
  .flatMap((h) => h.headers)
  .find((h) => h.key.toLowerCase() === "content-security-policy").value;
/* The control arm: the exact policy production was serving during the
 * incident. Removing the token rather than hand-writing the old string keeps
 * the two arms differing by ONE thing. */
if (useOld) csp = csp.replace(" 'wasm-unsafe-eval'", "");

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".png": "image/png",
  ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(dist, url);
  /* Static files resolve FIRST; only then the SPA fallback -- which is exactly
   * the precedence Vercel applies, and the reason the catch-all rewrite was
   * never the bug here. */
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, "index.html");
  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(4599, r));

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).split("\n")[0]));
page.on("console", (m) => { if (m.type() === "error") errors.push(`[console] ${m.text().split("\n")[0]}`); });

await page.goto("http://localhost:4599/login", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(9000);

const state = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  if (!c) return { canvas: false };
  let meshes = 0;
  const layers = new Set();
  c.__perf?.scene.traverse((o) => {
    if (o.isMesh) meshes += 1;
    if (o.name?.startsWith("login-site-")) layers.add(o.name);
  });
  return { canvas: true, layers: [...layers].sort(), meshes, debug: c.__authWorldDebug || null };
});

const tag = useOld ? "old-csp" : "new-csp";
fs.mkdirSync(path.join(root, ".screenshots/parity"), { recursive: true });
await page.screenshot({ path: path.join(root, `.screenshots/parity/${tag}.png`) });

console.log(`\nCSP ARM: ${tag}`);
console.log(`script-src: ${csp.match(/script-src[^;]*/)[0]}`);
console.log(`layers in scene : ${state.layers?.length ? state.layers.join(", ") : "NONE"}`);
console.log(`meshes in scene : ${state.meshes}`);
console.log(`__authWorldDebug: ${JSON.stringify(state.debug)}`);
console.log(`errors (${errors.length}):`);
for (const e of [...new Set(errors)]) console.log(`  ${e.slice(0, 160)}`);

await browser.close();
server.close();
