"""
Procedural construction WORLD -- layered, depth-aware, deterministic.

WHY THIS REPLACES A SKYLINE FUNCTION
------------------------------------
`generate_horizon.py` draws one elevation on one plane. An elevation is not a
world: it has no depth, so it cannot parallax, cannot occlude, cannot carry
light across surfaces at different distances, and cannot vary. A single fixed
strip is exactly what reads as "a faint crane in the header".

This emits FIVE named depth planes, each a separate SVG fragment with its own
parallax coefficient, its own ink strength, and its own motion budget:

    0  haze        atmospheric gradient bands, no geometry
    1  distant     silhouette massing, lightest ink, slowest parallax
    2  frame       structural bays -- columns, beams, bracing
    3  rig         tower cranes: mast, jib, counter-jib, trolley, hook
    4  near        foreground scaffold standards and setting-out geometry

DETERMINISM
-----------
Everything derives from a seeded LCG. The same seed always produces the same
world, so a variant is reproducible, diffable, and testable. Randomness is
used for PLACEMENT and PROPORTION only -- never for anything a viewer could
read as data. The world never varies by business state.

CORRECTNESS
-----------
Assertions, not eyeballs. The crane mast rendered zero-length once because an
apex coincided with a roofline; every structural relationship that must hold
is asserted here so it cannot ship broken.

Usage:
    python3 tools/scene/generate_world.py <variant> > out.js
    python3 tools/scene/generate_world.py --all-json
"""

import json
import math
import sys

W, H = 2400, 900
GROUND = 660


class Rng:
    """Seeded LCG. Deterministic across platforms and Python versions --
    `random` is not guaranteed to be, and a world that differs between
    machines cannot be reviewed."""

    def __init__(self, seed):
        self.s = seed & 0xFFFFFFFF

    def next(self):
        self.s = (1664525 * self.s + 1013904223) & 0xFFFFFFFF
        return self.s / 0xFFFFFFFF

    def rng(self, a, b):
        return a + (b - a) * self.next()

    def irng(self, a, b):
        return int(self.rng(a, b + 1))

    def pick(self, xs):
        return xs[min(len(xs) - 1, int(self.next() * len(xs)))]


# ---------------------------------------------------------------------------
# LAYER 1 -- distant massing
# ---------------------------------------------------------------------------

def distant(r, count=14):
    """
    Silhouette blocks on a 32-unit module. Heights follow a low-frequency sine
    plus jitter so the skyline has a PROFILE -- a long rise and fall the eye
    can follow -- instead of the even noise that reads as a bar chart.
    """
    M = 32
    out, x = [], -80
    for i in range(count):
        # One rise and fall across the band. An earlier version ran the sine
        # past pi, so the tail went negative and produced 12px blocks -- the
        # assertion below caught it on the first generation, which is the
        # whole reason the assertion is there.
        wave = 0.30 + 0.70 * math.sin(i / max(1, count - 1) * math.pi)
        h = int(56 + wave * 150 + r.rng(-26, 26))
        w = r.irng(3, 8) * M
        out.append({"x": x, "y": GROUND - h, "w": w, "h": h})
        x += w + r.irng(0, 1) * M // 2
        if x > W + 80:
            break

    assert out, "distant layer generated no massing"
    assert all(b["h"] > 20 for b in out), "a silhouette block has no presence"
    return out


# ---------------------------------------------------------------------------
# LAYER 2 -- the structural frame
# ---------------------------------------------------------------------------

