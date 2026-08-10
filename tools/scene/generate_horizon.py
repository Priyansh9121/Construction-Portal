"""
Procedural site elevation for the application's environmental band.

DIFFERENT FROM THE LOGIN SKYLINE, DELIBERATELY

The login scene is a photograph of a place at dusk. This is an ELEVATION
DRAWING of the same place: orthographic, measured, annotated. That is the
whole difference between Cinematic Site Intelligence (which owns the
threshold) and Architectural Instrument (which owns the workspace), and it is
why the dashboard band cannot simply reuse the login geometry at a smaller
size -- it would import the wrong grammar into the operational surface.

The band is SHALLOW on purpose. It is a horizon, not a hero: it establishes
that the workspace has depth and place, then gets out of the way of the
figures.

Emits:
  - massing as an orthographic elevation, drawn in LINE not fill
  - storey datums, which are the same hairlines the application uses
  - a dimension line, which is the drawing convention that says "measured"
  - a crane, reduced to its structural diagram

Usage:
    python3 tools/scene/generate_horizon.py > frontend/src/components/dashboard/horizonGeometry.js
"""

import json

W, H = 1600, 200
GROUND = 168


def elevation():
    """
    Five volumes, sized by a descending-then-rising rhythm so the eye reads a
    site rather than a chart. Widths are irregular multiples of a 24-unit
    module -- an elevation is drawn to a module, and a module the viewer
    cannot name is what separates "measured" from "arbitrary".
    """
    M = 24
    plan = [(7, 84), (5, 116), (9, 148), (4, 96), (6, 62)]
    blocks, x = [], 176

    for mods, h in plan:
        w = mods * M
        blocks.append({"x": x, "w": w, "h": h, "y": GROUND - h})
        x += w + M // 2

    return blocks


def datums(blocks, spacing=26):
    """Storey lines. The application's row rule, drawn on a building."""
    out = []
    for b in blocks:
        n = max(1, int((b["h"] - 14) // spacing))
        out.append([
            {"x1": b["x"], "x2": b["x"] + b["w"], "y": GROUND - 14 - i * spacing}
            for i in range(n)
        ])
    return out


def rig(blocks):
    tallest = max(b["h"] for b in blocks)
    apex = GROUND - tallest - 54
    return {
        "x": 640, "apex": apex, "jib": apex + 16,
        "from": 512, "to": 872, "hoist": 800, "load": apex + 74,
        "base": GROUND,
    }


def main():
    blocks = elevation()
    data = {
        "W": W, "H": H, "GROUND": GROUND,
        "blocks": blocks,
        "datums": datums(blocks),
        "rig": rig(blocks),
        # The dimension line is the signature of a drawing. It measures the
        # tallest volume, because that is the one a reader would ask about.
        "dimension": {
            "x": 148,
            "top": GROUND - max(b["h"] for b in blocks),
            "bottom": GROUND,
            "label": f'{max(b["h"] for b in blocks) * 50} MM',
        },
    }

    total = sum(len(d) for d in data["datums"])
    print("/*")
    print(" * GENERATED — do not edit by hand.")
    print(" * Source: tools/scene/generate_horizon.py")
    print(" *")
    print(" * An orthographic site elevation for the workspace's environmental")
    print(" * band. Drawn in line rather than fill, because the workspace speaks")
    print(" * Architectural Instrument and the threshold speaks Cinematic Site")
    print(" * Intelligence — reusing the login skyline here would import the")
    print(" * wrong grammar onto an operational surface.")
    print(f" *")
    print(f" * {len(blocks)} volumes, {total} storey datums, one dimension line.")
    print(" */")
    print()
    print("const HORIZON = " + json.dumps(data, indent=2) + ";")
    print()
    print("export default HORIZON;")


if __name__ == "__main__":
    main()
