#!/usr/bin/env python3
"""
WCAG contrast audit for the UI v2 token system.

Why this exists:
UI v2 has two colour planes — dark chrome and light data — and a token that is
legible on one is frequently illegal on the other. Checking that by eye is how
UI v1 shipped `--text-muted` at 4.34:1 and a notification badge at 3.48:1. This
resolves the `var()` chain in tokens.css down to literals and measures every
declared pairing, so a failing combination cannot reach a stylesheet.

Alpha is composited, not ignored: the chrome hairlines are
`rgb(255 255 255 / 0.08)`, which is meaningless as a colour until it is blended
over the surface it sits on.

Thresholds (WCAG 2.2):
  normal text   4.5:1     large text (>=18.66px bold / >=24px)  3.0:1
  non-text UI   3.0:1     (borders, focus rings, status bars, icons)

Usage:
    python3 tools/ui_v2/contrast_audit.py
    python3 tools/ui_v2/contrast_audit.py --json --out reports/contrast.json

Exit code 1 if any declared pair fails its threshold, so this can gate a build.
Read-only. No secrets, no network, no data access.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
TOKENS = ROOT / "frontend/src/styles/v2/core/tokens.css"


# --------------------------------------------------------------------------
# token resolution
# --------------------------------------------------------------------------
def load_tokens(path: pathlib.Path) -> dict[str, str]:
    src = re.sub(r"/\*.*?\*/", " ", path.read_text(), flags=re.S)
    return {m.group(1): m.group(2).strip() for m in re.finditer(r"(--[\w-]+)\s*:\s*([^;]+);", src)}


def resolve(value: str, tokens: dict[str, str], depth: int = 0) -> str:
    if depth > 16:
        return value
    return re.sub(
        r"var\(\s*(--[\w-]+)\s*\)",
        lambda m: resolve(tokens[m.group(1)], tokens, depth + 1) if m.group(1) in tokens else m.group(0),
        value,
    ).strip()


def parse_color(value: str) -> tuple[float, float, float, float] | None:
    """Returns (r, g, b, alpha) with channels 0-255, or None if not a colour."""
    v = value.strip()

    m = re.fullmatch(r"#([0-9a-fA-F]{3,8})", v)
    if m:
        h = m.group(1)
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        if len(h) == 6:
            return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 1.0)
        if len(h) == 8:
            return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(h[6:8], 16) / 255)

    # rgb(255 255 255 / 0.08) and rgb(255, 255, 255, 0.08)
    m = re.fullmatch(r"rgba?\(\s*([^)]+)\)", v)
    if m:
        body = m.group(1).replace("/", " ").replace(",", " ")
        parts = [p for p in body.split() if p]
        if len(parts) >= 3:
            try:
                r, g, b = (float(p.rstrip("%")) for p in parts[:3])
                a = float(parts[3].rstrip("%")) if len(parts) > 3 else 1.0
                if len(parts) > 3 and "%" in parts[3]:
                    a /= 100
                return (r, g, b, a)
            except ValueError:
                return None
    return None


def composite(fg: tuple, bg: tuple) -> tuple:
    """Blend a translucent colour over an opaque one."""
    r, g, b, a = fg
    br, bg_, bb, _ = bg
    return (r * a + br * (1 - a), g * a + bg_ * (1 - a), b * a + bb * (1 - a), 1.0)


def luminance(c: tuple) -> float:
    def ch(x: float) -> float:
        x /= 255
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4

    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])


def ratio(fg: tuple, bg: tuple) -> float:
    if fg[3] < 1.0:
        fg = composite(fg, bg)
    l1, l2 = luminance(fg), luminance(bg)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


# --------------------------------------------------------------------------
# the pairs that must hold
# --------------------------------------------------------------------------
# (foreground, background, minimum, label)
PAIRS: list[tuple[str, str, float, str]] = []

_DATA_BGS = ["--v2-surface", "--v2-page", "--v2-surface-sunken", "--v2-surface-hover"]
for bg in _DATA_BGS:
    PAIRS += [
        ("--v2-text", bg, 4.5, "body text"),
        ("--v2-text-secondary", bg, 4.5, "secondary text"),
        ("--v2-text-muted", bg, 4.5, "muted text"),
        ("--v2-action", bg, 4.5, "link / action text"),
    ]

_CHROME_BGS = ["--v2-chrome-bg", "--v2-chrome-bg-deep", "--v2-chrome-bg-raised",
               "--v2-chrome-bg-hover", "--v2-chrome-bg-active"]
for bg in _CHROME_BGS:
    PAIRS += [
        ("--v2-chrome-text", bg, 4.5, "chrome text"),
        ("--v2-chrome-text-secondary", bg, 4.5, "chrome secondary"),
        ("--v2-chrome-text-muted", bg, 4.5, "chrome muted"),
        ("--v2-action-on-chrome", bg, 4.5, "action on chrome"),
    ]

PAIRS += [
    ("--v2-action-text", "--v2-action", 4.5, "text on filled action"),
    ("--v2-action-text", "--v2-action-hover", 4.5, "text on hovered action"),
    ("--v2-success-fg", "--v2-success-bg", 4.5, "success pair"),
    ("--v2-warning-fg", "--v2-warning-bg", 4.5, "warning pair"),
    ("--v2-danger-fg", "--v2-danger-bg", 4.5, "danger pair"),
    ("--v2-info-fg", "--v2-info-bg", 4.5, "info pair"),
    ("--v2-neutral-fg", "--v2-neutral-bg", 4.5, "neutral pair"),
    # --- Non-text that WCAG 1.4.11 governs: 3:1 required ------------------
    # Control boundaries: what makes an input or unfilled button identifiable.
    ("--v2-control-line", "--v2-surface", 3.0, "input/control border"),
    ("--v2-control-line", "--v2-surface-sunken", 3.0, "control border on sunken"),
    ("--v2-control-line-strong", "--v2-surface", 3.0, "emphasised control border"),
    ("--v2-focus", "--v2-surface", 3.0, "focus ring on surface"),
    ("--v2-focus", "--v2-page", 3.0, "focus ring on page"),
    # Status indicator bars: meaningful graphics.
    ("--v2-success-bar", "--v2-success-bg", 3.0, "success bar"),
    ("--v2-warning-bar", "--v2-warning-bg", 3.0, "warning bar"),
    ("--v2-danger-bar", "--v2-danger-bg", 3.0, "danger bar"),
    ("--v2-info-bar", "--v2-info-bg", 3.0, "info bar"),
    ("--v2-neutral-bar", "--v2-neutral-bg", 3.0, "neutral bar"),
    ("--v2-success-bar", "--v2-surface", 3.0, "success bar on white"),
    ("--v2-warning-bar", "--v2-surface", 3.0, "warning bar on white"),
    ("--v2-danger-bar", "--v2-surface", 3.0, "danger bar on white"),
    ("--v2-identity", "--v2-chrome-bg", 3.0, "brand mark on chrome"),
]

# Decorative separators. Reported for information, NOT gated.
#
# WCAG 1.4.11 governs UI components and meaningful graphics. A rule between
# two table cells is neither: it is a visual convenience, and the information
# it separates is fully available without it. Forcing 3:1 here would produce a
# heavy grid that makes dense financial tables harder to scan, not easier —
# an accessibility loss dressed as a win. Kept visible so a genuinely
# invisible separator still gets noticed.
INFORMATIONAL: list[tuple[str, str, str]] = [
    ("--v2-line", "--v2-surface", "table / card separator"),
    ("--v2-line-soft", "--v2-surface", "soft separator"),
    ("--v2-line-strong", "--v2-surface", "emphasised separator"),
    ("--v2-chrome-line", "--v2-chrome-bg", "chrome separator (composited)"),
    ("--v2-chrome-line-strong", "--v2-chrome-bg", "chrome separator, strong"),
]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--out")
    args = ap.parse_args()

    if not TOKENS.exists():
        sys.exit(f"tokens not found: {TOKENS}")
    tokens = load_tokens(TOKENS)

    rows, failures = [], 0
    for fg_name, bg_name, minimum, label in PAIRS:
        fg_raw, bg_raw = resolve(f"var({fg_name})", tokens), resolve(f"var({bg_name})", tokens)
        fg, bg = parse_color(fg_raw), parse_color(bg_raw)
        if not fg or not bg:
            rows.append({"fg": fg_name, "bg": bg_name, "label": label,
                         "error": f"unparsed ({fg_raw} / {bg_raw})"})
            failures += 1
            continue
        r = ratio(fg, bg)
        ok = r >= minimum
        if not ok:
            failures += 1
        rows.append({"fg": fg_name, "bg": bg_name, "label": label, "min": minimum,
                     "ratio": round(r, 2), "pass": ok,
                     "fg_hex": fg_raw, "bg_hex": bg_raw})

    info_rows = []
    for fg_name, bg_name, label in INFORMATIONAL:
        fg = parse_color(resolve(f"var({fg_name})", tokens))
        bg = parse_color(resolve(f"var({bg_name})", tokens))
        if fg and bg:
            info_rows.append({"fg": fg_name, "bg": bg_name, "label": label,
                              "ratio": round(ratio(fg, bg), 2)})

    data = {"pairs": len(PAIRS), "failures": failures, "results": rows,
            "informational": info_rows}
    if args.out:
        out = pathlib.Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(data, indent=2))
    if args.json:
        print(json.dumps(data, indent=2))
    else:
        print(f"{'FOREGROUND':30} {'BACKGROUND':26} {'MIN':>5} {'RATIO':>7}  RESULT")
        print("-" * 84)
        for r in rows:
            if "error" in r:
                print(f"{r['fg']:30} {r['bg']:26} {'':>5} {'':>7}  ERROR {r['error']}")
                continue
            mark = "pass" if r["pass"] else "**FAIL**"
            print(f"{r['fg']:30} {r['bg']:26} {r['min']:>5} {r['ratio']:>7}  {mark}")
        print(f"\n{len(PAIRS)} gated pairs checked, {failures} failing")
        print("\nDecorative separators (reported, not gated — see INFORMATIONAL):")
        for r in info_rows:
            print(f"  {r['fg']:28} on {r['bg']:24} {r['ratio']:>6}  {r['label']}")

    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
