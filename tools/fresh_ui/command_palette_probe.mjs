/**
 * S-A3c verification.
 *
 * The check that matters most is the LAST one: SHELL-005 Escape precedence,
 * driven as a real interaction rather than inferred from class presence.
 * Open a dropdown, open the palette above it, press Escape once, and confirm
 * the palette closes while the dropdown survives.
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

const openPalette = async (page) => {
  await page.keyboard.press("Control+k");
  await page.waitForSelector(".command-modal", { timeout: 3000 });
};

/* -- geometry and behaviour across widths and motion modes ---------------- */
for (const [label, motion] of [["normal", "no-preference"], ["reduced", "reduce"]]) {
  for (const [w, h] of [[375, 667], [768, 1024], [1440, 900]]) {
    const context = await makeContext(w, h, motion);
    const page = await context.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await page.locator("body").click({ position: { x: 5, y: 5 } });

    await openPalette(page);
    /* 500ms in BOTH modes, deliberately. getBoundingClientRect returns the
     * TRANSFORMED box, and CommandPalette.jsx scales the modal from 0.94 over
     * 220ms through Framer Motion props that do NOT respect
     * prefers-reduced-motion (SHELL-012). Waiting only 120ms in reduced mode
     * measured mid-animation and reported rows as 43px when they are 44px. */
    await page.waitForTimeout(500);

    const geo = await page.evaluate(() => {
      const modal = document.querySelector(".command-modal");
      const backdrop = document.querySelector(".command-backdrop");
      const r = modal.getBoundingClientRect();
      const br = backdrop.getBoundingClientRect();
      const input = document.querySelector(".command-header input");
      const rows = [...document.querySelectorAll(".command-results button")];
      return {
        right: Math.round(r.right - window.innerWidth),
        left: Math.round(-r.left),
        bottom: Math.round(r.bottom - window.innerHeight),
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
        backdropCovers:
          Math.round(br.width) >= window.innerWidth &&
          Math.round(br.height) >= window.innerHeight,
        focusedIsInput: document.activeElement === input,
        inputFontSize: getComputedStyle(input).fontSize,
        rowCount: rows.length,
        smallestRow: rows.length
          ? Math.min(...rows.map((b) => Math.round(b.getBoundingClientRect().height)))
          : null,
      };
    });

    check(geo.right <= 1, `${label} @${w} fits right`, `${geo.right}px`);
    check(geo.left <= 1, `${label} @${w} fits left`, `${geo.left}px`);
    check(geo.bottom <= 1, `${label} @${w} fits bottom`, `${geo.bottom}px`);
    check(geo.docOverflow <= 1, `${label} @${w} no document overflow`, `${geo.docOverflow}px`);
    check(geo.backdropCovers, `${label} @${w} backdrop covers the viewport`);
    check(geo.focusedIsInput, `${label} @${w} initial focus is the input`);
    check(geo.inputFontSize === "16px", `${label} @${w} input is 16px (no iOS zoom)`, geo.inputFontSize);
    if (geo.smallestRow !== null) {
      check(geo.smallestRow >= 44, `${label} @${w} result rows meet 44px`, `${geo.smallestRow}px`);
    }

    if (label === "normal") {
      await page.screenshot({ path: path.join(outDir, `palette-${w}.png`) });

      /* Empty state. */
      await page.fill(".command-header input", "zzzznomatch");
      await page.waitForSelector(".command-empty");
      if (w === 1440) {
        await page.screenshot({ path: path.join(outDir, "palette-empty.png") });
      }
      await page.fill(".command-header input", "");
    }

    /* Escape closes and the palette goes away. */
    await page.keyboard.press("Escape");
    /* The exit animation is also a Framer prop and also ignores reduced
     * motion, so the element outlives a short wait in both modes. */
    await page.waitForTimeout(600);
    const gone = await page.evaluate(() => !document.querySelector(".command-modal"));
    check(gone, `${label} @${w} Escape closes the palette`);

    await context.close();
  }
}

/* -- SHELL-005: real Escape precedence ------------------------------------ */
{
  const context = await makeContext(1440, 900, "no-preference");
  const page = await context.newPage();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });

  // 1. Open a dropdown.
  await page.locator(".account-trigger").click();
  await page.waitForSelector(".account-panel");

  // 2. Open the palette above it.
  await openPalette(page);
  await page.waitForTimeout(400);

  const both = await page.evaluate(() => ({
    palette: Boolean(document.querySelector(".command-modal")),
    dropdown: Boolean(document.querySelector(".account-panel")),
    hook: Boolean(document.querySelector(".command-backdrop, .modal-backdrop")),
  }));
  check(both.palette && both.dropdown, "both surfaces open before Escape");
  check(both.hook, "SHELL-005 hook present while the palette is open");

  // 3. One Escape.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(350);

  const after = await page.evaluate(() => ({
    palette: Boolean(document.querySelector(".command-modal")),
    dropdown: Boolean(document.querySelector(".account-panel")),
  }));

  check(!after.palette, "one Escape closes the PALETTE");
  check(
    after.dropdown,
    "the underlying dropdown SURVIVES that Escape (SHELL-005 precedence)"
  );

  await context.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\ncommand palette clean");
process.exit(failures ? 1 : 0);
