/**
 * Verify the account menu panel, which only exists while open and so is
 * invisible to the route-level screenshot pass.
 *
 * Checks the things a stylesheet can break: the panel fits the viewport at the
 * narrowest width, its controls meet the target floor, and the disclosure
 * semantics and Escape-with-focus-return still hold. Escape precedence itself
 * is covered by authenticated.spec.js.
 *
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
const outDir = path.join(root, ".screenshots/shell");
fs.mkdirSync(outDir, { recursive: true });

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
  for (const [w, h] of [[375, 667], [1440, 900]]) {
    const context = await browser.newContext({
      viewport: { width: w, height: h },
      reducedMotion: motion,
    });
    await context.addInitScript(
      ([t, u]) => {
        localStorage.setItem("token", t);
        localStorage.setItem("user", u);
      },
      [token, JSON.stringify(user)]
    );
    const page = await context.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });

    const trigger = page.locator(".account-trigger");
    await trigger.click();
    await page.waitForSelector(".account-panel");
    await page.waitForTimeout(motion === "reduce" ? 120 : 400);

    const geo = await page.evaluate(() => {
      const panel = document.querySelector(".account-panel");
      const r = panel.getBoundingClientRect();
      const action = document.querySelector(".account-action");
      const ar = action.getBoundingClientRect();
      return {
        overflowRight: Math.round(r.right - window.innerWidth),
        overflowLeft: Math.round(-r.left),
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
        actionHeight: Math.round(ar.height),
        expanded: document
          .querySelector(".account-trigger")
          .getAttribute("aria-expanded"),
        role: panel.getAttribute("role"),
      };
    });

    check(geo.overflowRight <= 1, `${label} @${w} panel fits right edge`, `${geo.overflowRight}px`);
    check(geo.overflowLeft <= 1, `${label} @${w} panel fits left edge`, `${geo.overflowLeft}px`);
    check(geo.docOverflow <= 1, `${label} @${w} no document overflow`, `${geo.docOverflow}px`);
    check(geo.actionHeight >= 44, `${label} @${w} action meets 44px`, `${geo.actionHeight}px`);
    check(geo.expanded === "true", `${label} @${w} aria-expanded true while open`);
    check(geo.role === "menu", `${label} @${w} panel keeps role=menu`);

    if (label === "normal") {
      await page.screenshot({ path: path.join(outDir, `account-menu-${w}.png`) });
    }

    // Escape closes and focus returns to the trigger.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);
    const after = await page.evaluate(() => ({
      open: Boolean(document.querySelector(".account-panel")),
      focused: document.activeElement?.className || "",
      expanded: document
        .querySelector(".account-trigger")
        .getAttribute("aria-expanded"),
    }));
    check(!after.open, `${label} @${w} Escape closes the panel`);
    check(after.focused.includes("account-trigger"), `${label} @${w} focus returns to the trigger`);
    check(after.expanded === "false", `${label} @${w} aria-expanded false when closed`);

    await context.close();
  }
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\naccount menu clean");
process.exit(failures ? 1 : 0);
