#!/usr/bin/env python3
"""
Design system token audit: contrast, ramp monotonicity, and semantic-collision checks.

METHODOLOGY
-----------
Parses frontend/src/styles/system/core/tokens.css, resolves var() indirection to
literal hex values, then runs three checks that are genuine computation rather
than judgement:

  1. CONTRAST     WCAG 2.x ratios for every gated foreground/background pair.
  2. MONOTONIC    the neutral ramp must decrease in luminance monotonically.
                  A single out-of-order value (a stray hue dropped into a grey
                  ramp) is invisible in review and obvious here.
  3. COLLISION    the brand accent must not share a hue family with any status
                  colour. This is the V1 defect V3 exists to fix, so it is
                  asserted mechanically rather than trusted to discipline.

LIMITATIONS
-----------
  * Contrast is computed on token values, NOT on rendered pixels. Opacity,
    blend modes, backdrop filters and overlapping elevation can all change
    what a user actually sees. Runtime verification is a separate job that
    belongs to the axe and contrast suites against a real browser.
  * Hue-family classification uses HSV hue arcs, which is a coarse model. It
    is good enough to catch "the accent is the same blue as the info status"
    and is not intended for fine colour science.
  * This tool reads source only. It never touches production data, needs no
    secrets, and deletes nothing.

Exit code is non-zero when any gated check fails, so it can gate a phase.
"""

from __future__ import annotations

import colorsys
import re
import sys
from pathlib import Path

TOKENS = Path(__file__).resolve().parents[2] / "frontend/src/styles/system/core/tokens.css"

# Gated pairs: (foreground token, background token, required ratio, why)
GATED_PAIRS = [
    ("--ui-ink-strong", "--ui-canvas", 4.5, "primary text on the page canvas"),
    ("--ui-ink-strong", "--ui-surface", 4.5, "primary text on a card"),
    ("--ui-ink", "--ui-canvas", 4.5, "body text on the page canvas"),
    ("--ui-ink", "--ui-surface", 4.5, "body text on a card"),
    ("--ui-ink", "--ui-surface-sunken", 4.5, "body text on a sunken surface"),
    ("--ui-ink-muted", "--ui-canvas", 4.5, "secondary text must still pass AA"),
    ("--ui-ink-muted", "--ui-surface", 4.5, "secondary text on a card"),
    ("--ui-ink-faint", "--ui-surface", 3.0, "meta text, large or non-essential"),
    ("--ui-ink-on-accent", "--ui-accent", 4.5, "primary button label"),
    ("--ui-ink-on-accent", "--ui-accent-hover", 4.5, "primary button label, hover"),
    ("--ui-accent", "--ui-canvas", 4.5, "accent used as a text link"),
    ("--ui-accent", "--ui-surface", 4.5, "accent as a link on a card"),
    ("--ui-accent", "--ui-accent-subtle", 4.5, "accent text in its own tint"),
    ("--ui-focus", "--ui-canvas", 3.0, "focus ring against the canvas"),
    ("--ui-focus", "--ui-surface", 3.0, "focus ring against a card"),
    ("--ui-line-strong", "--ui-surface", 3.0, "control boundary, WCAG 2.2 non-text"),
    ("--ui-line", "--ui-surface", 1.4, "decorative hairline, reported not gated"),
]

NEUTRAL_RAMP = [
    "--ui-neutral-0", "--ui-neutral-25", "--ui-neutral-50", "--ui-neutral-100",
    "--ui-neutral-200", "--ui-neutral-300", "--ui-neutral-400",
    "--ui-neutral-500", "--ui-neutral-600", "--ui-neutral-700",
    "--ui-neutral-800", "--ui-neutral-900",
]

# Hue arcs in degrees. Coarse on purpose; see LIMITATIONS.
HUE_FAMILIES = [
    ("red", 345, 15), ("amber", 25, 55), ("green", 85, 165),
    ("cyan", 165, 195), ("blue", 195, 250), ("indigo", 250, 280),
    ("violet", 280, 320), ("magenta", 320, 345),
]

