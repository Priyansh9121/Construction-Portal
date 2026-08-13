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
import bpy

import concept_lib as L
import concept_mesh as M
import site_dressing as D
import human as H

NAME = "C-infill"

# Sun position for the daylight gate. Overridable from the command line so the
# same world can be checked at morning, midday and afternoon -- the runtime
# will eventually drive these from real IST and coordinates, so the world has
# to survive ORDINARY light, not one flattering angle.
SUN_ELEV = 46.0
# Azimuth 196 put the sun BEHIND the building, so the whole street elevation
# sat in shade. That was invisible while the sky carried a fake sun disc which
# filled the shadow back in; removing the double sun exposed it immediately.
# The street face looks -Y, so the sun has to come from -Y to light it.
SUN_AZ = 18.0

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


def build(dusk=False, join_by_material=True):
    L.reset()
    rng = random.Random(41)
    mats = L.standard_materials(wear=0.72, lit=0.5 if dusk else 0.0)
    parts = {"conc": [], "galv": [], "ply": [], "paint": [], "glass": [],
             "street": []}

    top = GROUND_H + LEVELS * STOREY_H

    # ---- TERRAIN: a graded street, not a game plane ----------------------
    #
    # The world used to be five flat boxes at five heights, which is exactly
    # what a game plane looks like from eye level: no crossfall, no gutter, and
    # a kerb that is a step rather than an upstand.
    #
    # The street corridor is now ONE ribbon built from a real cross-section, so
    # the road crowns at its centre and falls to a gutter on each side, the
    # kerb is a 140 mm upstand, and the footpath falls BACK toward the gutter.
    # That drainage logic is what makes ground read as engineered rather than
    # as deformed: water has somewhere to go, and the eye reads that even when
    # it is not looking for it.
    #
    # The numbers are small on purpose. An urban site is nearly flat, and the
    # realism is in 20-150 mm level changes, not in topography.
    #
    # THE CORRIDOR HAS TO REACH WHERE THE CAMERA STANDS.
    #
    # This section used to stop at a far verge 46 m out. The establishing
    # camera stands 70 m out, so it was standing 24 m beyond the end of the
    # street, on the bare 900 m earth box -- which is exactly why the lower
    # third of the frame read as a model sheet. Raycasting the foreground
    # returned `earth`, not `spandrel`: the street was never the problem, its
    # EXTENT was.
    #
    # A 70 m sightline to a 22 m frontage does not happen across a side
    # street. It happens across a divided arterial, which is the ordinary
    # condition for an inner-city plot on a main road in this region -- so
    # that is what this is: two carriageways, a planted median, and a footpath
    # on each side. The distance is now explained by the world rather than
    # imposed on it.
    ROAD = [
        (-84.0, 0.38),          # opposite building line
        (-79.0, 0.32),          # far footpath at the shopfronts
        (-70.2, 0.24),          # far footpath -- THE CAMERA STANDS HERE
        (-68.5, 0.17),          # far kerb: a 150 mm upstand
        (-68.1, 0.03),          # far gutter, the low point
        (-61.5, 0.22),          # crown of the far carriageway
        (-53.9, 0.04),          # gutter against the median
        (-53.5, 0.19),          # median kerb
        (-49.0, 0.23),          # median top, planted
        (-44.5, 0.19),          # median kerb
        (-44.1, 0.04),          # gutter against the median
        (-35.0, 0.22),          # crown of the near carriageway
        (-25.4, 0.02),          # near gutter, the low point
        (-25.0, 0.16),          # near kerb upstand
        (-21.0, 0.20),          # footpath, falling back to the kerb
        (-17.6, 0.24),          # footpath at the building line
    ]
    L.box("ground", (900, 900, 0.4), (0, 0, -0.22), mats["earth"])
    parts["street"].append(M.ribbon("road", -320, 320, ROAD, mats["spandrel"]))

    # The rear laneway: narrower, no footpath, a single fall to one gutter.
    LANE = [
        (17.6, 0.22), (21.0, 0.06), (22.0, 0.16),
        (26.0, 0.12), (30.0, 0.05), (30.4, 0.16), (38.0, 0.04),
    ]
    parts["street"].append(M.ribbon("lane", -220, 220, LANE, mats["spandrel"]))

    # The site pad, sitting slightly PROUD of the footpath so the site reads as
    # a thing built into the ground rather than a plate laid on it, with a
    # graded ramp down to the gate where vehicles actually cross the kerb.
    parts["street"].append(
        M.prism("pad", M.rect(-13, -19, 13, 19), 0.24, 0.16, mats["conc"]))
    RAMP = [(-19.0, 0.24), (-20.4, 0.20), (-21.6, 0.10), (-23.0, 0.03)]
    parts["street"].append(M.ribbon("ramp", -6.0, 6.0, RAMP, mats["conc"]))
    # A compacted access strip worn across the pad from the gate to the core.
    parts["street"].append(
        M.prism("haul", M.rect(-5.4, -19, 5.4, 12), 0.395, 0.03, mats["earth"]))
    # The gutter drain the site falls toward.
    parts["street"].append(
        M.prism("drain", M.rect(-1.2, -25.6, 1.2, -25.0), 0.0, 0.06, mats["galv"]))

    # ---- WHAT ACTUALLY READS AT 70 m AND 1.7 m EYE ---------------------
    #
    # The establishing camera looks along 52 m of road at a couple of degrees
    # off grazing. At that angle a 150 mm kerb upstand is about three pixels
    # and a crossfall is invisible -- the first version of this street was
    # correct engineering that the frame could not see.
    #
    # What reads at grazing incidence is VERTICAL, or long and horizontal:
    # median planting, poles, and the lane lines that run away to the
    # vanishing point. So the corridor gets those, and the level changes stay
    # because they are right, not because they carry the image.
    MEDIAN_Y = -49.0
    for i in range(48):
        x = -132 + i * 5.6
        # A continuous planted strip: the single strongest thing separating a
        # divided arterial from a grey field.
        parts["street"].append(
            M.prism("street-hedge", M.rect(x - 2.6, MEDIAN_Y - 1.5, x + 2.6, MEDIAN_Y + 1.5),
                    0.23, rng.uniform(0.62, 0.86), mats["earth"]))
    # Street lighting down the median, on the spacing poles are actually set.
    for i in range(11):
        x = -120 + i * 24.0
        parts["street"].append(
            M.prism("street-pole", M.rect(x - 0.11, MEDIAN_Y - 0.11, x + 0.11, MEDIAN_Y + 0.11),
                    0.23, 9.0, mats["galv"]))
        for side in (-1, 1):
            parts["street"].append(
                M.prism("street-arm", M.rect(x - 0.07, MEDIAN_Y + side * 0.1,
                                             x + 0.07, MEDIAN_Y + side * 2.1),
                        9.0, 0.14, mats["galv"]))
            parts["street"].append(
                M.prism("street-lamp", M.rect(x - 0.28, MEDIAN_Y + side * 1.55,
                                              x + 0.28, MEDIAN_Y + side * 2.35),
                        8.78, 0.18, mats["galv"]))
    # Lane markings. Broken lines on the running lanes, continuous at the
    # kerb edge -- these are the lines that carry the perspective.
    for (cy, lanes) in ((-61.5, (-4.2, 0.0, 4.2)), (-35.0, (-5.6, 0.0, 5.6))):
        for off in lanes:
            for i in range(64):
                x = -140 + i * 4.4
                parts["street"].append(
                    M.prism("street-line", M.rect(x, cy + off - 0.06, x + 2.2, cy + off + 0.06),
                            0.20, 0.012, mats["conc"]))
    # Gullies at the gutter LOW POINTS the section already falls to.
    for gx in range(-5, 6):
        x = gx * 24.0
        for gy, gz in ((-68.1, 0.03), (-25.4, 0.02)):
            parts["street"].append(
                M.prism("street-gully", M.rect(x - 0.42, gy - 0.28, x + 0.42, gy + 0.28),
                        gz - 0.02, 0.05, mats["galv"]))
    # Bollards on the SITE footpath, where the frame can actually see them --
    # the far footpath is a 600 mm sliver under the lens.
    for i in range(30):
        x = -34 + i * 2.4
        if -8 < x < 8:
            continue                    # the vehicle crossover at the gate
        parts["street"].append(
            M.prism("street-bollard", M.rect(x - 0.06, -24.9, x + 0.06, -24.78),
                    0.16, 0.90, mats["galv"]))

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
        # ---- THE BACK OF THE BUILDING ---------------------------------
        #
        # A 360 camera reaches the laneway, and until now it found two blank
        # walls there. Rear elevations are not glamorous and should not be:
        # they are where the servicing happens. So the laneway face gets
        # SMALLER, IRREGULAR openings (bathrooms and stairs, not living
        # rooms), a service door, a fire stair, condensers and a downpipe.
        #
        # Utilitarian, not decorated. The tell of a fake city is a back that
        # looks like a front.
        rear_y = PY1 + 3.0
        for lv in range(1, int(nh / 3.4)):
            for i in range(3):
                wx = nx - 5.6 + i * 5.6
                # Narrower and shorter than the street windows, and the middle
                # bay is a blank riser rather than a window.
                if i == 1 and lv % 2 == 0:
                    continue
                M.cut(body, M.prism(f"nrw{side}{lv}{i}",
                                    M.rect(wx - 0.62, rear_y - 0.65, wx + 0.62, rear_y + 0.05),
                                    0.2 + lv * 3.4 + 0.4, 1.15))
        # Service door at lane level.
        M.cut(body, M.prism(f"nrd{side}",
                            M.rect(nx + sx * 4.2 - 0.65, rear_y - 0.6,
                                   nx + sx * 4.2 + 0.65, rear_y + 0.05), 0.18, 2.15))
        # An external fire stair: the single most recognisable rear-elevation
        # object there is.
        for lv in range(1, int(nh / 3.4)):
            zz = 0.2 + lv * 3.4
            parts["galv"].append(
                M.prism(f"nfl{side}{lv}",
                        M.rect(nx - 7.6, rear_y - 1.5, nx - 5.4, rear_y - 0.1),
                        zz, 0.06, mats["galv"]))
            for hh in (0.5, 1.05):
                parts["galv"].append(
                    M.prism(f"nfr{side}{lv}{hh}",
                            M.rect(nx - 7.6, rear_y - 1.55, nx - 5.4, rear_y - 1.49),
                            zz + hh, 0.04, mats["galv"]))
        for lv in range(int(nh / 3.4)):
            parts["galv"].append(
                M.prism(f"nfp{side}{lv}",
                        M.rect(nx - 7.62, rear_y - 1.56, nx - 7.54, rear_y - 1.48),
                        0.2 + lv * 3.4, 3.4, mats["galv"]))
        # Condensers and a downpipe.
        for i in range(3):
            parts["galv"].append(
                L.box(f"nac{side}{i}", (0.85, 0.4, 0.7),
                      (nx + sx * 1.2 + i * 1.3, rear_y - 0.3, 3.4 + i * 4.5),
                      mats["galv"], bevel=0.03))
        parts["galv"].append(
            L.cyl(f"ndp{side}", 0.075, nh, (nx + sx * 8.2, rear_y - 0.16, nh / 2),
                  mats["galv"], verts=7))

        # Rooftop plant, off-centre, plus a lift overrun on the taller one.
        parts["conc"].append(
            L.box(f"nplant{side}", (4.2, 3.4, 2.2), (nx + sx * 2.5, 4.0, nh + 1.3),
                  mats["city_cool"]))
        if nh > 21:
            parts["conc"].append(
                L.box(f"nplant2{side}", (2.6, 2.6, 3.2), (nx - sx * 3.6, -6.0, nh + 1.8),
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

    # ---- MAST CLIMBER ----------------------------------------------------
    # A real rack-and-pinion machine, not a cube on a stack of blocks. See
    # site_dressing.mast_climber for what each part is answering.
    parts["galv"].extend(
        D.mast_climber("mc", PX1 - 1.0, sy - 2.6, 0.2, top, mats, rng,
                       car_z=12.0))


    # ---- Street furniture, hoarding, people -----------------------------
    # THE HOARDING NEEDS A GATE.
    #
    # It ran continuously across the frontage, including straight over the
    # vehicle ramp -- so the ramp led to a solid fence and the entrance camera
    # photographed a blue wall. A site boundary with no way in is the kind of
    # error that is invisible in plan and obvious the moment a camera stands
    # at human height in front of it.
    GATE_X0, GATE_X1 = -6.4, 6.4
    for i in range(9):
        x0 = PX0 - 1.2 + i * 2.6
        x1 = PX0 + 1.2 + i * 2.6
        if x1 > GATE_X0 and x0 < GATE_X1:
            continue
        parts["paint"].append(
            M.prism(f"hoard{i}", M.rect(x0, PY0 - 4.6, x1, PY0 - 4.4), 0.2, 2.4,
                    mats["screen"]))
    # Gate leaves, standing open against the hoarding line.
    for sx, lx in ((-1, GATE_X0), (1, GATE_X1)):
        leaf = M.prism(f"gate{sx}", M.rect(0, 0, 2.9, 0.12), 0.2, 2.3,
                       mats["galv"])
        leaf.location = (lx, PY0 - 4.5, 0)
        leaf.rotation_euler = (0, 0, sx * 1.15)
        parts["galv"].append(leaf)
    L.box("cabin", (6.1, 2.5, 2.6), (0, 21.5, 1.5), mats["paint"], bevel=0.05)
    L.box("skip", (2.2, 4.6, 1.5), (7.0, 21.0, 0.95), mats["crane"], bevel=0.05)
    for i in range(5):
        L.box("stack", (2.4, 1.2, rng.uniform(0.4, 0.9)), (-6 + i * 2.8, 20.0, 0.6),
              mats["ply"])

    # ---- PEOPLE ----------------------------------------------------------
    #
    # Real lofted anatomy, not box figures. Each has a REASON to stand where
    # it does: one arriving through the gate, one at the material staging with
    # the rebar, one signalling the lift, one on the footpath outside.
    for (nm, x, y, z, face, pose) in (
            ("wk-gate", -3.6, -20.4, 0.40, 0.7, "walk"),
            ("wk-mat", -2.0, -8.2, 0.40, 2.5, "carry"),
            ("wk-bank", 5.4, -4.0, 0.40, -1.1, "signal"),
            ("wk-path", 4.6, -22.6, 0.24, 2.9, "stand")):
        w = H.worker(nm, mats, pose=pose, facing=face,
                     height=rng.uniform(1.68, 1.83), seed=int(x * 10))
        w.location = (x, y, z)
        parts.setdefault("people", []).append(w)

    # ---- SITE CONTENT ----------------------------------------------------
    # The single largest cause of the game-like read was an EMPTY site.
    # Everything below is placed by work zone; see site_dressing.py.
    D.dress(parts, mats, rng, PX0, PX1, PY0, PY1)

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
    # ACROSS THE ROAD. The one bearing that had no city in it was the one the
    # establishing camera looks along: the flanks are at +/-x and the rear
    # terrace at +y, so the street side simply stopped into sky. These sit
    # behind the far footpath, which is what turns the far side of the
    # arterial into a street frontage instead of a horizon.
    for i in range(7):
        blocks.append((-96 + i * 30 + rng.uniform(-4, 4), -98 + rng.uniform(-5, 5),
                       rng.uniform(22, 32), rng.uniform(20, 30),
                       rng.uniform(18, 38), i % 2))
    # FAR TIER. Silhouette and massing only -- these are 200-450 m away, where
    # window geometry is below a pixel and the only thing that reads is a
    # varied roofline sitting in atmosphere. Placed on a RING so that every
    # bearing of a 360 orbit has city in it: the acceptance test for this
    # milestone is that no angle finds the edge of the world.
    for i in range(34):
        a = (i / 34) * math.tau + rng.uniform(-0.06, 0.06)
        d = rng.uniform(190, 430)
        blocks.append((math.cos(a) * d, math.sin(a) * d,
                       rng.uniform(26, 54), rng.uniform(26, 54),
                       rng.uniform(24, 96), i % 2))
    L.context_city(rng, blocks, mats, lit=0.5 if dusk else 0.0)

    # A camera inside a neighbour is invisible in source and obvious in a
    # render. Concept B needed this guard; C proved it needs to be everywhere.
    for cam_name, (loc, _t, _mm) in CAMERAS.items():
        for (cx, cy, w, d, h, _era) in blocks:
            if (abs(loc[0] - cx) < w * 0.62 and abs(loc[1] - cy) < d * 0.62
                    and loc[2] < h):
                raise AssertionError(
                    f"camera {cam_name} is inside the block at {cx:.0f},{cy:.0f}")

    if join_by_material:
        for key, objs in parts.items():
            objs = [o for o in objs if o]
            if objs:
                L.join_all(f"c-{key}", objs)
    return parts


def light(dusk):
    if dusk:
        L.sky_world(3.0, 214, strength=0.55, dusk=True)
        L.sun_lamp(3.0, 214, 4.0, color=(1.0, 0.68, 0.42), angle=1.8)
    else:
        # High enough to reach down a narrow street between tall neighbours,
        # and from the south so the street elevation is actually lit.
        # Retuned for PHOTOGRAPHIC albedos. The previous values were set
        # against dark procedural swatches; real CC0 sets are far brighter, so
        # the same sun clipped every highlight and turned red brick pale pink.
        # Sun:sky ratio, not sun elevation, is what makes daylight read. Real
        # direct sun is several times the ambient sky contribution; at
        # 3.2 against 0.32 the ambient was filling every shadow. Midday stays
        # midday -- this is a ratio fix, so it holds at any elevation.
        L.sky_world(SUN_ELEV, SUN_AZ, strength=0.16)
        L.sun_lamp(SUN_ELEV, SUN_AZ, 5.0, color=(1.0, 0.96, 0.90))
    L.atmosphere_box()


# ---------------------------------------------------------------------------
# PRODUCTION EXPORT
# ---------------------------------------------------------------------------
#
# The production world is EXPORTED FROM THIS SCENE, not rebuilt from Three.js
# primitives. That rule is the entire reason the concept gate existed: the
# previous world was assembled from JavaScript boxes and no amount of shader or
# camera work made it stop looking like assembled boxes.
#
# Layers exist so the browser can load progressively and so a layer can be
# swapped, budgeted or dropped on mobile without touching the others. The
# classification happens BEFORE the material join -- joining by material first
# would weld the project, its neighbours and the street into one mesh and make
# the split impossible.
#
# Order matters. "cabin" must be tested before any short architecture prefix
# would swallow it.
LAYER_RULES = (
    ("street", ("gate", "ground", "street", "kerb", "path", "lane", "sitepad",
                "hoard", "cabin", "skip", "stack",
                # M3 terrain
                "road", "pad", "ramp", "haul", "drain")),
    ("neighbours", ("nb", "np", "nw", "nplant", "city",
                    # M3 rear elevations: openings, fire stair, plant
                    "nrw", "nrd", "nfl", "nfr", "nfp", "nac", "ndp")),
    ("scaffold", ("std", "ldg", "tr", "board", "gr", "mast", "climber", "mc")),
    ("people", ("wk-",)),
)


def layer_of(name):
    """Which production layer an object belongs to, from its authored name."""
    base = name.split(".")[0]
    for layer, prefixes in LAYER_RULES:
        for pre in prefixes:
            if base == pre or base.startswith(pre):
                return layer
    return "architecture"


# glTF EXPORTS FACTORS, NOT NODE TREES.
#
# Every material in concept_lib is a procedural node graph -- formwork lift
# lines, pour-to-pour colour steps, run-off staining, worked roughness. NONE of
# that survives a glTF export: the format carries base colour, roughness and
# metallic as numbers (or as image textures), and a node chain driving base
# colour exports as nothing, which is why the first import rendered the whole
# site near-white.
#
# So production materials are baked down to representative CONSTANTS here. The
# material NAMES and slots are preserved exactly, because M4 has to be able to
# attach real texture maps per surface without touching any geometry.
#
# This is a known, deliberate loss. The procedural detail returns in M4 as
# actual albedo/roughness/normal maps.
PRODUCTION_FACTORS = {
    #                     base colour  rough  metal
    "conc":              (0x9AA0A6,    0.86,  0.0),
    "wet":               (0x6E747C,    0.42,  0.0),
    "ply":               (0xB8823F,    0.78,  0.0),
    "galv":              (0x8C949B,    0.38,  1.0),
    "paint":             (0x8A9096,    0.5,   0.25),
    "crane":             (0xC8611A,    0.44,  0.25),
    "screen":            (0x2F6F8C,    0.62,  0.2),
    "spandrel":          (0x3A4149,    0.4,   0.25),
    "glass":             (0x1A2229,    0.06,  0.0),
    "city_warm":         (0x8A7F72,    0.72,  0.0),
    "city_cool":         (0x6E7684,    0.7,   0.0),
    "earth":             (0x7A6852,    0.95,  0.0),
    "hiviz":             (0xCBE034,    0.62,  0.0),
    "workwear":          (0x2C3540,    0.85,  0.0),
    "hat":               (0xE8E4DC,    0.42,  0.0),
    "skin":              (0x8A6A52,    0.78,  0.0),
}


def bake_production_materials(skip=frozenset()):
    """
    Flatten the remaining procedural materials to the factors glTF can carry.

    `skip` holds materials that already carry real image textures, which must
    NOT be flattened -- that was the old behaviour and it is exactly what
    stranded the CC0 maps in Blender.
    """
    for mat in bpy.data.materials:
        key = mat.name.split(".")[0]
        if mat.name in skip or key not in PRODUCTION_FACTORS:
            continue
        colour, rough, metal = PRODUCTION_FACTORS[key]
        mat.use_nodes = True
        nt = mat.node_tree
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        bsdf.location = (-260, 0)
        bsdf.inputs["Base Color"].default_value = L.srgb(colour)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])


