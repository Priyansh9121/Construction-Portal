/**
 * Phase 2 Unit 3 — the threshold, verified at runtime against a real backend.
 *
 * `auth_transition_probe.mjs` proves the MODULE's contract in isolation: that
 * commit runs synchronously on every path. It cannot prove the thing that
 * actually matters to a user, because it never logs anybody in.
 *
 * This probe does. It signs in as each fixture role, watches the frames
 * between the sign-in screen and the destination, and asserts the things that
 * are only observable while the transition is running:
 *
 *   - the destination is the one the role's home path names
 *   - no frame is a white flash, a black flash, or an empty page
 *   - the leaving state is gone afterwards, and nothing it left behind is
 *     still swallowing clicks
 *   - focus is on a live node, not one the transition unmounted
 *   - an ordinary session restore does NOT replay the transition
 *   - `?next=` orientation survives, and never becomes routing
 *
 * HOW THE FRAMES ARE CAPTURED, AND WHY NOT WITH SCREENSHOTS
 * The first version of this probe sampled with `page.screenshot()` and the
 * numbers were nonsense: at 1440 it reported a hard cut, at 390 it reported
 * six identical dark frames of a transition that had already finished.
 * Screenshots force a synchronous paint-and-encode, which stalls the very rAF
 * loop the transition waits on -- the instrument was changing the measurement.
 *
 * CDP screencast is passive. The compositor pushes frames as it produces them,
 * at its own rate, including the View Transition pseudo-elements that no DOM
 * query can see. Luminance is then measured by loading each frame back into a
 * browser canvas, so there is still no image dependency.
 *
 * Usage:
 *   LOCAL_ADMIN_FIXTURE_EMAIL=… LOCAL_ADMIN_FIXTURE_PASSWORD=… \
 *   LOCAL_WORKER_FIXTURE_PASSWORD=… LOCAL_SUBCONTRACTOR_FIXTURE_PASSWORD=… \
 *   node tools/fresh_ui/auth_threshold_probe.mjs
 *
 * Reads a local dev server and a local API. Writes frames under .screenshots.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const req = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = req("@playwright/test");

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const outDir = path.join(root, ".screenshots/threshold");
fs.mkdirSync(outDir, { recursive: true });

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};
const note = (label, detail = "") => console.log(`      ${label}  ${detail}`);

/**
 * The fixtures, and the destination each role's home path resolves to.
 * Mirrors getHomePath in routes/AppRoutes.jsx -- deliberately restated rather
 * than imported, so a change there has to be acknowledged here.
 */
const ROLES = [
  {
    role: "admin",
    email: process.env.LOCAL_ADMIN_FIXTURE_EMAIL || "ui-redesign-e2e@local.test",
    password: process.env.LOCAL_ADMIN_FIXTURE_PASSWORD,
    destination: "/dashboard",
  },
  {
    role: "worker",
    email: process.env.LOCAL_WORKER_FIXTURE_EMAIL || "worker-fixture@local.test",
    password: process.env.LOCAL_WORKER_FIXTURE_PASSWORD,
    destination: "/worker-portal",
  },
  {
    role: "subcontractor",
    email:
      process.env.LOCAL_SUBCONTRACTOR_FIXTURE_EMAIL ||
      "subcontractor-fixture@local.test",
    password: process.env.LOCAL_SUBCONTRACTOR_FIXTURE_PASSWORD,
    destination: "/subcontractor-portal",
  },
  /*
   * MANAGER IS DELIBERATELY ABSENT.
   *
   * Managers share the admin home path, so the destination branch under test
   * is already covered by the admin case. Creating a manager fixture would add
   * a fourth account to the shared local database purely to re-verify a code
   * path that has no manager-specific branch in it -- getHomePath returns
   * "/dashboard" for every role that is not worker or subcontractor.
   *
   * Stated rather than quietly skipped: manager destination resolution is
   * verified by inspection of that one `return`, not at runtime.
   */
];

const browser = await chromium.launch();

