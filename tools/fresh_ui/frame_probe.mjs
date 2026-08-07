/**
 * Frame geometry probe.
 *
 * The shell has two modes and the transition is the dangerous part: below
 * 1024px the sidebar is `position: fixed` and out of flow, at/above it the
 * sidebar becomes a sticky in-flow grid track. A frame that is correct at 768
 * and at 1440 can still be broken at 1024, so 1023/1024/1025 are measured
 * explicitly rather than inferred from the normal matrix.
 *
 * Measures geometry, never appearance. Descendant styling is the leak probe's
 * job.
 *
 * Local dev server only.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium, request: playwrightRequest } = requireFromFrontend("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const API = process.env.E2E_API_URL || "http://127.0.0.1:5051";

const WIDTHS = [375, 768, 1023, 1024, 1025, 1440];

const api = await playwrightRequest.newContext({ baseURL: API });
const login = await api.post("/api/auth/login", {
  data: {
    email: process.env.LOCAL_ADMIN_FIXTURE_EMAIL,
    password: process.env.LOCAL_ADMIN_FIXTURE_PASSWORD,
  },
});
if (!login.ok()) {
  console.error("admin fixture login failed");
  process.exit(1);
}
const { token, user } = await login.json();
await api.dispose();

const browser = await chromium.launch();
let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

for (const [label, motion] of [["normal", "no-preference"], ["reduced", "reduce"]]) {
  const context = await browser.newContext({ reducedMotion: motion });
  await context.addInitScript(
    ([t, u]) => {
      localStorage.setItem("token", t);
      localStorage.setItem("user", u);
    },
    [token, JSON.stringify(user)]
  );
  const page = await context.newPage();

  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    const g = await page.evaluate(() => {
      const rect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: Math.round(r.x),
          right: Math.round(r.right),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      };
      const sidebarEl = document.querySelector(".sidebar");
      return {
        layout: rect(".app-layout"),
        main: rect(".main-content"),
        page: rect(".page-content"),
        sidebar: rect(".sidebar"),
        topbar: rect(".topbar"),
        sidebarPosition: sidebarEl ? getComputedStyle(sidebarEl).position : null,
        toggleVisible: (() => {
          const t = document.querySelector(".sidebar-toggle");
          if (!t) return false;
          return getComputedStyle(t).display !== "none";
        })(),
        docOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        viewport: window.innerWidth,
      };
    });

    const desktop = w >= 1024;

    // Shell mode is coherent.
    check(
      g.sidebarPosition === (desktop ? "sticky" : "fixed"),
      `${label} @${w} sidebar mode`,
      g.sidebarPosition
    );
    check(
      g.toggleVisible === !desktop,
      `${label} @${w} toggle visibility matches mode`,
      String(g.toggleVisible)
    );

    // No document overflow in either mode.
    check(g.docOverflow <= 0, `${label} @${w} no document overflow`, `${g.docOverflow}px`);

    // Content must not sit under the sidebar, and must not be double-offset.
    if (desktop) {
      check(
        g.main.x === g.sidebar.right,
        `${label} @${w} main starts exactly where the sidebar ends (no gap, no double offset)`,
        `main.x ${g.main.x} vs sidebar.right ${g.sidebar.right}`
      );
      check(
        g.main.right === g.viewport,
        `${label} @${w} main reaches the viewport edge`,
        `${g.main.right} vs ${g.viewport}`
      );
    } else {
      check(
        g.main.x === 0,
        `${label} @${w} main starts at the viewport edge in drawer mode`,
        `${g.main.x}`
      );
      check(
        g.main.w === g.viewport,
        `${label} @${w} main spans the viewport in drawer mode`,
        `${g.main.w} vs ${g.viewport}`
      );
    }

    // The topbar belongs to the content column, not the whole frame.
    check(
      g.topbar.x === g.main.x && g.topbar.w === g.main.w,
      `${label} @${w} topbar aligns with the content column`,
      `topbar ${g.topbar.x}/${g.topbar.w} vs main ${g.main.x}/${g.main.w}`
    );
  }

  await context.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nframe geometry coherent at every width, both motion modes");
process.exit(failures ? 1 : 0);