def frame(r, bays=9):
    """
    The building under construction: columns on a regular grid, floor beams at
    a fixed storey height, and diagonal bracing in a minority of bays.

    Storey height is CONSTANT across the frame. Irregular storeys would read
    as a mistake to anyone who has seen a structure, and this layer's whole
    job is to be recognisably real.
    """
    bay_w, storey = 118, 62
    x0 = int(W * 0.30)
    storeys = r.irng(5, 7)
    top = GROUND - storeys * storey

    cols = [{"x": x0 + i * bay_w, "y0": top, "y1": GROUND} for i in range(bays + 1)]
    beams = [
        {"y": GROUND - s * storey, "x0": x0, "x1": x0 + bays * bay_w}
        for s in range(1, storeys + 1)
    ]

    # Bracing in a minority of bays, biased low where a real frame is stiffest.
    braces = []
    for i in range(bays):
        for s in range(storeys):
            if r.next() < 0.16 - s * 0.015:
                bx, by = x0 + i * bay_w, GROUND - s * storey
                braces.append({"x0": bx, "y0": by, "x1": bx + bay_w, "y1": by - storey})

    # The topmost storey is under construction, so its slab is partial.
    partial = {"y": top, "x0": x0, "x1": x0 + int(bays * bay_w * r.rng(0.45, 0.72))}

    assert top < GROUND, "frame has no height"
    assert partial["x1"] < beams[-1]["x1"], "the partial slab is not partial"
    return {"cols": cols, "beams": beams, "braces": braces, "partial": partial,
            "top": top, "x0": x0, "x1": x0 + bays * bay_w, "storey": storey}


# ---------------------------------------------------------------------------
# LAYER 3 -- tower cranes
# ---------------------------------------------------------------------------

def crane(r, base_x, mast_top, jib_len, back_len, depth):
    """
    A tower crane reduced to its structural diagram: mast with tie levels, jib,
    counter-jib with counterweight, trolley on the jib, hook on a cable.

    `hook_y` is where the load hangs at rest. The trolley TRAVELS along the jib
    in production, so the cable attaches to the trolley's own coordinate space
    rather than to a fixed x -- the geometry emits an origin and a range, and
    the animation supplies the position.
    """
    apex = mast_top
    ties = [GROUND - (i + 1) * (GROUND - apex) / 4 for i in range(3)]
    hook_drop = r.rng(120, 200)

    g = {
        "depth": depth,
        "base": {"x": base_x, "y": GROUND},
        "apex": {"x": base_x, "y": apex},
        "ties": ties,
        "jib": {"x0": base_x, "x1": base_x + jib_len, "y": apex + 18},
        "back": {"x0": base_x - back_len, "x1": base_x, "y": apex + 18},
        "cwt": {"x": base_x - back_len, "y": apex + 10, "w": 34, "h": 22},
        "cab": {"x": base_x + 12, "y": apex + 22, "w": 26, "h": 20},
        # Trolley travel, expressed as a fraction of the jib so the animation
        # is resolution-independent.
        "travel": {"from": 0.30, "to": 0.88, "y": apex + 18},
        "hook_drop": hook_drop,
        "tower_top": {"x0": base_x - 14, "x1": base_x + 14, "y": apex},
    }

    assert g["apex"]["y"] < GROUND - 120, "crane mast is too short to read"
    assert g["jib"]["x1"] > g["base"]["x"], "jib has no length"
    assert apex + 18 + hook_drop < GROUND, "the hook hangs below ground"
    return g


def rigs(r):
    """Two cranes on DIFFERENT depth planes. One crane is a landmark; two at
    different distances is what makes the scene three-dimensional."""
    a = crane(r, base_x=int(W * 0.42), mast_top=int(GROUND - r.rng(430, 470)),
              jib_len=int(r.rng(360, 430)), back_len=int(r.rng(120, 150)), depth=0.55)
    b = crane(r, base_x=int(W * 0.74), mast_top=int(GROUND - r.rng(300, 340)),
              jib_len=int(r.rng(250, 300)), back_len=int(r.rng(90, 110)), depth=0.30)
    assert a["apex"]["y"] < b["apex"]["y"], "the near crane must read as taller"
    return [a, b]


# ---------------------------------------------------------------------------
# LAYER 4 -- foreground scaffold and setting-out geometry
# ---------------------------------------------------------------------------