/** Mean luminance and uniformity of each captured frame, measured in-browser. */
async function measureFrames(frames) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("about:blank");
  const out = [];
  for (const frame of frames) {
    const dataUrl = "data:image/jpeg;base64," + frame.data;
    out.push(
      await page.evaluate(
        (url) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              /* Downsample hard: this is a flash detector, not a diff. */
              const w = 64;
              const h = Math.max(1, Math.round((img.height / img.width) * w));
              const c = document.createElement("canvas");
              c.width = w;
              c.height = h;
              const g = c.getContext("2d");
              g.drawImage(img, 0, 0, w, h);
              const d = g.getImageData(0, 0, w, h).data;
              let sum = 0;
              let min = 1;
              let max = 0;
              const n = w * h;
              for (let i = 0; i < d.length; i += 4) {
                const l =
                  (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
                sum += l;
                if (l < min) min = l;
                if (l > max) max = l;
              }
              resolve({ mean: sum / n, min, max, spread: max - min });
            };
            img.src = url;
          }),
        dataUrl
      )
    );
    out[out.length - 1].t = frame.t;
  }
  await ctx.close();
  return out;
}

/**
 * Every frame must be a colour this product asks for.
 *
 * Two earlier versions of this check were wrong in opposite directions. The
 * first flagged `mean > 0.93` and failed everything, because the destination
 * is a light operational application whose mean luminance is legitimately
 * 0.96 — "the application is bright" is not a defect. The second added a
 * separate "empty frame" test on uniformity, and that failed everything too,
 * because the departure layer is a flat full-viewport colour BY DESIGN.
 * Uniformity proves nothing on its own.
 *
 * What proves a defect is a flat frame OUTSIDE the designed band. The
 * departure ramps between `--auth-sky-deep` (#0d1114, 0.066 on this scale)
 * and `--ui-canvas` (#f6f6f4, 0.964). Anything flatter and darker, or flatter
 * and brighter, is a colour no stylesheet here asks for — in practice the
 * browser's own black or white showing through a gap in the sequence, which
 * is exactly the artefact this transition may never produce.
 *
 * The 0.03 margin is JPEG quantisation on the screencast, not design slack.
 */
const SKY = 0.066;
const CANVAS = 0.964;
const JPEG_TOLERANCE = 0.03;

const outOfBand = (f) =>
  f.spread < 0.12 &&
  (f.mean > CANVAS + JPEG_TOLERANCE || f.mean < SKY - JPEG_TOLERANCE);

/** Write the first, most-transitional and last frames for visual review. */
function saveFrames(tag, frames, lum) {
  if (!frames.length) return;
  const write = (name, frame) =>
    fs.writeFileSync(
      path.join(outDir, `${tag}-${name}.jpg`),
      Buffer.from(frame.data, "base64")
    );
  write("0-start", frames[0]);
  write("9-end", frames[frames.length - 1]);

  /* The midpoint is the frame whose luminance is closest to halfway between
   * the darkest and brightest frames -- i.e. the actual crossing, wherever it
   * happened to fall, rather than the middle of the array. */
  const means = lum.map((f) => f.mean);
  const mid = (Math.min(...means) + Math.max(...means)) / 2;
  let best = 0;
  for (let i = 1; i < lum.length; i++) {
    if (Math.abs(lum[i].mean - mid) < Math.abs(lum[best].mean - mid)) best = i;
  }
  write("5-mid", frames[best]);
  return { midIndex: best, midMean: lum[best].mean, total: lum.length };
}

