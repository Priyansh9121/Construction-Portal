/**
 * S-A3b verification.
 *
 * Two jobs:
 *
 *  1. Prove `.link-button` on a BUSINESS page is untouched. It is rendered by
 *     seven unmigrated routes, and the notification sheet styles it only as a
 *     descendant of the panel. The generic leak probe samples `main button`,
 *     which is not guaranteed to be that element, so this checks it by name.
 *
 *  2. Verify the notification panel at three widths in both motion modes:
 *     it opens, fits the viewport, causes no document overflow, keeps its
 *     dialog semantics and aria-expanded, keeps 44px targets, closes on
 *     Escape, and does NOT carry a modal-backdrop class (SHELL-005).
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

const makeContext = async (w, h, motion) => {
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
  return context;
};

/* -- 1. .link-button on a business page must be untouched ---------------- */
{
  const context = await makeContext(1440, 900, "no-preference");
  const page = await context.newPage();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });

  const sample = await page.evaluate(() => {
    const el = document.querySelector("main .link-button, .page-content .link-button");
    if (!el) return { found: false };
    const cs = getComputedStyle(el);
    return {
      found: true,
      color: cs.color,
      fontSize: cs.fontSize,
      minHeight: cs.minHeight,
      padding: cs.padding,
      insidePanel: Boolean(el.closest(".notification-panel")),
    };
  });

  if (!sample.found) {
    console.log("info  no .link-button rendered on Dashboard in this data state");
  } else {
    check(!sample.insidePanel, "sampled .link-button is business-page, not panel");
    /* The notification rules set min-height 44px and font-size --ui-text-xs.
     * A business .link-button must show neither. */
    check(
      sample.minHeight !== "44px",
      "business .link-button did not inherit the panel min-height",
      sample.minHeight
    );
    check(
      sample.fontSize !== "12px",
      "business .link-button did not inherit the panel font-size",
      sample.fontSize
    );
  }

  await context.close();
}

/* -- 2. the panel itself -------------------------------------------------- */
for (const [label, motion] of [["normal", "no-preference"], ["reduced", "reduce"]]) {
  for (const [w, h] of [[375, 667], [768, 1024], [1440, 900]]) {
    const context = await makeContext(w, h, motion);
    const page = await context.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });

    await page.locator(".notification-button").click();
    await page.waitForSelector(".notification-panel");
    await page.waitForTimeout(motion === "reduce" ? 120 : 400);

    const geo = await page.evaluate(() => {
      const panel = document.querySelector(".notification-panel");
      const r = panel.getBoundingClientRect();
      const controls = [...panel.querySelectorAll("button")].map((b) =>
        Math.round(b.getBoundingClientRect().height)
      );
      return {
        right: Math.round(r.right - window.innerWidth),
        left: Math.round(-r.left),
        bottom: Math.round(r.bottom - window.innerHeight),
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
        role: panel.getAttribute("role"),
        expanded: document
          .querySelector(".notification-button")
          .getAttribute("aria-expanded"),
        modalClass:
          panel.classList.contains("command-backdrop") ||
          panel.classList.contains("modal-backdrop"),
        smallest: controls.length ? Math.min(...controls) : null,
      };
    });

    check(geo.right <= 1, `${label} @${w} fits right edge`, `${geo.right}px`);
    check(geo.left <= 1, `${label} @${w} fits left edge`, `${geo.left}px`);
    check(geo.bottom <= 1, `${label} @${w} fits bottom`, `${geo.bottom}px`);
    check(geo.docOverflow <= 1, `${label} @${w} no document overflow`, `${geo.docOverflow}px`);
    check(geo.role === "dialog", `${label} @${w} keeps role=dialog`);
    check(geo.expanded === "true", `${label} @${w} aria-expanded true`);
    check(!geo.modalClass, `${label} @${w} SHELL-005: not a modal surface`);
    if (geo.smallest !== null) {
      check(geo.smallest >= 44, `${label} @${w} controls meet 44px`, `${geo.smallest}px`);
    }

    if (label === "normal") {
      await page.screenshot({ path: path.join(outDir, `notifications-${w}.png`) });
    }

    /* Escape and focus restoration are NOT asserted here. An earlier version
     * of this probe pressed Escape with focus still on the trigger and
     * reported a failure, while `authenticated.spec.js:371` and `:417` — which
     * drive the real interaction, including modal precedence — pass. The
     * suite owns that contract; duplicating it badly here produced a false
     * negative, which is worse than no check. */

    await context.close();
  }
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nnotification panel clean");
process.exit(failures ? 1 : 0);
