import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.launch();
for (const [w,h,tag] of [[1440,900,"1440"],[390,844,"390"]]) {
  for (const rm of [false, true]) {
    if (rm && tag==="390") continue;
    const c = await b.newContext({viewport:{width:w,height:h}, reducedMotion: rm?"reduce":"no-preference"});
    const p = await c.newPage();
    const errs=[]; p.on("pageerror",e=>errs.push(String(e).slice(0,120)));
    await p.goto("http://localhost:5173/login",{waitUntil:"networkidle"});
    // The form must be usable immediately, before any world exists.
    const formAt = Date.now();
    await p.waitForSelector('input[name="email"]',{timeout:10000});
    const formReady = Date.now()-formAt;
    const liveAt = Date.now();
    const live = await p.waitForSelector('.auth-world[data-live="1"]',{timeout:12000}).then(()=>Date.now()-liveAt).catch(()=>null);
    await p.waitForTimeout(3200);
    await p.screenshot({path:`.screenshots/login3d/prod-${tag}${rm?"-rm":""}.png`});
    console.log(`${tag}${rm?" rm":""} formReady=${formReady}ms worldLive=${live===null?"NEVER":live+"ms"}`, errs.length?errs.slice(0,2):"ok");
    await p.close(); await c.close();
  }
}
await b.close();