def export_production():
    """
    Build the winning concept and write it out as four production GLBs.

    Geometry is joined per (layer, material) so material identity survives --
    concrete, wet concrete, galvanised steel, plywood, glass and the painted
    screens stay separate, because M4 has to be able to upgrade them
    individually without rebuilding any geometry.
    """
    parts = build(dusk=False, join_by_material=False)

    # TEXTURES NOW SHIP. The export used to flatten every material to a
    # constant because BOX projection cannot cross the glTF boundary; UVs at
    # real world scale mean the photographic maps travel with the geometry.
    # `bake_production_materials()` is kept only for the materials that have no
    # images at all (painted steel, galvanised, glass), which are correctly
    # factor-only and would gain nothing from a texture.
    retargeted = L.to_uv_materials()
    print(f"OK  {len(retargeted)} materials retargeted to UV")
    # Flatten ALL materials to factors for export. The UVs stay -- that is the
    # point -- but the images do not travel inside the GLB. Embedding them put
    # a full copy of every map into every layer that used it and took the set
    # from 0.5 MB to about 30 MB. They ship once instead, from
    # frontend/public/world/textures/cc0, attached at runtime by material name.
    bake_production_materials()

    # Everything in the scene, including the loose objects build() never put
    # into `parts` (ground, street, cabins, the city, the climber).
    tagged = {}
    claimed = set()
    for key, objs in parts.items():
        for o in objs:
            if o is None or o.name in claimed:
                continue
            claimed.add(o.name)
            tagged.setdefault((layer_of(o.name), key), []).append(o)
    for o in list(bpy.context.scene.objects):
        if o.type != "MESH" or o.name in claimed:
            continue
        claimed.add(o.name)
        tagged.setdefault((layer_of(o.name), "misc"), []).append(o)

    merged = {}
    for (layer, key), objs in tagged.items():
        ob = L.join_all(f"{layer}-{key}", objs)
        if ob:
            L.uv_project_for_export(ob, L.EXPORT_UV_TILE.get(key, L.DEFAULT_UV_TILE))
            merged.setdefault(layer, []).append(ob)

    out_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "frontend", "public", "world", "assets")
    report = []
    for layer, objs in merged.items():
        path = os.path.join(out_dir, f"login-site-{layer}.glb")
        stats = export_group(objs, path)
        report.append((layer, stats))
        print(f"OK  {os.path.basename(path)}  {stats['triangles']} tris  "
              f"{stats['meshes']} meshes  {stats['materials']} materials  "
              f"{stats['bytes'] / 1024:.0f} KB")

    total = sum(s["triangles"] for _, s in report)
    print(f"OK  TOTAL {total} triangles across {len(report)} layers")
    return report


