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

# ---- SITE LOGISTICS --------------------------------------------------------
#
# The tower crane was rejected by measured site geometry, so everything
# vertical happens through ONE hoist and everything heavy arrives with a
# mobile crane that leaves again. These numbers are the contract between them.
#
# The hoist sits in its own scaffold bay between the standards at 6.6 and 8.6,
# east of the gate so material lands beside the machine that lifts it.
# Measured clearances: 0.68 m inside the hoarding, 2.50 m off the party line,
# 0.25 m each side to the bay standards.
HOIST_X, HOIST_Y = 7.6, -20.4
HOIST_BAY = (6.6, 8.6)
# Ties land on SLAB EDGES, not in mid-air: levels 1, 3, 5 and the head tie at
# 6, roughly 6.6 m apart, which is what a mast of this height wants.
HOIST_TIES = [GROUND_H + l * STOREY_H for l in (1, 3, 5, 6)]
# Landings follow the WORK, not the floor count. Blockwork gangs at 1 and 2,
# the striking gang at 4, the forming gang at 6. The gate stands open only
# where something is actually being received -- level 2's blockwork front and
# level 6's forming deck. Levels 3 and 5 are reached from the stair core.
HOIST_LANDINGS = [(GROUND_H + l * STOREY_H, l in (2, 6)) for l in (1, 2, 4, 6)]
HOIST_CAR_Z = 2 * STOREY_H - 0.2                 # car standing at level 2

# The mobile crane works from the REAR LANEWAY, not the street. Measured: a
# street-side boom would have to stand 75 m back to clear the 25.6 m scaffold,
# because the scaffold stands directly between any street position and a deck
# set back 4.5 m. The rear elevation carries no scaffold at all.
# y = 26.4, not 27.0: at 27.0 the outrigger MATS reached 30.93 and overhung
# the far kerb at 30.40. Measured, then moved.
CRANE_X, CRANE_Y = 0.0, 26.4
# Hook raised 30.5 -> 31.6: at 30.5 there were only 3.0 m between boom head
# and a deck at 27.46 for rope, hook block, slings AND the bundle, so the
# bundle ended up 0.16 m BELOW the deck it was landing on.
CRANE_HOOK = (0.0, 16.0, 31.6)                   # radius 10.4 m, boom 31.0 m
CRANE_BOOM_DEG = 70.4


def plate(level):
    """The plan steps back from the street on the top two levels, and the
    street corner is chamfered where the entrance meets the footpath."""
    y0 = PY0 + (4.5 if level >= SETBACK_FROM else 0.0)
    return M.chamfered(PX0, y0, PX1, PY1, 3.5)


# ---- CONSTRUCTION STAGE PER LEVEL ------------------------------------------
#
# The hero used to be one plate repeated seven times. A 65 mm frame through the
# scaffold showed the cost: every level was a slab edge, a black void and a
# boarded lift, and the void was EMPTY -- no columns reading, no props, no
# formwork, no material. A dark hole with nothing in it reads as a hole in a
# slab, not as a floor of a building.
#
# So each level now carries a NAMED STATE, and the two causal rules that make a
# building read as one being built rather than one extruded:
#
#   props thin out DOWNWARD    concrete ages downward, so support is released
#                              from the bottom up
#   infill climbs UPWARD       the envelope follows the frame, so the lowest
#                              floors are the most enclosed
#
# Nothing here is randomised. A floor that differs for no reason is still
# procedural CG -- it just costs more triangles.
STAGE_ACTIVE_DECK = "active-deck"     # today's pour is being prepared
STAGE_FORMWORK = "formwork"           # deck formed, starters up, next pour
STAGE_FALSEWORK = "falsework"         # struck days ago, falsework still under
STAGE_STRUCK_NEW = "struck-new"       # young concrete, dense back-props
STAGE_BACKPROPPED = "backpropped"     # selective back-props on load paths
STAGE_INFILL_EARLY = "infill-early"   # frame dominates, envelope starting
STAGE_INFILL_ON = "infill-underway"   # oldest floor, envelope well advanced

STAGE_OF = {
    7: STAGE_ACTIVE_DECK,
    6: STAGE_FORMWORK,
    5: STAGE_FALSEWORK,
    4: STAGE_STRUCK_NEW,
    3: STAGE_BACKPROPPED,
    2: STAGE_INFILL_EARLY,
    1: STAGE_INFILL_ON,
}

# Prop grid spacing in metres. Absent = props already struck and removed.
# The widening spacing IS the age gradient: 1.8 m under a green slab, 4.2 m
# where only the load paths still need carrying.
PROP_SPACING = {
    STAGE_ACTIVE_DECK: 1.8,
    STAGE_FORMWORK: 1.8,
    STAGE_FALSEWORK: 1.8,
    STAGE_STRUCK_NEW: 2.6,
    STAGE_BACKPROPPED: 4.2,
}

# Fraction of the street frontage that has blockwork infill built.
INFILL_FRACTION = {STAGE_INFILL_ON: 0.66, STAGE_INFILL_EARLY: 0.33}


def build_infill(parts, mats, lvl, stage, z, y0):
    """
    Blockwork infill on the street elevation, built bay by bay from one end.

    Real infill goes up as a spandrel to sill height and a head panel under the
    slab, leaving the window band open until frames arrive -- so this is what
    makes a floor read as ENCLOSED without pretending the windows are glazed.
    """
    frac = INFILL_FRACTION.get(stage, 0.0)
    if frac <= 0:
        return
    bays = 6
    bw = (PX1 - PX0) / bays
    built = int(round(bays * frac))
    for b in range(built):
        bx0 = PX0 + b * bw + 0.14
        bx1 = PX0 + (b + 1) * bw - 0.14
        # Spandrel: slab to sill.
        parts["block"].append(
            M.prism(f"inf{lvl}s{b}", M.rect(bx0, y0 + 0.06, bx1, y0 + 0.30),
                    z + 0.02, 1.02, mats["block"]))
        # Head panel: under the slab over, leaving the opening between.
        parts["block"].append(
            M.prism(f"inf{lvl}h{b}", M.rect(bx0, y0 + 0.06, bx1, y0 + 0.30),
                    z + STOREY_H - 0.85, 0.52, mats["block"]))
        # The pier between bays, full height -- what the blockwork butts into.
        parts["block"].append(
            M.prism(f"inf{lvl}p{b}", M.rect(bx1, y0 + 0.06, bx1 + 0.26, y0 + 0.30),
                    z + 0.02, STOREY_H - 0.33, mats["block"]))

    # THE LEADING BAY IS RACKED BACK. A gang leaves the end of a run stepped so
    # the next section toothes in, and a wall that stops in one clean vertical
    # line is a wall that was drawn rather than built. This is also the only
    # cue that survives to 70 m saying WHICH level the envelope gang is on:
    # a stepped edge beside a finished one reads as work in progress.
    if built < bays:
        rx0 = PX0 + built * bw + 0.14
        rw = bw - 0.28
        for s in range(3):
            # Blockwork stops clear of the hoist bay: you cannot build the
            # envelope across the opening the hoist lands in. That gap gets
            # closed after the hoist comes down.
            rx1 = min(rx0 + rw * (1.0 - s / 3.0), HOIST_BAY[0] - 0.10)
            if rx1 <= rx0:
                continue
            parts["block"].append(
                M.prism(f"rak{lvl}{s}", M.rect(rx0, y0 + 0.06, rx1, y0 + 0.30),
                        z + 0.02 + s * 0.34, 0.34, mats["block"]))


