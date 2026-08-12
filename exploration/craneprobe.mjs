import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.launch({args:["--use-gl=angle","--enable-gpu","--ignore-gpu-blocklist"]});
const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto("http://localhost:5173/login",{waitUntil:"networkidle"});
await p.waitForSelector('.auth-world[data-live="1"]',{timeout:15000});
for (let i = 0; i < 12; i++) {
  await p.waitForTimeout(8000);
  const s = await p.evaluate(() => document.querySelector("canvas.auth-world")?.__probe || null);
  if (s) console.log(`${String(s.state).padEnd(10)} slew=${String(s.slew).padEnd(6)} trolley=${String(s.trolley).padEnd(6)} drop=${String(s.drop).padEnd(6)} swing=${String(s.swing).padEnd(8)} laden=${String(s.laden).padEnd(5)} hoist=${String(s.hoist).padEnd(6)} wind=${s.wind}`);
  else console.log("no probe");
}
await b.close();
