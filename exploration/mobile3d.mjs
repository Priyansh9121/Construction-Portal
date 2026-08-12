import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.launch({args:["--use-gl=angle","--enable-gpu","--ignore-gpu-blocklist"]});
for (const [w,h,tag] of [[390,844,"390"],[320,720,"320"]]) {
  const c = await b.newContext({viewport:{width:w,height:h}, hasTouch:true, deviceScaleFactor:2});
  const p = await c.newPage();
  await p.goto("http://localhost:5173/login",{waitUntil:"networkidle"});
  await p.waitForSelector('.auth-world[data-live="1"]',{timeout:15000}).catch(()=>{});
  await p.waitForTimeout(3200);
  await p.screenshot({path:`.screenshots/login3d/mob-${tag}.png`});
  const m = await p.evaluate(()=>({over:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    live:!!document.querySelector('.auth-world[data-live="1"]')}));
  console.log(tag, JSON.stringify(m));
  await p.close(); await c.close();
}
await b.close();
