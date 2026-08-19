/**
 * Does a route still depend on the v2 layer?
 *
 * WHY THIS EXISTS
 * ---------------
 * `styles/v2/` is not per-page residue. `.v2-root` sits on AppLayout
 * (src/layouts/AppLayout.jsx), so it wraps every authenticated route, and
 * `styles/v2/components/data.css` restyles a shared vocabulary through
 * DESCENDANT selectors from it — `.v2-root .card`, `.v2-root .table-wrapper`,
 * `.v2-root .badge`. A page never names `.v2-root`; it just inherits.
 *
 * That is why the first attempt to measure v2's reach failed. A `className=`
 * token scan over `src/pages/` reported "one consumer" because it can only see
 * a class a component NAMES. It was the wrong instrument, not a badly used one.
 *
 * So the acceptance bar for a migrated route is mechanical: **a migrated route
 * must reference ZERO classes that v2 restyles.** If system classes and v2
 * descendant rules both apply, the route is not migrated — it is still
 * inheriting the old layer, and it will change appearance the day v2 is
 * deleted at the end of Phase E.
 *
 * IT FOLLOWS THE IMPORT GRAPH, and it has to. The first version of this file
 * scanned `src/pages/*.jsx` only and reported SiteOperationsPage as clean —
 * while `tabs` and `table-wrapper` live in 11 component files each, reached
 * through `components/siteOperations/SiteOpsContext`. Scanning the page alone
 * reproduces the very blind spot this tool exists to close, one level down.
 *
 * Usage:
 *   node tools/ui_v2/v2_dependence.mjs                  # every page
 *   node tools/ui_v2/v2_dependence.mjs SiteOperations   # one page, listing hits
 *
 * Exits non-zero if a page named as MIGRATED still touches the v2 set.
 * Reads only; writes nothing.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const SRC = path.join(ROOT, "frontend/src");

/** Pages already migrated to `system`. A regression here is the failure case. */
const MIGRATED = new Set([
  "LoginPage", "RegisterPage", "ForgotPasswordPage", "ResetPasswordPage",
  "DashboardPage", "ActivityPage",
]);

const walk = (d) => fs.existsSync(d)
  ? fs.readdirSync(d, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
  : [];

/*
 * The v2-restyled set: every class v2 targets, including the ones it only ever
 * reaches as `.v2-root <selector>`. Bare element selectors (table, thead) are
 * deliberately excluded — a page cannot avoid a <table> and the redesign is
 * expected to restyle those through `system` instead.
 */
const v2Classes = new Set();
for (const f of walk(path.join(SRC, "styles/v2")).filter((f) => f.endsWith(".css"))) {
  const css = fs.readFileSync(f, "utf8");
  for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
    if (m[1] !== "v2-root") v2Classes.add(m[1]);
  }
}

/* Classes `system` declares. A class in BOTH is safe: system wins for a
 * migrated page, and it survives v2's deletion. */
const systemClasses = new Set();
for (const f of walk(path.join(SRC, "styles/system")).filter((f) => f.endsWith(".css")))
  for (const m of fs.readFileSync(f, "utf8").matchAll(/\.(-?[_a-zA-Z][\w-]*)/g))
    systemClasses.add(m[1]);

/** Only v2 styles these, so using one is a live dependence on the old layer. */
const v2Only = new Set([...v2Classes].filter((c) => !systemClasses.has(c)));

/*
 * Every class a file references, by any means. Not just className="literal":
 * template strings and conditionals are how a class gets built at runtime, and
 * css_inventory.py already reports 7 dynamic prefixes in this codebase.
 */
const classesUsedBy = (file) => {
  const src = fs.readFileSync(file, "utf8");
  const used = new Set();
  for (const m of src.matchAll(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([\s\S]{0,400}?)\})/g)) {
    const blob = m[1] || m[2] || m[3] || "";
    for (const t of blob.split(/[^A-Za-z0-9_-]+/)) if (t) used.add(t);
  }
  return used;
};

/**
 * Every file a page can reach through relative imports, transitively.
 *
 * A page's v2 dependence is the union of its own markup and everything it
 * renders — the class does not have to be written in the page file to apply
 * to the page.
 */
const reachableFrom = (entry) => {
  const seen = new Set();
  const stack = [entry];

  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);

    let src;
    try { src = fs.readFileSync(file, "utf8"); } catch { continue; }

    for (const m of src.matchAll(/from\s+["'](\.[^"']*)["']/g)) {
      const raw = path.resolve(path.dirname(file), m[1]);
      const candidates = [
        raw, raw + ".jsx", raw + ".js",
        path.join(raw, "index.jsx"), path.join(raw, "index.js"),
      ];
      const hit = candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
      if (hit && /\.jsx?$/.test(hit)) stack.push(hit);
    }
  }
  return [...seen];
};

const only = process.argv[2];
const pages = fs.readdirSync(path.join(SRC, "pages"))
  .filter((f) => f.endsWith(".jsx"))
  .filter((f) => !only || f.toLowerCase().includes(only.toLowerCase()));

let failures = 0;
console.log(`v2-only classes (styled by v2, not by system): ${v2Only.size}\n`);
console.log("Scanned per page: the page plus every file it reaches by relative import.\n");
console.log("PAGE".padEnd(28) + "STATE".padEnd(12) + "v2 CLASSES USED (page + its components)");

for (const f of pages.sort()) {
  const name = f.replace(".jsx", "");
  const files = reachableFrom(path.join(SRC, "pages", f));
  const used = new Set();
  for (const file of files) for (const c of classesUsedBy(file)) used.add(c);
  const hits = [...used].filter((c) => v2Only.has(c)).sort();
  const migrated = MIGRATED.has(name);
  const bad = migrated && hits.length > 0;
  if (bad) failures++;
  console.log(
    name.padEnd(28) +
    (migrated ? "migrated" : "legacy").padEnd(12) +
    (hits.length ? hits.join(", ") : "—") +
    (bad ? "   <-- MIGRATED BUT STILL ON v2" : "")
  );
}

if (only) {
  console.log("\nFull v2-only set, for reference:");
  console.log("  " + [...v2Only].sort().join(", "));
}

console.log(failures
  ? `\nFAIL: ${failures} migrated page(s) still depend on v2.`
  : "\nOK: no migrated page depends on v2.");
process.exit(failures ? 1 : 0);
