"""
The Dashboard's construction world, as a real 3D scene.

WHY THIS REPLACES generate_world.py
-----------------------------------
The previous generator emitted five stroked planes. That gives LAYERING --
parallax rates and ink strength -- but not space. Nothing had volume, nothing
occluded anything, and no object could move through depth. This emits a scene
with actual coordinates, a single projection, solid faces and a deterministic
draw order, which is what makes occlusion real rather than implied.

THE SPATIAL MODEL
-----------------
One coordinate system for every object in the world:

    x   east, world units, 0 at the site's west boundary
    y   up, 0 at ground, positive upward
    z   depth, 0 at the near plane, increasing away from the camera

Projection is AXONOMETRIC, not perspective: one world unit is the same length
wherever it sits, and depth is carried by a fixed skew. Construction drawings
are drawn this way for the same reason -- a measured drawing must not change a
dimension because the object moved further away. It also means the crane at the
back and the scaffold at the front share one rule, which a per-object fake
perspective could never guarantee.

    screen_x = x + z * SKEW_X
    screen_y = HORIZON - y - z * SKEW_Y

Depth is then expressed three ways, all derived from the same z:

    - DRAW ORDER      painter's algorithm; near objects drawn last, so they
                      genuinely cover what is behind them
    - PARALLAX BAND   objects are grouped into four bands that move at
                      different rates under the camera
    - LIGHT AND AIR   faces darken and cool with distance

OCCLUSION
---------
Every solid is emitted as three faces -- front, side, top -- and the whole
scene is sorted by a depth key before it is written. There is no opacity trick
anywhere: a foreground scaffold standard covers the frame behind it because it
is painted after it, which is the same reason it would in life.

LIGHT
-----
One direction for the entire world, from the upper left and slightly in front.
Front faces take the key light, side faces fall away, top faces catch the most.
A face's shade is a function of its normal and its depth, and nothing else.

Usage:
    python3 tools/scene/generate_world3d.py --module \
      > frontend/src/components/environment/worldGeometry.js
"""

import json
import math
import sys

# ---------------------------------------------------------------------------
# The camera and the projection. These five numbers define the whole world.
# ---------------------------------------------------------------------------

VIEW_W, VIEW_H = 2400, 900
HORIZON = 700          # ground line on screen, at z = 0
SKEW_X = 0.46          # screen x gained per unit of depth
SKEW_Y = 0.30          # screen y lost per unit of depth
Z_NEAR, Z_FAR = 0.0, 620.0

# Light direction, as a unit-ish vector in world space. Upper left, in front.
LIGHT = (-0.55, 0.74, -0.38)

# Face normals for an axis-aligned box, in the order the faces are emitted.
NORMALS = {"front": (0, 0, -1), "side": (1, 0, 0), "top": (0, 1, 0)}


class Rng:
    """Seeded LCG. Deterministic across platforms; `random` is not."""

    def __init__(self, seed):
        self.s = seed & 0xFFFFFFFF

    def next(self):
        self.s = (1664525 * self.s + 1013904223) & 0xFFFFFFFF
        return self.s / 0xFFFFFFFF

    def rng(self, a, b):
        return a + (b - a) * self.next()

    def irng(self, a, b):
        return int(self.rng(a, b + 1))


def project(x, y, z):
    return (x + z * SKEW_X, HORIZON - y - z * SKEW_Y)


def depth_fog(z):
    """0 at the near plane, 1 at the far plane. Drives shade and chroma."""
    return max(0.0, min(1.0, (z - Z_NEAR) / (Z_FAR - Z_NEAR)))


def shade(normal, z):
    """
    A face's luminance: how it faces the light, then how far away it is.

    Returned as a 0..1 scalar the renderer maps onto its palette, so the
    generator never hard-codes a colour and the theme stays in CSS.
    """
    lam = sum(n * l for n, l in zip(normal, LIGHT))
    lam = (lam + 1) / 2                      # -1..1 -> 0..1
    key = 0.34 + 0.66 * lam ** 1.35          # key light with a soft falloff
    return round(max(0.06, min(1.0, key * (1 - 0.55 * depth_fog(z)))), 3)


