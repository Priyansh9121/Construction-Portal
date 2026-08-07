/**
 * Capture the authenticated shell at the required widths, both motion modes.
 *
 * Signs in as the admin fixture by seeding localStorage, so it exercises the
 * real shell without spending an auth request per page.
 *
 * Usage: node tools/fresh_ui/shell_screenshots.mjs [outDir]
 * Local dev server only.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium, request: playwrightRequest } = requireFromFrontend("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const API = process.env.E2E_API_URL || "http://127.0.0.1:5051";
const outDir = process.argv[2] || path.join(root, ".screenshots/shell");
fs.mkdirSync(outDir, { recursive: true });

const ROUTES = [
  ["dashboard", "/dashboard"],
  ["tenders", "/tenders"],
  ["payments", "/payments"],
];

const WIDTHS = process.env.ONLY_WIDTHS
  ? process.env.ONLY_WIDTHS.split(",").map((w) => [Number(w), 900])
  : [[320, 568], [375, 667], [390, 844], [414, 896], [768, 1024],
     [1024, 768], [1280, 800], [1440, 900], [1920, 1080]];

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
const problems = [];

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

  for (const [name, route] of ROUTES) {
    for (const [w, h] of WIDTHS) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(motion === "reduce" ? 150 : 500);

      const check = await page.evaluate(() => {
        const doc = document.documentElement;
        const small = [];
        for (const el of document.querySelectorAll(
          ".sidebar-link, .sidebar-close, .sidebar-toggle"
        )) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.height < 44) {
            small.push(`${el.className}:${Math.round(r.height)}`);
          }
        }
        return { overflow: doc.scrollWidth - window.innerWidth, small };
      });

      if (check.overflow > 1) {
        problems.push(`${name} ${label} @ ${w}: overflow ${check.overflow}px`);
      }
      if (check.small.length) {
        problems.push(`${name} ${label} @ ${w}: under 44px -> ${check.small.join(", ")}`);
      }

      if (name === "dashboard") {
        await page.screenshot({
          path: path.join(outDir, `shell-${w}-${label}.png`),
        });
      }
    }
  }

  await context.close();
}

await browser.close();
console.log(
  problems.length
    ? `PROBLEMS:\n  ${problems.join("\n  ")}`
    : "no shell overflow and no sub-44px shell targets at any width, either motion mode"
);
process.exit(problems.length ? 1 : 0);
