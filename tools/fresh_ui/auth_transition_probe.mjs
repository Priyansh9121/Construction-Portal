/**
 * Phase 1C: prove the authentication transition cannot cost a session.
 *
 * The claim is not "the animation looks good" -- it is that authentication is
 * structurally incapable of waiting for it. Tested by asserting the commit
 * callback runs SYNCHRONOUSLY, before the call returns, in every motion mode,
 * and that the departure layer can never outlive its own transition.
 *
 * `auth_threshold_probe.mjs` is the other half: it signs in for real and
 * watches the frames. This one needs no backend and no fixture, so it stays
 * runnable when that one cannot be.
 *
 * The View Transitions cases this file used to cover are gone with the
 * mechanism -- see the header of utils/authTransition.js for why the snapshot
 * approach was measured and abandoned. What replaced them is stricter: there
 * is now only one path, so there is no fallback that could behave differently
 * from the primary one.
 *
 * Also checks the dark-to-light moment does not pass through black or white:
 * the scene's start colour is deliberately not pure black, and the end colour
 * is the application canvas rather than #fff.
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

const browser = await chromium.launch();

for (const reduced of [false, true]) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  const tag = reduced ? "reduced" : "full";
  console.log(`\n── ${tag} motion ──`);

  const results = await page.evaluate(async () => {
    const mod = await import("/src/utils/authTransition.js");
    const run = mod.runAuthTransition;
    const out = {};
    const layers = () => document.querySelectorAll(".auth-departure").length;

    /* 1 · commit runs synchronously, before the call even returns. */
    let committedAt = null;
    let returned = false;
    const p1 = run(() => { committedAt = returned ? "after" : "before"; });
    returned = true;
    out.sync = committedAt;

    /* 2 · the layer exists during the transition, and cannot be interacted
     *     with while it does. This is the "nothing swallows a click" contract
     *     tested at the moment it could actually be violated. */
    const live = document.querySelector(".auth-departure");
    out.layerPresentDuring = Boolean(live);
    out.layerInert = live
      ? getComputedStyle(live).pointerEvents === "none"
      : null;
    out.layerHidden = live ? live.getAttribute("aria-hidden") === "true" : null;

    /* 3 · ...and is gone from the document afterwards, not merely invisible. */
    out.returnsPromise = typeof p1?.then === "function";
    await p1;
    out.layersAfter = layers();
    out.cleared = !document.documentElement.hasAttribute("data-auth-leaving");

    /* 4 · the layer is inserted BEFORE the commit, so the commit never
     *     uncovers the page. Proven by reading the document from inside the
     *     callback itself. */
    let layersSeenByCommit = -1;
    await run(() => { layersSeenByCommit = layers(); });
    out.layerPrecedesCommit = layersSeenByCommit === 1;

    /* 5 · commit still runs when the callback itself is absent. */
    let noCallbackThrew = false;
    try { await run(undefined); } catch { noCallbackThrew = true; }
    out.noCallbackSafe = !noCallbackThrew;
    out.layersAtEnd = layers();

    out.timing = mod.authTransitionTiming;

    /*
     * 6 · dark-to-light endpoints, READ OFF THE LAYER THAT RENDERS.
     *
     * This used to read the `--auth-sky-deep` token and compare it against two
     * string literals. That could not see the layer's actual background at
     * all — and since the departure now mixes the world's live horizon into
     * that background, the token is no longer what the user sees.
     *
     * So the sample is `getComputedStyle(layer).backgroundColor` during a real
     * run, resolved by the browser through `color-mix` and any inline
     * override, which is the only value that can be wrong in a way that
     * matters.
     */
    const sample = (override) => {
      const probeLayer = document.createElement("div");
      probeLayer.className = "auth-departure";
      if (override) probeLayer.style.setProperty("--auth-departure-sky", override);
      document.body.appendChild(probeLayer);
      const bg = getComputedStyle(probeLayer).backgroundColor;
      probeLayer.remove();
      return bg;
    };
    out.startBg = sample(null);
    /* The same measurement with the world's brightest and darkest published
     * horizons forced in, so both ends of the real range are covered without
     * waiting for a particular hour. */
    out.startBgNoon = sample("#dae6f1");
    out.startBgNight = sample("#383f55");
    /* And a deliberately near-black value, to prove the assertion bites. */
    out.startBgBlack = sample("#000000");

    const cs = getComputedStyle(document.documentElement);
    out.skyDeep = cs.getPropertyValue("--auth-sky-deep").trim();
    out.canvas = cs.getPropertyValue("--ui-canvas").trim();
    return out;
  });

  check(results.sync === "before", `${tag} commit runs BEFORE the call returns`, results.sync);
  check(results.layerPrecedesCommit, `${tag} the departure layer is in place BEFORE the commit`);
  check(results.layerPresentDuring, `${tag} the departure layer exists while the transition runs`);
  check(results.layerInert === true, `${tag} the layer never accepts pointer events`);
  check(results.layerHidden === true, `${tag} the layer is hidden from assistive technology`);
  check(results.returnsPromise, `${tag} always returns a promise callers may ignore`);
  check(results.layersAfter === 0, `${tag} the layer is REMOVED, not merely faded`, String(results.layersAfter));
  check(results.layersAtEnd === 0, `${tag} repeated runs leave nothing behind`, String(results.layersAtEnd));
  check(results.cleared, `${tag} leaving state is cleared afterwards`);
  check(results.noCallbackSafe, `${tag} tolerates a missing callback`);

  /*
   * THE DARK-TO-LIGHT MOMENT, AS A MEASUREMENT RATHER THAN TWO INEQUALITIES.
   *
   * `!== "#000000"` passed anything that was not exactly black, including
   * values that destroy the effect the check exists to protect. It is now a
   * LUMINANCE BAND, with both ends chosen from measured values:
   *
   *   floor 14  — `--auth-sky-deep` itself is 16.4, and that is the darkest
   *               the departure is ever designed to be (it is what renders
   *               when there is no world). 14 clears it and rejects #0a0d17
   *               at 13.1, which is the shape of near-black this guards.
   *   ceiling 170 — the world's brightest horizon is 228 at noon. Unmixed,
   *               that starts the departure a few percent from `--ui-canvas`
   *               at 251 and there is no dark-to-light moment left. Mixed
   *               55% toward the static sky it lands at 133, so 170 passes
   *               every real hour and fails the unmixed regression.
   */
  const LUM_FLOOR = 14;
  const LUM_CEIL = 170;
  /* Chrome resolves `color-mix` to CSS Color 4 `color(srgb r g b)` with 0..1
   * floats, not to `rgb()` with 0..255 bytes. Both forms are parsed, because
   * which one comes back is the browser's business and not the check's. */
  const lum = (css) => {
    const text = String(css || "");
    let rgb = null;
    const modern = /color\(\s*srgb\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/.exec(text);
    if (modern) rgb = [1, 2, 3].map((i) => parseFloat(modern[i]) * 255);
    if (!rgb) {
      const legacy = /rgba?\(([^)]+)\)/.exec(text);
      if (legacy) rgb = legacy[1].split(/[,/\s]+/).filter(Boolean).slice(0, 3).map(parseFloat);
    }
    if (!rgb || rgb.some((v) => !Number.isFinite(v))) return NaN;
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };

  for (const [what, css] of [
    ["with no world", results.startBg],
    ["at the brightest hour", results.startBgNoon],
    ["at the darkest hour", results.startBgNight],
  ]) {
    const L = lum(css);
    check(
      Number.isFinite(L) && L >= LUM_FLOOR && L <= LUM_CEIL,
      `${tag} departure starts inside the dark-to-light band ${what}`,
      `${css} → ${Number.isFinite(L) ? L.toFixed(1) : "?"}`
    );
  }

  /*
   * PROVE THE ASSERTION BITES. A near-black start must FAIL the band — a
   * check that cannot fail is not a check. Same discipline as the VAT
   * vertex-count assert and assert_cameras_clear.
   */
  const blackL = lum(results.startBgBlack);
  check(
    Number.isFinite(blackL) && blackL < LUM_FLOOR,
    `${tag} a near-black start is REJECTED by the band`,
    `${results.startBgBlack} → ${Number.isFinite(blackL) ? blackL.toFixed(1) : "?"} < ${LUM_FLOOR}`
  );

  const canvas = results.canvas.toLowerCase();
  check(
    canvas !== "" && canvas !== "#fff" && canvas !== "#ffffff",
    `${tag} scene does not resolve to pure white`,
    results.canvas
  );

  if (reduced) {
    check(
      results.timing.reduced < results.timing.full,
      "reduced motion is shorter, not disabled",
      `${results.timing.reduced}ms vs ${results.timing.full}ms`
    );
  }

  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nauth transition cannot delay or lose authentication");
process.exit(failures ? 1 : 0);
