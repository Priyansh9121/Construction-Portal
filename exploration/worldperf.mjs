import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.launch();
for (const [w,h,tag,rm] of [[1440,900,"1440",0],[390,844,"390",0],[1440,900,"1440",1]]) {
  const c = await b.newContext({viewport:{width:w,height:h}, reducedMotion: rm?"reduce":"no-preference"});
  const p = await c.newPage();
  await p.goto("http://localhost:5173/login",{waitUntil:"networkidle"});
  await p.waitForSelector('.auth-world[data-live="1"]',{timeout:15000}).catch(()=>{});
  await p.waitForTimeout(2500);
  const probe = async (label, fn, secs) => {
    await p.evaluate(()=>{window.__f=0;window.__ft=[];let l=performance.now();
      const t=(n)=>{window.__f++;window.__ft.push(n-l);l=n;requestAnimationFrame(t)};requestAnimationFrame(t)});
    const t0=Date.now(); await fn();
    const r = await p.evaluate(()=>{const ft=window.__ft.slice(5).sort((a,b)=>a-b);
      return {f:window.__f, p95: ft[Math.floor(ft.length*0.95)]||0, p99: ft[Math.floor(ft.length*0.99)]||0};});
    return `${label} ${(r.f/((Date.now()-t0)/1000)).toFixed(1)}fps p95=${r.p95.toFixed(1)}ms p99=${r.p99.toFixed(1)}ms`;
  };
  const out = [];
  out.push(await probe("idle", ()=>p.waitForTimeout(4000)));
  if (!rm && w>400) {
    out.push(await probe("pointer", async()=>{for(let i=0;i<40;i++){await p.mouse.move(200+i*25, 300+Math.sin(i/5)*180);await p.waitForTimeout(25);}}));
    out.push(await probe("wheel", async()=>{const cv=await p.locator(".auth-world").boundingBox();
      for(let i=0;i<24;i++){await p.mouse.move(cv.x+cv.width*0.7, cv.y+cv.height*0.5);await p.mouse.wheel(0, i<12?120:-120);await p.waitForTimeout(40);}}));
  }
  const info = await p.evaluate(()=>({dom:document.querySelectorAll("*").length,
    heap: performance.memory? Math.round(performance.memory.usedJSHeapSize/1048576):null,
    over: document.documentElement.scrollWidth-document.documentElement.clientWidth}));
  console.log(`${tag}${rm?" reduced":""}: ${out.join(" | ")} | heap ${info.heap}MB overflow ${info.over}`);
  await p.close(); await c.close();
}
await b.close();
