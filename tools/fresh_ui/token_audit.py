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
  * HSV saturation is NOT perceptual chroma (FIN-001). It is computed as
    (max - min) / max, so it depends on the brightest channel alone: a dark
    colour reports higher saturation than it looks, and a pale tint reports
    lower. Two consequences that this tool cannot fix without an OKLCH
    conversion:
      - a colour just above CHROMA_FLOOR may still read as grey to a viewer,
        which is why the BORDERLINE band below reports rather than asserts;
      - a very dark saturated colour may fall below the floor and be called
        neutral when a viewer would perceive its hue.
    What the floor DOES reliably prevent is the failure that motivated it: a
    near-grey being assigned a hue family and reported as colliding with a
    status colour, when its hue angle is numerically unstable and
    perceptually absent.
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

# Finance declares its own namespace in a sibling file (FIN-003). It is read
# alongside the core tokens so `--ui-series-*` can be resolved through the core
# ramps it references, and so section 4 below can see it at all.
FINANCE_TOKENS = TOKENS.parent / "finance.css"

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
    """Every `--ui-*: value` declaration across the system token files."""
    text = TOKENS.read_text()
    if FINANCE_TOKENS.exists():
        text += "\n" + FINANCE_TOKENS.read_text()
    return dict(re.findall(r"(--ui-[a-z0-9-]+):\s*([^;]+);", text))


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


# ---------------------------------------------------------------------------
# FIN-001: chroma is evaluated BEFORE hue, and the threshold is justified.
#
# Below CHROMA_FLOOR a colour carries no usable hue identity: the HSV hue angle
# of a near-grey is numerically unstable (tiny channel differences swing it
# tens of degrees) and perceptually absent (a viewer reads it as grey). Asking
# "which hue family is this" is then a category error, and answering it
# produces false collisions.
#
# Concretely, the project's own --ui-neutral-600 (#5f6461) computes to hue 144
# degrees, two degrees from status-success at 142. Without a floor that reads
# as a hard collision with the success colour. Its chroma is 0.050: it is grey.
#
# WHY 0.18. Set from measurements of this palette, not chosen abstractly.
# Every colour in the neutral ramp (--ui-neutral-0 through -900) measures
# between 0.000 and 0.115 saturation, the top end reached by the warm dark
# greys. A floor of 0.18 clears the highest neutral with 0.065 of margin, and
# the lowest SATURATED hue token, --ui-indigo-200 at 0.249, sits 0.069 above
# it. The floor therefore separates the two populations with comparable margin
# on each side.
#
# KNOWN FALSE NEGATIVE, accepted deliberately. --ui-indigo-50 (#f0ebfd) is a
# pale tint of the accent and measures 0.071, which is BELOW the highest
# neutral. No single saturation threshold can separate it from grey, and this
# tool will call it neutral. That is tolerable because the check exists to
# catch identity and status colours colliding; indigo-50 is a background wash,
# never a series or accent identity. A palette that used pale tints AS
# identity would need perceptual chroma (OKLCH) rather than HSV saturation.
#
# The value is a property of THIS palette. A system with cooler greys or more
# saturated tints would need a different one, which is why it is named and
# derived here rather than inlined as a literal.
CHROMA_FLOOR = 0.18

# Between the floor and this bound, classification is reported as uncertain
# rather than asserted. HSV saturation is not perceptual chroma, so a colour
# just above the floor may still read as grey; saying so is more honest than
# silently committing to a family.
#
# 0.28 sits just above --ui-indigo-200 (0.249), the palest token intended to
# carry a hue, so the palest intentional colour is reported as uncertain rather
# than asserted. Anything more saturated is classified outright.
CHROMA_BORDERLINE = 0.28


def chroma(hex_colour: str) -> float:
    """HSV saturation. See LIMITATIONS: an approximation of chroma, not chroma."""
    h = hex_colour.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return colorsys.rgb_to_hsv(r, g, b)[1]


def hue_family(hex_colour: str) -> str:
    h = hex_colour.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hue, sat, _ = colorsys.rgb_to_hsv(r, g, b)
    # Chroma first, always. Hue is only meaningful once there is enough of it.
    if sat < CHROMA_FLOOR:
        return "neutral"
    deg = hue * 360
    family = "unclassified"
    for name, lo, hi in HUE_FAMILIES:
        if lo > hi:
            if deg >= lo or deg < hi:
                family = name
                break
        elif lo <= deg < hi:
            family = name
            break

    if sat < CHROMA_BORDERLINE:
        return f"{family} (borderline chroma {sat:.2f} - may read as neutral)"

    return family


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

    # ---- 4. finance series must not drift into status -----------------
    #
    # FIN-003 gave finance its own token namespace. This is the check that
    # keeps it honest: a series colour that acquires a status hue reproduces
    # exactly the defect the namespace was created to remove, and would do so
    # silently. The legacy --ui-finance-legacy-* values are deliberately NOT
    # checked; they are the known-bad literals being migrated away from, and
    # failing on them would block every build until F-04 finishes.
    print("\n4. FINANCE SERIES / STATUS SEPARATION")

    status_families = {
        hue_family(resolve(f"--ui-status-{name}-fg", tokens) or "#000000").split(" ")[0]
        for name in ("danger", "warning", "success", "info")
    }

    series = sorted(
        n for n in tokens
        if n.startswith("--ui-series-") and "opacity" not in n
    )

    if not series:
        print("  no --ui-series-* tokens declared")

    for name in series:
        value = resolve(name, tokens)
        if not value or not value.startswith("#"):
            print(f"  skip: {name} does not resolve to a hex value")
            continue

        family = hue_family(value)
        base = family.split(" ")[0]

        if base == "neutral":
            print(f"  pass: {name} {value} is neutral (chroma {chroma(value):.3f}), no hue identity to collide")
        elif base in status_families:
            failures += 1
            print(f"  FAIL: {name} {value} reads as '{family}', which a status colour also uses")
        else:
            print(f"  pass: {name} {value} reads as '{family}', distinct from every status hue")

    print(f"\n{'ALL CHECKS PASS' if failures == 0 else f'{failures} FAILING CHECK(S)'}")
    print("Contrast is computed on token values, not rendered pixels. See LIMITATIONS.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
