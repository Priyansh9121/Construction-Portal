/**
 * Before/after screenshots for the S-D legacy shell teardown.
 *
 * Two things need looking at, and they fail differently:
 *
 *   ROUTES  — four representative unmigrated business pages at 390 and 1440.
 *             The risk here is descendant leakage: deleting shell CSS must not
 *             restyle page content. The leak probe measures that numerically;
 *             these make it visible.
 *
 *   SHELL   — the sidebar active state and the three overlays. The risk here
 *             is the opposite: a system surface that was quietly relying on a
 *             legacy declaration. SHELL-007, 008, 009 and 013 were all this.
 *
 * Usage: node tools/fresh_ui/shell_teardown_shots.mjs <outDir>
 *
 * Read-only. Signs in with the shared admin fixture and mutates nothing
 * (AUTH-018).
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

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: shell_teardown_shots.mjs <outDir>");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const ROUTES = [
  ["dashboard", "/dashboard"],
  ["tenders", "/tenders"],
  ["payments", "/payments"],
  ["site-operations", "/site-operations"],
];

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

const newPage = async (width) => {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(
    ([t, u]) => {
      localStorage.setItem("token", t);
      localStorage.setItem("user", u);
    },
    [token, JSON.stringify(user)]
  );
  return { context, page: await context.newPage() };
};

for (const [name, route] of ROUTES) {
  for (const width of [390, 1440]) {
    const { context, page } = await newPage(width);
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(outDir, `${name}-${width}.png`) });
    await context.close();
    console.log(`  ${name} @ ${width}`);
  }
}

/* Shell states, all at 1440 where the sidebar is permanent. */
const { context, page } = await newPage(1440);
await page.goto(`${BASE}/tenders`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);

/* Active route: /tenders is current, so the active item is not the first one
 * and any contamination shows against its neighbours. */
await page.screenshot({ path: path.join(outDir, "shell-active-route.png") });

await page.locator(".sidebar-link.active-link").focus();
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(outDir, "shell-active-focus.png") });
await page.keyboard.press("Escape");

await page.locator(".account-trigger").click();
await page.waitForSelector(".account-panel");
await page.waitForTimeout(450);
await page.screenshot({ path: path.join(outDir, "shell-account.png") });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

await page.locator(".notification-button").click();
await page.waitForSelector(".notification-panel");
await page.waitForTimeout(450);
await page.screenshot({ path: path.join(outDir, "shell-notifications.png") });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

await page.keyboard.press("Control+k");
await page.waitForSelector(".command-modal");
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(outDir, "shell-palette.png") });

await context.close();
await browser.close();
console.log(`\nwritten to ${outDir}`);
