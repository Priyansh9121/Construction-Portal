import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium, request } = require("@playwright/test");
const api = await request.newContext({ baseURL:"http://127.0.0.1:5051" });
const r = await api.post("/api/auth/login",{data:{email:"ui-redesign-e2e@local.test",password:"UnitTwoLocal!2026"}});
const {token,user}=await r.json(); await api.dispose();
const b=await chromium.launch();
const w = Number(process.argv[2]||1440), rm = process.argv[3]==="1";
const c=await b.newContext({viewport:{width:w,height:w<=390?844:900},reducedMotion:rm?"reduce":"no-preference",
  recordVideo:{dir:`/Users/priyanshranpura/construction-portal/.recordings/arrival-${w}${rm?"-rm":""}`,size:{width:w,height:w<=390?844:900}}});
await c.addInitScript(([t,u])=>{localStorage.setItem("token",t);localStorage.setItem("user",u)},[token,JSON.stringify(user)]);
const p=await c.newPage();
const t0=Date.now();
await p.goto("http://localhost:5173/dashboard");
// Interactivity during arrival: can we hit a control at ~150ms?
await p.waitForSelector(".ui-attention__row",{timeout:15000});
const early = Date.now()-t0;
const clickable = await p.evaluate(()=>{const r=document.querySelector(".ui-attention__row");
  if(!r) return "none"; const b=r.getBoundingClientRect();
  const el=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
  return el && r.contains(el) ? "hit-testable" : "blocked";});
for (const ms of [0,150,300,600,900,1500,3000]) {
  const wait = ms - (Date.now()-t0); if (wait>0) await p.waitForTimeout(wait);
  await p.screenshot({path:`/Users/priyanshranpura/construction-portal/.screenshots/arrival/${w}${rm?"-rm":""}-t${ms}.png`});
}
console.log(`${w}${rm?" rm":""} firstRow@${early}ms ${clickable}`);
await p.close(); await c.close(); await b.close();