def box(x, y, z, w, h, d, kind, tag=None):
    """
    One solid, emitted as its three visible faces.

    Only three are ever visible under a fixed axonometric camera, so the other
    three are never generated -- half the polygons in the scene, for free.
    """
    faces = []

    def poly(pts, name):
        return {
            # Integer screen coordinates. At this scale a half-pixel is below
            # the stroke width and costs ~30% of the emitted module.
            "d": "M" + " L".join(f"{round(px)} {round(py)}" for px, py in pts) + " Z",
            "s": shade(NORMALS[name], z),
            "f": name,
        }

    x0, y0, z0 = x, y, z
    x1, y1, z1 = x + w, y + h, z + d

    # front (z = z0), side (x = x1), top (y = y1)
    faces.append(poly([project(x0, y0, z0), project(x1, y0, z0),
                       project(x1, y1, z0), project(x0, y1, z0)], "front"))
    faces.append(poly([project(x1, y0, z0), project(x1, y0, z1),
                       project(x1, y1, z1), project(x1, y1, z0)], "side"))
    faces.append(poly([project(x0, y1, z0), project(x1, y1, z0),
                       project(x1, y1, z1), project(x0, y1, z1)], "top"))

    solid = {"faces": faces, "kind": kind, "z": round(z)}
    if tag:
        solid["tag"] = tag
    return solid


def band_of(z):
    """
    Four parallax bands. Band order is also the occlusion order BETWEEN bands,
    which is what lets a moving object pass behind one structure and in front
    of another: it simply lives in a band between them.
    """
    if z > 420:
        return 0            # distant massing
    if z > 230:
        return 1            # the frame under construction
    if z > 90:
        return 2            # plant: cranes, hoist, the load
    return 3                # near: scaffold, fencing, setting-out


# ---------------------------------------------------------------------------
# Scene
# ---------------------------------------------------------------------------

def distant(r):
    """Silhouette massing at the far plane. Slim depth: it reads as profile."""
    out, x = [], -180
    for i in range(16):
        h = 90 + 210 * math.sin(i / 15 * math.pi) + r.rng(-40, 40)
        w = r.irng(70, 190)
        z = r.rng(470, 610)
        out.append(box(x, 0, z, w, max(60, h), r.rng(40, 90), "mass"))
        x += w + r.irng(6, 40)
        if x > VIEW_W:
            break
    assert out, "distant band is empty"
    return out


def frame(r):
    """
    The structure under construction: columns with real section, floor slabs
    with real thickness, and a top slab that stops short because the top storey
    is still being poured.
    """
    out = []
    bays, storey, bay_w = 7, 74, 132
    x0, z0 = 560, 300
    storeys = r.irng(5, 6)
    depth = 150

    for i in range(bays + 1):
        cx = x0 + i * bay_w
        out.append(box(cx, 0, z0, 16, storeys * storey, 16, "column"))
        out.append(box(cx, 0, z0 + depth, 16, storeys * storey, 16, "column"))

    for s in range(1, storeys + 1):
        y = s * storey
        span = bays * bay_w if s < storeys else int(bays * bay_w * r.rng(0.42, 0.68))
        out.append(box(x0, y, z0, span + 16, 9, depth + 16,
                       "slab-partial" if s == storeys else "slab"))

    # The core: a solid running the full height, which is what a real frame is
    # braced against and what gives the massing a centre.
    out.append(box(x0 + 2 * bay_w, 0, z0 + 40, 78, storeys * storey + 20, 74, "core"))

    assert any(s["kind"] == "slab-partial" for s in out), "no storey under construction"
    return out, {"x0": x0, "z0": z0, "storey": storey, "storeys": storeys,
                 "bay_w": bay_w, "bays": bays, "depth": depth}


def crane(r, base_x, z, mast_h, jib_len, back_len, tag):
    """
    A tower crane with section. The jib is emitted with the SAME depth as the
    mast so the trolley travelling along it stays in one band -- the load then
    crosses in front of, or behind, whatever else occupies that depth.
    """
    out = []
    m = 15
    out.append(box(base_x, 0, z, m, mast_h, m, "mast", tag=f"{tag}-mast"))
    out.append(box(base_x - 4, mast_h, z - 4, m + 8, 13, m + 8, "cap"))
    out.append(box(base_x + m, mast_h + 6, z, jib_len, 9, 11, "jib", tag=f"{tag}-jib"))
    out.append(box(base_x - back_len, mast_h + 6, z, back_len, 9, 11, "jib"))
    out.append(box(base_x - back_len - 4, mast_h - 2, z - 3, 34, 22, 18, "cwt"))
    out.append(box(base_x + m + 6, mast_h - 16, z - 4, 24, 20, 17, "cab"))
    return out, {"x": base_x + m, "y": mast_h + 6, "z": z,
                 "jib": jib_len, "mast_h": mast_h, "tag": tag}


def near_works(r):
    """
    Foreground scaffold and site fencing. This band exists to OCCLUDE: it is
    the thing the crane's load passes behind, and the reason the site reads as
    having a front at all.
    """
    out, x = [], -60
    while x < VIEW_W * 0.42:
        h = r.rng(210, 330)
        out.append(box(x, 0, r.rng(20, 70), 11, h, 11, "standard"))
        x += r.irng(66, 96)

    for lvl in range(4):
        y = 74 + lvl * 78
        out.append(box(-60, y, 44, VIEW_W * 0.42 + 60, 7, 9, "ledger"))

    # Site fencing at the very front: a low band that grounds the whole scene.
    for i in range(20):
        out.append(box(-60 + i * 150, 0, 6, 132, 46, 6, "fence"))

    assert len([s for s in out if s["kind"] == "standard"]) >= 4, "scaffold too sparse"
    return out