def export_group(objs, path):
    """Export a set of objects as one GLB, keeping their world transforms."""
    import bpy as _b
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for o in _b.context.scene.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    _b.context.view_layer.objects.active = objs[0]

    args = {
        "filepath": path, "export_format": "GLB", "use_selection": True,
        "export_yup": True, "export_apply": True, "export_normals": True,
        "export_materials": "EXPORT", "export_cameras": False,
        "export_lights": False, "export_extras": False,
        "export_animations": False, "export_texcoords": True,
        "export_draco_mesh_compression_enable": False,
    }
    props = {p.identifier for p in _b.ops.export_scene.gltf.get_rna_type().properties}
    _b.ops.export_scene.gltf(**{k: v for k, v in args.items() if k in props})

    dg = _b.context.evaluated_depsgraph_get()
    tris = 0
    mats = set()
    for o in objs:
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        for m in me.materials:
            if m:
                mats.add(m.name)
        o.evaluated_get(dg).to_mesh_clear()
    return {"triangles": tris, "meshes": len(objs), "materials": len(mats),
            "bytes": os.path.getsize(path)}


CAMERAS = {
    # ESTABLISHING: THE PRODUCTION FRAME. Not an art-directed variant -- this
    # is the runtime station converted straight through the exporter's mapping
    # (glTF x,y,z -> Blender x,-z,y), so what Cycles judges here is the frame
    # the Login actually opens on.
    #
    #   runtime: target [1, 13, 3], radius 70, azimuth -0.50, elevation
    #   -0.1621, 35 mm -> eye [-35.9, 1.7, 69.6]
    #
    # The eye lands at y = -69.6, standing on the far footpath. It used to land
    # on bare earth 24 m beyond the end of the street, which is the whole
    # reason the lower third of the production frame read as a model sheet.
    "establishing": ((-35.9, -69.6, 1.70), (1.0, -3.0, 13.0), 35),
    # HERO: up the street from the footpath opposite, so the neighbours frame
    # the plot and the scaffold is read THROUGH. Building runs out of frame.
    "hero": ((-19.0, -37.0, 1.65), (2.0, -6.0, 17.0), 28),
    # GROUND: standing on the OPPOSITE footpath, across the street.
    #
    # The first position pressed a 24 mm lens against the scaffold from 6 m and
    # produced an abstract lattice -- striking, and evidence of nothing, because
    # a frame with no person, no ground and no context cannot test human scale.
    # 26 m back at 28 mm is where a person actually stands to look at a site:
    # the hoarding, the workers on the footpath, the scaffolded elevation and
    # the neighbours all land in one frame, and the building crops at the top
    # rather than being fitted into the picture.
    "ground": ((-7.0, -38.0, 1.68), (3.0, -12.0, 10.0), 28),
    # ENTRANCE (gate view B): standing just inside the gate, looking into the
    # site. The street camera looks UP and never sees the ground, so this is
    # the only view that tests whether the site content actually works.
    # Standing AT the gate line looking in and slightly up. The first attempt
    # sat at y = -18.5, which is INSIDE the ground floor -- the frame was a
    # column half a metre from the lens and a dark soffit. The gate is at
    # y = -21.6, so this stands just outside it and looks through.
    "entrance": ((-2.4, -27.0, 1.68), (1.5, 4.0, 8.0), 28),
    # REAR: the laneway, the side nothing was composed for.
    # Far enough back to show the plot IN ITS TERRACE. At 36 m the building
    # filled the frame and the shot became a section through it, which proves
    # nothing about whether the rear of the SITE survives inspection.
    "rear": ((16.0, 44.0, 3.2), (-2.0, 6.0, 11.0), 24),
}


