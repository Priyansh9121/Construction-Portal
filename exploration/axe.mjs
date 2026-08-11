import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium, request } = require("@playwright/test");
const axePath = require.resolve("axe-core");
const fs = require("fs");
const axeSrc = fs.readFileSync(axePath, "utf8");
const api = await request.newContext({ baseURL:"http://127.0.0.1:5051" });
const r = await api.post("/api/auth/login",{data:{email:"ui-redesign-e2e@local.test",password:"UnitTwoLocal!2026"}});
if(!r.ok()){console.error("login",r.status());process.exit(1);}
const {token,user}=await r.json(); await api.dispose();
const b=await chromium.launch();
for (const w of [1440, 390, 320]) {
  const c=await b.newContext({viewport:{width:w,height:900}});
  await c.addInitScript(([t,u])=>{localStorage.setItem("token",t);localStorage.setItem("user",u)},[token,JSON.stringify(user)]);
  const p=await c.newPage();
  await p.goto("http://localhost:5173/dashboard",{waitUntil:"networkidle"});
  await p.waitForSelector(".ui-fin"); await p.waitForTimeout(1500);
  const over = await p.evaluate(()=>{
    const de=document.documentElement;
    const diff=de.scrollWidth-de.clientWidth;
    let worst=null;
    if(diff>0){ for(const el of document.querySelectorAll("body *")){ const rr=el.getBoundingClientRect();
      if(rr.right>de.clientWidth+1&&rr.width>0){ const c=(el.getAttribute("class")||el.nodeName).slice(0,44);
        if(!worst||rr.right>worst.right) worst={cls:c,right:Math.round(rr.right),w:Math.round(rr.width)};}}}
    return {diff, worst};
  });
  await p.addScriptTag({ content: axeSrc });
  const res = await p.evaluate(async () => await window.axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa"] } }));
  console.log(`--- ${w} overflow=${over.diff}`, over.worst?JSON.stringify(over.worst):"");
  for (const v of res.violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.description.slice(0,70)}`);
    for (const n of v.nodes.slice(0,2)) console.log("      ", n.target.join(" ").slice(0,90));
  }
  if(!res.violations.length) console.log("  axe clean");
  await p.close(); await c.close();
}
await b.close();
