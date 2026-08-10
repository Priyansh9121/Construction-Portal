import { createRequire } from "node:module";
import fs from "node:fs"; import path from "node:path";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium, request } = require("@playwright/test");
const ROOT="/Users/priyanshranpura/construction-portal";
const src = fs.readFileSync(path.join(ROOT,"exploration/phase3-chart/concepts.js"),"utf8");
const api = await request.newContext({ baseURL:"http://127.0.0.1:5051" });
const r = await api.post("/api/auth/login",{data:{email:"ui-redesign-e2e@local.test",password:"UnitTwoLocal!2026"}});
const {token,user}=await r.json(); await api.dispose();
const b=await chromium.launch();
for (const w of [1440,390]) {
  const c=await b.newContext({viewport:{width:w,height:w===390?844:900}});
  await c.addInitScript(([t,u])=>{localStorage.setItem("token",t);localStorage.setItem("user",u)},[token,JSON.stringify(user)]);
  const p=await c.newPage();
  await p.goto("http://localhost:5173/dashboard",{waitUntil:"networkidle"});
  await p.waitForSelector(".ui-chart"); await p.waitForTimeout(1500);
  const out = await p.evaluate(async ([code, W]) => {
    const G = await import("/src/components/finance/financeGeometry.js");
    const url = URL.createObjectURL(new Blob([code],{type:"text/javascript"}));
    const M = await import(url);
    const st=document.createElement("style"); st.textContent=M.CSS; document.head.appendChild(st);
    const res = await fetch("http://127.0.0.1:5051/api/payments",{headers:{Authorization:"Bearer "+localStorage.getItem("token")}});
    const body = await res.json();
    const rows = body.data || body.payments || body;
    const host = document.querySelector(".ui-chart");
    const width = host.getBoundingClientRect().width;
    const H = W===390 ? 260 : 300;
    const box = { x: W===390?46:56, y: 24, w: width - (W===390?120:190), h: H-70 };
    const states = {
      today: G.observe(rows,"today"), month: G.observe(rows,"month"), all: G.observe(rows,"all"),
    };
    window.__G=G; window.__M=M; window.__rows=rows; window.__box=box; window.__W=width; window.__H=H;
    host.innerHTML = `<div class="ui-chart__head"><h2 class="ui-chart__title">Month by month</h2>
      <p class="ui-chart__scope">Income, expenses and profit</p></div>` +
      ["A","B","C"].map(k=>`<div style="margin-block-end:28px">
        <div class="ui-chart__scope" style="margin-block-end:6px">CONCEPT ${k} · today / month / all</div>
        ${["today","month","all"].map(s=>`<div class="fx" data-c="${k}" data-s="${s}">${M.CONCEPTS[k](G,states[s],box,width,H)}</div>`).join("")}
      </div>`).join("");
    return { width, counts: Object.fromEntries(Object.entries(states).map(([k,v])=>[k,v.length])),
             nodes: document.querySelectorAll(".fx svg *").length };
  }, [src, w]);
  console.log(w, JSON.stringify(out));
  await p.screenshot({path:`${ROOT}/.screenshots/chart/concepts-${w}.png`, fullPage:true});
  await p.close(); await c.close();
}
await b.close();
