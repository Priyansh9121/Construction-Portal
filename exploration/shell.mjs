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
await p.waitForSelector(".fab-button"); await p.waitForTimeout(1800);
await p.locator(".fab-button").screenshot({path:".screenshots/arrival/fab-closed.png"});
await p.locator(".fab-button").click(); await p.waitForTimeout(500);
await p.screenshot({path:".screenshots/arrival/fab-open.png", clip:{x:1100,y:560,width:340,height:340}});
const st=await p.evaluate(()=>({expanded:document.querySelector(".fab-button").getAttribute("aria-expanded"),
  label:document.querySelector(".fab-button").getAttribute("aria-label"),
  items:document.querySelectorAll(".fab-menu a").length}));
await p.locator(".fab-button").click(); await p.waitForTimeout(400);
await p.locator(".sidebar-link").first().hover(); await p.waitForTimeout(300);
await p.locator(".sidebar").screenshot({path:".screenshots/arrival/sidebar-hover.png"});
console.log(JSON.stringify(st));
await b.close();
