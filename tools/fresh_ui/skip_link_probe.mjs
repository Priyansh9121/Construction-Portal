/**
 * S-A4c verification: the skip link.
 *
 * This control is only ever used by keyboard, so it is verified by keyboard.
 * The failure modes that matter are all invisible to a normal screenshot: it
 * is not the first stop, it does not become visible, it renders behind the
 * topbar it exists to skip, or its target does not exist.
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

    // Hidden before focus: off the top edge, but still in the document.
    const before = await page.evaluate(() => {
      const el = document.querySelector(".skip-link");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        bottom: r.bottom,
        display: cs.display,
        visibility: cs.visibility,
      };
    });
    check(Boolean(before), `${label} @${w} skip link exists`);
    if (!before) {
      await context.close();
      continue;
    }
    check(before.bottom <= 1, `${label} @${w} hidden off the top edge before focus`, `bottom ${Math.round(before.bottom)}px`);
    check(
      before.display !== "none" && before.visibility !== "hidden",
      `${label} @${w} stays in the accessibility tree while hidden`,
      `${before.display}/${before.visibility}`
    );

    // First Tab from the document must land on it.
    await page.keyboard.press("Tab");
    await page.waitForTimeout(motion === "reduce" ? 60 : 250);

    const focused = await page.evaluate(() => {
      const el = document.querySelector(".skip-link");
      const r = el.getBoundingClientRect();
      const active = document.activeElement;
      // What is painted at the link's own centre? If the topbar covers it,
      // this returns the topbar instead.
      const atCentre = document.elementFromPoint(
        Math.round(r.left + r.width / 2),
        Math.round(r.top + r.height / 2)
      );
      return {
        isFirstStop: active === el,
        top: Math.round(r.top),
        height: Math.round(r.height),
        onTop: atCentre === el || el.contains(atCentre),
        href: el.getAttribute("href"),
        targetExists: Boolean(document.querySelector("#main-content")),
      };
    });

    check(focused.isFirstStop, `${label} @${w} is the first tab stop`);
    check(focused.top >= 0, `${label} @${w} visible on focus`, `top ${focused.top}px`);
    check(focused.height >= 44, `${label} @${w} meets the 44px floor`, `${focused.height}px`);
    check(focused.onTop, `${label} @${w} paints above the topbar`);
    check(focused.href === "#main-content", `${label} @${w} href unchanged`, focused.href);
    check(focused.targetExists, `${label} @${w} #main-content target exists`);

    if (label === "normal" && w === 1440) {
      await page.screenshot({ path: path.join(outDir, "skip-link-focused.png") });
    }

    await context.close();
  }
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nskip link clean");
process.exit(failures ? 1 : 0);
