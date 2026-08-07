#!/usr/bin/env python3
"""
Route + page inventory for the UI v2 rebuild.

Why this exists:
The UI v2 brief requires every registered route to be individually redesigned
and verified. "Every route" has to come from the router, not from memory — an
earlier pass in this repository nearly deleted all 18 page components because a
regex missed `React.lazy(() => import(...))`. So this reads AppRoutes.jsx and
reports what is actually registered, together with the guard wrapping each
route, because the guard determines which fixture can reach it.

Usage:
    python3 tools/ui_v2/route_inventory.py            # table to stdout
    python3 tools/ui_v2/route_inventory.py --json     # machine-readable

Writes nothing unless --out is given. Touches no data, needs no secrets.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
ROUTES = ROOT / "frontend/src/routes/AppRoutes.jsx"
PAGES = ROOT / "frontend/src/pages"

# `path="/x"` — the literal registered in the router.
PATH_RE = re.compile(r'path="([^"]+)"')
# `const X = lazy(() => import("../pages/Y"))` in any of its spellings.
LAZY_RE = re.compile(
    r'(?:const|let)\s+(\w+)\s*=\s*(?:React\.)?lazy\(\s*\(\)\s*=>\s*import\(\s*["\']([^"\']+)["\']'
)
# Access control is expressed two ways in this router and BOTH must be read:
# a RoleRoute wrapper, and the layout component itself (AdminManagerLayout is
# what gates the office routes). Reading only one of them reports every office
# route as unguarded.
GUARD_RE = re.compile(r"<(RoleRoute|ProtectedRoute|PublicOnlyRoute|\w*Layout)\b([^>]*)", re.S)
ALLOW_RE = re.compile(r"allow=\{\[([^\]]*)\]\}")
# Page components are written multi-line with props, so the tag is never
# self-closing on its own line — match the opening tag only.
PAGE_RE = re.compile(r"<(\w+Page)\b")


def strip_comments(src: str) -> str:
    """Blank comment bodies, preserving newlines so line numbers survive."""
    src = re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), src, flags=re.S)
    return re.sub(r"(?<![:'\"])//[^\n]*", "", src)


def inventory() -> dict:
    if not ROUTES.exists():
        sys.exit(f"router not found: {ROUTES}")

    raw = ROUTES.read_text()
    src = strip_comments(raw)

    lazy = {name: mod for name, mod in LAZY_RE.findall(src)}

    # Each route's window runs from its own `path=` to the next one, so a
    # multi-line element with props is captured whole rather than guessed at
    # from a fixed number of lines.
    marks = [(m.group(1), m.start()) for m in PATH_RE.finditer(src)]
    routes = []
    for i, (path, start) in enumerate(marks):
        end = marks[i + 1][1] if i + 1 < len(marks) else len(src)
        window = src[start:end]
        line = src[:start].count("\n") + 1

        guards = GUARD_RE.findall(window)
        guard = guards[0][0] if guards else "—"
        allow = ""
        for _, attrs in guards:
            a = ALLOW_RE.search(attrs)
            if a:
                allow = a.group(1).replace('"', "").replace("'", "").replace(" ", "")
                break

        pages = PAGE_RE.findall(window)
        component = pages[0] if pages else ("Navigate/redirect" if "Navigate" in window else "—")

        routes.append(
            {
                "path": path,
                "line": line,
                "guard": guard,
                "allow": allow,
                "component": component,
                "lazy": component in lazy,
                "module": lazy.get(component, ""),
            }
        )

    page_files = sorted(p.name for p in PAGES.glob("*.jsx")) if PAGES.exists() else []
    referenced = {r["component"] for r in routes}
    orphan_pages = [p for p in page_files if p[:-4] not in referenced]

    return {
        "routes": routes,
        "route_count": len(routes),
        "lazy_boundaries": sum(1 for r in routes if r["lazy"]),
        "page_files": len(page_files),
        "pages_not_registered": orphan_pages,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", action="store_true", help="emit JSON")
    ap.add_argument("--out", help="also write JSON to this path")
    args = ap.parse_args()

    data = inventory()

    if args.out:
        pathlib.Path(args.out).write_text(json.dumps(data, indent=2))

    if args.json:
        print(json.dumps(data, indent=2))
        return

    print(f"{'PATH':28} {'GUARD':16} {'ROLES':22} {'COMPONENT':28} LAZY")
    print("-" * 104)
    for r in data["routes"]:
        print(
            f"{r['path']:28} {r['guard']:16} {(r['allow'] or '—'):22} "
            f"{r['component']:28} {'yes' if r['lazy'] else 'NO'}"
        )
    print(
        f"\nroutes={data['route_count']}  lazy={data['lazy_boundaries']}  "
        f"page files={data['page_files']}  unregistered={data['pages_not_registered'] or 'none'}"
    )


if __name__ == "__main__":
    main()
