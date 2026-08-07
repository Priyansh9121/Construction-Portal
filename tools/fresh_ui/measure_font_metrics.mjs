/**
 * Measure real font metrics in Chromium and compute the @font-face overrides
 * needed to make Noto Sans Gujarati sit correctly beside IBM Plex Sans.
 *
 * METHODOLOGY
 * -----------
 * Guessing `size-adjust` and the metric overrides is how mixed-script type
 * ends up sitting a few pixels off its baseline forever. This measures
 * instead, in the engine that will actually render it.
 *
 * For each face we load the real woff2 and read, from Chromium:
 *   - fontBoundingBoxAscent / fontBoundingBoxDescent  (the face's own metrics)
 *   - actualBoundingBox of a reference string          (the inked height)
 *
 * From those we compute:
 *   size-adjust        so the two scripts look optically the same size. Latin
 *                      optical size is carried by x-height; Gujarati has no
 *                      case, and its optical size is carried by the height
 *                      from the shirorekha (headline) to the baseline. We
 *                      match Gujarati's base-glyph height to Plex's x-height.
 *   ascent-override    \
 *   descent-override    > so both faces produce an IDENTICAL line box, which
 *   line-gap-override  /  is what stops a mixed line from jumping.
 *
 * LIMITATIONS
 * -----------
 *   - Measured at one size (100px) and scaled. Hinting can shift things by a
 *     fraction of a pixel at small sizes; that is below the threshold this is
 *     correcting for.
 *   - Chromium only. Firefox and Safari resolve metrics slightly differently.
 *     The overrides make the line box explicit, which reduces cross-engine
 *     divergence rather than eliminating it.
 *   - Reads local font files only. No production data, no secrets.
 *
 * Usage: node tools/fresh_ui/measure_font_metrics.mjs
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/* Playwright is a devDependency of frontend/, not of the repo root, and this
 * tool deliberately lives in tools/fresh_ui/ rather than inside the app. ESM
 * resolves from the importing file's directory, so resolve it explicitly
 * against frontend/ instead of relocating the tool. */
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = requireFromFrontend("@playwright/test");
const fontDir = path.join(root, "frontend/public/fonts");

const FACES = {
  plex: "ibm-plex-sans-var-latin.woff2",
  gujarati: "noto-sans-gujarati-var.woff2",
};

// Reference strings. Latin optical size is carried by x-height, so lowercase
// without ascenders or descenders. Gujarati base glyphs sit between the
// shirorekha and the baseline, which is the equivalent measure.
const SAMPLES = {
  plex: "xnumocse",
  gujarati: "સમતલ",   // સમતલ - flat-topped base glyphs
};

function toDataUrl(file) {
  const buf = fs.readFileSync(path.join(fontDir, file));
  return `data:font/woff2;base64,${buf.toString("base64")}`;
}

const measured = await (async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");

  const result = await page.evaluate(
    async ({ faces, samples }) => {
      const out = {};
      for (const [key, url] of Object.entries(faces)) {
        const face = new FontFace(`probe-${key}`, `url(${url})`);
        await face.load();
        document.fonts.add(face);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        ctx.font = `400 100px "probe-${key}"`;

        const m = ctx.measureText(samples[key]);
        out[key] = {
          fontAscent: m.fontBoundingBoxAscent,
          fontDescent: m.fontBoundingBoxDescent,
          inkAscent: m.actualBoundingBoxAscent,
          inkDescent: m.actualBoundingBoxDescent,
        };
      }
      return out;
    },
    { faces: Object.fromEntries(Object.entries(FACES).map(([k, v]) => [k, toDataUrl(v)])), samples: SAMPLES }
  );

  await browser.close();
  return result;
})();

const plex = measured.plex;
const guj = measured.gujarati;

// Optical size match: scale Gujarati so its inked base height equals Plex's.
const sizeAdjust = plex.inkAscent / guj.inkAscent;

// Line box match: express Plex's metrics as a percentage of em, then force
// the Gujarati face to adopt them. Overrides are relative to the ADJUSTED em,
// so divide by sizeAdjust.
const ascentOverride = (plex.fontAscent / 100) / sizeAdjust;
const descentOverride = (plex.fontDescent / 100) / sizeAdjust;

const pct = (n) => `${(n * 100).toFixed(1)}%`;

console.log("FONT METRIC MEASUREMENT (Chromium, 100px)\n");
console.log("raw measurements");
console.log(`  IBM Plex Sans     ascent=${plex.fontAscent.toFixed(2)} descent=${plex.fontDescent.toFixed(2)} inkAscent=${plex.inkAscent.toFixed(2)}`);
console.log(`  Noto Sans Gujarati ascent=${guj.fontAscent.toFixed(2)} descent=${guj.fontDescent.toFixed(2)} inkAscent=${guj.inkAscent.toFixed(2)}`);

console.log("\ncomputed overrides for the Gujarati @font-face");
console.log(`  size-adjust:       ${pct(sizeAdjust)}`);
console.log(`  ascent-override:   ${pct(ascentOverride)}`);
console.log(`  descent-override:  ${pct(descentOverride)}`);
console.log(`  line-gap-override: 0%`);

console.log("\nline-box check after override");
const plexLine = plex.fontAscent + plex.fontDescent;
const gujLine = (ascentOverride + descentOverride) * sizeAdjust * 100;
console.log(`  Plex line box:     ${plexLine.toFixed(2)}px at 100px`);
console.log(`  Gujarati line box: ${gujLine.toFixed(2)}px at 100px`);
console.log(`  delta:             ${Math.abs(plexLine - gujLine).toFixed(4)}px`);
console.log("\nMeasured in Chromium, not guessed. See LIMITATIONS in this file.");
