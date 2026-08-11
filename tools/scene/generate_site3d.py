"""
The construction site as a real 3D scene description.

This emits WORLD GEOMETRY IN METRES, not screen coordinates. Nothing here
knows about a viewport, a projection or a renderer -- the runtime places a
camera in this world and looks at it. That is the difference between a 3D
scene and a drawing that looks three-dimensional.

Everything is deterministic from one seed, so a site is reproducible, diffable
and reviewable. The generator's job is layout and structure; lighting,
materials and camera work belong to the runtime.

Emits:
  ground      extent of the site
  massing     background city blocks, coarse
  frame       the building under construction: grid, columns, slabs, core
  scaffold    standards, ledgers and boards on the near face
  crane       tower crane: mast, jib, counter-jib, tie levels, trolley range
  hoist       a mast-climbing hoist on the frame's flank
  works       site cabins, material stacks, fencing
  lights      work-light positions and their aim
  cameras     named camera stations and the paths between them

Usage:
    python3 tools/scene/generate_site3d.py > frontend/src/world/siteGeometry.json
"""

import json
import math
import sys

M = 1.0  # one unit is one metre


class Rng:
    def __init__(self, seed):
        self.s = seed & 0xFFFFFFFF

    def next(self):
        self.s = (1664525 * self.s + 1013904223) & 0xFFFFFFFF
        return self.s / 0xFFFFFFFF

    def f(self, a, b):
        return a + (b - a) * self.next()

    def i(self, a, b):
        return int(self.f(a, b + 1))


def r3(v):
    return round(v, 3)


def box(x, y, z, w, h, d, kind):
    """A solid, positioned by its CENTRE in world metres -- which is how a
    scene graph wants it, and avoids an off-by-half at every call site."""
    return {"k": kind, "p": [r3(x), r3(y), r3(z)], "s": [r3(w), r3(h), r3(d)]}


# ---------------------------------------------------------------------------

def frame(r):
    """
    The building under construction.

    A real frame is a GRID: columns on a regular bay, slabs at a constant
    storey height, a stair/lift core running the full height, and a top storey
    that is only partly poured because that is where the work is. Irregular
    storeys read as a mistake to anyone who has stood on a site.
    """
    bays_x, bays_z = 6, 4
    bay, storey = 7.2, 3.6
    storeys = r.i(9, 11)
    col = 0.62
    ox, oz = -bays_x * bay / 2, -bays_z * bay / 2

    out = []
    for i in range(bays_x + 1):
        for j in range(bays_z + 1):
            h = storeys * storey
            out.append(box(ox + i * bay, h / 2, oz + j * bay, col, h, col, "column"))

    slabs = []
    for s in range(1, storeys + 1):
        y = s * storey
        full = s < storeys
        w = bays_x * bay if full else bays_x * bay * r.f(0.42, 0.64)
        slabs.append(box(ox + w / 2, y, 0, w, 0.34, bays_z * bay,
                         "slab" if full else "slab-pour"))

    core = box(ox + 2 * bay, storeys * storey / 2 + 2, oz + 2 * bay,
               bay * 1.05, storeys * storey + 4, bay * 1.05, "core")

    assert any(s["k"] == "slab-pour" for s in slabs), "no storey under construction"
    return {"columns": out, "slabs": slabs, "core": core,
            "grid": {"bay": bay, "storey": storey, "storeys": storeys,
                     "bays_x": bays_x, "bays_z": bays_z, "ox": ox, "oz": oz}}


def crane(r, g):
    """
    A tower crane, sized against the building it serves.

    The jib must actually reach across the frame or the machine is decoration:
    that is asserted, not hoped for. The mast stands clear of the slab edge so
    it does not intersect the structure.
    """
    base_x = g["ox"] - 6.5
    base_z = g["oz"] + g["bays_z"] * g["bay"] * 0.5
    mast_h = g["storeys"] * g["storey"] + r.f(9, 13)
    jib = r.f(38, 46)
    back = jib * 0.34

    reach = base_x + jib
    assert reach > g["ox"] + g["bays_x"] * g["bay"] * 0.6, "jib cannot reach the frame"

    ties = [round(mast_h * f, 2) for f in (0.34, 0.58, 0.8)]
    return {"base": [r3(base_x), 0, r3(base_z)], "mast_h": r3(mast_h),
            "mast_w": 1.5, "jib": r3(jib), "back": r3(back), "ties": ties,
            "trolley": [r3(jib * 0.28), r3(jib * 0.9)],
            "hook_drop": [r3(mast_h * 0.28), r3(mast_h * 0.72)]}


