import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.launch();
for (const route of ["/register", "/login"]) {
  const c = await b.newContext({viewport:{width:1280,height:800}});
  const p = await c.newPage();
  let n = 0, threeReqs = 0, bytes = 0;
  const t0 = Date.now();
  p.on("request", (r) => { n++; if (/three/.test(r.url())) threeReqs++; });
  p.on("response", async (r) => { try { const h = r.headers()["content-length"]; if (h) bytes += +h; } catch {} });
  await p.goto(`http://localhost:5173${route}`, { waitUntil: "networkidle" });
  const idleAt = Date.now() - t0;
  console.log(`${route.padEnd(10)} networkidle=${idleAt}ms requests=${n} three-module-requests=${threeReqs}`);
  await p.close(); await c.close();
}
await b.close();
