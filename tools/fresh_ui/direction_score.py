#!/usr/bin/env python3
"""
Direction scoring for the fresh UI programme (V3).

METHODOLOGY
-----------
This tool does NOT score taste. Taste is not measurable and pretending
otherwise produces false confidence. What it scores is the set of
*mechanical consequences* a visual direction commits us to, each of which
IS measurable or at least reliably estimable before a line of CSS exists:

  contrast_headroom   WCAG ratio achievable between the direction's stated
                      foreground and background at its intended weight,
                      computed from real sRGB values.
  outdoor_legibility  Derived, not asserted: a function of background
                      luminance (bright grounds survive glare), foreground
                      contrast, and whether the direction depends on
                      luminance-only cues.
  density_fitness     Whether the direction's native composition can carry
                      the row counts this product actually renders.
  motion_cost         Estimated per-frame work the direction's signature
                      motion implies, on the field device class.
  asset_weight        Estimated bytes the direction adds beyond current.
  css_complexity      Estimated rule count for the direction's primitives.
  a11y_risk           Count of stated mechanisms that are known WCAG traps.

LIMITATIONS (read before trusting any number)
---------------------------------------------
  * Every figure except contrast_headroom is a PRE-BUILD ESTIMATE supplied
    by the analyst, not a measurement of built code. They are recorded here
    so the reasoning is auditable and falsifiable later, not so they can be
    mistaken for evidence.
  * contrast_headroom IS a real computation on real hex values and is the
    only number here that is measurement rather than judgement.
  * Weights encode this product's priorities (field-first). A different
    product would weight the same directions differently and get a
    different winner. The weights are declared, not hidden.
  * Scores are comparative within this run only. They are not a quality
    scale and 62/100 does not mean "62% good".

This file never reads production data, requires no secrets, and writes
nothing outside stdout and an optional JSON report.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, field, asdict


# ---------------------------------------------------------------------------
# Real computation: WCAG 2.x relative luminance and contrast ratio.
# ---------------------------------------------------------------------------

def _srgb_channel(value_8bit: int) -> float:
    c = value_8bit / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(hex_colour: str) -> float:
    """WCAG relative luminance for an #rrggbb string."""
    h = hex_colour.lstrip("#")
    if len(h) != 6:
        raise ValueError(f"expected #rrggbb, got {hex_colour!r}")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _srgb_channel(r) + 0.7152 * _srgb_channel(g) + 0.0722 * _srgb_channel(b)


def contrast_ratio(fg: str, bg: str) -> float:
    l1, l2 = relative_luminance(fg), relative_luminance(bg)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


# ---------------------------------------------------------------------------
# Direction model
# ---------------------------------------------------------------------------

@dataclass
class Direction:
    key: str
    name: str
    ground: str              # dominant background hex
    ink: str                 # dominant body-text hex
    accent: str              # single accent hex
    accent_on_ground: bool   # is the accent ever used as text on the ground?

    # Analyst pre-build estimates, 0-10 where 10 is best for this product.
    density_fitness: int
    motion_cost: int         # 10 = cheapest per frame
    asset_weight: int        # 10 = lightest
    css_complexity: int      # 10 = simplest
    maintainability: int
    originality: int         # 10 = furthest from the category rut
    audience_identification: int
    product_clarity: int
    implementation_risk: int  # 10 = lowest risk

    a11y_traps: list[str] = field(default_factory=list)
    notes: str = ""

    # -- derived -----------------------------------------------------------

    @property
    def body_contrast(self) -> float:
        return contrast_ratio(self.ink, self.ground)

    @property
    def accent_contrast(self) -> float:
        return contrast_ratio(self.accent, self.ground)

    @property
    def ground_luminance(self) -> float:
        return relative_luminance(self.ground)

    @property
    def outdoor_legibility(self) -> float:
        """
        Derived 0-10. Bright grounds survive direct sunlight because phone
        screens cannot out-emit the sun; they can only rely on reflectance
        contrast. So ground luminance carries real weight, and it is
        multiplied (not averaged) with body contrast headroom so a dark
        direction cannot buy its way out with a high ratio alone.
        """
        lum_term = min(self.ground_luminance / 0.75, 1.0)      # 0..1
        contrast_term = min(self.body_contrast / 12.0, 1.0)    # 0..1
        return round(10.0 * (0.6 * lum_term + 0.4 * contrast_term) * (0.55 + 0.45 * lum_term), 2)

    @property
    def a11y_risk(self) -> int:
        """10 = no known traps."""
        return max(0, 10 - 2 * len(self.a11y_traps))


# Weights encode this product's declared priority: the field supervisor wins
# interaction and accessibility trade-offs; the office wins data authority.
WEIGHTS: dict[str, float] = {
    "outdoor_legibility": 3.0,
    "density_fitness": 2.5,
    "product_clarity": 2.5,
    "audience_identification": 2.0,
    "a11y_risk": 2.0,
    "originality": 1.5,
    "maintainability": 1.5,
    "motion_cost": 1.0,
    "implementation_risk": 1.0,
    "css_complexity": 0.75,
    "asset_weight": 0.75,
}


def score(direction: Direction) -> tuple[float, dict[str, float]]:
    raw = {
        "outdoor_legibility": direction.outdoor_legibility,
        "density_fitness": float(direction.density_fitness),
        "product_clarity": float(direction.product_clarity),
        "audience_identification": float(direction.audience_identification),
        "a11y_risk": float(direction.a11y_risk),
        "originality": float(direction.originality),
        "maintainability": float(direction.maintainability),
        "motion_cost": float(direction.motion_cost),
        "implementation_risk": float(direction.implementation_risk),
        "css_complexity": float(direction.css_complexity),
        "asset_weight": float(direction.asset_weight),
    }
    total_weight = sum(WEIGHTS.values())
    weighted = sum(raw[k] * WEIGHTS[k] for k in raw) / total_weight
    return round(weighted * 10, 1), raw