def build_backprops(parts, mats, rng, lvl, stage, z):
    """Back-propping under a plate, at the spacing its age warrants."""
    sp = PROP_SPACING.get(stage)
    if not sp:
        return
    x = PX0 + 1.6
    while x < PX1 - 1.0:
        y = PY0 + 6.0
        while y < PY1 - 1.0:
            if CORE[0] < x < CORE[2] and CORE[1] < y < CORE[3]:
                y += sp
                continue
            parts["galv"].append(
                L.cyl(f"prop{lvl}", 0.045, STOREY_H - 0.35,
                      (x, y, z - STOREY_H + (STOREY_H - 0.35) / 2),
                      mats["galv"], verts=6))
            y += sp
        x += sp


def build_staging(parts, mats, rng, lvl, stage, z, surf=None):
    """
    Material where the work actually is -- not a pallet on every floor.

    Blocks land where blockwork is being built; ply and rebar land where the
    next pour is being formed. That is the whole rule.

    `surf` is the level the material actually RESTS on. It has to be passed,
    because M.slab(z) puts the slab TOP at z while the top level's formwork
    deck sits at z - 0.24 -- and the original z + 0.30 floated every pallet,
    block cube and rebar bundle in this world 300 mm clear of the floor.
    """
    sz = z if surf is None else surf
    if stage in (STAGE_INFILL_ON, STAGE_INFILL_EARLY):
        for i in range(2 if stage == STAGE_INFILL_ON else 1):
            bx = 3.0 + i * 3.2
            parts["conc"].append(
                M.prism(f"blk{lvl}{i}", M.rect(bx, 2.0, bx + 1.15, 3.1),
                        sz, 0.95, mats["conc"]))
    if stage in (STAGE_FORMWORK, STAGE_ACTIVE_DECK):
        for i in range(3):
            px = -8.0 + i * 3.4
            parts["ply"].append(
                M.prism(f"plystk{lvl}{i}", M.rect(px, 6.0, px + 2.5, 7.3),
                        sz, rng.uniform(0.26, 0.44), mats["ply"]))
        for i in range(4):
            bx = -6.0 + i * 2.6
            for j in range(3):
                parts["galv"].append(
                    L.cyl(f"reb{lvl}{i}{j}", 0.016, 5.6,
                          (bx + j * 0.05, 11.0, sz + 0.04 + j * 0.04),
                          mats["galv"], verts=5, axis="X"))


def build_soffit_forms(parts, mats, lvl, stage, z, y0):
    """
    A falsework level still has its SOFFIT FORMWORK up. That is what
    "falsework standing" means: the props are not holding air, they are
    holding the deck the slab was cast on, and it has not been struck yet.

    Without it, level 5 was a prop grid identical to levels 6 and 7 -- three
    storeys in a row reading the same, which was a recorded weakness. It also
    happens to be the one light-toned surface in the upper working band, so
    the distinction it makes is a VALUE distinction as well as a construction
    one, and the props already terminate at exactly this height.
    """
    if stage != STAGE_FALSEWORK:
        return
    zp = z - 0.35                            # formwork face against the soffit
    xb = ((PX0 + 0.3, -7.7), (-7.3, -0.2), (0.2, 7.3), (7.7, PX1 - 0.3))
    yb = ((y0 + 0.4, -4.2), (-3.8, 5.8), (6.2, PY1 - 0.6))
    for i, (a, b) in enumerate(xb):
        for j, (c, d) in enumerate(yb):
            if d <= c or b <= a:
                continue
            parts["ply"].append(
                M.prism(f"sfm{lvl}{i}{j}", M.rect(a, c, b, d), zp, 0.05, mats["ply"]))


def build_beams(parts, mats, lvl, z, y0):
    """
    The downstand grillage under a poured plate.

    A 300 mm flat slab does not span a 7.5 x 10 m grid. This frame always
    needed beams, and their absence is most of why every floor read as a slab
    edge with nothing behind it: there was genuinely nothing behind it. They
    are also what the back-props bear on, and at 65 mm they are the horizontal
    that tells the eye there is STRUCTURE in the dark rather than a gap
    between two plates.
    """
    d, w = 0.55, 0.40
    zb = z - 0.30 - d
    # Longitudinal, on the column lines, stopped where they run into a core.
    for i, (x, y_end) in enumerate(((-7.5, STAIR[1]), (0.0, PY1 - 0.4), (7.5, CORE[1]))):
        if y_end <= y0 + 1.0:
            continue
        parts["conc"].append(
            M.prism(f"beam{lvl}L{i}", M.rect(x - w / 2, y0, x + w / 2, y_end),
                    zb, d, mats["conc"]))
    # Transverse, on the two column rows that clear both cores.
    for i, y in enumerate((-4.0, 6.0)):
        if y <= y0:
            continue
        parts["conc"].append(
            M.prism(f"beam{lvl}T{i}", M.rect(PX0, y - w / 2, PX1, y + w / 2),
                    zb, d, mats["conc"]))


def build_pour_front(parts, mats, lvl, z, y0):
    """
    The half of a formwork level that has NOT been poured yet.

    The pour front cut the slab away and left a hole in the building. A hole
    is not what is physically there: you form a deck BEFORE you pour onto it,
    so the un-poured half carries plywood on soldiers, and the pour stops
    against a shuttered stop-end with strongbacks behind it. Filling the void
    with the reason for the void is the whole point -- it is the same fix as
    the props, one level up.
    """
    fx0, fx1 = -2.0, PX1 - 0.4
    soffit = z - 0.30                      # the deck forms to the slab soffit
    parts["ply"].append(
        M.prism(f"fdeck{lvl}", M.rect(fx0, y0 + 0.4, fx1, PY1 - 0.4),
                soffit - 0.06, 0.06, mats["ply"]))
    for i in range(11):
        yy = y0 + 1.0 + i * 1.05
        if yy > PY1 - 0.6:
            break
        parts["ply"].append(
            M.prism(f"fsol{lvl}{i}", M.rect(fx0, yy - 0.08, fx1, yy + 0.08),
                    soffit - 0.32, 0.26, mats["ply"]))
    # Stop-end shutter: what the concrete was stopped against, standing proud
    # of the slab it retained.
    parts["ply"].append(
        M.prism(f"stope{lvl}", M.rect(fx0 - 0.09, y0 + 0.4, fx0, PY1 - 0.4),
                soffit, 0.64, mats["ply"]))
    for i in range(7):
        yy = y0 + 1.4 + i * 2.3
        if yy > PY1 - 0.8:
            break
        parts["galv"].append(
            L.cyl(f"sback{lvl}{i}", 0.030, 1.15, (fx0 - 0.34, yy, z + 0.28),
                  mats["galv"], verts=6))


