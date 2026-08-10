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

# A true elevation STRIP, not a scene.
#
# Measured, not chosen: the band offers 102px of clear vertical space at 1440
# and 90px at 390 before the first attention row begins. The previous 1600x200
# box rendered 190px tall, so 46% of the drawing sat behind operational
# content — which is why it read as stray lines rather than as a site.
#
# At 1600x150 the drawing is 10.7:1. In an 815px-wide box `meet` renders it
# 76px tall and anchors it to the baseline, so the WHOLE elevation lands
# inside the clear space with its ground line where the content begins.
W, H = 1600, 150
GROUND = 132


def elevation():
    """
    Five volumes, sized by a descending-then-rising rhythm so the eye reads a
    site rather than a chart. Widths are irregular multiples of a 24-unit
    module -- an elevation is drawn to a module, and a module the viewer
    cannot name is what separates "measured" from "arbitrary".
    """
    M = 24
    # Heights fit under GROUND with headroom for the rig. The tallest is
    # third and slightly off-centre: a symmetrical skyline reads as a chart.
    plan = [(7, 46), (5, 64), (9, 88), (4, 54), (6, 34)]
    blocks, x = [], 176

    for mods, h in plan:
        w = mods * M
        blocks.append({"x": x, "w": w, "h": h, "y": GROUND - h})
        x += w + M // 2

    return blocks


def datums(blocks, spacing=22, floor=52):
    """
    Storey lines — the application's row rule, drawn on a building.

    Only on volumes tall enough to carry them. At strip scale a datum on a
    34-unit block is a line 3px from another line: detail that reads at 1440
    and becomes hatching at 390. Fourteen datums became six, and the drawing
    got clearer rather than poorer.
    """
    out = []
    for b in blocks:
        if b["h"] < floor:
            out.append([])
            continue
        n = max(1, int((b["h"] - 16) // spacing))
        out.append([
            {"x1": b["x"], "x2": b["x"] + b["w"], "y": GROUND - 16 - i * spacing}
            for i in range(n)
        ])
    return out


def rig(blocks):
    """
    The rig, proportioned to the strip.

    It stands clear of the tallest volume by a margin the assertion enforces,
    because a jib level with a roofline is read as a roofline. The working jib
    is roughly 2.8x the counter-jib, as a real tower crane is.
    """
    tallest = max(b["h"] for b in blocks)
    roofline = GROUND - tallest
    apex = 14

    assert apex < roofline - 20, "the rig must stand clear of the skyline"
    assert apex > 0, "the rig apex must stay inside the box"

    x, working, counter = 700, 250, 90
    jib = apex + 14

    return {
        "x": x, "apex": apex, "jib": jib,
        "from": x - counter, "to": x + working,
        "hoist": x + 176, "load": jib + 44,
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
            "x": 150,
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
