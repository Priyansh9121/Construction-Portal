/**
 * Prove the development-only reset-token block is absent from a PRODUCTION
 * build.
 *
 * The browser suite runs against `vite dev`, where import.meta.env.DEV is
 * true, so it can only assert that the block is clearly labelled. Whether it
 * SHIPS is a build-time question: Vite replaces import.meta.env.DEV with
 * false in a production build and the dead branch is then eliminated.
 *
 * That elimination is the security property, so it is verified against the
 * built output rather than assumed.
 *
 * Usage: node tools/fresh_ui/verify_dev_token_absent.mjs
 * Requires `npm run build` to have been run. Reads dist/ only.
 * Exits non-zero if any marker survives.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const distAssets = path.join(root, "frontend/dist/assets");

if (!fs.existsSync(distAssets)) {
  console.error("dist/assets missing. Run `npm run build` in frontend/ first.");
  process.exit(1);
}

/* Strings that exist ONLY inside the DEV-gated branch. If Vite eliminated the
 * branch, none of them can appear in any shipped chunk. */
const MARKERS = [
  "Development only",
  "dev-reset-token",
  "auth-devbox",
];

const files = fs
  .readdirSync(distAssets)
  .filter((f) => f.endsWith(".js") || f.endsWith(".css"))
  .map((f) => path.join(distAssets, f));

let failures = 0;

for (const marker of MARKERS) {
  const hits = files.filter((file) =>
    fs.readFileSync(file, "utf8").includes(marker)
  );

  const ok = hits.length === 0;
  if (!ok) failures += 1;

  console.log(
    `${ok ? "pass" : "FAIL"}  "${marker}" ${
      ok ? "absent from the production build" : `found in ${hits.map((h) => path.basename(h)).join(", ")}`
    }`
  );
}

console.log(
  failures === 0
    ? `\n${files.length} built assets scanned. The development reset-token block does not ship.`
    : `\n${failures} marker(s) survived into the production build.`
);

process.exit(failures ? 1 : 0);
