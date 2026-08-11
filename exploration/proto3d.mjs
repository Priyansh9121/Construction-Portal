import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.launch({ args: ["--use-gl=angle","--enable-gpu","--ignore-gpu-blocklist"] });
for (const [w,h,label] of [[1440,900,"desktop"],[390,844,"mobile"]]) {
  const c = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor: label==="mobile"?2:1 });
  const p = await c.newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(String(e).slice(0,140)));
  p.on("console",m=>{if(m.type()==="error")errs.push(m.text().slice(0,140))});
  await p.goto("http://localhost:5173/proto3d.html");
  await p.waitForFunction(()=>window.__m, {timeout:25000}).catch(()=>{});
  await p.waitForTimeout(6000);
  const m = await p.evaluate(()=>window.__m||null);
  const mem = await p.evaluate(()=> performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576) : null);
  await p.screenshot({path:`/Users/priyanshranpura/construction-portal/.screenshots/login3d/${label}-idle.png`});
  // Sign-in flight
  await p.click("#go"); await p.waitForTimeout(500);
  await p.screenshot({path:`/Users/priyanshranpura/construction-portal/.screenshots/login3d/${label}-flight.png`});
  await p.waitForTimeout(1400);
  await p.screenshot({path:`/Users/priyanshranpura/construction-portal/.screenshots/login3d/${label}-through.png`});
  const after = await p.evaluate(()=>window.__m||null);
  console.log(label, JSON.stringify({...m, heapMB: mem, afterFlightFps: after?.fps}), errs.length?errs.slice(0,2):"no errors");
  await p.close(); await c.close();
}
await b.close();
