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
const errs=[]; p.on("console",m=>{if(m.type()==="error")errs.push(m.text().slice(0,110))});
p.on("pageerror",e=>errs.push("PAGEERROR "+String(e).slice(0,110)));
await p.goto("http://localhost:5173/dashboard",{waitUntil:"networkidle"});
await p.waitForSelector(".ui-fin"); await p.waitForTimeout(1200);
await p.locator(".ui-fin").scrollIntoViewIfNeeded();
await p.getByRole("radio",{name:"Today"}).click(); await p.waitForTimeout(1100);
await p.getByRole("radio",{name:"This month"}).click();
for (const ms of [100,220,340,480,650]) {
  await p.waitForTimeout(ms===100?100:120);
  await p.locator(".ui-fin__svg").screenshot({path:`/Users/priyanshranpura/construction-portal/.screenshots/chart/morph-t${ms}.png`});
}
await p.waitForTimeout(800);
const before = await p.evaluate(()=>document.querySelectorAll(".ui-fin svg *").length);
for (const n of ["Today","All time","This month","Today","All time","Today"]) {
  await p.getByRole("radio",{name:n}).click(); await p.waitForTimeout(70);
}
await p.waitForTimeout(1500);
const after = await p.evaluate(()=>({
  nodes:document.querySelectorAll(".ui-fin svg *").length,
  bays:document.querySelectorAll(".ui-fin__bay").length,
  leaving:document.querySelectorAll(".ui-fin__bay--leaving").length,
  readout:document.querySelector(".ui-fin__readout").innerText.replace(/\n/g," ").slice(0,64),
}));
await p.locator(".ui-fin").screenshot({path:"/Users/priyanshranpura/construction-portal/.screenshots/chart/morph-settled.png"});
console.log("beforeNodes",before,JSON.stringify(after));
console.log("errors:", errs.length? errs.slice(0,3): "none");
await b.close();
