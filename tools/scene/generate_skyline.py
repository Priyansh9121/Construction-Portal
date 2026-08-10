"""
Procedural geometry for the authentication scene.

WHY THIS IS GENERATED RATHER THAN DRAWN

The first scene was hand-authored and every proportion was a guess. Two of
them were wrong in ways only arithmetic could have caught: the crane's mast
resolved to zero length because the building tops and the apex landed on the
same y, and `preserveAspectRatio="slice"` cropped the apex off the screen at
1440x900 because nobody had worked out what it crops.

Geometry that is computed cannot make either mistake. The safe area is a
constraint here, not a hope.

THE SAFE AREA, DERIVED

    scale          = max(cw / W, ch / H)
    visible height = ch / scale     (H whenever cw/ch <= W/H)
    visible width  = cw / scale     (W whenever cw/ch >= W/H)

The tightest real case is the 768px-wide mobile band at ratio 2.74, which sees
only the bottom 583 units of a 900-unit box. Everything essential is placed
inside that.

Usage:
    python3 tools/scene/generate_skyline.py > frontend/src/components/auth/sceneGeometry.js
"""

import json
import math

W, H = 1600, 900
HORIZON = 720

# Nothing essential above this line; see the safe-area note above.
SAFE_TOP = 340
SAFE_X = (200, 1400)


def massing():
    """
    The skyline.

    Heights follow a damped alternating rhythm rather than a random walk: a
    real site has one tower under construction and shorter finished blocks
    around it, and randomness reads as noise at this scale. The tallest is
    capped so the rig has room to be legible above it -- the rig is the only
    object in the frame that is unmistakably a construction site, so the
    skyline yields to it.
    """
    blocks = []
    x = 392
    # (width, height) — the third block is the tallest, slightly off-centre,
    # because a symmetrical skyline reads as a chart.
    plan = [(176, 210), (138, 150), (190, 240), (122, 180), (158, 128)]

    for w, h in plan:
        blocks.append({"x": x, "w": w, "h": h, "y": HORIZON - h})
        x += w

    return blocks


def floors(block, spacing=38, inset=8):
    """
    Floor plates, inset from the silhouette's edge.

    A line running to the outline reads as a stripe painted on the building.
    Inset, it reads as a storey seen through an unclad frame -- which is what
    a building at this stage actually looks like, and what makes this linework
    continuous with the application's hairlines.
    """
    count = max(0, int((block["h"] - 24) // spacing))
    return [
        {
            "x1": block["x"] + inset,
            "x2": block["x"] + block["w"] - inset,
            "y": HORIZON - 30 - i * spacing,
        }
        for i in range(count)
    ]


def rig():
    """
    The tower crane.

    Proportioned from real ones: the counter-jib is roughly a third of the
    working jib, and the mast stands clear of the tallest block by enough that
    the jib is never confused with a roofline.
    """
    tallest = max(b["h"] for b in massing())
    roofline = HORIZON - tallest

    apex = SAFE_TOP + 10           # inside the safe area, with a margin
    jib_y = apex + 24

    assert apex < roofline - 100, "the rig must stand clear of the skyline"
    assert apex >= SAFE_TOP, "the rig apex must sit inside the safe area"

    x = 800
    working = 250                  # the long arm
    counter = round(working / 2.8)  # the short, weighted arm

    assert SAFE_X[0] < x - counter and x + working < SAFE_X[1], "rig outside safe x"

    return {
        "x": x,
        "apex": apex,
        "jib": jib_y,
        "jibFrom": x - counter,
        "jibTo": x + working,
        "tieFrom": x - round(counter * 0.72),
        "tieTo": x + round(working * 0.72),
        "hoist": x + round(working * 0.62),
        "load": jib_y + 94,
        "base": HORIZON,
    }


def lights(blocks):
    """
    Lit windows.

    Five, never more. This is atmosphere and it must not read as occupancy:
    a lit grid would say the site is busy, and the whole premise of the scene
    is that the day is over. Positions are derived from the floor plates so a
    light always sits ON a storey rather than floating.

    Each carries a phase so they breathe out of step. No count is ever shown
    and nothing here is data.
    """
    out = []
    picks = [(0, 4), (2, 6), (2, 2), (3, 3), (4, 1)]

    for i, (b, f) in enumerate(picks):
        block = blocks[b]
        rows = floors(block)
        if f >= len(rows):
            f = len(rows) - 1
        if f < 0:
            continue
        row = rows[f]
        out.append({
            "x": round(block["x"] + block["w"] * (0.28 + 0.16 * (i % 3))),
            "y": row["y"] - 13,
            # Seconds, deliberately non-harmonic so the pattern never repeats
            # visibly within a session.
            "delay": round(i * 5.7, 1),
            "period": round(19 + i * 3.3, 1),
        })

    return out


def main():
    blocks = massing()
    r = rig()

    scene = {
        "W": W, "H": H, "HORIZON": HORIZON,
        "safeTop": SAFE_TOP, "safeX": list(SAFE_X),
        "massing": blocks,
        "floors": [floors(b) for b in blocks],
        "rig": r,
        "lights": lights(blocks),
        "distance": [
            {"x": 150, "w": 104, "h": 128},
            {"x": 268, "w": 78, "h": 82},
            {"x": 1210, "w": 112, "h": 112},
            {"x": 1338, "w": 70, "h": 70},
        ],
    }

    total_floors = sum(len(f) for f in scene["floors"])

    print("/*")
    print(" * GENERATED — do not edit by hand.")
    print(" *")
    print(" * Source: tools/scene/generate_skyline.py")
    print(" * Regenerate:")
    print(" *   python3 tools/scene/generate_skyline.py \\")
    print(" *     > frontend/src/components/auth/sceneGeometry.js")
    print(" *")
    print(" * Every proportion here is derived, and the generator asserts the")
    print(" * two constraints that were previously got wrong by hand: the rig")
    print(" * stands clear of the skyline, and nothing essential leaves the")
    print(" * safe area that `preserveAspectRatio=\"slice\"` guarantees.")
    print(f" *")
    print(f" * {len(blocks)} blocks, {total_floors} floor plates,"
          f" {len(scene['lights'])} lit windows.")
    print(" */")
    print()
    print("const SCENE = " + json.dumps(scene, indent=2) + ";")
    print()
    print("export default SCENE;")


if __name__ == "__main__":
    main()
