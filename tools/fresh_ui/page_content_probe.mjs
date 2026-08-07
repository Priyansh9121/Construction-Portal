/**
 * Page-content gutter and width evidence.
 *
 * S-A4b has to decide two consequential things about `.page-content`, which
 * wraps every business page:
 *
 *   1. Should the shell keep a universal max-width? The legacy sheets set one
 *      (`--v2-content-max` with `margin-inline: auto`). The brief says not to
 *      preserve that automatically, because a financial table and the worker
 *      portal do not want the same content width.
 *
 *   2. What should the shell gutter be? Adding one on top of a route that
 *      already pads itself produces a visible double frame.
 *
 * Neither can be answered by taste, so this measures. For each route and
 * width it reports the shell gutter, whether the max-width is actually
 * BINDING (content narrower than its track) or inert, and the route's own
 * outer padding, so double-gutters are detectable as a number rather than an
 * impression.
 *
 * Reports evidence. Asserts nothing, changes nothing.
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

const ROUTES = [
  ["dashboard", "/dashboard"],
  ["tenders", "/tenders"],
  ["payments", "/payments"],
  ["users", "/users"],
  ["site-operations", "/site-operations"],
];

const WIDTHS = [390, 768, 1024, 1440, 1920];

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
const context = await browser.newContext();
await context.addInitScript(
  ([t, u]) => {
    localStorage.setItem("token", t);
    localStorage.setItem("user", u);
  },
  [token, JSON.stringify(user)]
);
const page = await context.newPage();

console.log("PAGE CONTENT GUTTER AND WIDTH EVIDENCE\n");
console.log("maxW binding = the max-width actually constrains content (border box < track)");
console.log("childPad     = the route's own first wrapper inline padding, on top of the shell gutter\n");

const header = `${"route".padEnd(17)}${"vw".padEnd(6)}${"track".padEnd(7)}${"pad".padEnd(6)}${"content".padEnd(9)}${"maxW".padEnd(10)}${"binding".padEnd(9)}${"childPad".padEnd(10)}overflow`;
console.log(header);
console.log("-".repeat(header.length));

for (const [name, route] of ROUTES) {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(350);

    const m = await page.evaluate(() => {
      const pc = document.querySelector(".page-content");
      const mc = document.querySelector(".main-content");
      if (!pc || !mc) return null;

      const cs = getComputedStyle(pc);
      const pcRect = pc.getBoundingClientRect();
      const mcRect = mc.getBoundingClientRect();

      const padL = parseFloat(cs.paddingLeft);
      const padR = parseFloat(cs.paddingRight);
      const maxW = cs.maxWidth;

      // Is the max-width actually doing anything, or is the track narrower?
      const binding =
        maxW !== "none" && pcRect.width < mcRect.width - 0.5;

      // The route's own outermost wrapper, if it pads itself as well.
      const firstChild = [...pc.children].find(
        (el) => el.getBoundingClientRect().width > 0
      );
      const childPad = firstChild
        ? Math.round(parseFloat(getComputedStyle(firstChild).paddingLeft))
        : null;

      return {
        track: Math.round(mcRect.width),
        pad: Math.round(padL) === Math.round(padR) ? Math.round(padL) : `${Math.round(padL)}/${Math.round(padR)}`,
        content: Math.round(pcRect.width - padL - padR),
        maxW,
        binding,
        childPad,
        overflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      };
    });

    if (!m) {
      console.log(`${name.padEnd(17)}${String(w).padEnd(6)}(page-content absent)`);
      continue;
    }

    console.log(
      name.padEnd(17) +
        String(w).padEnd(6) +
        String(m.track).padEnd(7) +
        String(m.pad).padEnd(6) +
        String(m.content).padEnd(9) +
        String(m.maxW).padEnd(10) +
        String(m.binding).padEnd(9) +
        String(m.childPad ?? "-").padEnd(10) +
        String(m.overflow)
    );
  }
  console.log("");
}

await browser.close();
console.log("Evidence only. No assertions, no changes.");
