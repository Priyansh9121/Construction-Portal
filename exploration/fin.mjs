import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium, request } = require("@playwright/test");
const api = await request.newContext({ baseURL:"http://127.0.0.1:5051" });
const r = await api.post("/api/auth/login",{data:{email:"ui-redesign-e2e@local.test",password:"UnitTwoLocal!2026"}});
if(!r.ok()){console.error("login",r.status(),(await r.text()).slice(0,90));process.exit(1);}
const {token,user}=await r.json(); await api.dispose();
const b=await chromium.launch();
const widths=(process.argv[2]||"1440,390").split(",").map(Number);
const rms=(process.argv[3]||"0").split(",").map(Number);
for (const w of widths) for (const rm of rms) {
  const c=await b.newContext({viewport:{width:w,height:w===390?844:900},hasTouch:w===390,
    reducedMotion:rm?"reduce":"no-preference"});
  await c.addInitScript(([t,u])=>{localStorage.setItem("token",t);localStorage.setItem("user",u)},[token,JSON.stringify(user)]);
  const p=await c.newPage();
  await p.goto("http://localhost:5173/dashboard",{waitUntil:"networkidle"});
  await p.waitForSelector(".ui-fin"); await p.waitForTimeout(1200);
  await p.locator(".ui-fin").scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const tag=`${w}${rm?"-rm":""}`;
  for (const n of ["Today","This month","All time"]) {
    await p.getByRole("radio",{name:n}).click(); await p.waitForTimeout(1000);
    await p.locator(".ui-fin").screenshot({path:`.screenshots/chart/s-${tag}-${n.replace(/ /g,"")}.png`});
  }
  await p.getByRole("radio",{name:"This month"}).click(); await p.waitForTimeout(800);
  const bb=await p.locator(".ui-fin__svg").boundingBox();
  await p.mouse.move(bb.x+bb.width*0.5, bb.y+bb.height/2); await p.waitForTimeout(450);
  await p.locator(".ui-fin").screenshot({path:`.screenshots/chart/s-${tag}-inspect.png`});
  console.log(tag, JSON.stringify(await p.evaluate(()=>({
    nodes:document.querySelectorAll(".ui-fin svg *").length,
    over:document.documentElement.scrollWidth-document.documentElement.clientWidth}))));
  await p.close(); await c.close();
}
await b.close();
