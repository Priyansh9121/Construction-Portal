import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { request } = require("@playwright/test");
const api = await request.newContext({ baseURL: "http://127.0.0.1:5051" });
const r = await api.post("/api/auth/login",{data:{email:"ui-redesign-e2e@local.test",password:"UnitTwoLocal!2026"}});
const { token } = await r.json();
const H = { Authorization: `Bearer ${token}` };
const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const list = await (await api.get("/api/payments",{headers:H})).json();
const rows = list.data || list.payments || list;
const already = (rows||[]).filter(p => (p.payment_date||"").slice(0,10) === today).length;
if (already) { console.log("today already has", already); process.exit(0); }
for (const [dir, amount] of [["income", 482000], ["expense", 196500]]) {
  const res = await api.post("/api/payments", { headers: H, data: {
    payment_date: today, payment_direction: dir, amount, description: "local dev seed",
  }});
  console.log(dir, res.status());
}
await api.dispose();
