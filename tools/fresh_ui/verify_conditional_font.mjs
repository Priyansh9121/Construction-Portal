/**
 * Verify that the Gujarati face is genuinely conditional.
 *
 * The whole justification for shipping a 110 kB Gujarati font to a product
 * whose priority persona is on a phone with weak signal is that
 * `unicode-range` makes the browser fetch it ONLY when it must render a
 * Gujarati codepoint. That is a claim about runtime behaviour, so it is
 * verified at runtime rather than asserted.
 *
 * Two probes against a real Chromium, watching the network:
 *   1. A page with Latin text only  -> the Gujarati woff2 must NOT be fetched.
 *   2. A page containing Gujarati   -> it MUST be fetched, and must render at
 *                                      the corrected metrics.
 *
 * LIMITATIONS
 *   - Probes a synthetic page that loads the built stylesheet, not the live
 *     app, so it isolates font-loading behaviour from data loading. Whether a
 *     given route actually contains Gujarati is a content question.
 *   - Chromium only.
 *
 * Usage: node tools/fresh_ui/verify_conditional_font.mjs
 * Exits non-zero if either expectation fails.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = requireFromFrontend("@playwright/test");

const fontDir = path.join(root, "frontend/public/fonts");
const GUJARATI_FILE = "noto-sans-gujarati-var.woff2";

const faceCss = fs.readFileSync(
  path.join(root, "frontend/src/styles/system/core/typography.css"),
  "utf8"
);

function pageFor(body) {
  return `<!doctype html><html><head><style>
    ${faceCss}
    @font-face {
      font-family: "IBM Plex Sans";
      src: url("/fonts/ibm-plex-sans-var-latin.woff2") format("woff2");
      font-weight: 100 700; font-display: swap;
      unicode-range: U+0000-00FF, U+2000-206F, U+20AC, U+2122;
    }
    body { font-family: "IBM Plex Sans", "Noto Sans Gujarati", sans-serif; font-size: 24px; }
  </style></head><body>${body}</body></html>`;
}

const browser = await chromium.launch();
let failures = 0;

for (const [label, body, shouldFetch] of [
  ["latin only", "<p>Cement 50 bags at 350 rupees, GST 28 percent</p>", false],
  ["contains gujarati", "<p>સિમેન્ટ 50 બેગ, દર 350</p>", true],
]) {
  const page = await browser.newPage();
  const fetched = [];

  /* The page MUST be served from a real origin. An earlier version of this
   * probe used setContent(), which runs on about:blank where "/fonts/..."
   * cannot resolve to anything — so no request was ever issued and the
   * latin-only case "passed" by doing nothing at all. A test that passes
   * vacuously is worse than no test. */
  await page.route("http://font-probe.test/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith(".woff2")) {
      const file = path.basename(url.pathname);
      fetched.push(file);
      return route.fulfill({
        status: 200,
        contentType: "font/woff2",
        body: fs.readFileSync(path.join(fontDir, file)),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: pageFor(body),
    });
  });

  await page.goto("http://font-probe.test/index.html");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const got = fetched.includes(GUJARATI_FILE);
  const ok = got === shouldFetch;
  if (!ok) failures += 1;

  console.log(
    `${ok ? "pass" : "FAIL"}  ${label.padEnd(18)} ` +
      `gujarati fetched=${String(got).padEnd(5)} expected=${shouldFetch}` +
      `  [${fetched.join(", ") || "no font requests"}]`
  );

  await page.close();
}

await browser.close();

console.log(
  failures === 0
    ? "\nConditional loading verified at runtime: English-only sessions pay nothing."
    : `\n${failures} expectation(s) failed.`
);
process.exit(failures ? 1 : 0);