def near(r):
    """
    Scaffold standards and ledgers at the front of the scene, plus survey
    setting-out marks on the ground line. This layer is heaviest in ink and
    parallaxes most, which is what sells depth: near things move more.
    """
    standards, x = [], int(W * 0.06)
    while x < W * 0.30:
        h = r.rng(150, 240)
        standards.append({"x": x, "y0": GROUND - h, "y1": GROUND + 40})
        x += r.irng(46, 62)

    ledgers = []
    if standards:
        lo = min(s["y0"] for s in standards)
        for lvl in range(3):
            y = GROUND - 60 - lvl * 62
            if y > lo:
                ledgers.append({"y": y, "x0": standards[0]["x"], "x1": standards[-1]["x"]})

    marks = [{"x": int(W * f), "label": lbl}
             for f, lbl in zip((0.12, 0.34, 0.56, 0.78, 0.94), ("A", "B", "C", "D", "E"))]

    assert len(standards) >= 3, "scaffold is too sparse to read as scaffold"
    return {"standards": standards, "ledgers": ledgers, "marks": marks}


# ---------------------------------------------------------------------------
# LAYER 0 -- atmosphere
# ---------------------------------------------------------------------------

def haze(r):
    """Three depth bands. Distance in a real site view is carried by CONTRAST
    falling off, not by fog volume, so these are wide low-opacity bands rather
    than a blur -- which is also the only version that stays cheap to paint."""
    return [
        {"y": GROUND - 300, "h": 300, "o": round(r.rng(0.030, 0.045), 4)},
        {"y": GROUND - 150, "h": 150, "o": round(r.rng(0.050, 0.070), 4)},
        {"y": GROUND - 60, "h": 90, "o": round(r.rng(0.070, 0.095), 4)},
    ]


VARIANTS = {
    # Named worlds. The seed is the whole definition, which is the point of a
    # deterministic generator: a variant is reproducible from one integer.
    "operations": 20260810,
    "register": 77120453,
    "field": 31415926,
}


def world(seed):
    r = Rng(seed)
    return {
        "seed": seed,
        "viewBox": [0, 0, W, H],
        "ground": GROUND,
        "haze": haze(r),
        "distant": distant(r),
        "frame": frame(r),
        "rigs": rigs(r),
        "near": near(r),
    }


def nodes(w):
    """SVG element count, so the cost of a world is known before it ships."""
    n = len(w["haze"]) + len(w["distant"]) + 1
    f = w["frame"]
    n += len(f["cols"]) + len(f["beams"]) + len(f["braces"]) + 1
    for g in w["rigs"]:
        n += 9 + len(g["ties"])
    n += len(w["near"]["standards"]) + len(w["near"]["ledgers"]) + len(w["near"]["marks"]) * 2
    return n


if __name__ == "__main__":
    if "--module" in sys.argv:
        # Production emit: every variant in one module. A world is ~90 nodes of
        # numbers; three of them cost less than one photograph, and shipping
        # them together is what lets a route pick its own seed without a
        # second network request.
        out = {k: world(s) for k, s in VARIANTS.items()}
        print("/* Generated by tools/scene/generate_world.py --module. Do not edit. */")
        print("/*")
        print(" * Deterministic construction worlds, five depth planes each.")
        for k, w in out.items():
            print(f" *   {k:<11} seed {w['seed']}  {nodes(w)} nodes")
        print(" *")
        print(" * Regenerate: python3 tools/scene/generate_world.py --module \\")
        print(" *   > frontend/src/components/environment/worldGeometry.js")
        print(" */")
        print()
        print(f"export const WORLDS = {json.dumps(out, separators=(',', ':'))};")
        print()
        print("export const GROUND = %d;" % GROUND)
    elif "--all-json" in sys.argv:
        out = {k: world(s) for k, s in VARIANTS.items()}
        for k, w in out.items():
            print(f"{k}: seed={w['seed']} nodes={nodes(w)}", file=sys.stderr)
        print(json.dumps(out))
    else:
        name = sys.argv[1] if len(sys.argv) > 1 else "operations"
        w = world(VARIANTS[name])
        print(f"/* Generated by tools/scene/generate_world.py {name} -- do not edit. */")
        print(f"/* {nodes(w)} SVG nodes across 5 depth planes. */")
        print(f"export const WORLD = {json.dumps(w, separators=(',', ':'))};")
