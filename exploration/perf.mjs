import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium, request } = require("@playwright/test");
const api = await request.newContext({ baseURL:"http://127.0.0.1:5051" });
const r = await api.post("/api/auth/login",{data:{email:"ui-redesign-e2e@local.test",password:"UnitTwoLocal!2026"}});
const {token,user}=await r.json(); await api.dispose();
const b=await chromium.launch();
for (const [w,rm] of [[1440,0],[390,0],[1440,1],[390,1]]) {
  const c=await b.newContext({viewport:{width:w,height:w===390?844:900},reducedMotion:rm?"reduce":"no-preference",hasTouch:w===390});
  await c.addInitScript(([t,u])=>{localStorage.setItem("token",t);localStorage.setItem("user",u)},[token,JSON.stringify(user)]);
  const p=await c.newPage();
  await p.addInitScript(()=>{window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value}).observe({type:"layout-shift",buffered:true});});
  await p.goto("http://localhost:5173/dashboard",{waitUntil:"networkidle"});
  await p.waitForSelector(".ui-fin"); await p.waitForTimeout(2200);
  await p.evaluate(()=>{window.__m={f:0,long:0};const t=()=>{window.__m.f++;requestAnimationFrame(t)};requestAnimationFrame(t);
    new PerformanceObserver(l=>{window.__m.long+=l.getEntries().length}).observe({entryTypes:["longtask"]});});
  await p.waitForTimeout(4000);
  const rest=await p.evaluate(()=>({...window.__m}));
  await p.evaluate(()=>{window.__m.f=0}); let t0=Date.now();
  for(let i=0;i<12;i++){await p.mouse.wheel(0,200);await p.waitForTimeout(55);}
  const scroll=await p.evaluate(()=>({...window.__m})); const sfps=+(scroll.f/((Date.now()-t0)/1000)).toFixed(1);
  await p.locator(".ui-fin").scrollIntoViewIfNeeded();
  await p.evaluate(()=>{window.__m.f=0}); t0=Date.now();
  for (const n of ["Today","This month","All time"]) { await p.getByRole("radio",{name:n}).click(); await p.waitForTimeout(680); }
  const morph=await p.evaluate(()=>({...window.__m})); const mfps=+(morph.f/((Date.now()-t0)/1000)).toFixed(1);
  await p.getByRole("radio",{name:"This month"}).click(); await p.waitForTimeout(700);
  const bb=await p.locator(".ui-fin__svg").boundingBox();
  await p.evaluate(()=>{window.__m.f=0}); t0=Date.now();
  for(let i=0;i<20;i++){await p.mouse.move(bb.x+bb.width*(0.1+i*0.04), bb.y+bb.height/2);await p.waitForTimeout(24);}
  const insp=await p.evaluate(()=>({...window.__m})); const ifps=+(insp.f/((Date.now()-t0)/1000)).toFixed(1);
  const m=await p.evaluate(()=>({cls:+window.__cls.toFixed(4),
    over:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    svg:document.querySelectorAll("svg *").length, dom:document.querySelectorAll("*").length,
    anims:document.getAnimations().filter(a=>a.playState==="running").length}));
  console.log(`${w}${rm?" reduced":""}`, JSON.stringify({rest:+(rest.f/4).toFixed(1),scroll:sfps,morph:mfps,inspect:ifps,long:rest.long+morph.long+insp.long,...m}));
  await p.close(); await c.close();
}
await b.close();
