"""
Hoist car -- the fabricated cage that climbs the mast.

WHY THIS IS AUTHORED
--------------------
The mast is repeated lattice and stays procedural (tools/scene/generate_hoist.py).
The CAR is one welded product: a floor pan, a portal frame, mesh infill, a
canopy with an overhang, a bi-parting gate and the drive housing that grips
the mast. Its silhouette is the read, and none of it repeats.

ON MESH INFILL
--------------
The obvious move is an alpha-tested weld-mesh texture. It is the wrong one
here. At the distance this car is seen -- roughly 60 px tall at 1440 -- a
25 mm weld mesh is far below a pixel, so an alpha texture would deliver
nothing but shimmer, and alpha-tested surfaces additionally break the
depth-sorted, shadow-casting path the rest of the world uses.

What actually reads at that size is the SILHOUETTE: an open cage with visible
uprights against the sky, versus a solid box. So the infill is real bars at a
spacing chosen to survive the resolution it is seen at (~150 mm), and the
material is darkened to stand in for the light the fine mesh would swallow.
That is a deliberate trade, not a shortcut.

    /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/asset_hoist.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_build as B

# Matches the "car" block emitted by tools/scene/generate_hoist.py. If these
# disagree the car will not sit on its mast, so they are asserted at the end.
W, D, H = 1.60, 3.00, 2.40
POST = 0.075
BAR = 0.028
FLOOR = 0.10


def materials():
    return {
        # Hoists are painted in a high-visibility colour so plant operators
        # can see them against a grey site. This is the one saturated object
        # on the whole site and it earns it.
        "paint": B.material("hoist-paint", B.srgb(0xC8611A), 0.0, 0.46),
        # Bare galvanised: the mesh, the gate and the drive housing.
        "galv": B.material("hoist-galv", B.srgb(0x8A9298), 0.9, 0.44),
        # Mesh infill reads darker than the bar it is made of, because real
        # weld mesh is mostly the shadow behind it.
        "mesh": B.material("hoist-mesh", B.srgb(0x4A5157), 0.85, 0.55),
        "deck": B.material("hoist-deck", B.srgb(0x2E3338), 0.6, 0.7),
    }


def frame(M):
    """Floor pan, corner posts, portal rails and the canopy over them."""
    parts = []
    hw, hd = W / 2, D / 2

    # Floor pan with a raised lip: the car has a FLOOR, and the lip is what
    # catches the light along the bottom edge and stops the cage reading as
    # an empty wireframe.
    parts.append(B.box("pan", (W, D, FLOOR), (0, 0, FLOOR / 2), M["deck"], bevel=0.012))
    for sx in (-1, 1):
        parts.append(B.box(f"lip-x{sx}", (0.05, D, 0.14),
                           (sx * (hw - 0.025), 0, FLOOR + 0.06), M["paint"]))
    for sy in (-1, 1):
        parts.append(B.box(f"lip-y{sy}", (W, 0.05, 0.14),
                           (0, sy * (hd - 0.025), FLOOR + 0.06), M["paint"]))

    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(B.box(f"post{sx}{sy}", (POST, POST, H),
                               (sx * (hw - POST / 2), sy * (hd - POST / 2), H / 2),
                               M["paint"], bevel=0.008))

    # Head rails, then the canopy sitting on them with a real overhang.
    for sy in (-1, 1):
        parts.append(B.box(f"head-y{sy}", (W, POST, POST),
                           (0, sy * (hd - POST / 2), H - POST / 2), M["paint"]))
    for sx in (-1, 1):
        parts.append(B.box(f"head-x{sx}", (POST, D, POST),
                           (sx * (hw - POST / 2), 0, H - POST / 2), M["paint"]))
    parts.append(B.box("canopy", (W + 0.14, D + 0.14, 0.05), (0, 0, H + 0.025),
                       M["paint"], bevel=0.012))
    # Canopy edge return, the same manufactured cue the cabin roof uses.
    for sx in (-1, 1):
        parts.append(B.box(f"cret-x{sx}", (0.03, D + 0.14, 0.05),
                           (sx * (W / 2 + 0.055), 0, H - 0.02), M["paint"]))
        parts.append(B.box(f"cret-y{sx}", (W + 0.14, 0.03, 0.05),
                           (0, sx * (D / 2 + 0.055), H - 0.02), M["paint"]))
    return parts


def infill(M):
    """
    Mesh on both flanks and across the mast face above the drive housing.

    HANDEDNESS. Blender is Z-up and the exporter maps (x, y, z) to
    (x, z, -y), so Blender -Y becomes glTF +Z. The mast sits at +z in the
    world, therefore the mast side of this car is Blender -Y and the landing
    gate is Blender +Y. Getting this backwards puts the drive housing on the
    open side and the gate against the mast, which is how the first pass of
    this file was written.
    """
    parts = []
    hw, hd = W / 2, D / 2
    top = H - POST
    bot = FLOOR + 0.14

    # SOLID BELOW, MESH ABOVE. A real car is sheeted for the first metre --
    # it carries loads, and an open cage would let them out. The first pass
    # meshed the full height and the result read as a livestock crate you
    # could see straight through, which also destroyed the silhouette: an
    # object you see through has no mass.
    solid = 1.02
    for sx in (-1, 1):
        x = sx * (hw - POST / 2)
        parts.append(B.box(f"skin{sx}", (0.035, D - POST, solid - bot),
                           (x, 0, bot + (solid - bot) / 2), M["paint"]))
        n = int(D / 0.15)
        for i in range(1, n):
            y = -hd + D * i / n
            parts.append(B.box(f"bar{sx}{i}", (BAR, BAR, top - solid),
                               (x, y, solid + (top - solid) / 2), M["mesh"]))
        parts.append(B.box(f"rail{sx}", (BAR, D - POST, BAR),
                           (x, 0, solid + (top - solid) * 0.52), M["galv"]))

    # Mast face: sheeted low, the drive housing over it, mesh above that.
    y = -hd + POST / 2
    parts.append(B.box("mskin", (W - POST, 0.035, solid - bot),
                       (0, y, bot + (solid - bot) / 2), M["paint"]))
    mbot = 1.72
    mspan = top - mbot
    n = int(W / 0.15)
    for i in range(1, n):
        parts.append(B.box(f"mbar{i}", (BAR, BAR, mspan),
                           (-hw + W * i / n, y, mbot + mspan / 2), M["mesh"]))
    return parts


def gate(M):
    """
    The loading gate, on the face that meets the landing.

    Left standing OPEN. A hoist with a shut gate is parked; one with an open
    gate is being loaded, and the site is meant to read as operational.
    """
    parts = []
    hw, hd = W / 2, D / 2
    top = H - POST
    bot = FLOOR + 0.14
    span = top - bot
    y = hd - POST / 2          # +Y in Blender is the landing side

    # One leaf folded back against the flank, one part-drawn across.
    solid = 1.02
    for i, (cx, width) in enumerate(((-hw + 0.30, 0.52), (hw - 0.62, 0.34))):
        parts.append(B.box(f"gleaf{i}", (width, 0.035, solid - bot),
                           (cx, y, bot + (solid - bot) / 2), M["galv"], bevel=0.006))
        parts.append(B.box(f"gstile{i}", (0.05, 0.05, span), (cx - width / 2, y,
                                                              bot + span / 2), M["galv"]))
        parts.append(B.box(f"gstil2{i}", (0.05, 0.05, span), (cx + width / 2, y,
                                                              bot + span / 2), M["galv"]))
        n = max(2, int(width / 0.12))
        for j in range(1, n):
            parts.append(B.box(f"gbar{i}{j}", (BAR * 0.8, 0.05, top - solid),
                               (cx - width / 2 + width * j / n, y,
                                solid + (top - solid) / 2), M["mesh"]))
    # Threshold and head, which frame the opening.
    parts.append(B.box("gsill", (W - POST, 0.09, 0.06), (0, y, bot - 0.03), M["paint"]))
    parts.append(B.box("ghead", (W - POST, 0.09, 0.06), (0, y, top + 0.03), M["paint"]))
    return parts


def drive(M):
    """
    The mast interface: the drive housing, its guide rollers and the buffer
    that meets the mast. This face is what makes the car look GRIPPED to
    something rather than parked beside it.
    """
    parts = []
    hd = D / 2
    y = -hd - 0.10             # -Y in Blender is the mast side
    parts.append(B.box("dhouse", (0.72, 0.34, 1.05), (0, y - 0.06, 1.10),
                       M["galv"], bevel=0.015))
    parts.append(B.box("dmotor", (0.34, 0.30, 0.34), (0.30, y - 0.16, 1.72),
                       M["galv"], bevel=0.02))
    # Guide rollers top and bottom, which is what actually holds a car to a
    # mast and is visible as a pair of dark blocks either side.
    for sz in (0.42, 2.02):
        for sx in (-1, 1):
            parts.append(B.box(f"roll{sx}{sz}", (0.16, 0.26, 0.20),
                               (sx * 0.40, y - 0.02, sz), M["deck"], bevel=0.02))
    # Back plate tying the housing into the cage.
    parts.append(B.box("dplate", (W - 0.10, 0.05, H - 0.30), (0, -hd + 0.01, H / 2 - 0.05),
                       M["paint"]))
    return parts


def main():
    B.reset_scene()
    M = materials()
    ob = B.join("hoist", frame(M) + infill(M) + gate(M) + drive(M))
    B.set_origin_to_ground(ob)

    stats = B.export_glb(ob, os.path.join(B.ASSET_DIR, "hoist.glb"))
    # Y-up after export: X across, Y up, Z deep. Depth includes the drive
    # housing standing proud of the cage.
    B.validate(stats, max_triangles=9000,
               expect_size=(W + 0.16, H + 0.10, D + 0.5), tol=0.22)
    print(f"OK  {stats['file']}  {stats['triangles']} tris  "
          f"{stats['bytes'] / 1024:.1f} KB  size {stats['size_m']}  "
          f"{len(stats['materials'])} materials")


main()