def build_crown(parts, mats, lvl, y0, deck_top):
    """
    What the top deck has to put ABOVE the slab line, and why.

    Interior props are 48 mm tubes standing in shadow: at 70 m they are gone,
    and no amount of adding more of them brings them back. The only part of
    the construction story an establishing frame can still read is the part
    that crosses the SKYLINE. So the forming deck carries its real temporary
    works up where the sky is behind them -- edge shutters standing proud,
    column cages and boxed columns waiting for the next lift, and a guard rail
    on the open edge.

    Nothing here is oversized to make it show. Every dimension is the real
    one. It reads because it is grouped, repeated and broken against sky,
    which is how a construction skyline reads from a street in any case.
    """
    x0, x1 = PX0 + 0.4, PX1 - 0.4
    ye = y0 + 0.5

    # Edge shutter -- the side form for the next pour, on three free edges.
    for i, r in enumerate((M.rect(x0, ye, x1, ye + 0.07),
                           M.rect(x0, ye, x0 + 0.07, PY1 - 0.4),
                           M.rect(x1 - 0.07, ye, x1, PY1 - 0.4))):
        parts["ply"].append(M.prism(f"shut{lvl}{i}", r, deck_top, 0.32, mats["ply"]))

    # Column starter cages, and the two that have already been boxed ready to
    # pour. Real 16 mm bar, real 600 mm column -- grouped, not enlarged.
    for xi, x in enumerate((-7.5, 0.0, 7.5)):
        for yi, y in enumerate((-4.0, 6.0, 15.0)):
            if y < ye + 1.0:
                continue
            if CORE[0] < x < CORE[2] and CORE[1] < y < CORE[3]:
                continue
            if (xi + yi) % 3 == 0:
                parts["ply"].append(
                    M.prism(f"cbox{lvl}{xi}{yi}",
                            M.rect(x - 0.32, y - 0.32, x + 0.32, y + 0.32),
                            deck_top, 1.35, mats["ply"]))
                continue
            for dx, dy in ((-0.18, -0.18), (0.18, -0.18), (0.18, 0.18), (-0.18, 0.18)):
                parts["galv"].append(
                    L.cyl(f"cage{lvl}{xi}{yi}", 0.016, 1.50,
                          (x + dx, y + dy, deck_top + 0.75), mats["galv"], verts=5))
            for lz in (0.42, 1.16):
                for ax, (ox, oy) in (("X", (0.0, -0.18)), ("X", (0.0, 0.18)),
                                     ("Y", (-0.18, 0.0)), ("Y", (0.18, 0.0))):
                    parts["galv"].append(
                        L.cyl(f"cage{lvl}{xi}{yi}l", 0.010, 0.36,
                              (x + ox, y + oy, deck_top + lz), mats["galv"],
                              axis=ax, verts=4))

    # Guard rail on the open deck edge: the strongest single horizontal the
    # crown has against the sky, and the one piece of edge protection on this
    # building that a viewer at street level is actually looking up at.
    span = (x1 - x0 - 1.2) / 8.0
    for i in range(9):
        parts["galv"].append(
            L.cyl(f"drp{lvl}{i}", 0.024, 1.18, (x0 + 0.6 + i * span, ye - 0.13,
                                                deck_top + 0.59), mats["galv"], verts=6))
    for h in (0.56, 1.12):
        parts["galv"].append(
            M.prism(f"drail{lvl}{h}", M.rect(x0, ye - 0.16, x1, ye - 0.10),
                    deck_top + h, 0.042, mats["galv"]))


def build_ground_logistics(parts, mats, rng):
    """
    The ground floor is where the site OPERATES FROM, and it was a black void.

    Measured at 0.13 luminance in the production frame -- the darkest band in
    the hero and the one level never authored. The fix is not exposure. It is
    that four flows have to be legible, and each needs the thing that makes it
    real:

        VEHICLE     ramp, gate, unloading bay on the existing haul strip
        PEDESTRIAN  a barriered corridor that never crosses the vehicle route
        MATERIAL    unloading bay -> staging -> hoist base, in that order and
                    on one line, which is WHY the hoist sits east of the gate
        WASTE       floors -> hoist -> skip beside the hoist -> out the gate

    Restraint matters more than inventory: every object below belongs to one
    of those four flows, and nothing is here because a site "usually has one".
    """
    galv, mesh, ply = mats["galv"], mats["screen"], mats["ply"]

    # PEDESTRIAN: one barrier line holding the walking route against the west
    # party wall. A route that crosses the vehicle route is not a route.
    for i in range(14):
        yy = -18.6 + i * 1.95
        parts["paint"].append(
            M.prism(f"pbar{i}", M.rect(-8.10, yy, -8.04, yy + 1.80), 0.42, 1.05, mesh))
        parts["galv"].append(
            L.cyl(f"pbf{i}", 0.05, 0.62, (-8.07, yy + 0.9, 0.44), galv, axis="Y", verts=6))
    for i, sy in enumerate((-18.2, -16.0)):      # signs only where the route starts
        parts["paint"].append(
            M.prism(f"psgn{i}", M.rect(-8.16, sy, -8.10, sy + 0.90), 1.05, 0.62, ply))

    # VEHICLE: bollards holding the unloading bay off the pedestrian line.
    for i in range(5):
        parts["paint"].append(
            L.cyl(f"boll{i}", 0.09, 1.05, (-7.2, -18.4 + i * 1.9, 0.92),
                  mats["crane"], verts=8))

    # MATERIAL: unloading bay -> staging -> hoist, west to east on one line.
    parts["ply"] += D.plank_stack("gply1", 2.1, -15.2, 0.40, mats, rng, layers=8)
    parts["ply"] += D.plank_stack("gply2", 3.6, -15.4, 0.40, mats, rng, layers=6)
    parts["galv"] += D.rebar_bundle("greb1", 1.2, -12.4, 0.44, mats, rng, count=11)
    parts["galv"] += D.tube_pile("gtub", 5.0, -12.0, 0.40, mats, rng, count=12)
    for i in range(3):
        # Block pallets staged CLEAR of the car's travel envelope -- material
        # waiting for a hoist must not stand in the hoist.
        parts["block"].append(
            M.prism(f"gblk{i}", M.rect(2.8 + i * 1.30, -17.6, 3.95 + i * 1.30, -16.5),
                    0.40, 0.92, mats["block"]))
    parts["paint"] += D.wrapped_pallet("gwp", 6.4, -14.6, 0.40, mats, rng)

    # WASTE: the skip stands beside the hoist, because that is what brings it
    # down. The rear-yard skip serves the rear yard and is a different flow.
    parts["paint"] += D.bin_skip("gskip", 5.6, -12.6, 0.40, mats, rng)

    # LIGHT: the ground floor is 34 m deep with no facade, and the sun reaches
    # 4.4 m of it. Measured through the production camera it sat at 0.064
    # against a hoarding at 0.27 -- a lit band with a black hole above it.
    # A real site hangs festoon and stands task lights, so this world does
    # too. Every luminaire has a visible fixture; there is no fill light.
    parts["galv"] += D.site_lighting(
        "lit", mats, rng, soffit_z=GROUND_H + STOREY_H - 0.3,
        festoon=(0.0, -18.0, 6.0, 9),
        task=((-1.0, -13.6, 2.70, 78.0), (6.5, -18.2, 2.70, 78.0)))


