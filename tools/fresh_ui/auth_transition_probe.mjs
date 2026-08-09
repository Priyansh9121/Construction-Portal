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

    /* 6 · dark-to-light endpoints. */
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

  const sky = results.skyDeep.toLowerCase();
  check(
    sky !== "" && sky !== "#000" && sky !== "#000000",
    `${tag} scene does not start at pure black`,
    results.skyDeep
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
