import { createRequire } from "node:module";
const r = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium, request } = r("@playwright/test");
const api = await request.newContext({ baseURL: "http://127.0.0.1:5051" });
const l = await api.post("/api/auth/login", { data: { email: process.env.LOCAL_ADMIN_FIXTURE_EMAIL, password: process.env.LOCAL_ADMIN_FIXTURE_PASSWORD }});
const { token, user } = await l.json(); await api.dispose();
const b = await chromium.launch();
const LONG_EN = "Riverside Industrial Park Phase Two Structural Steelwork And Foundation Package";
const LONG_GU = "રિવરસાઇડ ઔદ્યોગિક ઉદ્યાન બીજા તબક્કાનું માળખાકીય સ્ટીલવર્ક અને પાયાનું પેકેજ";
let fail = 0;
for (const w of [320, 390, 768, 1440]) {
  const c = await b.newContext({ viewport: { width: w, height: 900 } });
  await c.addInitScript(([t,u])=>{localStorage.setItem("token",t);localStorage.setItem("user",u)},[token,JSON.stringify(user)]);
  const p = await c.newPage();
  await p.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  for (const [label, text] of [["latin", LONG_EN], ["gujarati", LONG_GU]]) {
    const res = await p.evaluate((t) => {
      const el = document.querySelector(".ui-pipe__item-title");
      if (!el) return { skip: true };
      el.textContent = t;
      const row = el.closest(".ui-pipe__row");
      const doc = document.documentElement;
      return {
        docOverflow: Math.max(0, doc.scrollWidth - doc.clientWidth),
        titleOverflow: Math.max(0, el.scrollWidth - el.clientWidth),
        rowRight: Math.round(row.getBoundingClientRect().right),
        viewport: window.innerWidth,
      };
    }, text);
    if (res.skip) { console.log(`skip ${w} ${label}: no pipeline row`); continue; }
    const ok = res.docOverflow === 0 && res.titleOverflow === 0 && res.rowRight <= res.viewport;
    if (!ok) fail++;
    console.log(`${ok ? "pass" : "FAIL"}  ${w} ${label}  docOverflow=${res.docOverflow} titleOverflow=${res.titleOverflow} rowRight=${res.rowRight}/${res.viewport}`);
  }
  await c.close();
}
await b.close();
console.log(fail ? `\n${fail} failure(s)` : "\nlong and mixed-script names wrap without overflow");
process.exit(fail ? 1 : 0);
