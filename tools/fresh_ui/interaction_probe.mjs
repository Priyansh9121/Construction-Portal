/**
 * Phase 1C: prove the interaction contract.
 *
 * The claims worth testing are not "it looks right" but:
 *
 *   1. FOCUS SURVIVES EVERY MATERIAL, including the dark auth scene, with no
 *      route-specific override. Tested by rendering the same control on
 *      canvas, raised, inset and dark, and asserting a visible ring each time.
 *   2. FOCUS IS NEVER CLIPPED. `outline` is used rather than `box-shadow`
 *      precisely because dense rows and attention cards use `overflow:hidden`.
 *   3. FOCUS IS NEVER ANIMATED. A keyboard user must not wait to see where
 *      they are.
 *   4. NO LAYOUT PROPERTY IS ANIMATED. Only colour and transform.
 *   5. TARGETS MEET THE FLOOR, and the field variant exceeds it.
 *   6. REDUCED MOTION IS AUTHORED, not disabled -- the press still registers.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const req = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = req("@playwright/test");
const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

const HARNESS = `
  <div id="probe" style="position:fixed;left:0;top:0;padding:20px">
    <div data-surface="canvas" style="background:var(--ui-canvas);padding:12px">
      <button class="ctl ctl--primary" id="c-canvas">Sign in</button></div>
    <div data-surface="raised" data-material="raised" style="padding:12px">
      <button class="ctl ctl--secondary" id="c-raised">Review</button></div>
    <div data-surface="inset" data-material="inset" style="padding:12px">
      <button class="ctl ctl--quiet" id="c-inset">Filter</button></div>
    <div data-scheme="dark" data-surface="dark" style="background:#0d1114;padding:12px">
      <button class="ctl ctl--primary" id="c-dark">Sign in</button></div>
    <div class="rows" style="overflow:hidden;background:var(--ui-surface)">
      <div><button class="ctl ctl--quiet" id="c-clip">Row action</button></div></div>
    <button class="ctl ctl--field ctl--primary" id="c-field">Submit update</button>
    <button class="ctl ctl--icon" id="c-icon">×</button>
    <input class="field" id="f-input" />
  </div>`;

const browser = await chromium.launch();

for (const reduced of [false, true]) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.evaluate((h) => { document.body.insertAdjacentHTML("beforeend", h); }, HARNESS);
  await page.waitForTimeout(150);

  const tag = reduced ? "reduced" : "full";
  console.log(`\n── ${tag} motion ──`);

  const ids = ["c-canvas", "c-raised", "c-inset", "c-dark", "c-clip"];
  for (const id of ids) {
    await page.focus(`#${id}`);
    const f = await page.evaluate((id) => {
      const el = document.getElementById(id);
      const cs = getComputedStyle(el);
      return {
        width: cs.outlineWidth,
        style: cs.outlineStyle,
        color: cs.outlineColor,
        offset: cs.outlineOffset,
        transition: cs.transitionProperty,
        transitionDur: cs.transitionDuration,
      };
    }, id);
    const visible = parseFloat(f.width) >= 2 && f.style !== "none";
    check(visible, `${tag} focus ring visible on ${id.replace("c-", "")}`, `${f.width} ${f.style}`);
  }

  /* Clipping: an inward offset inside overflow:hidden must keep the ring
   * within the element's own box. */
  const clip = await page.evaluate(() => {
    const el = document.getElementById("c-clip");
    el.focus();
    const off = parseFloat(getComputedStyle(el).outlineOffset);
    return { off };
  });
  check(clip.off <= 0, `${tag} focus turns inward inside a clipping row`, `offset ${clip.off}px`);

  /* Focus must never animate. */
  const noAnim = await page.evaluate(() => {
    const el = document.getElementById("c-canvas");
    el.focus();
    return getComputedStyle(el).transitionDuration;
  });
  check(/^0s(,\s*0s)*$/.test(noAnim.trim()) || noAnim.trim() === "0s",
    `${tag} focus is not animated`, noAnim);

  /* Only colour and transform may animate. */
  const props = await page.evaluate(() => {
    const el = document.getElementById("c-raised");
    return getComputedStyle(el).transitionProperty;
  });
  const banned = ["width", "height", "top", "left", "margin", "padding"];
  const bad = banned.filter((b) => new RegExp(`\\b${b}\\b`).test(props));
  check(bad.length === 0, `${tag} no layout property animates`, bad.join(", ") || props);

  /* Targets. */
  const sizes = await page.evaluate(() => {
    const g = (id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    };
    return { base: g("c-canvas"), field: g("c-field"), icon: g("c-icon"), input: g("f-input") };
  });
  check(sizes.base.h >= 44, `${tag} base control meets the 44px floor`, `${sizes.base.h}px`);
  check(sizes.field.h > sizes.base.h, `${tag} field variant exceeds it`, `${sizes.field.h}px`);
  check(sizes.icon.w === sizes.icon.h, `${tag} icon control is square`, `${sizes.icon.w}×${sizes.icon.h}`);
  check(sizes.input.h >= 44, `${tag} input meets the floor`, `${sizes.input.h}px`);

  if (reduced) {
    /* Authored, not disabled: the press must still register. */
    const active = await page.evaluate(() => {
      const s = [...document.styleSheets].flatMap((sh) => {
        try { return [...sh.cssRules]; } catch { return []; }
      });
      const txt = JSON.stringify(s.map((r) => r.cssText || ""));
      return /reduce/.test(txt) && /surface-sunken/.test(txt);
    });
    check(active, "reduced motion keeps a press affordance (ground, not travel)");
  }

  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\ninteraction contract holds");
process.exit(failures ? 1 : 0);