def boarded_lifts(lifts, lift_h=2.0):
    """
    Which scaffold lifts still carry a working platform.

    The 70 m frame failed because the scaffold hid the storeys the stage
    system had just differentiated. The earlier checkpoint blamed debris mesh.
    There is no debris mesh in this world and there never was -- the occluder
    is BOARDING, and the arithmetic is unambiguous: boards on every second
    lift land at 4, 8, 12, 16, 20 and 24 m, which is one full-width plywood
    band across every single storey from level 1 to level 5.

    Boards are not cladding. They are a consumable the site owns a finite
    number of, and they sit under a gang's feet. This job runs two gangs --
    a blockwork gang following the envelope upward, and a frame gang forming
    and pouring at the top -- so the platforms sit in TWO bands with struck
    scaffold between them. The standards, ledgers, transoms and ties stay:
    they are the structure and they hold the scaffold to the building. Only
    the platforms move, because on a real site that is the thing that moves.
    """
    frame = {lifts, lifts - 1, lifts - 2}
    # The blockwork front is the HIGHEST level still being infilled; below it
    # the wall is up and the gang has carried its boards with it.
    front = max(l for l, s in STAGE_OF.items() if s in INFILL_FRACTION)
    zc = GROUND_H + front * STOREY_H
    block = {int(round(zc / lift_h)), int(round((zc + STOREY_H * 0.6) / lift_h))}
    return frame | block


