import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium, request } = require("@playwright/test");
const api = await request.newContext({ baseURL:"http://127.0.0.1:5051" });
const r = await api.post("/api/auth/login",{data:{email:"ui-redesign-e2e@local.test",password:"UnitTwoLocal!2026"}});
const {token,user}=await r.json(); await api.dispose();
const CASES = {
  base: "",
  noRoom: ".ui-world--room{display:none!important}",
  noBandBlend: ".w-bay{mix-blend-mode:normal!important}",
  noLight: ".ui-world__light{display:none!important}",
  noBandPlant: ".w-plant{display:none!important}",
  noVectorEffect: ".w-f{vector-effect:none!important}",
  noFaceStroke: ".w-f{stroke:none!important}",
  noHas: ".ui-fin__bays:has(.ui-fin__bay[data-active]) .ui-fin__bay:not([data-active]){opacity:1!important}",
  noWillChange: ".ui-world__plane{will-change:auto!important}",
  noRoomAndHas: ".ui-world--room{display:none!important}.ui-fin__bays:has(.ui-fin__bay[data-active]) .ui-fin__bay:not([data-active]){opacity:1!important}",
};
const b=await chromium.launch();
for (const [name, css] of Object.entries(CASES)) {
  const c=await b.newContext({viewport:{width:1440,height:900}});
  await c.addInitScript(([t,u])=>{localStorage.setItem("token",t);localStorage.setItem("user",u)},[token,JSON.stringify(user)]);
  await c.addInitScript((css)=>{const add=()=>{if(!css||document.getElementById("__iso"))return;
    const s=document.createElement("style");s.id="__iso";s.textContent=css;
    (document.head||document.documentElement).appendChild(s);};
    document.addEventListener("DOMContentLoaded",add);const iv=setInterval(()=>{if(document.head){add();clearInterval(iv);}},4);}, css);
  const p=await c.newPage();
  await p.goto("http://localhost:5173/dashboard",{waitUntil:"networkidle"});
  await p.waitForSelector(".ui-fin"); await p.waitForTimeout(1800);
  await p.locator(".ui-fin").scrollIntoViewIfNeeded();
  await p.evaluate(()=>{window.__f=0;const t=()=>{window.__f++;requestAnimationFrame(t)};requestAnimationFrame(t)});
  const bb=await p.locator(".ui-fin__svg").boundingBox();
  const t0=Date.now();
  for(let i=0;i<24;i++){await p.mouse.move(bb.x+bb.width*(0.1+i*0.033), bb.y+bb.height/2);await p.waitForTimeout(22);}
  const f=await p.evaluate(()=>window.__f);
  const applied = css ? await p.evaluate(()=>!!document.getElementById("__iso")) : true;
  console.log(`${name.padEnd(13)} inspectFps=${(f/((Date.now()-t0)/1000)).toFixed(1)} applied=${applied}`);
  await p.close(); await c.close();
}
await b.close();
