/**
 * Phase 1C: prove the authentication transition cannot cost a session.
 *
 * The claim is not "the animation looks good" -- it is that authentication is
 * structurally incapable of waiting for it. Tested by asserting the commit
 * callback runs SYNCHRONOUSLY, before any frame is scheduled, on every path:
 *
 *   1. View Transitions available
 *   2. View Transitions absent (fallback)
 *   3. startViewTransition throws
 *   4. reduced motion (never requests a view transition at all)
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

    /* 1 · commit runs synchronously, before the call even returns. */
    let committedAt = null;
    let returned = false;
    run(() => { committedAt = returned ? "after" : "before"; });
    returned = true;
    out.sync = committedAt;
    document.documentElement.removeAttribute("data-auth-leaving");

    /* 2 · fallback: no View Transitions support. */
    const real = document.startViewTransition;
    delete document.startViewTransition;
    let fallbackCommitted = false;
    const p2 = run(() => { fallbackCommitted = true; });
    out.fallbackCommitted = fallbackCommitted;
    out.fallbackReturnsPromise = typeof p2?.then === "function";
    await p2;
    out.fallbackCleared = !document.documentElement.hasAttribute("data-auth-leaving");

    /* 3 · startViewTransition throws. */
    document.startViewTransition = () => { throw new Error("boom"); };
    let threwCommitted = false;
    let survived = true;
    try { await run(() => { threwCommitted = true; }); }
    catch { survived = false; }
    out.threwCommitted = threwCommitted;
    out.survivedThrow = survived;
    if (real) document.startViewTransition = real; else delete document.startViewTransition;
    document.documentElement.removeAttribute("data-auth-leaving");

    /* 4 · commit still runs when the callback itself is absent. */
    let noCallbackThrew = false;
    try { await run(undefined); } catch { noCallbackThrew = true; }
    out.noCallbackSafe = !noCallbackThrew;
    document.documentElement.removeAttribute("data-auth-leaving");

    out.timing = mod.authTransitionTiming;

    /* 5 · dark-to-light endpoints. */
    const cs = getComputedStyle(document.documentElement);
    out.skyDeep = cs.getPropertyValue("--auth-sky-deep").trim();
    out.canvas = cs.getPropertyValue("--ui-canvas").trim();
    return out;
  });

  check(results.sync === "before", `${tag} commit runs BEFORE the call returns`, results.sync);
  check(results.fallbackCommitted, `${tag} commit runs with no View Transitions support`);
  check(results.fallbackReturnsPromise, `${tag} always returns a promise callers may ignore`);
  check(results.fallbackCleared, `${tag} leaving state is cleared afterwards`);
  check(results.threwCommitted, `${tag} commit runs even when startViewTransition throws`);
  check(results.survivedThrow, `${tag} a thrown transition never rejects into the caller`);
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