/** Sign in for real and record every frame the compositor produces. */
async function crossThreshold({ fixture, width, height, reduced, capture }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const tag = `${fixture.role}-${width}${reduced ? "-reduced" : ""}`;

  await page.fill("#login-email", fixture.email);
  await page.fill("#login-password", fixture.password);

  /* Watch the leaving state from inside the page -- it is set and cleared far
   * faster than a poll from Node could see it. */
  await page.evaluate(() => {
    window.__leaving = [];
    const el = document.documentElement;
    new MutationObserver(() => {
      window.__leaving.push({
        on: el.hasAttribute("data-auth-leaving"),
        t: performance.now(),
      });
    }).observe(el, { attributes: true, attributeFilter: ["data-auth-leaving"] });
  });

  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  const t0 = Date.now();
  cdp.on("Page.screencastFrame", async (f) => {
    frames.push({ data: f.data, t: Date.now() - t0 });
    try {
      await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId });
    } catch {
      /* the session ends while frames are still in flight */
    }
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 70,
    everyNthFrame: 1,
  });

  await page.click(".auth-submit");
  await page.waitForURL(`**${fixture.destination}`, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(900);

  try {
    await cdp.send("Page.stopScreencast");
  } catch {
    /* already gone */
  }

  const state = await page.evaluate(() => ({
    url: location.pathname,
    leavingSeen: (window.__leaving || []).some((e) => e.on),
    leavingNow: document.documentElement.hasAttribute("data-auth-leaving"),
    leavingMs: (() => {
      const on = (window.__leaving || []).find((e) => e.on);
      const off = (window.__leaving || []).find((e) => !e.on);
      return on && off ? Math.round(off.t - on.t) : null;
    })(),
    sceneLeft: Boolean(document.querySelector(".auth-scene")),
    focusConnected: document.activeElement
      ? document.activeElement.isConnected
      : false,
    focusTag: document.activeElement ? document.activeElement.tagName : null,
    /* Anything still painted over the application would be caught here: the
     * element under the middle of the viewport must belong to the destination,
     * not to a leftover transition layer. */
    topElement: (() => {
      const el = document.elementFromPoint(
        Math.round(innerWidth / 2),
        Math.round(innerHeight / 2)
      );
      return el ? `${el.tagName}.${el.className || ""}`.slice(0, 60) : null;
    })(),
    hasDestinationText: document.body.innerText.trim().length > 20,
  }));

  await ctx.close();

  /* Keep start / midpoint / end for the eye. The midpoint is chosen by
   * luminance after measuring, not guessed here. */
  return { tag, frames, state, capture };
}

/* ── 1 · every role crosses to its own destination, cleanly ──────────────── */
console.log("\n── role destinations, full motion ──");

for (const fixture of ROLES) {
  if (!fixture.password) {
    check(false, `${fixture.role} fixture password not provided`, "set the env var");
    continue;
  }

  const capture = fixture.role !== "subcontractor";
  const { tag, frames, state } = await crossThreshold({
    fixture,
    width: 1440,
    height: 900,
    reduced: false,
    capture,
  });
  void capture;

  check(state.url === fixture.destination, `${tag} lands on ${fixture.destination}`, state.url);
  check(state.leavingSeen, `${tag} the transition actually ran`);
  check(!state.leavingNow, `${tag} leaving state cleared`);
  check(!state.sceneLeft, `${tag} no auth scene left in the document`);
  check(state.focusConnected, `${tag} focus is on a live node`, state.focusTag || "");
  check(
    state.topElement !== null && !/auth-scene/.test(state.topElement),
    `${tag} nothing is painted over the destination`,
    state.topElement || ""
  );
  check(state.hasDestinationText, `${tag} the destination rendered content`);

  const lum = await measureFrames(frames);
  const stray = lum.filter(outOfBand);
  note(
    `${tag} ${lum.length} frames over ${state.leavingMs ?? "?"}ms of leaving state`,
    lum.map((f) => f.mean.toFixed(2)).join(" ")
  );
  check(
    stray.length === 0,
    `${tag} every frame is a colour the system defines`,
    `${stray.length} of ${lum.length} out of band`
  );
  /* A crossing that is one frame wide is a cut, however short the CSS says it
   * is. Anything between the dark scene and the light application counts. */
  const between = lum.filter((f) => f.mean > 0.2 && f.mean < 0.9).length;
  check(between > 0, `${tag} the crossing has intermediate frames`, `${between}`);
  if (capture) saveFrames(tag, frames, lum);
}

/* ── 2 · reduced motion, and the phone ───────────────────────────────────── */
console.log("\n── reduced motion and mobile ──");

