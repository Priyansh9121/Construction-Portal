"""
Towable site light tower.

WHY THIS IS AUTHORED
--------------------
It was two boxes: a 220 mm stick and a 1.5 m slab on top. A light tower is a
recognisable machine, and it is recognisable almost entirely from SILHOUETTE --
a low trailer body, four outriggers splayed at ground level, a thin telescopic
mast, and a wide lamp head cantilevered off the top. That profile is unlike
anything else on a site, which is what makes it worth authoring: it reads
correctly at a size where no amount of surface detail would.

It also earns its place in the story. This site is lit at dusk; the thing
doing the lighting should be present.

Overall 7.1 m to the top of the lamp head, matching the mast/lamp boxes the
site generator emits so the stand-in and the asset agree.

    /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/asset_light_tower.py
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_build as B

BODY_W, BODY_D, BODY_H = 1.30, 1.75, 0.95
AXLE = 0.42                 # height of the chassis over the ground
MAST_TOP = 6.70


def materials():
    return {
        "paint": B.material("lt-paint", B.srgb(0xC9A227), 0.0, 0.5),
        "galv": B.material("lt-galv", B.srgb(0x9BA3A9), 0.9, 0.4),
        "dark": B.material("lt-dark", B.srgb(0x24282C), 0.3, 0.7),
        "rubber": B.material("lt-rubber", B.srgb(0x141618), 0.0, 0.92),
        # The lens is emissive so the head reads as a LAMP even before the
        # runtime's own work lights touch it. Strength is low on purpose --
        # this is a cue, not a light source; the actual illumination comes
        # from the world's lamp rig.
        "lens": B.material("lt-lens", B.srgb(0xFFF1D0), 0.0, 0.08,
                           emission=B.srgb(0xFFE6B0), emission_strength=3.0),
    }


def trailer(M):
    """Chassis, body, wheels, drawbar and the four outriggers."""
    parts = []
    z0 = AXLE

    parts.append(B.box("chassis", (BODY_W + 0.1, BODY_D + 0.5, 0.12),
                       (0, 0, z0 - 0.06), M["dark"], bevel=0.01))
    parts.append(B.box("body", (BODY_W, BODY_D, BODY_H), (0, 0, z0 + BODY_H / 2),
                       M["paint"], bevel=0.02))
    # Louvre bands on the flanks: a generator needs cooling air, and the
    # horizontal slots are what stop the body reading as a plain crate.
    for sx in (-1, 1):
        for i in range(5):
            parts.append(B.box(f"lv{sx}{i}", (0.02, BODY_D * 0.6, 0.045),
                               (sx * (BODY_W / 2 + 0.005), -0.1,
                                z0 + 0.28 + i * 0.11), M["dark"]))
    parts.append(B.box("lid", (BODY_W + 0.06, BODY_D + 0.06, 0.06),
                       (0, 0, z0 + BODY_H + 0.02), M["paint"], bevel=0.014))
    # Exhaust, and the fuel filler cap.
    parts.append(B.tube("exhaust", 0.045, 0.5, 8, M["dark"], axis="Z"))
    parts[-1].location = (BODY_W / 2 - 0.16, -BODY_D / 2 + 0.22, z0 + BODY_H + 0.26)
    parts.append(B.tube("filler", 0.055, 0.05, 8, M["galv"], axis="Z"))
    parts[-1].location = (-BODY_W / 2 + 0.22, BODY_D / 2 - 0.3, z0 + BODY_H + 0.07)

    # Wheels. A light tower is TOWED, and the wheels are most of why it reads
    # as plant rather than as a fixed installation.
    for sx in (-1, 1):
        w = B.tube(f"wheel{sx}", 0.30, 0.18, 14, M["rubber"], axis="X")
        w.location = (sx * (BODY_W / 2 + 0.06), 0.15, 0.30)
        parts.append(w)
        h = B.tube(f"hub{sx}", 0.11, 0.20, 10, M["galv"], axis="X")
        h.location = (sx * (BODY_W / 2 + 0.06), 0.15, 0.30)
        parts.append(h)

    # Drawbar and jockey wheel.
    parts.append(B.box("drawbar", (0.09, 1.15, 0.09), (0, -BODY_D / 2 - 0.5, z0 - 0.02),
                       M["dark"]))
    parts.append(B.box("hitch", (0.16, 0.24, 0.16), (0, -BODY_D / 2 - 1.02, z0 - 0.02),
                       M["galv"], bevel=0.02))
    parts.append(B.box("jockey", (0.06, 0.06, 0.42), (0, -BODY_D / 2 - 0.66, 0.21),
                       M["galv"]))

    # Outriggers, DEPLOYED. A tower with its legs stowed is being moved; one
    # with them down is working, which is the state this site is in.
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (BODY_W / 2 + 0.30), sy * (BODY_D / 2 - 0.12)
            parts.append(B.box(f"arm{sx}{sy}", (0.62, 0.08, 0.08),
                               (sx * (BODY_W / 2 + 0.16), y, z0 - 0.04), M["galv"]))
            parts.append(B.box(f"leg{sx}{sy}", (0.055, 0.055, z0 + 0.04),
                               (x, y, (z0 + 0.04) / 2), M["galv"]))
            parts.append(B.box(f"foot{sx}{sy}", (0.20, 0.20, 0.03), (x, y, 0.015),
                               M["dark"], bevel=0.005))
    return parts


def mast(M):
    """
    Three telescopic stages, each thinner than the one below.

    The step change in section is the detail that says "telescopic" rather
    than "pole", and it costs three boxes.
    """
    parts = []
    base = AXLE + BODY_H + 0.05
    stages = [(0.155, base, 2.35), (0.125, base + 2.30, 2.20),
              (0.098, base + 4.45, MAST_TOP - (base + 4.45))]
    for i, (w, z, h) in enumerate(stages):
        parts.append(B.box(f"mast{i}", (w, w, h), (0, 0, z + h / 2),
                           M["galv"], bevel=0.006))
    # Winch and the guy the mast pivots on.
    parts.append(B.box("winch", (0.22, 0.14, 0.18), (0, -0.16, base + 0.24),
                       M["dark"], bevel=0.02))
    return parts


def head(M):
    """Crossbar and four floodlights, aimed down and outward at the work."""
    parts = []
    z = MAST_TOP
    parts.append(B.box("yoke", (0.10, 0.10, 0.24), (0, 0, z - 0.10), M["galv"]))
    parts.append(B.box("bar", (1.55, 0.09, 0.09), (0, 0, z + 0.06), M["galv"]))

    for i, x in enumerate((-0.60, -0.20, 0.20, 0.60)):
        # Each lamp is a shallow housing tilted forward, with its lens as a
        # separate emissive face. Tilt matters: four lamps facing straight
        # ahead read as a signboard, four raked down read as work lighting.
        tilt = math.radians(28)
        hz = z - 0.16
        housing = B.box(f"lamp{i}", (0.34, 0.16, 0.26), (x, -0.06, hz),
                        M["dark"], bevel=0.018)
        housing.rotation_euler = (tilt, 0, 0)
        parts.append(housing)
        lens = B.box(f"lens{i}", (0.29, 0.03, 0.21),
                     (x, -0.06 - 0.09 * math.cos(tilt), hz - 0.09 * math.sin(tilt)),
                     M["lens"])
        lens.rotation_euler = (tilt, 0, 0)
        parts.append(lens)
        parts.append(B.box(f"stirrup{i}", (0.40, 0.02, 0.06), (x, -0.02, z + 0.02),
                           M["galv"]))
    return parts


def main():
    B.reset_scene()
    M = materials()
    ob = B.join("light-tower", trailer(M) + mast(M) + head(M))
    B.set_origin_to_ground(ob)

    stats = B.export_glb(ob, os.path.join(B.ASSET_DIR, "light-tower.glb"))
    B.validate(stats, max_triangles=9000, expect_size=(2.0, 7.05, 3.0), tol=0.3)
    print(f"OK  {stats['file']}  {stats['triangles']} tris  "
          f"{stats['bytes'] / 1024:.1f} KB  size {stats['size_m']}  "
          f"{len(stats['materials'])} materials")


main()
