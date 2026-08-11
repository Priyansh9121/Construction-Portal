import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.launch();
for (const time of ["dawn","dusk","day"]) {
  const c = await b.newContext({viewport:{width:1440,height:900}});
  const p = await c.newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(String(e).slice(0,130)));
  await p.addInitScript((t)=>{window.__AUTH_TIME=t;}, time);
  await p.goto("http://localhost:5173/login",{waitUntil:"networkidle"});
  await p.waitForSelector('.auth-world[data-live="1"]',{timeout:15000}).catch(()=>{});
  await p.waitForTimeout(3000);
  await p.screenshot({path:`.screenshots/login3d/time-${time}.png`});
  console.log(time, errs.length?errs.slice(0,1):"ok");
  await p.close(); await c.close();
}
await b.close();
