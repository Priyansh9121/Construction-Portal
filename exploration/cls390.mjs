import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium, request } = require("@playwright/test");
const api = await request.newContext({ baseURL:"http://127.0.0.1:5051" });
const r = await api.post("/api/auth/login",{data:{email:"ui-redesign-e2e@local.test",password:"UnitTwoLocal!2026"}});
const {token,user}=await r.json(); await api.dispose();
const b=await chromium.launch();
const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true});
await c.addInitScript(([t,u])=>{localStorage.setItem("token",t);localStorage.setItem("user",u)},[token,JSON.stringify(user)]);
const p=await c.newPage();
await p.addInitScript(() => {
  window.__s = [];
  window.__cls = 0;
  const box = (r) => (r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null);
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__cls += e.value;
      const src = (e.sources || []).map((s) => {
        const n = s.node;
        if (!n) return { n: "?" };
        const cls = n.getAttribute ? n.getAttribute("class") || n.nodeName : n.nodeName;
        const par = n.parentElement && n.parentElement.getAttribute
          ? (n.parentElement.getAttribute("class") || "").slice(0, 26) : "";
        return { n: n.nodeName + "." + String(cls).slice(0, 30), par,
                 prev: box(s.previousRect), cur: box(s.currentRect) };
      });
      window.__s.push({ t: Math.round(e.startTime), v: +e.value.toFixed(5), src });
    }
  }).observe({ type: "layout-shift", buffered: true });
});

await p.goto("http://localhost:5173/dashboard",{waitUntil:"networkidle"});
await p.waitForSelector(".ui-fin"); await p.waitForTimeout(1200);
console.log("phase load :", await p.evaluate(()=>+window.__cls.toFixed(5)));
for(let i=0;i<10;i++){await p.mouse.wheel(0,200);await p.waitForTimeout(55);}
await p.waitForTimeout(400);
console.log("phase scroll:", await p.evaluate(()=>+window.__cls.toFixed(5)));
await p.locator(".ui-fin").scrollIntoViewIfNeeded();
for (const n of ["Today","This month","All time"]) { await p.getByRole("radio",{name:n}).click(); await p.waitForTimeout(750); }
console.log("phase morph :", await p.evaluate(()=>+window.__cls.toFixed(5)));
await p.getByRole("radio",{name:"This month"}).click(); await p.waitForTimeout(700);
const bb=await p.locator(".ui-fin__svg").boundingBox();
for(let i=0;i<20;i++){await p.mouse.move(bb.x+bb.width*(0.1+i*0.04), bb.y+bb.height/2);await p.waitForTimeout(24);}
await p.waitForTimeout(400);
console.log("phase inspect:", await p.evaluate(()=>+window.__cls.toFixed(5)));
const o=await p.evaluate(()=>({cls:+window.__cls.toFixed(5),s:window.__s}));
console.log("TOTAL", o.cls, "entries", o.s.length);
for (const e of o.s) { console.log(` t=${e.t} v=${e.v}`);
  for(const x of e.src.slice(0,3)) console.log(`    ${x.n} | par=${x.par}\n      prev=${JSON.stringify(x.prev)} cur=${JSON.stringify(x.cur)}`); }
await b.close();
