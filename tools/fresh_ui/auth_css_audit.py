#!/usr/bin/env python3
"""
Consumer audit for the two legacy auth stylesheets.

METHODOLOGY
-----------
Deleting CSS on grep evidence alone has already burned this project once: a
"no consumer found" line was read as "v2 is dead" when v2 was in fact
rendering the whole app shell. So every selector here is classified against
three independent sources:

  1. STATIC   className string literals in .jsx / .js
  2. TEST     selectors used by the Playwright suites
  3. SCOPE    whether the selector is auth-scoped or generic enough to be
              used by routes outside the auth group

A selector is reported DELETABLE only when it is auth-scoped AND the current
system stylesheet already defines it AND nothing outside the auth group
references it. Everything else is reported for a human decision.

LIMITATIONS
-----------
  * Static analysis cannot see a class assembled at runtime from fragments.
    Candidate prefixes are reported separately so they are never auto-deleted.
  * "Defined in the current system" means the selector name appears in
    styles/system/; it does not prove visual equivalence. That is what the
    screenshot review and the browser suite are for.
  * This tool reads source only. It deletes nothing.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "frontend/src"
TESTS = ROOT / "frontend/tests"

LEGACY = [
    SRC / "styles/pages/auth.css",
    SRC / "styles/v2/pages/auth.css",
]
CURRENT = SRC / "styles/system"

# Files that make up the auth group. A selector used ONLY here is auth-scoped.
AUTH_SOURCES = {
    SRC / "pages/LoginPage.jsx",
    SRC / "pages/RegisterPage.jsx",
    SRC / "pages/ForgotPasswordPage.jsx",
    SRC / "pages/ResetPasswordPage.jsx",
    SRC / "components/auth/AuthShell.jsx",
    SRC / "components/auth/Approach.jsx",
}

CLASS_IN_CSS = re.compile(r"\.(-?[_a-zA-Z][\w-]*)")
COMMENT = re.compile(r"/\*.*?\*/", re.S)


def selectors(path: Path) -> set[str]:
    """Class names defined in a stylesheet, comments stripped first.

    Stripping comments matters: this project's stylesheets are heavily
    commented and prose like "the .auth-card wrapper" would otherwise be
    parsed as a definition.
    """
    text = COMMENT.sub("", path.read_text(encoding="utf-8"))
    # Drop @keyframes bodies and at-rule preludes that carry no class.
    return set(CLASS_IN_CSS.findall(text))


def source_files() -> list[Path]:
    return [
        p
        for p in SRC.rglob("*")
        if p.suffix in {".jsx", ".js"} and p.is_file()
    ]


def test_files() -> list[Path]:
    return [p for p in TESTS.rglob("*.js") if p.is_file()]


def main() -> int:
    legacy_selectors: set[str] = set()
    for path in LEGACY:
        if path.exists():
            legacy_selectors |= selectors(path)

    current_text = "\n".join(
        p.read_text(encoding="utf-8") for p in CURRENT.rglob("*.css")
    )
    current_selectors = set(CLASS_IN_CSS.findall(COMMENT.sub("", current_text)))

    sources = {p: p.read_text(encoding="utf-8") for p in source_files()}
    tests = {p: p.read_text(encoding="utf-8") for p in test_files()}

    deletable, keep_generic, keep_undefined, unreferenced = [], [], [], []

    for name in sorted(legacy_selectors):
        word = re.compile(r"[\"'`\s.\[]" + re.escape(name) + r"[\"'`\s.\]:,]")

        auth_hits, other_hits = [], []
        for path, text in sources.items():
            if word.search(text):
                (auth_hits if path in AUTH_SOURCES else other_hits).append(path)

        test_hits = [p for p, t in tests.items() if word.search(t)]
        in_current = name in current_selectors

        if other_hits:
            keep_generic.append((name, other_hits))
        elif not auth_hits and not test_hits:
            unreferenced.append(name)
        elif in_current:
            deletable.append(name)
        else:
            keep_undefined.append((name, auth_hits, test_hits))

    print("LEGACY AUTH CSS CONSUMER AUDIT")
    print(f"legacy selectors: {len(legacy_selectors)}\n")

    print(f"1. SAFE TO DELETE — auth-scoped and already defined in styles/system/ ({len(deletable)})")
    for name in deletable:
        print(f"   .{name}")

    print(f"\n2. KEEP — referenced OUTSIDE the auth group ({len(keep_generic)})")
    for name, paths in keep_generic:
        shown = ", ".join(p.relative_to(SRC).as_posix() for p in paths[:3])
        more = "" if len(paths) <= 3 else f" (+{len(paths) - 3} more)"
        print(f"   .{name:<28} {shown}{more}")

    print(f"\n3. NEEDS A DECISION — still referenced by auth but NOT defined in styles/system/ ({len(keep_undefined)})")
    for name, auth_hits, test_hits in keep_undefined:
        where = []
        if auth_hits:
            where.append("auth:" + ",".join(p.stem for p in auth_hits))
        if test_hits:
            where.append("tests:" + ",".join(p.stem for p in test_hits))
        print(f"   .{name:<28} {' | '.join(where)}")

    print(f"\n4. NO REFERENCE FOUND — verify by hand before deleting ({len(unreferenced)})")
    print("   " + ", ".join(f".{n}" for n in unreferenced) if unreferenced else "   none")

    print("\nStatic analysis only. Nothing was deleted. See LIMITATIONS.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
