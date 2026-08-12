"""
CONCEPT C — TIGHT INNER-CITY INFILL

THE ARCHITECTURAL IDEA
----------------------
A narrow plot between two existing buildings. The site is 22 m wide and 34 m
deep with PARTY WALLS on both flanks, so there is exactly one elevation facing
the street and one facing a rear laneway. Everything about the project is
governed by that constraint:

  no side windows      both flanks are blind party walls against the
                       neighbours, so the whole facade budget goes to the
                       street elevation
  a single stair core  a wider plot could afford two; this one cannot, so the
                       core sits hard against the north party wall
  the setback          the upper two floors step back from the street to keep
                       daylight in the flats opposite -- a planning
                       constraint, visible as form
  scaffold everywhere  with no room for a crane pad, the street elevation is
                       fully scaffolded and a mast climber does the lifting

WHY THIS IS A DIFFERENT TEST FROM CONCEPT B
-------------------------------------------
B is wide, low and seen across an open corner: its problem is horizontal
composition. C is narrow, tall and seen up a street with buildings pressing in
on both sides: its problem is VERTICAL composition and occlusion. If the
production camera can orbit this and never find a bad angle, it can orbit
anything -- because most of what the camera sees here is other people's
buildings.

    Blender -b -P tools/blender/concept_c.py -- [--frames hero,ground,rear] [--dusk]
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import concept_lib as L
import concept_mesh as M

NAME = "C-infill"

# ---- The plot, in metres ---------------------------------------------------
PX0, PX1 = -11.0, 11.0          # 22 m frontage
PY0, PY1 = -17.0, 17.0          # 34 m deep
GROUND_H = 4.6                  # a taller commercial ground floor
STOREY_H = 3.3
LEVELS = 7
SETBACK_FROM = 6                # upper levels step back from the street
CORE = (4.0, 8.0, 10.0, 16.0)   # hard against the north party wall
STAIR = (-10.0, 9.0, -5.0, 16.0)


def plate(level):
    """The plan steps back from the street on the top two levels, and the
    street corner is chamfered where the entrance meets the footpath."""
    y0 = PY0 + (4.5 if level >= SETBACK_FROM else 0.0)
    return M.chamfered(PX0, y0, PX1, PY1, 3.5)


def build(dusk=False):
    L.reset()
    rng = random.Random(41)
    mats = L.standard_materials(wear=0.72, lit=0.5 if dusk else 0.0)
    parts = {"conc": [], "galv": [], "ply": [], "paint": [], "glass": []}

    top = GROUND_H + LEVELS * STOREY_H

    # ---- Street, footpath, laneway --------------------------------------
    L.box("ground", (500, 500, 0.4), (0, 0, -0.2), mats["earth"])
    L.box("street", (500, 13, 0.32), (0, -31, 0.04), mats["spandrel"])
    L.box("kerb", (500, 0.35, 0.4), (0, -24.6, 0.18), mats["conc"])
    L.box("path", (500, 7.2, 0.34), (0, -21, 0.15), mats["conc"])
    L.box("lane", (500, 7.0, 0.3), (0, 26, 0.04), mats["spandrel"])
    L.box("sitepad", (26, 38, 0.4), (0, 0, 0.18), mats["conc"])

    # ---- NEIGHBOURS, hard against both flanks ---------------------------
    #
    # These are the concept. The site is a gap in a terrace, so the
    # neighbours are foreground architecture, not background LOD: real
    # window reveals, sills, parapets and a service door at street level.
    for side, sx in (("W", -1), ("E", 1)):
        nx = sx * (11.0 + 9.0)
        nh = 24.0 if sx < 0 else 19.0
        body = M.prism(f"nb{side}", M.rect(nx - 9, PY0 - 3, nx + 9, PY1 + 3),
                       0.2, nh, mats["city_warm"] if sx < 0 else mats["city_cool"],
                       bevel=0.05)
        parts["conc"].append(body)
        # A real parapet with a coping, not a cut top.
        parts["conc"].append(
            M.parapet(f"np{side}", M.rect(nx - 9.3, PY0 - 3.3, nx + 9.3, PY1 + 3.3),
                      nh + 0.2, 1.1, 0.45, mats["conc"]))
        # Window reveals down the street elevation: real recesses, so the sun
        # puts a shadow in every one.
        for lv in range(1, int(nh / 3.4)):
            for i in range(4):
                wx = nx - 6.6 + i * 4.4
                rec = M.prism(f"nw{side}{lv}{i}",
                              M.rect(wx - 1.05, PY0 - 3.35, wx + 1.05, PY0 - 2.75),
                              0.2 + lv * 3.4, 1.7)
                M.cut(body, rec)
        # Rooftop plant, off-centre.
        parts["conc"].append(
            L.box(f"nplant{side}", (4.2, 3.4, 2.2), (nx + sx * 2.5, 4.0, nh + 1.3),
                  mats["city_cool"]))

    # ---- THE PROJECT ----------------------------------------------------
    # Party walls: blind concrete up both flanks, cast against the neighbours.
    for sx in (-1, 1):
        parts["conc"].append(
            M.wall(f"party{sx}", (sx * 10.7, PY0), (sx * 10.7, PY1),
                   top, 0.3, mats["conc"], z=0.2))

    # Ground floor: a tall open frame with the entrance in the chamfer.
    for x in (-7.5, 0.0, 7.5):
        for y in (-14.0, -4.0, 6.0, 15.0):
            if CORE[0] < x < CORE[2] and CORE[1] < y < CORE[3]:
                continue
            parts["conc"].append(
                M.column(f"gc{x}{y}", x, y, 0.4, GROUND_H, 0.55, mats["conc"]))

    for lvl in range(1, LEVELS + 1):
        z = GROUND_H + lvl * STOREY_H
        outline = plate(lvl)
        voids = [CORE, STAIR]

        if lvl == LEVELS:
            # Top level: formwork deck over falsework, no slab yet.
            parts["ply"].append(
                M.prism("deck", M.rect(PX0 + 0.4, PY0 + 5, PX1 - 0.4, PY1 - 0.4),
                        z - 0.3, 0.06, mats["ply"]))
            for i in range(11):
                yy = PY0 + 5.6 + i * 1.05
                parts["ply"].append(
                    M.prism(f"sol{i}", M.rect(PX0 + 0.4, yy - 0.08, PX1 - 0.4, yy + 0.08),
                            z - 0.56, 0.24, mats["ply"]))
        elif lvl == LEVELS - 1:
            # The pour front runs across the plate.
            slab = M.slab(f"slab{lvl}", outline, z, 0.3, mats["wet"],
                          voids=voids, edge_band=0.3)
            cutter = M.prism("pcut", M.rect(-2.0, PY0 - 6, PX1 + 6, PY1 + 6),
                             z - 2.0, 4.0)
            M.cut(slab, cutter)
            parts["conc"].append(slab)
            # Starter bars beyond the pour front.
            for x in (-7.5, 0.0, 7.5):
                if x < -2.0:
                    continue
                for y in (-10.0, 0.0, 10.0):
                    for dx, dy in ((-0.18, -0.18), (0.18, -0.18), (0.18, 0.18), (-0.18, 0.18)):
                        h = rng.uniform(0.8, 1.2)
                        parts["galv"].append(
                            L.cyl("bar", 0.014, h, (x + dx, y + dy, z + h / 2),
                                  mats["galv"], verts=5))
        else:
            parts["conc"].append(
                M.slab(f"slab{lvl}", outline, z, 0.3, mats["conc"],
                       voids=voids, edge_band=0.3))

        # Street edge beam, so the facade line has depth.
        y0 = PY0 + (4.5 if lvl >= SETBACK_FROM else 0.0)
        eb = M.wall(f"eb{lvl}", (PX0, y0), (PX1, y0), 0.7, 0.36, mats["conc"],
                    z=z - 0.3 - 0.7)
        if eb:
            parts["conc"].append(eb)

        # Internal columns.
        if lvl < LEVELS:
            for x in (-7.5, 0.0, 7.5):
                for y in (-14.0, -4.0, 6.0, 15.0):
                    if CORE[0] < x < CORE[2] and CORE[1] < y < CORE[3]:
                        continue
                    if y < y0:
                        continue
                    parts["conc"].append(
                        M.column(f"c{lvl}{x}{y}", x, y, z, STOREY_H, 0.5, mats["conc"]))

        # Falsework under the two newest plates.
        if lvl >= LEVELS - 1:
            x = PX0 + 1.6
            while x < PX1 - 1.0:
                y = PY0 + 6.0
                while y < PY1 - 1.0:
                    parts["galv"].append(
                        L.cyl("prop", 0.045, STOREY_H - 0.35,
                              (x, y, z - STOREY_H + (STOREY_H - 0.35) / 2),
                              mats["galv"], verts=6))
                    y += 1.8
                x += 1.8

        if lvl < LEVELS - 1:
            for h in (0.5, 1.05):
                parts["galv"].append(
                    M.prism(f"rail{lvl}{h}", M.rect(PX0 + 0.3, y0, PX1 - 0.3, y0 + 0.09),
                            z + h, 0.045, mats["galv"]))

    # ---- Core and stair, as real walls ----------------------------------
    parts["conc"] += M.stair_core("core", *CORE, 0.2, top + 3.4, mats["conc"], 0.25)
    parts["conc"] += M.stair_core("stair", *STAIR, 0.2, top + 1.2, mats["conc"], 0.22)

    # ---- SCAFFOLD ACROSS THE WHOLE STREET ELEVATION ---------------------
    #
    # With no room for a crane pad, the street face carries a full scaffold and
    # a mast climber. This is the concept's signature: the building is seen
    # THROUGH steelwork from the street, which is exactly the foreground
    # occlusion the production camera needs.
    sy = PY0 - 1.5
    lifts = int(top / 2.0)
    for i in range(12):
        sx = PX0 - 0.4 + i * 2.0
        parts["galv"].append(
            L.cyl(f"std{i}", 0.024, top + 1.4, (sx, sy, (top + 1.4) / 2), mats["galv"], verts=6))
        parts["galv"].append(
            L.cyl(f"std2{i}", 0.024, top + 1.4, (sx, sy - 1.3, (top + 1.4) / 2),
                  mats["galv"], verts=6))
    for lift in range(1, lifts + 1):
        zz = lift * 2.0
        parts["galv"].append(
            M.prism(f"ldg{lift}", M.rect(PX0 - 0.45, sy - 0.03, PX1 + 0.45, sy + 0.03),
                    zz, 0.048, mats["galv"]))
        parts["galv"].append(
            M.prism(f"ldg2{lift}", M.rect(PX0 - 0.45, sy - 1.33, PX1 + 0.45, sy - 1.27),
                    zz, 0.048, mats["galv"]))
        for i in range(12):
            sx = PX0 - 0.4 + i * 2.0
            parts["galv"].append(
                L.cyl(f"tr{lift}{i}", 0.022, 1.35, (sx, sy - 0.65, zz), mats["galv"],
                      axis="Y", verts=5))
        if lift % 2 == 0:
            parts["ply"].append(
                M.prism(f"board{lift}", M.rect(PX0 - 0.4, sy - 1.28, PX1 + 0.4, sy + 0.02),
                        zz + 0.05, 0.04, mats["ply"]))
            for h in (0.5, 1.0):
                parts["galv"].append(
                    M.prism(f"gr{lift}{h}", M.rect(PX0 - 0.45, sy - 1.36, PX1 + 0.45, sy - 1.30),
                            zz + h, 0.04, mats["galv"]))

    # Mast climber against the east end of the scaffold.
    for i in range(int(top / 1.5)):
        parts["galv"].append(
            M.prism(f"mast{i}", M.rect(PX1 - 1.4, sy - 2.4, PX1 - 0.6, sy - 1.9),
                    i * 1.5, 1.2, mats["galv"]))
    # The car rides the FRONT face of its mast. At sy - 3.2 it sat 0.8 m clear
    # of the mast and read as a floating orange box -- the same class of error
    # as the production hoist that had no mast at all.
    L.box("climber", (2.6, 1.5, 2.3), (PX1 - 1.0, sy - 2.9, 13.0), mats["crane"],
          bevel=0.05)
    L.box("climber-deck", (3.0, 0.2, 0.12), (PX1 - 1.0, sy - 2.1, 11.9), mats["galv"])

    # ---- Street furniture, hoarding, people -----------------------------
    for i in range(9):
        parts["paint"].append(
            M.prism(f"hoard{i}", M.rect(PX0 - 1.2 + i * 2.6, PY0 - 4.6,
                                        PX0 + 1.2 + i * 2.6, PY0 - 4.4), 0.2, 2.4,
                    mats["screen"]))
    L.box("cabin", (6.1, 2.5, 2.6), (0, 21.5, 1.5), mats["paint"], bevel=0.05)
    L.box("skip", (2.2, 4.6, 1.5), (7.0, 21.0, 0.95), mats["crane"], bevel=0.05)
    for i in range(5):
        L.box("stack", (2.4, 1.2, rng.uniform(0.4, 0.9)), (-6 + i * 2.8, 20.0, 0.6),
              mats["ply"])

    for (x, y, f) in ((-4, -22, 0.9), (5, -21, 2.6), (2, 19, -1.2)):
        L.figure((x, y, 0.36), mats, facing=f)

    # ---- The rest of the street: a continuous terrace, not islands ------
    blocks = []
    for i in range(6):
        blocks.append((-52 - i * 20, rng.uniform(-2, 2), 18, 34, rng.uniform(16, 30),
                       i % 2))
        blocks.append((52 + i * 20, rng.uniform(-2, 2), 18, 34, rng.uniform(15, 28),
                       (i + 1) % 2))
    for i in range(5):
        blocks.append((rng.uniform(-70, 70), 76 + i * 26, rng.uniform(20, 34),
                       rng.uniform(18, 28), rng.uniform(20, 46), i % 2))
    L.context_city(rng, blocks, mats, lit=0.5 if dusk else 0.0)

    # A camera inside a neighbour is invisible in source and obvious in a
    # render. Concept B needed this guard; C proved it needs to be everywhere.
    for cam_name, (loc, _t, _mm) in CAMERAS.items():
        for (cx, cy, w, d, h, _era) in blocks:
            if (abs(loc[0] - cx) < w * 0.62 and abs(loc[1] - cy) < d * 0.62
                    and loc[2] < h):
                raise AssertionError(
                    f"camera {cam_name} is inside the block at {cx:.0f},{cy:.0f}")

    for key, objs in parts.items():
        objs = [o for o in objs if o]
        if objs:
            L.join_all(f"c-{key}", objs)


def light(dusk):
    if dusk:
        L.sky_world(3.0, 214, strength=0.55, dusk=True)
        L.sun_lamp(3.0, 214, 4.0, color=(1.0, 0.68, 0.42), angle=1.8)
    else:
        # High enough to reach down a narrow street between tall neighbours,
        # and from the south so the street elevation is actually lit.
        L.sky_world(46, 196, strength=0.5)
        L.sun_lamp(46, 196, 6.5, color=(1.0, 0.94, 0.86), angle=0.6)


CAMERAS = {
    # HERO: up the street from the footpath opposite, so the neighbours frame
    # the plot and the scaffold is read THROUGH. Building runs out of frame.
    "hero": ((-19.0, -37.0, 1.65), (2.0, -6.0, 17.0), 28),
    # GROUND: on the footpath directly below, looking up inside the scaffold.
    "ground": ((-2.0, -24.0, 1.62), (3.0, -10.0, 15.0), 24),
    # REAR: the laneway, the side nothing was composed for.
    # Far enough back to show the plot IN ITS TERRACE. At 36 m the building
    # filled the frame and the shot became a section through it, which proves
    # nothing about whether the rear of the SITE survives inspection.
    "rear": ((16.0, 44.0, 3.2), (-2.0, 6.0, 11.0), 24),
}


def main():
    args = L.argv()
    dusk = "--dusk" in args
    cycles = "--cycles" in args
    which = args[args.index("--frames") + 1] if "--frames" in args else "hero,ground,rear"

    build(dusk=dusk)
    light(dusk)
    suffix = "dusk" if dusk else "day"
    for key in which.split(","):
        loc, tgt, mm = CAMERAS[key.strip()]
        cam = L.camera(f"cam-{key}", loc, tgt, mm=mm)
        if cycles:
            L.render(os.path.join(L.OUT, f"{NAME}-{suffix}-{key}-cycles.png"), cam,
                     width=960, height=600, samples=96, engine="CYCLES",
                     exposure=0.25 if dusk else -0.45)
        else:
            L.render(os.path.join(L.OUT, f"{NAME}-{suffix}-{key}.png"), cam,
                     width=1440, height=900, samples=48,
                     exposure=0.25 if dusk else -0.45)


main()
