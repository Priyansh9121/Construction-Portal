/**
 * Phase 1C: prove the script-safety rule rather than assert it.
 *
 * THE RULE
 *   Tracking belongs to chrome. It is never applied to content.
 *
 * Wide letter-spacing pulls Gujarati conjuncts apart -- the script composes
 * ligated clusters, and space inserted between their parts is a broken word,
 * not a wider one.
 *
 * `:lang(gu)` cannot be the guard on its own: the document declares lang="en"
 * and Gujarati arrives as inline data (site names, worker names, material
 * descriptions typed on site) with no lang attribute, and the backend that
 * would have to supply per-field language metadata is frozen.
 *
 * So this measures the two things that actually matter:
 *
 *   1. STRUCTURAL -- no element containing Gujarati carries non-zero tracking,
 *      and none is rendered in a monospace face (Plex Mono has no Gujarati
 *      coverage, so a fallback mid-line breaks the metrics).
 *
 *   2. RENDERED -- tracking measurably damages Gujarati, and the roles the
 *      system defines do not. Proven by comparing rendered width of the same
 *      string tracked vs untracked, so the harm is demonstrated rather than
 *      assumed.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = requireFromFrontend("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";

/* Real strings, not lorem: a site, a worker, a material, a status phrase. */
const GU = {
  site: "રિવરસાઇડ બીજો તબક્કો",
  worker: "રાજ પટેલ",
  material: "તૈયાર મિશ્રિત કોંક્રિટ",
  phrase: "આજે નોંધાયેલું",
};

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

const browser = await chromium.launch();

for (const width of [390, 768, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();

  /* Load the app so the real font stack and system CSS are active. */
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const res = await page.evaluate(async (GU) => {
    const host = document.createElement("div");
    host.setAttribute("data-probe", "gu");
    host.style.cssText = "position:fixed;left:-9999px;top:0;width:360px";
    document.body.appendChild(host);

    const mk = (cls, text, extra = "") => {
      const el = document.createElement("span");
      if (cls) el.className = cls;
      el.style.cssText = extra;
      el.textContent = text;
      host.appendChild(el);
      return el;
    };

    await document.fonts.ready;

    /* --- 1. does tracking actually damage Gujarati? ------------------- */
    const plain = mk("", GU.site, "letter-spacing:0");
    const tracked = mk("", GU.site, "letter-spacing:0.12em");
    const wPlain = plain.getBoundingClientRect().width;
    const wTracked = tracked.getBoundingClientRect().width;

    /* --- 2. do the system roles keep content untracked? --------------- */
    const roles = ["t-content", "t-body", "t-display", "t-section"].map((c) => {
      const el = mk(c, GU.site);
      const cs = getComputedStyle(el);
      return {
        role: c,
        tracking: cs.letterSpacing,
        family: cs.fontFamily,
        width: el.getBoundingClientRect().width,
      };
    });

    /* --- 3. the tracked chrome role, and its :lang(gu) reset ----------- */
    const label = mk("t-label", "CASH POSITION");
    const labelTracking = getComputedStyle(label).letterSpacing;

    const guLabelWrap = document.createElement("div");
    guLabelWrap.lang = "gu";
    host.appendChild(guLabelWrap);
    const guLabel = document.createElement("span");
    guLabel.className = "t-label";
    guLabel.textContent = GU.phrase;
    guLabelWrap.appendChild(guLabel);
    const guLabelTracking = getComputedStyle(guLabel).letterSpacing;

    /* --- 4. mono must never carry Gujarati ---------------------------- */
    const meta = mk("t-meta", "09 AUG 2026");
    const metaFamily = getComputedStyle(meta).fontFamily;

    /* --- 5. does the Gujarati face actually load? --------------------- */
    const guLoaded = document.fonts.check('12px "Noto Sans Gujarati"');

    const out = {
      wPlain: Math.round(wPlain * 10) / 10,
      wTracked: Math.round(wTracked * 10) / 10,
      roles,
      labelTracking,
      guLabelTracking,
      metaFamily,
      guLoaded,
    };
    host.remove();
    guLabelWrap.remove();
    return out;
  }, GU);

  console.log(`\n── ${width}px ──`);

  const damage = res.wTracked - res.wPlain;
  check(
    damage > 4,
    `${width} tracking measurably distorts Gujarati (so the rule is real)`,
    `${res.wPlain}px → ${res.wTracked}px  (+${Math.round(damage * 10) / 10}px)`
  );

  for (const r of res.roles) {
    const zero = r.tracking === "normal" || parseFloat(r.tracking) === 0;
    check(zero, `${width} ${r.role} leaves content untracked`, r.tracking);
    check(
      !/mono/i.test(r.family),
      `${width} ${r.role} is not monospace`,
      r.family.split(",")[0]
    );
  }

  check(
    parseFloat(res.labelTracking) > 0,
    `${width} chrome label IS tracked (the role still works)`,
    res.labelTracking
  );
  check(
    res.guLabelTracking === "normal" || parseFloat(res.guLabelTracking) === 0,
    `${width} lang="gu" resets chrome tracking (defence in depth)`,
    res.guLabelTracking
  );
  check(/mono/i.test(res.metaFamily), `${width} mechanical metadata is monospace`);
  check(res.guLoaded, `${width} Gujarati face is loaded and available`);

  await context.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nGujarati typography safe across all widths");
process.exit(failures ? 1 : 0);
