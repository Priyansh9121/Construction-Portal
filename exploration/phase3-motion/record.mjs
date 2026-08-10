/*
 * Records each pass against the LIVE Dashboard.
 *
 * Static screenshots cannot review motion, so every run captures video plus a
 * frame ladder at fixed times, and measures the cost of the environment while
 * it is running: frames delivered, long tasks, layout shift, SVG node count.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire("/Users/priyanshranpura/construction-portal/frontend/package.json");
const { chromium, request } = require("@playwright/test");

const ROOT = "/Users/priyanshranpura/construction-portal";
const OUT = path.join(ROOT, ".recordings");
const worlds = JSON.parse(fs.readFileSync(path.join(ROOT, "exploration/phase3-motion/worlds.json"), "utf8"));
const worldSrc = fs.readFileSync(path.join(ROOT, "exploration/phase3-motion/world.js"), "utf8");
const passSrc = fs.readFileSync(path.join(ROOT, "exploration/phase3-motion/passes.js"), "utf8");

const api = await request.newContext({ baseURL: "http://127.0.0.1:5051" });
const login = await api.post("/api/auth/login", {
  data: { email: "ui-redesign-e2e@local.test", password: "UnitTwoLocal!2026" },
});
if (!login.ok()) { console.error("login failed"); process.exit(1); }
const { token, user } = await login.json();
await api.dispose();

const which = process.argv[2] || "pass1,pass2,pass3";
const only = process.argv[3] || "1440,390";
const browser = await chromium.launch();
const report = [];

for (const pass of which.split(",")) {
  for (const w of only.split(",").map(Number)) {
    for (const rm of [false, true]) {
      if (rm && w !== 1440) continue;
      const tag = `${pass}-${w}${rm ? "-rm" : ""}`;
      const dir = path.join(OUT, tag);
      fs.rmSync(dir, { recursive: true, force: true });
      const ctx = await browser.newContext({
        viewport: { width: w, height: w === 390 ? 844 : 900 },
        reducedMotion: rm ? "reduce" : "no-preference",
        recordVideo: { dir, size: { width: w, height: w === 390 ? 844 : 900 } },
      });
      await ctx.addInitScript(([t, u]) => {
        localStorage.setItem("token", t); localStorage.setItem("user", u);
      }, [token, JSON.stringify(user)]);
      const p = await ctx.newPage();
      await p.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
      await p.waitForSelector(".ui-horizon", { timeout: 15000 });

      // Inject the pass. The modules are evaluated in the page so the
      // prototype runs on the real DOM with no production edit.
      await p.evaluate(async ([wsrc, psrc, worldsJson, name]) => {
        const url = (s) => URL.createObjectURL(new Blob([s], { type: "text/javascript" }));
        const wmod = await import(url(wsrc));
        const pmod = await import(url(psrc.replace(/from\s+"\.\/world\.js"/g, "from '" + url(wsrc) + "'")));
        const pass = pmod.PASSES[name];
        const style = document.createElement("style");
        style.textContent = pass.css;
        document.head.appendChild(style);
        pass.mount(document.querySelector(".page-content") || document.body,
                   wmod.renderWorld, JSON.parse(worldsJson));
        // Restart CSS animations so t=0 is the moment of injection.
        document.getAnimations().forEach((a) => { try { a.currentTime = 0; } catch {} });
      }, [worldSrc, passSrc, JSON.stringify(worlds), pass]);

      // Instrument: frames delivered and long tasks over a 5s at-rest window.
      await p.evaluate(() => {
        window.__m = { frames: 0, long: 0, cls: 0 };
        const tick = () => { window.__m.frames++; requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
        new PerformanceObserver((l) => { window.__m.long += l.getEntries().length; })
          .observe({ entryTypes: ["longtask"] });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
      });

      fs.mkdirSync(path.join(dir, "frames"), { recursive: true });
      for (const t of [200, 900, 1800, 3000, 5000]) {
        await p.waitForTimeout(t === 200 ? 200 : t - (t === 900 ? 200 : t === 1800 ? 900 : t === 3000 ? 1800 : 3000));
        await p.screenshot({ path: path.join(dir, "frames", `t${t}.png`) });
      }

      const rest = await p.evaluate(() => ({ ...window.__m }));
      // Scroll pass, then a hover, then a second measurement under motion.
      await p.evaluate(() => { window.__m.frames = 0; window.__m.long = 0; });
      for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, 220); await p.waitForTimeout(60); }
      await p.screenshot({ path: path.join(dir, "frames", "scrolled.png") });
      const moving = await p.evaluate(() => ({ ...window.__m }));

      const cost = await p.evaluate(() => ({
        svg: document.querySelectorAll(".w-svg *").length,
        anims: document.getAnimations().filter((a) => a.playState === "running").length,
      }));

      report.push({ tag, restFps: +(rest.frames / 5).toFixed(1),
        moveFps: +(moving.frames / 0.9).toFixed(1), long: rest.long + moving.long,
        cls: +rest.cls.toFixed(4), svg: cost.svg, anims: cost.anims });
      console.log(JSON.stringify(report.at(-1)));
      await p.close(); await ctx.close();
    }
  }
}
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
await browser.close();