def scaffold(r, g):
    """Standards, ledgers and boards on the near face -- the layer the camera
    passes closest to, and the reason the site has a foreground at all."""
    z = g["oz"] - 1.9
    x0 = g["ox"] - 1.5
    span = g["bays_x"] * g["bay"] + 3
    lifts = 7
    standards = [box(x0 + i * 2.4, lifts * 2 / 2, z, 0.09, lifts * 2, 0.09, "tube")
                 for i in range(int(span / 2.4) + 1)]
    ledgers = [box(x0 + span / 2, 2 + l * 2, z, span, 0.08, 0.08, "tube")
               for l in range(lifts)]
    boards = [box(x0 + span / 2, 2 + l * 2 + 0.06, z + 0.35, span, 0.05, 0.7, "board")
              for l in range(1, lifts, 2)]
    assert len(standards) >= 6, "scaffold too sparse to read as scaffold"
    return {"standards": standards, "ledgers": ledgers, "boards": boards}


def massing(r):
    """
    Background city. Coarse on purpose: it is silhouette and depth cue, and
    every polygon spent here is one not spent on the structure in focus.

    Placed on an arc that EXCLUDES the camera's own quadrant. The first version
    scattered blocks on a full circle and one landed between the camera and the
    site, filling the right of frame with a dark slab — background geometry in
    the foreground, which a render showed at once. The camera stations all sit
    toward +x/+z, so that wedge is kept clear and everything else reads as
    distance.
    """
    out = []
    # The camera looks from roughly 45 degrees; keep 110 degrees around it free.
    blocked = (math.radians(-10), math.radians(100))
    placed = 0
    guard = 0
    while placed < 26 and guard < 400:
        guard += 1
        a = r.f(0, math.tau)
        d = r.f(110, 250)
        norm = a % math.tau
        if blocked[0] % math.tau <= norm <= blocked[1] % math.tau and d < 200:
            continue
        h = r.f(14, 74)
        w, dp = r.f(10, 26), r.f(10, 26)
        out.append(box(math.cos(a) * d, h / 2, math.sin(a) * d - 30, w, h, dp, "mass"))
        placed += 1

    assert placed >= 18, "massing band too sparse after exclusion"
    return out


