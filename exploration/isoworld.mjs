import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium } = require("@playwright/test");
const CASES = {
  base: "",
  hideSvgLayers: ".auth-scene__layer{display:none!important}",
  hideBrand: ".auth-brand,.auth-scene__content{}",
  noBackdrop: ".auth-card{backdrop-filter:none!important}",
  smallCanvas: ".auth-world{width:50%!important;height:50%!important}",
};
const b = await chromium.launch();
for (const [name, css] of Object.entries(CASES)) {
  const c = await b.newContext({viewport:{width:1440,height:900}});
  const p = await c.newPage();
  if (css) await p.addInitScript((css)=>{const add=()=>{if(document.getElementById("__i"))return;
    const s=document.createElement("style");s.id="__i";s.textContent=css;(document.head||document.documentElement).appendChild(s);};
    document.addEventListener("DOMContentLoaded",add);const iv=setInterval(()=>{if(document.head){add();clearInterval(iv);}},4);}, css);
  await p.goto("http://localhost:5173/login",{waitUntil:"networkidle"});
  await p.waitForSelector('.auth-world[data-live="1"]',{timeout:15000}).catch(()=>{});
  await p.waitForTimeout(2000);
  await p.evaluate(()=>{window.__f=0;const t=()=>{window.__f++;requestAnimationFrame(t)};requestAnimationFrame(t)});
  const t0=Date.now(); await p.waitForTimeout(3500);
  const f=await p.evaluate(()=>window.__f);
  console.log(`${name.padEnd(15)} ${(f/((Date.now()-t0)/1000)).toFixed(1)}fps`);
  await p.close(); await c.close();
}
await b.close();