def build(dusk=False, join_by_material=True):
    L.reset()
    rng = random.Random(41)
    mats = L.standard_materials(wear=0.72, lit=0.5 if dusk else 0.0)
    parts = {"conc": [], "block": [], "galv": [], "ply": [], "paint": [],
             "glass": [], "street": []}

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
    # ONE MATERIAL PER CROSS-SECTION SEGMENT. The profile already knew where
    # the kerbs, gutters, median and footpaths were; it just rendered them all
    # as asphalt. Read left to right across the section above.
    ROAD_MATS = [mats[k] for k in (
        "footpath", "footpath", "footpath",   # opposite building line -> kerb
        "kerb",                               # far kerb upstand
        "asphalt", "asphalt",                 # far carriageway, crown, gutter
        "kerb",                               # median kerb, near side
        "median_top", "median_top",           # planted median
        "kerb",                               # median kerb, far side
        "asphalt", "asphalt",                 # near carriageway
        "kerb",                               # near kerb upstand
        "footpath", "footpath")]              # footpath to the building line
    parts["street"].append(
        M.ribbon("road", -320, 320, ROAD, mats["asphalt"], segment_mats=ROAD_MATS))

    # The rear laneway: narrower, no footpath, a single fall to one gutter.
    LANE = [
        (17.6, 0.22), (21.0, 0.06), (22.0, 0.16),
        (26.0, 0.12), (30.0, 0.05), (30.4, 0.16), (38.0, 0.04),
    ]
    LANE_MATS = [mats[k] for k in (
        "footpath", "kerb", "asphalt", "asphalt", "kerb", "footpath")]
    parts["street"].append(
        M.ribbon("lane", -220, 220, LANE, mats["asphalt"], segment_mats=LANE_MATS))

    # The site pad, sitting slightly PROUD of the footpath so the site reads as
    # a thing built into the ground rather than a plate laid on it, with a
    # graded ramp down to the gate where vehicles actually cross the kerb.
    parts["street"].append(
        M.prism("pad", M.rect(-13, -19, 13, 19), 0.24, 0.16, mats["conc"]))
    RAMP = [(-19.0, 0.24), (-20.4, 0.20), (-21.6, 0.10), (-23.0, 0.03)]
    parts["street"].append(M.ribbon("ramp", -6.0, 6.0, RAMP, mats["conc"]))
    # A compacted access strip worn across the pad from the gate to the core.
    parts["street"].append(
        M.prism("haul", M.rect(-5.4, -19, 5.4, 12), 0.395, 0.03, mats["haul"]))
    # ---- LANE MARKINGS ---------------------------------------------------
    #
    # The inventory found these MISSING outright. They are derived from the
    # road profile rather than placed by eye: three 3.5 m lanes centred on
    # each carriageway crown, which leaves the outer margin unmarked as the
    # parking/shoulder it is. Only lane separators are authored -- crosswalks,
    # arrows, bus lanes and box junctions would all be inventing a traffic
    # scheme this street does not describe.
    #
    # Every dash sits on the CROSSFALL, not on a flat plane: z comes from
    # interpolating the section at that y, so paint follows the camber the way
    # paint does.
    #
    # The dash is EMBEDDED, not stood on top. Basing it 6 mm proud left a 6 mm
    # air gap under every line, and at 11 m that is enough to show side faces
    # and cast its own shadow -- the markings read as raised concrete bars
    # lying on the road rather than as paint. Base 3 mm below the surface,
    # 7 mm tall, so 4 mm of real thermoplastic stands proud and there is no
    # gap and no z-fighting.
    def section_z(section, y):
        for i in range(len(section) - 1):
            (ya, za), (yb, zb) = section[i], section[i + 1]
            if ya <= y <= yb:
                return za + (y - ya) / (yb - ya) * (zb - za)
        return section[-1][1]

    MARK_W, MARK_DASH, MARK_GAP, MARK_SINK = 0.10, 3.0, 6.0, 0.003
    for ci, crown in enumerate((-61.5, -35.0)):
        for si in (-1, 1):
            my = crown + si * 1.75
            mz = section_z(ROAD, my) - MARK_SINK
            n = int(280.0 / (MARK_DASH + MARK_GAP))
            for k in range(n):
                mx = -140.0 + k * (MARK_DASH + MARK_GAP)
                parts["street"].append(
                    M.prism(f"mark{ci}{si}{k}",
                            M.rect(mx, my - MARK_W / 2, mx + MARK_DASH, my + MARK_W / 2),
                            mz, 0.007, mats["roadline"]))

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
        # ---- WINDOWS AS ASSEMBLIES, NOT AS CUTS -----------------------
        #
        # These were a 250 mm boolean recess and nothing else -- no glass, no
        # frame, no interior. The back face of the cut was the SAME wall
        # material lit by the SAME sun, so every opening read as a rectangle
        # pressed into a slab. That single fact is what made both neighbours
        # look like massing.
        #
        # A window is not a hole. It is: opening -> reveal -> frame ->
        # recessed glazing -> INTERIOR DEPTH. The interior is the part that
        # was missing and the part that does the work: a room is darker than
        # any sunlit facade, so the dark box behind the glass is what tells
        # the eye there is a building in there rather than solid stone.
        FACE = PY0 - 3.0                     # the street face of the neighbour
        for lv in range(1, int(nh / 3.4)):
            z0 = 0.2 + lv * 3.4
            for i in range(4):
                wx = nx - 6.6 + i * 4.4
                # 1. The opening, cut 420 mm deep so the reveal has real depth.
                rec = M.prism(f"nw{side}{lv}{i}",
                              M.rect(wx - 1.05, FACE - 0.35, wx + 1.05, FACE + 0.42),
                              z0, 1.7)
                M.cut(body, rec)
                # 2. INTERIOR. An unlit room behind the opening. Without this
                #    the eye sees masonry through the glass.
                parts["conc"].append(
                    M.prism(f"nw{side}{lv}{i}-room",
                            M.rect(wx - 1.0, FACE + 0.40, wx + 1.0, FACE + 2.6),
                            z0 + 0.02, 1.66, mats["interior"]))
                # 3. GLAZING, set 300 mm behind the wall face -- the setback
                #    is what casts the reveal shadow across the glass.
                parts["glass"].append(
                    M.prism(f"nw{side}{lv}{i}-glass",
                            M.rect(wx - 0.98, FACE + 0.29, wx + 0.98, FACE + 0.31),
                            z0 + 0.06, 1.58, mats["glass"]))
                # 4. FRAME: head, sill and two jambs, in the reveal.
                for (fx0, fy0, fx1, fy1, fz, fh) in (
                        (wx - 1.0, FACE + 0.26, wx + 1.0, FACE + 0.34, z0 + 1.64, 0.06),
                        (wx - 1.0, FACE + 0.26, wx + 1.0, FACE + 0.34, z0 + 0.02, 0.06),
                        (wx - 1.0, FACE + 0.26, wx - 0.94, FACE + 0.34, z0 + 0.02, 1.68),
                        (wx + 0.94, FACE + 0.26, wx + 1.0, FACE + 0.34, z0 + 0.02, 1.68)):
                    parts["conc"].append(
                        M.prism(f"nw{side}{lv}{i}-frame", M.rect(fx0, fy0, fx1, fy1),
                                fz, fh, mats["paint"]))
                # 5. A SILL that projects past the face and throws a shadow
                #    line -- the detail that says "built" rather than "cut".
                parts["conc"].append(
                    M.prism(f"nw{side}{lv}{i}-sill",
                            M.rect(wx - 1.16, FACE - 0.08, wx + 1.16, FACE + 0.36),
                            z0 - 0.06, 0.08, mats["conc"]))
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
            for i in range(4):
                wx = nx - 6.3 + i * 4.2
                # Four bays at 4.2 m, not three at 5.6. Three left roughly
                # 18 m of wall carrying six small holes, and on the shaded
                # rear face that reads as a blank slab someone punched rather
                # than a building. The bay ABOVE the service door stays blank
                # on alternate floors -- a riser, which is why it is blank.
                if i == 1 and lv % 2 == 0:
                    continue
                z0 = 0.2 + lv * 3.4 + 0.4
                M.cut(body, M.prism(f"nrw{side}{lv}{i}",
                                    M.rect(wx - 0.62, rear_y - 0.65, wx + 0.62, rear_y + 0.05),
                                    z0, 1.15))
                # A REAR ELEVATION IS STILL A BUILDING.
                #
                # This was step 1 of the street window's four and nothing
                # else: a boolean recess with solid concrete at its back. It
                # read as a hole punched in a slab because that is exactly
                # what it was. The street face gets a room, glazing, a frame
                # and a projecting sill; the back of a building legitimately
                # gets less, but it does not get NOTHING.
                #
                # So it takes the same vocabulary, utilitarian: an unlit room,
                # glazing set 300 mm back so the reveal throws a shadow, and a
                # plain frame. No projecting sill -- that is a street detail,
                # and a service elevation would not have one.
                parts["conc"].append(
                    M.prism(f"nrw{side}{lv}{i}-room",
                            M.rect(wx - 0.60, rear_y - 2.40, wx + 0.60, rear_y - 0.63),
                            z0 + 0.02, 1.11, mats["interior"]))
                parts["glass"].append(
                    M.prism(f"nrw{side}{lv}{i}-glass",
                            M.rect(wx - 0.58, rear_y - 0.32, wx + 0.58, rear_y - 0.30),
                            z0 + 0.05, 1.05, mats["glass"]))
                for (fx0, fy0, fx1, fy1, fz, fh) in (
                        (wx - 0.60, rear_y - 0.36, wx + 0.60, rear_y - 0.28, z0 + 1.10, 0.05),
                        (wx - 0.60, rear_y - 0.36, wx + 0.60, rear_y - 0.28, z0 + 0.02, 0.05),
                        (wx - 0.60, rear_y - 0.36, wx - 0.55, rear_y - 0.28, z0 + 0.02, 1.13),
                        (wx + 0.55, rear_y - 0.36, wx + 0.60, rear_y - 0.28, z0 + 0.02, 1.13)):
                    parts["conc"].append(
                        M.prism(f"nrw{side}{lv}{i}-fr{fz:.1f}",
                                M.rect(fx0, fy0, fx1, fy1), fz, fh, mats["paint"]))
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
        # ---- SERVICE STACK -------------------------------------------
        #
        # A rear elevation is where a building admits what it does. A soil and
        # vent stack running the full height, with a boxed riser at its head
        # and small vent grilles off it, is the cheapest honest thing that
        # turns a blank field into a service elevation -- and it is the reason
        # the riser bay above is blank.
        stk = nx + sx * 1.4
        parts["galv"].append(
            M.prism(f"nsv{side}", M.rect(stk - 0.09, rear_y - 0.20, stk + 0.09, rear_y - 0.02),
                    0.2, nh - 0.6, mats["galv"]))
        for lv in range(1, int(nh / 3.4)):
            zz = 0.2 + lv * 3.4
            parts["galv"].append(
                M.prism(f"nsb{side}{lv}", M.rect(stk - 0.16, rear_y - 0.26, stk + 0.16, rear_y - 0.02),
                        zz + 0.9, 0.22, mats["galv"]))
            if lv % 2:
                parts["conc"].append(
                    M.prism(f"nvg{side}{lv}",
                            M.rect(stk + sx * 0.9 - 0.28, rear_y - 0.14,
                                   stk + sx * 0.9 + 0.28, rear_y + 0.02),
                            zz + 1.9, 0.34, mats["paint"]))

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
            # A column carries the slab above it. These stopped at 5.00 m
            # against a level 1 soffit at 7.60 -- 2.60 m short, floating.
            # GROUND_H is the storey's clear height, not the structural rise:
            # the ground storey is 7.9 m floor to floor because the loop puts
            # level 1 at GROUND_H + STOREY_H. Height comes from the slab now.
            parts["conc"].append(
                M.column(f"gc{x}{y}", x, y, 0.4,
                         GROUND_H + STOREY_H - 0.3 - 0.4, 0.55, mats["conc"]))

    for lvl in range(1, LEVELS + 1):
        z = GROUND_H + lvl * STOREY_H
        outline = plate(lvl)
        voids = [CORE, STAIR]
        stage = STAGE_OF[lvl]
        y0 = PY0 + (4.5 if lvl >= SETBACK_FROM else 0.0)
        surf = z                       # what material on this level rests on

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
            # The deck is the working surface, 240 mm below the nominal level.
            surf = z - 0.24
            build_crown(parts, mats, lvl, y0, surf)
        elif lvl == LEVELS - 1:
            # The pour front runs across the plate.
            slab = M.slab(f"slab{lvl}", outline, z, 0.3, mats["wet"],
                          voids=voids, edge_band=0.3)
            cutter = M.prism("pcut", M.rect(-2.0, PY0 - 6, PX1 + 6, PY1 + 6),
                             z - 2.0, 4.0)
            M.cut(slab, cutter)
            parts["conc"].append(slab)
            # The un-poured half is a FORMED DECK, not a hole in the building.
            build_pour_front(parts, mats, lvl, z, y0)
            # Starter bars beyond the pour front, standing on that deck --
            # reinforcement is fixed before the concrete arrives, not after.
            for x in (-7.5, 0.0, 7.5):
                if x < -2.0:
                    continue
                for y in (-10.0, 0.0, 10.0):
                    for dx, dy in ((-0.18, -0.18), (0.18, -0.18), (0.18, 0.18), (-0.18, 0.18)):
                        h = rng.uniform(0.8, 1.2)
                        parts["galv"].append(
                            L.cyl("bar", 0.014, h, (x + dx, y + dy, z - 0.30 + h / 2),
                                  mats["galv"], verts=5))
        else:
            parts["conc"].append(
                M.slab(f"slab{lvl}", outline, z, 0.3, mats["conc"],
                       voids=voids, edge_band=0.3))
            # A 300 mm plate does not span this grid on its own.
            build_beams(parts, mats, lvl, z, y0)

        # Street edge beam, so the facade line has depth.
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

        # Temporary works and secondary works, by the level's OWN state.
        # Props thin downward as the concrete ages; infill climbs upward as
        # the envelope follows the frame. Neither is decoration.
        build_backprops(parts, mats, rng, lvl, stage, z)
        build_soffit_forms(parts, mats, lvl, stage, z, y0)
        build_infill(parts, mats, lvl, stage, z, y0)
        build_staging(parts, mats, rng, lvl, stage, z, surf)

        # Edge protection only where the slab edge is still open. Once the
        # blockwork is up the guard rail comes down, so the enclosed floors
        # must NOT carry one -- identical rails on every level was part of
        # what made the stack read as repeated.
        if stage not in (STAGE_INFILL_ON, STAGE_ACTIVE_DECK):
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
    # A scaffold is TIED TO A BUILDING, and this one was not. It stood to
    # 29.1 m against a street elevation that stops at 24.4 -- levels 6 and 7
    # step back 4.5 m -- so its top 4.7 m was tube tied to nothing. That
    # overrun is what capped the crown: the set-back forming deck was being
    # rendered behind a boarded lift serving a facade that is not there.
    # Where the building steps away, the scaffold stops, and the temporary
    # works at the top finally have sky behind them instead of steel.
    street_top = GROUND_H + SETBACK_FROM * STOREY_H      # head of the top
    scaf_h = street_top + 1.2                            # street-line storey
    sy = PY0 - 1.5
    lifts = int(street_top / 2.0)
    boarded = boarded_lifts(lifts)
    for i in range(12):
        sx = PX0 - 0.4 + i * 2.0
        parts["galv"].append(
            L.cyl(f"std{i}", 0.024, scaf_h, (sx, sy, scaf_h / 2), mats["galv"], verts=6))
        parts["galv"].append(
            L.cyl(f"std2{i}", 0.024, scaf_h, (sx, sy - 1.3, scaf_h / 2),
                  mats["galv"], verts=6))
    # ---- THE HOIST BAY ---------------------------------------------------
    #
    # The hoist car travels through the plane the scaffold occupies, so the
    # scaffold has to make room for it -- properly, not by deleting whatever
    # tubes happen to intersect. One full bay between the standards at 6.6 and
    # 8.6 is left OPEN: the standards stay because they frame the opening, the
    # ledgers, boards and guard rails STOP at the bay and return, and the bay
    # edges are guarded, because an opening in a working platform is an edge.
    def bay_split(a, b):
        """Segments of a run from a to b that avoid the hoist bay."""
        lo, hi = HOIST_BAY
        if b <= lo or a >= hi:
            return [(a, b)]
        out = []
        if a < lo:
            out.append((a, lo))
        if b > hi:
            out.append((hi, b))
        return out

    for lift in range(1, lifts + 1):
        zz = lift * 2.0
        for k, (a, b) in enumerate(bay_split(PX0 - 0.45, PX1 + 0.45)):
            parts["galv"].append(
                M.prism(f"ldg{lift}_{k}", M.rect(a, sy - 0.03, b, sy + 0.03),
                        zz, 0.048, mats["galv"]))
            parts["galv"].append(
                M.prism(f"ldg2{lift}_{k}", M.rect(a, sy - 1.33, b, sy - 1.27),
                        zz, 0.048, mats["galv"]))
        # Transoms CARRY THE BOARDS. A full set at every lift was the second
        # half of the occlusion problem -- 156 tubes screening the elevation
        # to hold up platforms that are not there. Where the boards were
        # struck the board-bearing transoms went up with them; what stays is
        # the sparse set at the tie lifts, which is structure, not decking.
        full = lift in boarded
        for i in range(12):
            if not full and (lift % 4 or i % 3):
                continue
            sx = PX0 - 0.4 + i * 2.0
            parts["galv"].append(
                L.cyl(f"tr{lift}{i}", 0.022, 1.35, (sx, sy - 0.65, zz), mats["galv"],
                      axis="Y", verts=5))
        # Platforms only where a gang is standing -- see boarded_lifts(). The
        # edge protection and toe board go with them, because you guard an
        # edge someone can fall off, not an empty lift.
        if lift in boarded:
            for k, (a, b) in enumerate(bay_split(PX0 - 0.4, PX1 + 0.4)):
                parts["ply"].append(
                    M.prism(f"board{lift}_{k}", M.rect(a, sy - 1.28, b, sy + 0.02),
                            zz + 0.05, 0.04, mats["ply"]))
                parts["ply"].append(
                    M.prism(f"board{lift}t{k}", M.rect(a, sy - 1.34, b, sy - 1.28),
                            zz + 0.09, 0.15, mats["ply"]))
                for h in (0.5, 1.0):
                    parts["galv"].append(
                        M.prism(f"gr{lift}{h}_{k}", M.rect(a, sy - 1.36, b, sy - 1.30),
                                zz + h, 0.04, mats["galv"]))
            # An opening in a boarded lift is an EDGE. Guard both bay sides.
            for e, ex in enumerate(HOIST_BAY):
                for h in (0.5, 1.0):
                    parts["galv"].append(
                        M.prism(f"gr{lift}b{e}{h}", M.rect(ex - 0.03, sy - 1.34,
                                                           ex + 0.03, sy + 0.02),
                                zz + h, 0.04, mats["galv"]))

    # ---- CONSTRUCTION HOIST ----------------------------------------------
    #
    # This was a mast climber standing in the wrong place doing a hoist's job.
    # Measured, it oversailed the party line by 1.28 m and the site boundary
    # by 1.53 m, its ties stopped 1.89 m short of the facade and held nothing,
    # its work platform faced AWAY from the building, and it had no landings
    # at all -- a car stopping in mid-air beside a slab edge.
    #
    # It is now a construction hoist, inside both boundaries, in its own
    # scaffold bay, tied to slab edges and landing on real platforms. See
    # site_dressing.construction_hoist for why it is not an MCWP.
    parts["galv"].extend(
        D.construction_hoist("hst", HOIST_X, HOIST_Y, 0.2, top, PY0,
                             HOIST_LANDINGS, HOIST_TIES, mats, rng,
                             car_z=HOIST_CAR_Z))

    # ---- PERIODIC MOBILE-CRANE OPERATION ---------------------------------
    #
    # It works from the REAR LANEWAY, and that is a measured decision. From
    # the street the boom would have to stand 75 m back to clear a 25.6 m
    # scaffold standing directly between it and a deck set back 4.5 m. The
    # rear elevation carries no scaffold, so an 11.0 m radius from the lane
    # clears the level 6 slab edge by 3.6 m and the deck edge by 1.5 m.
    # It is a visitor: the hoist does the routine work.
    build_ground_logistics(parts, mats, rng)
    crane, _head = D.mobile_crane("mcr", CRANE_X, CRANE_Y, 0.05, CRANE_HOOK,
                                  CRANE_BOOM_DEG, mats, rng)
    parts["paint"] += crane
    # The lift: a banded bundle of formwork ply for the deck being formed at
    # level 6, hanging a metre clear and about to land. A relevant load.
    # The rigging chain, built downward from the head so each link lands where
    # the one above it ends: rope -> hook block -> slings -> bundle, with the
    # bundle hanging 0.94 m clear of the deck at 27.46.
    hx, hy, hz = CRANE_HOOK
    LOAD_Z, LOAD_H = 28.40, 0.70
    HOOK_TOP, HOOK_H = 30.55, 0.65
    parts["galv"].append(
        L.cyl("mcrrope", 0.022, hz - HOOK_TOP, (hx, hy, (hz + HOOK_TOP) / 2),
              mats["galv"], verts=6))
    parts["galv"].append(
        L.box("mcrhook", (0.36, 0.36, HOOK_H), (hx, hy, HOOK_TOP - HOOK_H / 2),
              mats["galv"], bevel=0.04))
    sling_h = (HOOK_TOP - HOOK_H) - (LOAD_Z + LOAD_H)
    for s in (-1, 1):
        sl = L.cyl(f"mcrsling{s}", 0.016, sling_h * 1.07,
                   (hx + s * 0.85, hy, LOAD_Z + LOAD_H + sling_h / 2),
                   mats["galv"], verts=5)
        sl.rotation_euler = (0, s * 0.33, 0)
        parts["galv"].append(sl)
    # THE LOAD IS A REBAR BUNDLE, not formwork ply -- and that is a material
    # decision, not a dressing one. A ply bundle landing on a ply deck is the
    # blockwork-on-concrete collapse again: same surface, no separation, so
    # the landing could not be read at any camera distance. Reinforcement is
    # just as relevant to a deck being formed (bars are fixed before the pour)
    # and it is dark banded steel against pale sheeting.
    for i in range(11):
        row, col = divmod(i, 6)
        parts["galv"].append(
            L.cyl(f"mcrbar{i}", 0.016, 3.6,
                  (hx, hy - 0.42 + col * 0.17 + row * 0.085,
                   LOAD_Z + 0.05 + row * 0.034), mats["galv"], axis="X", verts=6))
    for s in (-1, 1):                      # the bands that make it a BUNDLE
        parts["galv"].append(
            M.prism(f"mcrband{s}", M.rect(hx + s * 1.15 - 0.03, hy - 0.82,
                                          hx + s * 1.15 + 0.03, hy + 0.82),
                    LOAD_Z - 0.02, LOAD_H + 0.04, mats["galv"]))


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
    # The three added here belong to the LIFT and the HOIST. A dogman who
    # cannot see the load, or a receiver who is not on the deck it lands on,
    # is set dressing -- so each position was taken from the operation.
    for (nm, x, y, z, face, pose) in (
            ("wk-gate", -3.6, -20.4, 0.40, 0.7, "walk"),
            ("wk-mat", -2.0, -8.2, 0.40, 2.5, "carry"),
            ("wk-bank", 5.4, -4.0, 0.40, -1.1, "signal"),
            ("wk-path", 4.6, -22.6, 0.24, 2.9, "stand"),
            ("wk-hoist", 6.3, -18.6, 0.40, 1.4, "stand"),
            ("wk-dog", 3.2, 23.6, 0.24, 2.0, "signal"),
            ("wk-deck", 1.6, 14.2, 27.46, 3.3, "signal")):
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
                "verge", "lamp", "tree", "park", "hoard", "cabin", "skip", "stack",
                # M3 terrain
                "road", "pad", "ramp", "haul", "drain", "mark")),
    ("neighbours", ("nb", "np", "nw", "nplant", "city",
                    # M3 rear elevations: openings, fire stair, plant
                    "nrw", "nrd", "nfl", "nfr", "nfp", "nac", "ndp")),
    ("street", ("mcr", "pbar", "pbf", "psgn", "boll", "gply", "greb", "gtub",
                "gblk", "gwp", "gskip")),
    ("scaffold", ("std", "ldg", "tr", "board", "gr", "mast", "climber", "mc",
                  "hst")),
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
    "block":             (0xC4C1B8,    0.94,  0.0),
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

    # Defaults to the production asset directory, so every existing caller —
    # build_assets.sh included — is unaffected.
    #
    # WORLD_EXPORT_DIR redirects the export elsewhere. That exists because the
    # standing rule for this project is to re-export to a scratch directory and
    # never leave production assets overwritten, and until now honouring it
    # meant exporting over them and running `git restore` afterwards. A rule
    # that depends on remembering to undo something is a rule that eventually
    # gets forgotten mid-investigation, with a dirty tree as the result.
    out_dir = os.environ.get("WORLD_EXPORT_DIR") or os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "frontend", "public", "world", "assets")
    os.makedirs(out_dir, exist_ok=True)
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
        # No images in the GLB. This is the "flatten at export" half of the
        # texture design -- the runtime reattaches maps from
        # /world/textures/cc0/ by material name, via SITE_SURFACES in
        # frontend/src/world/loginSite.js, so one copy of each map is fetched
        # and cached across every layer that uses it.
        #
        # Without it the exporter embeds a full copy of every map into every
        # GLB whose materials reference one. Measured 2026-08-17: that was
        # 10.57 MB of the street layer's 11.49 MB, against 0.91 MB of actual
        # geometry, and every one of those nine images was already shipping
        # as a file.
        #
        # The four other layers were unaffected only because their materials
        # are PBR factors with no image nodes at all -- not because anything
        # was stripping them.
        #
        # A material stripped here MUST have an entry in SITE_SURFACES, or it
        # renders as a flat colour. EXPORT_UV_TILE in concept_lib.py must
        # carry it too, so the UVs are projected at the size the map was
        # authored for.
        "export_image_format": "NONE",
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
    # HERO STACK: close on the street elevation through the scaffold, framed
    # so several floors are visible at once. This is the frame that has to
    # prove the building is being BUILT rather than extruded -- a fault the
    # 70 m establishing camera is too far away to show.
    "stack": ((-14.0, -46.0, 12.0), (0.0, -17.0, 16.0), 65),
    # NEIGHBOUR BAY: close on the east neighbour's street elevation, at the
    # distance the openings have to survive. A failure at 70 m is invisible;
    # this is where a window either reads as an assembly or as a pressed
    # rectangle.
    "bay": ((14.0, -34.0, 7.0), (20.0, -20.0, 9.0), 50),
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
    # ROAD TRUTH: a SOURCE-VERIFICATION camera, not a runtime station and not
    # a replacement for establishing. The production frame compresses 52 m of
    # street into 49 px with the near kerb and gutter sharing about five of
    # them, so it cannot prove the street materials either way. This stands a
    # person on the median at eye height looking back across the near
    # carriageway at the site, which puts median underfoot, then gutter, kerb,
    # footpath, the gate mouth and the haul route beyond it in one frame.
    # Standing on the near footpath just east of the gate, looking WSW ALONG
    # the kerb line. Aiming across the street from the median put the road in
    # a narrow band with the building taking the frame; along the kerb the
    # footpath, kerb upstand, gutter and carriageway each get real depth, and
    # the markings recede on the crossfall instead of sitting side-on.
    "road_truth": ((18.0, -23.4, 1.60), (-16.0, -31.0, 0.35), 42),
    # HOIST: close on the machine in its scaffold bay, from inside the site,
    # so the bay, the ties, the landings and the base land in one frame. This
    # is the view that has to prove the thing is attached to a building.
    "hoist": ((-1.6, -26.5, 3.4), (7.6, -18.6, 13.0), 50),
    # LIFT: the rear laneway, standing back from the outriggers at about the
    # distance a banksman actually stands. Tests whether the crane can
    # physically BE there, not whether it looks good.
    "lift": ((-19.0, 40.0, 1.70), (0.0, 24.0, 9.0), 35),
    # DECK RECEIVING: up at the load coming in over the level 6 slab edge
    # onto the forming deck, from the laneway side.
    # DECK RECEIVING: a three-quarter view from WEST of the boom plane. Aimed
    # down the boom axis the boom sat between lens and load and the landing
    # could not be read; the crane was correct and the camera was not. From
    # off-axis the boom crosses the frame instead of hiding the thing it is
    # delivering, and rear lane -> boom -> hook -> bundle -> deck reads in one
    # image without decoding.
    "deck": ((-9.5, 23.0, 26.2), (0.6, 15.2, 28.3), 38),
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
    # CLOUD STATE IS AN EXPLICIT ARGUMENT, NOT A DEFAULT.
    #
    # The architecture has to hold under clear sky as well as cover, so the
    # clear render stays the baseline and the cover conditions are named in
    # the filename. A cloud state that quietly became the default would let
    # cover hide geometry, which is the one thing clouds must not do here.
    cloud = args[args.index("--clouds") + 1] if "--clouds" in args else "none"
    if cloud != "none":
        L.clouds("clouds", L.CLOUD_MODERATE if cloud == "moderate" else L.CLOUD_LIGHT)
        sc = bpy.context.scene
        # A 5.2 km domain of thin cloud does not need fine stepping, and the
        # default rate turns a 4 minute frame into a very long one.
        sc.cycles.volume_step_rate = 8.0
        sc.cycles.volume_preview_step_rate = 8.0
        sc.cycles.volume_max_steps = 256
    suffix = "dusk" if dusk else "day"
    if cloud != "none":
        suffix = f"{suffix}-{cloud}"
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


# Guarded so this module can be IMPORTED for its helpers.
#
# It used to call main() bare, which meant `import concept_c` built the whole
# C scene and, if --export happened to be on the command line, wrote C's layers
# out before the importing script had run a line. Concept D imports layer_of()
# and bake_production_materials() from here, and found three of C's layers in
# its own export directory.
#
# Blender's -P runs a script with __name__ == "__main__", so build_assets.sh is
# unaffected.
if __name__ == "__main__":
    main()