def ground(r):
    """The ground plane and its setting-out grid, drawn IN the plane rather
    than laid on top of it -- the grid recedes with the same skew as the
    structures standing on it."""
    lines = []
    for i in range(11):
        z = 40 + i * 58
        a, b = project(-200, 0, z), project(VIEW_W + 200, 0, z)
        lines.append({"d": f"M{a[0]:.1f} {a[1]:.1f} L{b[0]:.1f} {b[1]:.1f}",
                      "s": round(0.30 * (1 - depth_fog(z)) + 0.05, 4)})
    for i in range(17):
        x = -200 + i * 180
        a, b = project(x, 0, 30), project(x, 0, 620)
        lines.append({"d": f"M{round(a[0])} {round(a[1])} L{round(b[0])} {round(b[1])}",
                      "s": 0.22})
    return lines


def scene(seed):
    r = Rng(seed)

    solids = []
    solids += distant(r)
    frame_solids, f = frame(r)
    solids += frame_solids

    # Two cranes at DIFFERENT depths. The near one is in the plant band and is
    # occluded by the scaffold; the far one stands behind the frame.
    c1, rig1 = crane(r, base_x=int(r.rng(700, 780)), z=200,
                     mast_h=int(r.rng(470, 520)), jib_len=int(r.rng(430, 500)),
                     back_len=int(r.rng(140, 175)), tag="a")
    c2, rig2 = crane(r, base_x=int(r.rng(1500, 1620)), z=430,
                     mast_h=int(r.rng(330, 380)), jib_len=int(r.rng(300, 350)),
                     back_len=int(r.rng(100, 130)), tag="b")
    solids += c1 + c2
    solids += near_works(r)

    assert rig1["mast_h"] > rig2["mast_h"], "the nearer crane must read as taller"

    # Painter's algorithm: far first. This IS the occlusion system.
    for s in solids:
        s["band"] = band_of(s["z"])
    solids.sort(key=lambda s: -s["z"])

    bands = [[], [], [], []]
    for s in solids:
        bands[s["band"]].append(s)

    assert all(bands), "a parallax band is empty; the scene has no depth range"

    # The hoist runs the face of the core, inside the frame band, so the frame's
    # own columns pass in front of it at either end of its travel.
    hoist = {"x": f["x0"] + 2 * f["bay_w"] + 82, "z": f["z0"] + 40,
             "y0": 20, "y1": f["storeys"] * f["storey"] - 40, "w": 26, "d": 22}

    return {
        "seed": seed,
        "viewBox": [0, 0, VIEW_W, VIEW_H],
        "horizon": HORIZON,
        "skew": [SKEW_X, SKEW_Y],
        "bands": bands,
        "ground": ground(r),
        "rigs": [rig1, rig2],
        "hoist": hoist,
        "frame": f,
        # Screen-space projection of the load path, so the renderer can move the
        # trolley along the jib without repeating the projection maths.
        "paths": [
            {"tag": t["tag"],
             "from": project(t["x"] + t["jib"] * 0.22, t["y"], t["z"]),
             "to": project(t["x"] + t["jib"] * 0.92, t["y"], t["z"])}
            for t in (rig1, rig2)
        ],
    }


# Two worlds: the room behind the page, and the window at the top of the
# instrument. A third was generated and never rendered.
VARIANTS = {"operations": 20260811, "register": 77120453}


def face_count(w):
    return sum(len(s["faces"]) for band in w["bands"] for s in band)


if __name__ == "__main__":
    out = {k: scene(s) for k, s in VARIANTS.items()}
    for k, w in out.items():
        counts = [len(b) for b in w["bands"]]
        print(f"{k:<11} seed {w['seed']}  solids/band {counts}  faces {face_count(w)}",
              file=sys.stderr)

    print("/* Generated by tools/scene/generate_world3d.py. Do not edit. */")
    print("/*")
    print(" * A true 3D scene: one axonometric projection, solid faces, and a")
    print(" * painter's-algorithm draw order that makes occlusion real.")
    for k, w in out.items():
        print(f" *   {k:<11} {face_count(w)} faces across 4 parallax bands")
    print(" *")
    print(" * Regenerate: python3 tools/scene/generate_world3d.py \\")
    print(" *   > frontend/src/components/environment/worldGeometry.js")
    print(" */")
    print()
    print(f"export const WORLDS = {json.dumps(out, separators=(',', ':'))};")