DECL = re.compile(r"^\s*(--ui-[a-z0-9-]+)\s*:\s*([^;]+);", re.MULTILINE)
VAR = re.compile(r"var\(\s*(--ui-[a-z0-9-]+)\s*\)")
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def load_tokens() -> dict[str, str]:
    text = TOKENS.read_text(encoding="utf-8")
    return {m.group(1): m.group(2).strip() for m in DECL.finditer(text)}


def resolve(name: str, tokens: dict[str, str], depth: int = 0) -> str | None:
    if depth > 12 or name not in tokens:
        return None
    value = tokens[name]
    if HEX.match(value):
        return value.lower()
    ref = VAR.search(value)
    return resolve(ref.group(1), tokens, depth + 1) if ref else None


def _channel(v: int) -> float:
    c = v / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_colour: str) -> float:
    h = hex_colour.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _channel(r) + 0.7152 * _channel(g) + 0.0722 * _channel(b)


def contrast(fg: str, bg: str) -> float:
    a, b = luminance(fg), luminance(bg)
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)


def hue_family(hex_colour: str) -> str:
    h = hex_colour.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hue, sat, _ = colorsys.rgb_to_hsv(r, g, b)
    if sat < 0.18:
        return "neutral"
    deg = hue * 360
    for name, lo, hi in HUE_FAMILIES:
        if lo > hi:
            if deg >= lo or deg < hi:
                return name
        elif lo <= deg < hi:
            return name
    return "unclassified"


def main() -> int:
    tokens = load_tokens()
    failures = 0

    print("DESIGN SYSTEM TOKEN AUDIT")
    print(f"source: {TOKENS.relative_to(TOKENS.parents[4])}\n")

    # ---- 1. contrast --------------------------------------------------
    print("1. CONTRAST")
    print(f"{'foreground':<24} {'background':<24} {'need':>6} {'got':>7}  result")
    print("-" * 76)
    for fg_name, bg_name, need, why in GATED_PAIRS:
        fg, bg = resolve(fg_name, tokens), resolve(bg_name, tokens)
        if not fg or not bg:
            print(f"{fg_name:<24} {bg_name:<24} {'?':>6} {'?':>7}  UNRESOLVED")
            failures += 1
            continue
        ratio = contrast(fg, bg)
        gated = need > 1.5
        ok = ratio >= need
        verdict = "pass" if ok else ("FAIL" if gated else "info")
        if gated and not ok:
            failures += 1
        print(f"{fg_name:<24} {bg_name:<24} {need:>6.1f} {ratio:>6.2f}:1  {verdict}   {why}")

    # ---- 2. ramp monotonicity ----------------------------------------
    print("\n2. NEUTRAL RAMP MONOTONICITY")
    previous = None
    for name in NEUTRAL_RAMP:
        value = resolve(name, tokens)
        if not value:
            print(f"  {name:<20} UNRESOLVED")
            failures += 1
            continue
        lum = luminance(value)
        family = hue_family(value)
        flag = ""
        if previous is not None and lum > previous:
            flag = "  <-- OUT OF ORDER: lighter than the step before it"
            failures += 1
        if family != "neutral":
            flag += f"  <-- NOT NEUTRAL: reads as {family}"
            failures += 1
        print(f"  {name:<20} {value}  lum={lum:.4f}{flag}")
        previous = lum

    # ---- 3. semantic collision ---------------------------------------
    print("\n3. ACCENT / STATUS COLLISION")
    accent = resolve("--ui-accent", tokens)
    if not accent:
        print("  --ui-accent UNRESOLVED")
        failures += 1
    else:
        family = hue_family(accent)
        reserved = {"red", "amber", "green", "blue"}
        print(f"  --ui-accent {accent} reads as hue family: {family}")
        if family in reserved:
            print(f"  FAIL: {family} carries semantic status meaning and is banned as branding")
            failures += 1
        elif family == "neutral":
            print("  FAIL: the accent has collapsed to neutral and cannot carry identity")
            failures += 1
        else:
            print(f"  pass: {family} carries no status meaning in this system")

    print(f"\n{'ALL CHECKS PASS' if failures == 0 else f'{failures} FAILING CHECK(S)'}")
    print("Contrast is computed on token values, not rendered pixels. See LIMITATIONS.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
