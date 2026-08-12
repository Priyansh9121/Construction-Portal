"""
CONCEPT A — DENSE URBAN HIGH-RISE

The site is a tight city plot and the building is a tall RC tower going up
inside it. The idea being tested: VERTICALITY and CONFINEMENT. Neighbours press
against two boundaries, the street is narrow, and the tower is tall enough that
the camera has to look up at it from anywhere on the plot.

What this concept is trying to prove:

  - a tall tower reads as under construction from a distance, purely through
    silhouette: screens at the working levels, a core overrunning the top slab,
    and a pour front on the highest floor
  - an L-shaped plate with a re-entrant corner never reads as an extrusion,
    from any bearing
  - close neighbours create automatic occlusion and depth, which is what the
    production world has to survive when the camera orbits

    Blender -b -P tools/blender/concept_a.py -- [--frames hero,ground,rear]
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import concept_lib as L
import concept_frame as F

NAME = "A-urban-tower"
STOREYS = 21
STOREY_H = 3.5


def build(dusk=False):
    L.reset()
    rng = random.Random(11)
    mats = L.standard_materials(wear=0.62, lit=0.35 if dusk else 0.0)

    # ---- Ground: the plot, the street and the neighbouring lots -----------
    ground = L.box("ground", (420, 420, 0.4), (0, 0, -0.2), mats["earth"])
    # A street running past the site's south edge, with a kerb.
    L.box("road", (420, 16, 0.32), (0, -54, 0.02), mats["spandrel"])
    L.box("kerb", (420, 0.5, 0.34), (0, -46, 0.12), mats["conc"])
    L.box("pave", (420, 6.0, 0.30), (0, -43, 0.1), mats["conc"])

    # The poured ground slab the tower stands on.
    L.box("pad", (74, 62, 0.5), (0, 0, 0.2), mats["conc"])

    # ---- The tower -------------------------------------------------------
    #
    # An L-SHAPED PLATE. A rectangle extruded 21 times is the shape the eye
    # files under "model"; a re-entrant corner reads as a building from every
    # bearing, which is what a 360-degree camera demands.
    plan = [
        (-26, -20, 6, 20),      # the long wing
        (6, -20, 26, 2),        # the short return, leaving a notch
    ]
    F.build_frame(plan, STOREYS, mats, bay=8.0, storey_h=STOREY_H,
                  core=(-6, 2, 6, 18), seed=11,
                  pour_fraction=0.48, screens_from=STOREYS - 3)

    # ---- Crane: inside the plot, mast above the tower --------------------
    L.tower_crane((34, 6, 0.4), STOREYS * STOREY_H + 12, 46, mats, slew=2.5)

    # ---- Hoarding around the plot, with a gate on the street -------------
    for i in range(34):
        x = -68 + i * 4.0
        if 8 < i < 12:
            continue
        L.box("hoard", (3.9, 0.12, 2.4), (x, -42, 1.2), mats["screen"])
    for i in range(22):
        L.box("hoardE", (0.12, 3.9, 2.4), (68, -42 + i * 4.0, 1.2), mats["screen"])

    # ---- Site compound and materials, in the notch of the L --------------
    for i in range(3):
        L.box("cabin", (6.1, 2.6, 2.7), (14 + i * 7.0, -32, 1.35), mats["paint"],
              bevel=0.04)
    for i in range(6):
        L.box("stack", (2.8, 1.3, rng.uniform(0.5, 1.1)),
              (-20 + i * 3.4, -32, 0.55), mats["ply"])
    for i in range(4):
        L.box("rebarstack", (0.9, 6.0, 0.45), (-40 + i * 1.2, -30, 0.42), mats["galv"])

    # ---- People, for scale ----------------------------------------------
    for (x, y, f) in ((10, -36, 0.4), (-14, -30, 2.2), (26, -34, -1.1)):
        L.figure((x, y, 0.4), mats, facing=f)

    # ---- Neighbours: close on two sides, city beyond ---------------------
    blocks = [
        (-64, 24, 30, 34, 44, 1), (-58, 70, 26, 30, 58, 0),
        (52, 40, 34, 30, 38, 1), (60, -10, 26, 26, 30, 0),
        (10, 78, 40, 30, 66, 0), (-20, 120, 44, 36, 82, 1),
        (86, 96, 36, 32, 72, 0), (-96, 84, 32, 30, 52, 1),
        (120, 30, 40, 40, 90, 0), (-130, 10, 34, 34, 64, 0),
        (40, 150, 50, 40, 104, 1), (-70, 176, 46, 38, 96, 0),
        (150, 130, 44, 40, 78, 1), (-160, 120, 40, 40, 70, 0),
    ]
    L.context_city(rng, blocks, mats, lit=0.35 if dusk else 0.0)
    return ground


def light(dusk):
    if dusk:
        L.sky_world(3.5, 250, strength=1.0, dusk=True)
        L.sun_lamp(3.5, 250, 3.2, color=(1.0, 0.72, 0.46), angle=1.6)
    else:
        L.sky_world(38, 215, strength=1.0)
        L.sun_lamp(38, 215, 4.0, color=(1.0, 0.96, 0.9), angle=0.9)


CAMERAS = {
    # 1. LOGIN HERO: from the street, looking up the tower. 28 mm, eye height.
    "hero": ((96, -104, 2.1), (-4, -4, 40), 28),
    # 2. GROUND / HUMAN: inside the hoarding beside the compound, 35 mm.
    "ground": ((30, -36, 1.7), (-8, -6, 16), 35),
    # 3. 360 SAFETY: the far side, where nothing was composed for a camera.
    "rear": ((-92, 96, 3.0), (0, 4, 34), 35),
}


def main():
    args = L.argv()
    dusk = "--dusk" in args
    which = "hero,ground,rear"
    if "--frames" in args:
        which = args[args.index("--frames") + 1]

    build(dusk=dusk)
    light(dusk)
    suffix = "dusk" if dusk else "day"
    for key in which.split(","):
        loc, tgt, mm = CAMERAS[key.strip()]
        cam = L.camera(f"cam-{key}", loc, tgt, mm=mm)
        L.render(os.path.join(L.OUT, f"{NAME}-{suffix}-{key}.png"), cam,
                 width=1440, height=900, samples=48,
                 exposure=0.4 if dusk else 0.0)


main()
