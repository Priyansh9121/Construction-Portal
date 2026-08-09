/**
 * Bounded audit of the existing icon primitive against the current foundation.
 * Static: reads the source rather than the browser, because every property
 * under test is authored, not computed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const src = fs.readFileSync(path.join(root, "frontend/src/components/ui/Icon.jsx"), "utf8");
let fail = 0;
const check = (ok, label, detail = "") => {
  if (!ok) fail++;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

check(/viewBox="0 0 24 24"/.test(src), "24x24 viewBox, one grid for every glyph");
check(/fill="none"/.test(src) && !/fill="(?!none)/.test(src), "stroke-only construction, nothing filled");
check(/strokeWidth="1\.75"/.test(src), "single stroke weight", "1.75");
check(/strokeLinecap="round"/.test(src) && /strokeLinejoin="round"/.test(src), "round caps and joins");
check(/stroke="currentColor"/.test(src), "inherits colour from context");
check(/aria-hidden="true"/.test(src), "decorative by default");
check(/focusable="false"/.test(src), "never a tab stop inside a control", "focusable=false");
check(/width=\{size\}[\s\S]*height=\{size\}/.test(src), "square by construction");
check(/if \(!d\)[\s\S]*return null/.test(src), "an unknown name renders nothing rather than a broken box");

/* Every path must start with a move command, or the segment splitter is
 * producing malformed geometry. */
const paths = [...src.matchAll(/^\s{2}"?([a-z][\w-]*)"?:\s*"([^"]+)"/gm)];
const bad = paths.filter(([, , d]) => !d.trim().startsWith("M") && !d.trim().startsWith("m"));
check(bad.length === 0, `${paths.length} glyphs all begin with a move command`, bad.map((b) => b[1]).join(","));

/* Optical grid: coordinates must sit inside the 24-unit box, or the glyph
 * clips at small sizes. Allow the 0..24 range plus stroke half-width. */
const out = [];
for (const [, name, d] of paths) {
  for (const n of d.match(/-?\d+(\.\d+)?/g) || []) {
    const v = Math.abs(parseFloat(n));
    if (v > 24.9) { out.push(`${name}:${n}`); break; }
  }
}
check(out.length === 0, "every coordinate inside the 24-unit box", out.join(" "));

/* The rendered sizes actually used across the app must be even multiples that
 * land on whole device pixels at 1x for a 24-grid glyph. */
/* Every size any consumer actually renders, read from source. */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".jsx")) out.push(p);
  }
  return out;
}
const consumers = [...new Set(
  walk(path.join(root, "frontend/src"))
    .flatMap((f) => [...fs.readFileSync(f, "utf8").matchAll(/<Icon[^>]*?size=\{(\d+)\}/g)])
    .map((m) => Number(m[1]))
)];
const odd = consumers.filter((s) => s % 2 !== 0);
check(odd.length === 0, `sizes in use are even (${[...new Set(consumers)].sort((a,b)=>a-b).join(", ")})`, odd.join(","));

console.log(fail ? `\n${fail} defect(s).` : "\nIcon.jsx conforms to the foundation. Adopt as-is.");
process.exit(fail ? 1 : 0);
