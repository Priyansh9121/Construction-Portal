import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium, request } = require("@playwright/test");
const api = await request.newContext({ baseURL:"http://127.0.0.1:5051" });
const r = await api.post("/api/auth/login",{data:{email:"ui-redesign-e2e@local.test",password:"UnitTwoLocal!2026"}});
const {token,user}=await r.json(); await api.dispose();
const b=await chromium.launch();
const c=await b.newContext({viewport:{width:1440,height:900}});
await c.addInitScript(([t,u])=>{localStorage.setItem("token",t);localStorage.setItem("user",u)},[token,JSON.stringify(user)]);
const p=await c.newPage();
await p.goto("http://localhost:5173/dashboard",{waitUntil:"networkidle"});
await p.waitForSelector(".ui-world--band"); await p.waitForTimeout(1500);
// Drive the machinery cycle to chosen points by setting animation time directly.
for (const pct of [0.05, 0.22, 0.45, 0.70]) {
  await p.evaluate((pct)=>{
    for (const a of document.getAnimations()) {
      const n = a.animationName || "";
      if (n.startsWith("w-travel") || n.startsWith("w-hoisting") || n.startsWith("w-hoist")) {
        a.pause();
        const d = a.effect.getTiming().duration;
        a.currentTime = d * pct;
      }
    }
  }, pct);
  await p.waitForTimeout(180);
  await p.locator(".ui-world--band").screenshot({path:`/Users/priyanshranpura/construction-portal/.screenshots/world/occ-${Math.round(pct*100)}.png`});
}
// Prove ordering: is any near-band solid painted after a plant element?
const order = await p.evaluate(()=>{
  const band=document.querySelector(".ui-world--band");
  const planes=[...band.querySelectorAll(".ui-world__plane")].map(e=>e.dataset.band);
  const plantBand=band.querySelector(".w-plant")?.closest(".ui-world__plane")?.dataset.band;
  return {planes, plantBand};
});
console.log(JSON.stringify(order));
await b.close();