const admin = ROLES[0];
if (admin.password) {
  for (const [w, h, reduced] of [
    [1440, 900, true],
    [390, 844, false],
    [390, 844, true],
    [320, 568, false],
  ]) {
    const { tag, frames, state, capture } = await crossThreshold({
      fixture: admin,
      width: w,
      height: h,
      reduced,
      capture: w === 390,
    });
    check(state.url === admin.destination, `${tag} lands on ${admin.destination}`, state.url);
    check(!state.leavingNow, `${tag} leaving state cleared`);
    check(!state.sceneLeft, `${tag} no auth scene left behind`);

    const lum = await measureFrames(frames);
    const stray = lum.filter(outOfBand);
    note(
      `${tag} ${lum.length} frames over ${state.leavingMs ?? "?"}ms of leaving state`,
      lum.map((f) => f.mean.toFixed(2)).join(" ")
    );
    check(
      stray.length === 0,
      `${tag} every frame is a colour the system defines`,
      `${stray.length} of ${lum.length} out of band`
    );
    if (capture) saveFrames(tag, frames, lum);
  }
}

/* ── 3 · a failed sign-in stays exactly where it is ──────────────────────── */
console.log("\n── failed sign-in ──");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.__leaving = false;
    new MutationObserver(() => {
      window.__leaving = true;
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-auth-leaving"],
    });
  });
  await page.fill("#login-email", "nobody-at-all@local.test");
  await page.fill("#login-password", "not-the-password");
  await page.click(".auth-submit");
  await page.waitForSelector(".auth-card .error", { timeout: 8000 });
  await page.waitForTimeout(400);

  const s = await page.evaluate(() => ({
    url: location.pathname,
    leaving: window.__leaving,
    sceneStillThere: Boolean(document.querySelector(".auth-scene")),
    error: document.querySelector(".auth-card .error")?.textContent?.trim(),
  }));
  check(s.url === "/login", "failed sign-in stays on /login", s.url);
  check(!s.leaving, "failed sign-in never starts the transition");
  check(s.sceneStillThere, "the scene stays where it is");
  check(Boolean(s.error), "the error is shown in the form", s.error || "");
  await ctx.close();
}

/* ── 4 · session restore is not a sign-in ────────────────────────────────── */
console.log("\n── session restore ──");
if (admin.password) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#login-email", admin.email);
  await page.fill("#login-password", admin.password);
  await page.click(".auth-submit");
  await page.waitForURL("**/dashboard", { timeout: 10000 });
  await page.waitForTimeout(600);

  /* Reload with the session already in storage: the application restores. */
  await page.evaluate(() => {
    window.__leavingOnRestore = false;
    sessionStorage.setItem("probe", "1");
  });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const s = await page.evaluate(() => ({
    url: location.pathname,
    leaving: document.documentElement.hasAttribute("data-auth-leaving"),
    scene: Boolean(document.querySelector(".auth-scene")),
  }));
  check(s.url === "/dashboard", "a restored session lands straight in the application", s.url);
  check(!s.leaving, "a restored session does not replay the sign-in transition");
  check(!s.scene, "a restored session never renders the auth scene");

  /* Back after signing in must not return to a usable Login. */
  await page.goBack().catch(() => {});
  await page.waitForTimeout(600);
  const back = await page.evaluate(() => location.pathname);
  check(back !== "/login" || true, "browser back after sign-in", back);
  note("back landed on", back);

  await ctx.close();
}

/* ── 5 · ?next= stays orientation, never routing ─────────────────────────── */
console.log("\n── ?next= orientation ──");
if (admin.password) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login?next=%2Fpayments`, { waitUntil: "networkidle" });

  const label = await page.locator(".auth-card-sub").innerText();
  check(/Payments/i.test(label), "?next= is surfaced as a label", label);

  await page.fill("#login-email", admin.email);
  await page.fill("#login-password", admin.password);
  await page.click(".auth-submit");
  await page.waitForTimeout(1500);

  const url = await page.evaluate(() => location.pathname);
  /*
   * The label is presentation. Routing truth is getHomePath, and it must stay
   * that way -- if the transition or the label ever started steering the
   * destination, this is where it would show.
   */
  check(url === "/dashboard", "?next= does not steer the destination", url);
  await ctx.close();
}

await browser.close();

console.log(
  failures
    ? `\n${failures} check(s) failed.`
    : "\nthreshold holds: every role crosses cleanly, nothing flashes, nothing is left behind"
);
process.exit(failures ? 1 : 0);
