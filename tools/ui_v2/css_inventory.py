#!/usr/bin/env python3
"""
Stylesheet + class-consumer inventory for the UI v2 migration.

Why this exists:
The UI v2 brief allows deleting the entire stylesheet tree, but only after
every consumer is inventoried. Two traps in this repository make a naive scan
dangerous, and both have already caused real damage here:

  1. Comment prose parses as selectors. A previous tool proposed "trimming"
     `/* File purpose... */` as if it were a rule. Comments are masked here,
     with newlines preserved so line numbers stay true.
  2. Class names are composed dynamically — `className={`badge badge--${tone}`}`
     — so a literal grep for `.badge--camera` finds nothing and the class looks
     dead. Template literals and conditional expressions are extracted
     separately and reported as DYNAMIC, never as unused.

Test selectors count as consumers: deleting a class that a Playwright spec
queries breaks the suite, not the UI, which is a slower and more confusing
failure.

Usage:
    python3 tools/ui_v2/css_inventory.py
    python3 tools/ui_v2/css_inventory.py --json --out reports/css_inventory.json

Read-only. No secrets, no data access.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[2]
STYLES = ROOT / "frontend/src/styles"
SRC = ROOT / "frontend/src"
TESTS = ROOT / "frontend/tests"

CLASS_RE = re.compile(r"\.(-?[_a-zA-Z][\w-]*)")
# className="a b", className={"a b"}, class="a b"
STATIC_ATTR_RE = re.compile(r'class(?:Name)?\s*=\s*["\']([^"\']+)["\']')
# Any template literal or expression inside className={...}
DYN_ATTR_RE = re.compile(r"class(?:Name)?\s*=\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}", re.S)
# Bare quoted strings anywhere (covers cls variables, arrays, test selectors)
QUOTED_RE = re.compile(r"[\"'`]([^\"'`\n]{2,120})[\"'`]")


def mask_comments(src: str) -> str:
    """Blank /* */ bodies but keep newlines, so reported lines stay accurate."""
    return re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), src, flags=re.S)


def collect_declared() -> dict[str, list[str]]:
    declared: dict[str, list[str]] = defaultdict(list)
    for p in sorted(STYLES.rglob("*.css")):
        src = mask_comments(p.read_text())
        # Only look at selector text: everything before each `{`.
        for block in re.finditer(r"([^{}]+)\{", src):
            sel = block.group(1)
            if "@" in sel and "{" not in sel and ":" not in sel:
                continue
            line = src[: block.start()].count("\n") + 1
            for name in CLASS_RE.findall(sel):
                declared[name].append(f"{p.relative_to(ROOT)}:{line}")
    return declared


def collect_consumers() -> tuple[set[str], set[str], set[str]]:
    """Returns (static classes, dynamic fragments, test-referenced strings)."""
    static: set[str] = set()
    dynamic: set[str] = set()
    tests: set[str] = set()

    def scan(paths, sink_static, sink_dyn):
        for p in paths:
            try:
                src = p.read_text()
            except Exception:
                continue
            for m in STATIC_ATTR_RE.finditer(src):
                sink_static.update(m.group(1).split())
            for m in DYN_ATTR_RE.finditer(src):
                expr = m.group(1)
                for q in QUOTED_RE.findall(expr):
                    sink_static.update(w for w in q.split() if w)
                # `badge--${tone}` -> record the stable prefix as dynamic
                for pre in re.findall(r"([\w-]+)\$\{", expr):
                    sink_dyn.add(pre)
            for q in QUOTED_RE.findall(src):
                if re.fullmatch(r"[\w-]+(?:\s+[\w-]+)*", q) and "-" in q:
                    sink_static.update(q.split())

    jsx = [p for p in SRC.rglob("*.jsx")] + [p for p in SRC.rglob("*.js")]
    scan(jsx, static, dynamic)

    if TESTS.exists():
        for p in TESTS.rglob("*.js"):
            src = p.read_text()
            for q in QUOTED_RE.findall(src):
                for name in CLASS_RE.findall(q):
                    tests.add(name)
    return static, dynamic, tests


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--out")
    args = ap.parse_args()

    declared = collect_declared()
    static, dynamic, tests = collect_consumers()

    rows = []
    for name, sites in sorted(declared.items()):
        if name in static:
            status = "static"
        elif any(name.startswith(pre) for pre in dynamic):
            status = "DYNAMIC"
        elif name in tests:
            status = "test-only"
        else:
            status = "no-consumer-found"
        rows.append({"class": name, "status": status, "declared_at": sites[:3], "count": len(sites)})

    summary = defaultdict(int)
    for r in rows:
        summary[r["status"]] += 1

    sheets = sorted(STYLES.rglob("*.css"))
    data = {
        "stylesheets": len(sheets),
        "css_lines": sum(len(p.read_text().split("\n")) for p in sheets),
        "declared_classes": len(declared),
        "summary": dict(summary),
        "dynamic_prefixes": sorted(dynamic),
        "test_referenced": sorted(tests),
        "classes": rows,
    }

    if args.out:
        out = pathlib.Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(data, indent=2))

    if args.json:
        print(json.dumps(data, indent=2))
        return

    print(f"stylesheets      : {data['stylesheets']}")
    print(f"css source lines : {data['css_lines']}")
    print(f"declared classes : {data['declared_classes']}")
    print("\nconsumer status:")
    for k, v in sorted(summary.items(), key=lambda kv: -kv[1]):
        print(f"  {k:20} {v}")
    print(f"\ndynamic class prefixes ({len(dynamic)}): {', '.join(sorted(dynamic)[:24])}")
    print(f"test-referenced classes ({len(tests)}): {', '.join(sorted(tests)[:24])}")
    unknown = [r['class'] for r in rows if r['status'] == 'no-consumer-found']
    print(f"\nno consumer found ({len(unknown)}) — MUST be verified by hand before deletion:")
    print("  " + ", ".join(unknown[:40]))


if __name__ == "__main__":
    main()