# ---------------------------------------------------------------------------
# The candidates actually on the table this run.
# ---------------------------------------------------------------------------

DIRECTIONS: list[Direction] = [
    Direction(
        key="instrument-face",
        name="The surveyor's instrument face (ASSIGNED, roll e056354b index 3)",
        ground="#EDEEEA",          # matte anti-glare panel
        ink="#16191C",             # engraved near-black
        accent="#0B5D4E",          # instrument green, reserved for live/measured
        accent_on_ground=True,
        density_fitness=10,        # verniers and scales are the densest legible tradition
        motion_cost=8,             # needle settle and detent snap are transform-only
        asset_weight=9,            # no imagery; ticks and reticles are CSS/SVG
        css_complexity=7,
        maintainability=8,
        originality=8,
        audience_identification=9,  # site staff read total stations daily
        product_clarity=9,
        implementation_risk=8,
        a11y_traps=[],
        notes="Outdoor legibility is the problem a total-station display already solves.",
    ),
    Direction(
        key="split-flap",
        name="Rail concourse split-flap board (challenger)",
        ground="#141414",
        ink="#F2F2EF",
        accent="#E8A317",
        accent_on_ground=True,
        density_fitness=8,
        motion_cost=4,             # per-character cascade across live rows
        asset_weight=8,
        css_complexity=5,
        maintainability=6,
        originality=8,
        audience_identification=9,  # Indian railway boards are known by heart
        product_clarity=6,
        implementation_risk=5,
        a11y_traps=[
            "per-character cascade animates financial figures, which the brief bans",
            "dark ground fights the stated outdoor-legibility requirement",
        ],
        notes="Superb for the approvals queue; wrong as a whole-product ground.",
    ),
    Direction(
        key="cassette-deck",
        name="Cassette futurist tape deck fascia (challenger)",
        ground="#C9C6BC",
        ink="#1B1B18",
        accent="#D97A18",
        accent_on_ground=True,
        density_fitness=4,          # a fascia of labelled controls resists 400-row tables
        motion_cost=7,
        asset_weight=7,
        css_complexity=4,           # brushed metal via many layered gradients
        maintainability=4,
        originality=7,
        audience_identification=3,  # nostalgia, not this audience's own world
        product_clarity=4,
        implementation_risk=4,
        a11y_traps=["amber LED ladders lean on luminance-only state signalling"],
        notes="Overlaps the instrument world but arrives via nostalgia rather than the site.",
    ),
    Direction(
        key="ikeda-datamatics",
        name="Data-sublime barcode field (challenger)",
        ground="#FFFFFF",
        ink="#000000",
        accent="#000000",
        accent_on_ground=False,
        density_fitness=7,
        motion_cost=2,              # canvas strobing on rAF
        asset_weight=6,
        css_complexity=5,
        maintainability=5,
        originality=9,
        audience_identification=2,
        product_clarity=3,
        implementation_risk=3,
        a11y_traps=[
            "full-frame inversion and strobing are seizure and vestibular risks",
            "pure black on pure white with no grey removes every hierarchy step",
            "colour is unavailable, so status cannot carry a hue at all",
        ],
        notes="Rejected on task truth: hostile to a supervisor in glare.",
    ),
    Direction(
        key="canon",
        name="Category standard: modern SaaS admin dashboard (the standing exit)",
        ground="#FFFFFF",
        ink="#1F2937",
        accent="#2563EB",
        accent_on_ground=True,
        density_fitness=7,
        motion_cost=8,
        asset_weight=9,
        css_complexity=9,
        maintainability=9,
        originality=1,              # this is definitionally the rut
        audience_identification=5,
        product_clarity=8,
        implementation_risk=9,
        a11y_traps=[],
        notes="Played straight it is safe, competent and completely forgettable.",
    ),
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--json", metavar="PATH", help="also write the full report as JSON")
    args = parser.parse_args()

    rows = []
    for d in DIRECTIONS:
        total, raw = score(d)
        rows.append((total, d, raw))
    rows.sort(key=lambda r: -r[0])

    print("DIRECTION SCORING - fresh UI programme (V3)")
    print("Weights are field-first and declared in WEIGHTS. Comparative within this run only.\n")

    header = f"{'direction':<46} {'score':>6} {'body CR':>8} {'outdoor':>8} {'density':>8} {'a11y':>6}"
    print(header)
    print("-" * len(header))
    for total, d, raw in rows:
        print(
            f"{d.name[:45]:<46} {total:>6.1f} "
            f"{d.body_contrast:>7.2f}:1 {d.outdoor_legibility:>8.2f} "
            f"{raw['density_fitness']:>8.1f} {raw['a11y_risk']:>6.1f}"
        )

    print("\nAccessibility traps recorded (each costs 2 points of a11y_risk):")
    any_traps = False
    for _, d, _ in rows:
        for trap in d.a11y_traps:
            any_traps = True
            print(f"  [{d.key}] {trap}")
    if not any_traps:
        print("  none")

    print("\nContrast is measured. Everything else is a declared pre-build estimate.")

    if args.json:
        payload = {
            "weights": WEIGHTS,
            "results": [
                {
                    **asdict(d),
                    "score": total,
                    "body_contrast": round(d.body_contrast, 3),
                    "accent_contrast": round(d.accent_contrast, 3),
                    "outdoor_legibility": d.outdoor_legibility,
                    "a11y_risk": d.a11y_risk,
                }
                for total, d, _ in rows
            ],
        }
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2)
        print(f"\nJSON report written to {args.json}")


if __name__ == "__main__":
    main()