def works(r, g):
    """Site cabins, material stacks and hoarding -- the things that make a
    construction site a workplace rather than a model of a building."""
    out = []
    for i in range(3):
        out.append(box(g["ox"] - 16 + i * 7, 1.4, g["oz"] + 26, 6.2, 2.8, 2.6, "cabin"))
    for i in range(7):
        out.append(box(g["ox"] + 4 + (i % 4) * 3.4, 0.5, g["oz"] + 21 + (i // 4) * 3,
                       3.0, 1.0, 1.4, "stack"))
    span = g["bays_x"] * g["bay"] + 26
    out.append(box(g["ox"] + span / 2 - 13, 1.2, g["oz"] + 31, span, 2.4, 0.2, "hoarding"))
    return out


def lights(r, g):
    """Work lights: position and aim. Warm, low, and pointed at the work --
    which is what makes a night site read as being worked rather than lit."""
    out = []
    for i in range(4):
        x = g["ox"] + i * (g["bays_x"] * g["bay"] / 3)
        out.append({"p": [r3(x), r3(g["storeys"] * g["storey"] * r.f(0.35, 0.85)), r3(g["oz"] - 3)],
                    "aim": [r3(x + r.f(-6, 6)), r3(r.f(4, 14)), r3(g["oz"] + 8)],
                    "warm": True})
    out.append({"p": [r3(g["ox"] - 22), 26, r3(g["oz"] - 24)],
                "aim": [0, 8, 0], "warm": False})
    return out


def cameras(g):
    """
    Camera stations, and the choreography between them.

    Named rather than numeric so the runtime reads as direction: an approach
    that holds the whole site, a working station beside the form, and the
    interior the sign-in flight arrives at. Movement is always between two
    stations -- a camera that wanders has no composition.
    """
    top = g["storeys"] * g["storey"]
    span = g["bays_x"] * g["bay"]

    # Distances are derived from the building, not chosen. A 43m frame at
    # fov 32 needs roughly 2.2x its span to sit in shot with air around it;
    # the first version was framed at 57m and put the camera inside the
    # structure, which a render showed immediately.
    d = span * 2.6
    return {
        # Wide: the whole site, the crane above it and the skyline behind.
        "approach": {"pos": [d * 0.78, top * 1.5, d * 1.05],
                     "look": [-span * 0.1, top * 0.5, 0], "fov": 32},
        # Working: closer and lower, the frame filling the right of frame while
        # the form holds the left.
        "station": {"pos": [d * 0.6, top * 1.05, d * 0.78],
                    "look": [-span * 0.12, top * 0.46, 0], "fov": 34},
        # Focus: a small push in. The move must read without being noticed.
        "focus": {"pos": [d * 0.53, top * 0.95, d * 0.68],
                  "look": [-span * 0.14, top * 0.42, 0], "fov": 33},
        # The sign-in flight ends inside the structure, at slab level.
        "through": {"pos": [span * 0.1, top * 0.55, g["bays_z"] * g["bay"] * 0.4],
                    "look": [-span * 0.6, top * 0.5, -g["bays_z"] * g["bay"]], "fov": 54},
        # Where the destination takes over: looking down the frame's centre
        # bay, which is the corridor the handover flight travels.
        "operational": {"pos": [0, top * 0.5, d * 0.42],
                        "look": [0, top * 0.46, -g["bays_z"] * g["bay"] * 2], "fov": 40},
    }


def cameras_portrait(g):
    """
    A phone gets its OWN stations, not the desktop ones at a taller aspect.
    Reusing them cropped into the structure and lost the site and the crane
    entirely — visible the moment it was rendered.

    Portrait wants height, not width: the camera stands back and low so the
    frame rises through the shot with the crane above it, and the form occupies
    the lower half against sky and massing rather than against a wall of slabs.
    """
    top = g["storeys"] * g["storey"]
    span = g["bays_x"] * g["bay"]
    d = span * 3.4
    return {
        "approach": {"pos": [d * 0.5, top * 0.42, d * 0.86],
                     "look": [-span * 0.05, top * 0.78, 0], "fov": 44},
        "station": {"pos": [d * 0.42, top * 0.34, d * 0.72],
                    "look": [-span * 0.05, top * 0.72, 0], "fov": 46},
        "focus": {"pos": [d * 0.38, top * 0.3, d * 0.64],
                  "look": [-span * 0.06, top * 0.66, 0], "fov": 45},
        "through": {"pos": [span * 0.06, top * 0.5, g["bays_z"] * g["bay"] * 0.5],
                    "look": [-span * 0.2, top * 0.48, -g["bays_z"] * g["bay"] * 2],
                    "fov": 62},
        "operational": {"pos": [0, top * 0.5, d * 0.3],
                        "look": [0, top * 0.46, -g["bays_z"] * g["bay"] * 2], "fov": 52},
    }


def site(seed):
    r = Rng(seed)
    f = frame(r)
    g = f["grid"]
    return {
        "seed": seed,
        "units": "metres",
        "ground": 520,
        "frame": f,
        "crane": crane(r, g),
        "scaffold": scaffold(r, g),
        "massing": massing(r),
        "works": works(r, g),
        "lights": lights(r, g),
        "cameras": cameras(g),
        "camerasPortrait": cameras_portrait(g),
    }


def counts(s):
    f = s["frame"]
    return (len(f["columns"]) + len(f["slabs"]) + 1 + len(s["massing"])
            + len(s["works"]) + sum(len(v) for v in s["scaffold"].values()))


if __name__ == "__main__":
    out = site(20260811)
    print(f"solids {counts(out)}  storeys {out['frame']['grid']['storeys']}  "
          f"lights {len(out['lights'])}  cameras {len(out['cameras'])}", file=sys.stderr)
    print(json.dumps(out, separators=(",", ":")))
