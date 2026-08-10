import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium, request } = require("@playwright/test");
const api = await request.newContext({ baseURL:"http://127.0.0.1:5051" });
const r = await api.post("/api/auth/login",{data:{email:"ui-redesign-e2e@local.test",password:"UnitTwoLocal!2026"}});
if (!r.ok()) { console.error("login", r.status(), (await r.text()).slice(0,120)); process.exit(1); }
const {token,user}=await r.json(); await api.dispose();
const b=await chromium.launch();
const jobs = (process.argv[2]||"1440,390").split(",").map(Number);
for (const w of jobs) {
  for (const rm of [false,true]) {
    const c=await b.newContext({viewport:{width:w,height:w<=390?844:900},reducedMotion:rm?"reduce":"no-preference"});
    await c.addInitScript(([t,u])=>{localStorage.setItem("token",t);localStorage.setItem("user",u)},[token,JSON.stringify(user)]);
    const p=await c.newPage();
    await p.goto("http://localhost:5173/dashboard",{waitUntil:"networkidle"});
    await p.waitForSelector(".ui-fin"); await p.waitForTimeout(2600);
    await p.screenshot({path:`.screenshots/world/v2-${w}${rm?"-rm":""}.png`});
    if (!rm) await p.screenshot({path:`.screenshots/world/v2-${w}-full.png`, fullPage:true});
    const m=await p.evaluate(()=>({over:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      anims:document.getAnimations().filter(a=>a.playState==="running").length,
      nodes:document.querySelectorAll(".ui-world svg *").length}));
    console.log(w+(rm?" rm":""), JSON.stringify(m));
    await p.close(); await c.close();
  }
}
await b.close();
