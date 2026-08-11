import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.launch();
const url = "file:///Users/priyanshranpura/construction-portal/exploration/renderer-bench.html";
for (const mode of ["svg","webgl"]) for (const n of [260, 600]) {
  const p = await (await b.newContext({viewport:{width:1200,height:400}})).newPage();
  const metrics = [];
  await p.goto(`${url}?mode=${mode}&n=${n}`);
  await p.waitForFunction(()=>window.__fps!==undefined,{timeout:20000});
  const fps = await p.evaluate(()=>window.__fps);
  const cdp = await p.context().newCDPSession(p);
  const m = await cdp.send("Performance.getMetrics");
  const get=(k)=>m.metrics.find(x=>x.name===k)?.value ?? 0;
  console.log(`${mode.padEnd(6)} n=${String(n).padEnd(4)} fps=${String(fps).padEnd(6)} nodes=${get("Nodes")} layout=${get("LayoutCount")} recalc=${get("RecalcStyleCount")}`);
  await p.close();
}
await b.close();
