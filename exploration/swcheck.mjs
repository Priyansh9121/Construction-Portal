import { createRequire } from "node:module";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium } = require("@playwright/test");
for (const [label, args] of [["no-gpu (as tests run)", []], ["gpu", ["--use-gl=angle","--enable-gpu","--ignore-gpu-blocklist"]]]) {
  const b = await chromium.launch({ args });
  const p = await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto("http://localhost:5173/register", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(4000);
  const r = await p.evaluate(() => {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl");
    const dbg = gl && gl.getExtension("WEBGL_debug_renderer_info");
    return {
      worldLive: !!document.querySelector('.auth-world[data-live="1"]'),
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "n/a",
    };
  });
  // Now time a realistic interaction: fill five fields.
  const t0 = Date.now();
  await p.fill("#register-full-name", "Probe").catch(()=>{});
  await p.fill("#register-email", "p@local.test").catch(()=>{});
  await p.fill("#register-company-name", "W").catch(()=>{});
  await p.fill("#register-password", "a-long-enough-passphrase").catch(()=>{});
  await p.fill("#register-confirm-password", "a-long-enough-passphrase").catch(()=>{});
  console.log(`${label.padEnd(22)} worldLive=${r.worldLive} fill5=${Date.now()-t0}ms renderer=${String(r.renderer).slice(0,44)}`);
  await b.close();
}
