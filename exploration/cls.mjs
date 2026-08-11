import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium, request } = require("@playwright/test");
const api = await request.newContext({ baseURL:"http://127.0.0.1:5051" });
const r = await api.post("/api/auth/login",{data:{email:"ui-redesign-e2e@local.test",password:"UnitTwoLocal!2026"}});
const {token,user}=await r.json(); await api.dispose();
const b=await chromium.launch();
const c=await b.newContext({viewport:{width:390,height:844}});
await c.addInitScript(([t,u])=>{localStorage.setItem("token",t);localStorage.setItem("user",u)},[token,JSON.stringify(user)]);
const p=await c.newPage();
await p.addInitScript(()=>{window.__s=[];window.__cls=0;
  new PerformanceObserver(l=>{for(const e of l.getEntries()){if(e.hadRecentInput)continue;window.__cls+=e.value;
    window.__s.push({t:Math.round(e.startTime),v:+e.value.toFixed(4),src:(e.sources||[]).map(s=>{
      const n=s.node; if(!n) return "?";
      const cls=n.getAttribute?.("class")||n.nodeName;
      return `${n.nodeName}.${String(cls).slice(0,34)} prev=${s.previousRect?[Math.round(s.previousRect.y),Math.round(s.previousRect.height)]:"-"} cur=${s.currentRect?[Math.round(s.currentRect.y),Math.round(s.currentRect.height)]:"-"}`;})});}}).observe({type:"layout-shift",buffered:true});});
await p.goto("http://localhost:5173/dashboard",{waitUntil:"networkidle"});
await p.waitForTimeout(3000);
const read = async (label) => console.log(label, await p.evaluate(()=>+window.__cls.toFixed(4)));
await read("after load   ");
for(let i=0;i<12;i++){await p.mouse.wheel(0,200);await p.waitForTimeout(55);}
await p.waitForTimeout(500); await read("after scroll ");
await p.locator(".ui-fin").scrollIntoViewIfNeeded();
for (const n of ["Today","This month","All time"]) { await p.getByRole("tab",{name:n}).click(); await p.waitForTimeout(700); }
await read("after morph  ");
const o=await p.evaluate(()=>({cls:+window.__cls.toFixed(4),s:window.__s}));
console.log("CLS",o.cls);
for (const e of o.s.slice(0,6)) { console.log(` t=${e.t} v=${e.v}`); for(const x of e.src.slice(0,2)) console.log("   ",x); }
await b.close();