def main():
    args = L.argv()
    dusk = "--dusk" in args
    global SUN_ELEV, SUN_AZ
    if "--sun" in args:
        SUN_ELEV = float(args[args.index("--sun") + 1])
    if "--az" in args:
        SUN_AZ = float(args[args.index("--az") + 1])
    # NOT "--cycles": the Cycles addon parses sys.argv itself and claims
    # that flag even after the "--" separator, so Blender aborts with an
    # ambiguous-option error before the script ever runs.
    cycles = "--ref" in args
    which = args[args.index("--frames") + 1] if "--frames" in args else "hero,ground,rear"

    if "--export" in args:
        export_production()
        return

    build(dusk=dusk)
    light(dusk)
    suffix = "dusk" if dusk else "day"
    for key in which.split(","):
        loc, tgt, mm = CAMERAS[key.strip()]
        cam = L.camera(f"cam-{key}", loc, tgt, mm=mm)
        if cycles:
            L.render(os.path.join(L.OUT, f"{NAME}-{suffix}-{key}-s{int(SUN_ELEV)}a{int(SUN_AZ)}-cycles.png"), cam,
                     width=720, height=450, samples=24, engine="CYCLES",
                     exposure=0.25 if dusk else -0.35)
        else:
            L.render(os.path.join(L.OUT, f"{NAME}-{suffix}-{key}.png"), cam,
                     width=1440, height=900, samples=48,
                     exposure=0.25 if dusk else -0.35)


main()
