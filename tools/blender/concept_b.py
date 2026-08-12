"""
CONCEPT B — LARGE COMMERCIAL PROJECT

THE ARCHITECTURAL IDEA
----------------------
A wide, low commercial building on a corner plot, built as TWO WINGS around a
full-height atrium, with a transfer level at the podium.

That idea drives every irregularity, so none of it is random:

  the chamfered corner   the plot meets two streets, so the plate is cut back
                         at the junction and the entrance sits in the cut
  the atrium            a 22 x 15 m void punched through every plate above the
                        podium, which is what gives the building an inside
  the transfer level    the podium wants column-free retail, so L1 columns are
                        900 mm and carry a transfer beam; everything above is
                        650 mm on a tighter grid offset from it
  two cores             a tall main core west (lifts, stairs, risers) that
                        overruns the roof, and a small services core east
  the setback           the top plate steps back from the south edge to make a
                        terrace, which breaks the silhouette

CONSTRUCTION SEQUENCE, WEST TO EAST
-----------------------------------
The west wing is up and being clad. The east wing is still structure: the top
plate there is a formwork deck on falsework with a pour front running across
it. So the building reads left-to-right as finished-to-forming, which is a
different story from Concept A's bottom-to-top reading and gives the frame a
horizontal narrative the eye can follow.

    Blender -b -P tools/blender/concept_b.py -- [--frames hero,ground,rear] [--dusk] [--cycles]
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import concept_lib as L
import concept_mesh as M

NAME = "B-commercial"

# ---- The design, in metres -------------------------------------------------
PODIUM_H = 5.4
STOREY_H = 4.2
LEVELS = 6                      # above the podium
X0, X1 = -46.0, 46.0
Y0, Y1 = -30.0, 30.0
CHAMFER = 14.0                  # the cut street corner
ATRIUM = (-6.0, -8.0, 16.0, 7.0)
CORE_MAIN = (-30.0, -6.0, -18.0, 12.0)
CORE_SVC = (28.0, 8.0, 36.0, 20.0)
POUR_X = 12.0                   # the pour front on the top deck


def plate_outline(level):
    """The plan changes with height: a chamfered corner throughout, and the
    top level steps back from the south edge to form a terrace."""
    y0 = Y0 + (9.0 if level >= LEVELS else 0.0)
    return M.chamfered(X0, y0, X1, Y1, CHAMFER)


def build(dusk=False):
    L.reset()
    rng = random.Random(23)
    mats = L.standard_materials(wear=0.66, lit=0.4 if dusk else 0.0)
    parts = {"conc": [], "galv": [], "ply": [], "paint": [], "glass": []}

    # ---- Ground: two streets, kerbs, footpaths, the site slab -------------
    L.box("ground", (600, 600, 0.4), (0, 0, -0.2), mats["earth"])
    L.box("roadS", (600, 18, 0.3), (0, -56, 0.05), mats["spandrel"])
    L.box("roadE", (18, 600, 0.3), (66, 0, 0.05), mats["spandrel"])
    L.box("kerbS", (600, 0.4, 0.36), (0, -46.5, 0.16), mats["conc"])
    L.box("kerbE", (0.4, 600, 0.36), (56.5, 0, 0.16), mats["conc"])
    L.box("padS", (600, 8, 0.32), (0, -42, 0.14), mats["conc"])
    L.box("padE", (8, 600, 0.32), (52, 0, 0.14), mats["conc"])
    L.box("sitepad", (110, 76, 0.45), (0, 0, 0.2), mats["conc"])

    # ---- Structure --------------------------------------------------------
    #
    # The transfer level: 900 mm podium columns on a wide grid, carrying a
    # deep transfer beam, with a tighter 650 mm grid above that is DELIBERATELY
    # offset from it. That offset is the most architectural thing in the
    # model -- it is the reason the transfer exists.
    for x in range(-40, 41, 16):
        for y in (-22, -4, 14, 26):
            if M.rect(*ATRIUM) and ATRIUM[0] < x < ATRIUM[2] and ATRIUM[1] < y < ATRIUM[3]:
                continue
            if x < X0 + CHAMFER and y < Y0 + CHAMFER:
                continue
            parts["conc"].append(
                M.column(f"pc{x}{y}", x, y, 0.45, PODIUM_H, 0.9, mats["conc"]))
    # Transfer beams over the podium, spanning the wide grid.
    for y in (-22, -4, 14, 26):
        parts["conc"].append(
            M.prism(f"tb{y}", M.rect(X0 + 2, y - 0.65, X1 - 2, y + 0.65),
                    PODIUM_H - 1.5, 1.5, mats["conc"], bevel=0.03))

    for lvl in range(1, LEVELS + 1):
        z = PODIUM_H + lvl * STOREY_H
        outline = plate_outline(lvl)
        voids = [ATRIUM, CORE_MAIN, CORE_SVC]

        if lvl == LEVELS:
            # TOP PLATE: only the west part is cast. East of the pour front
            # there is a formwork deck instead -- the building is still being
            # built, and it is being built from this end.
            west = [(x, y) for (x, y) in outline]
            cast = M.slab(f"slab{lvl}", west, z, 0.34, mats["wet"],
                          voids=voids, edge_band=0.35)
            cutter = M.prism("pourcut", M.rect(POUR_X, Y0 - 5, X1 + 5, Y1 + 5),
                             z - 2.0, 4.0)
            M.cut(cast, cutter)
            parts["conc"].append(cast)

            deck = M.prism(f"deck{lvl}", M.rect(POUR_X, Y0 + 9, X1, Y1),
                           z - 0.34, 0.06, mats["ply"])
            parts["ply"].append(deck)
            for i in range(9):
                yy = Y0 + 10 + i * 2.2
                parts["ply"].append(
                    M.prism(f"sol{i}", M.rect(POUR_X, yy - 0.09, X1, yy + 0.09),
                            z - 0.62, 0.26, mats["ply"]))
        else:
            parts["conc"].append(
                M.slab(f"slab{lvl}", outline, z, 0.34, mats["conc"],
                       voids=voids, edge_band=0.35))

        # An edge beam around the plate. Without it a slab is a razor plate
        # and the building reads as a multi-storey car park; with it every
        # floor gains a shadow line and visible depth.
        for (a, b) in ((( X0, Y0 + (9 if lvl >= LEVELS else 0)), (X1, Y0 + (9 if lvl >= LEVELS else 0))),
                       ((X0, Y1), (X1, Y1)),
                       ((X1, Y0 + (9 if lvl >= LEVELS else 0)), (X1, Y1))):
            eb = M.wall(f"eb{lvl}", a, b, 0.85, 0.42, mats["conc"],
                        z=z - 0.34 - 0.85)
            if eb:
                parts["conc"].append(eb)

        # Upper columns: the tighter, offset grid.
        #
        # THE GRID REACHES THE PERIMETER. It previously stopped at +/-42 x
        # +/-26 against a plate running to +/-46 x +/-30, leaving a 4 m
        # cantilever on every edge with nothing under it -- which is why the
        # building read as a stack of trays rather than as a frame. The line is
        # now 2 m inside the slab edge, which is an ordinary slab overhang and
        # puts visible structure under every plate.
        if lvl < LEVELS:
            for x in range(-44, 45, 8):
                for y in range(-28, 29, 8):
                    if ATRIUM[0] - 1 < x < ATRIUM[2] + 1 and ATRIUM[1] - 1 < y < ATRIUM[3] + 1:
                        continue
                    if CORE_MAIN[0] < x < CORE_MAIN[2] and CORE_MAIN[1] < y < CORE_MAIN[3]:
                        continue
                    if y < Y0 + 9 and lvl >= LEVELS - 1:
                        continue
                    if x < X0 + CHAMFER and y < Y0 + CHAMFER:
                        continue
                    parts["conc"].append(
                        M.column(f"c{lvl}{x}{y}", x, y, z, STOREY_H, 0.65,
                                 mats["conc"]))

        # Falsework under the two most recent plates, thinning with age.
        if lvl >= LEVELS - 1:
            spacing = 1.9 if lvl == LEVELS else 3.2
            x = POUR_X if lvl == LEVELS else X0 + 4
            while x < X1 - 2:
                y = Y0 + 11
                while y < Y1 - 2:
                    parts["galv"].append(
                        L.cyl("prop", 0.05, STOREY_H - 0.4,
                              (x + rng.uniform(-0.1, 0.1), y + rng.uniform(-0.1, 0.1),
                               z - STOREY_H + (STOREY_H - 0.4) / 2), mats["galv"], verts=6))
                    y += spacing
                x += spacing

        # Edge protection on every completed plate.
        if lvl < LEVELS:
            for h in (0.55, 1.1):
                parts["galv"].append(
                    M.prism(f"rail{lvl}{h}", M.rect(X0 + 0.2, Y1 - 0.12, X1 - 0.2, Y1),
                            z + h, 0.05, mats["galv"]))
                parts["galv"].append(
                    M.prism(f"railS{lvl}{h}", M.rect(X0 + 0.2, Y0, X1 - 0.2, Y0 + 0.12),
                            z + h, 0.05, mats["galv"]))

    # ---- Cores: real walls around real voids, overrunning the roof --------
    top = PODIUM_H + LEVELS * STOREY_H
    parts["conc"] += M.stair_core("core", *CORE_MAIN, 0.2, top + 5.2, mats["conc"], 0.3)
    parts["conc"] += M.stair_core("svc", *CORE_SVC, 0.2, top + 1.4, mats["conc"], 0.25)

    # ---- Facade: only the west wing, only the lower three levels ----------
    #
    # Cladding follows the structure by several floors, so the west end is
    # enclosed while the east end is still open frame. That gap IS the project
    # programme, made visible.
    for lvl in range(1, 4):
        z = PODIUM_H + (lvl - 1) * STOREY_H
        for i in range(6):
            ax = X0 + 2 + i * 7.0
            parts["glass"] += M.facade_bay(f"fb{lvl}{i}", (ax, Y0), (ax + 7.0, Y0),
                                           z, STOREY_H, mats["glass"], mats["spandrel"])
    # Podium glazing along the chamfered entrance.
    parts["glass"] += M.facade_bay("ent", (X0 + CHAMFER, Y0), (X0, Y0 + CHAMFER),
                                   0.45, PODIUM_H, mats["glass"], mats["spandrel"],
                                   mullions=5)

    # ---- Site: hoarding, compound, staging, plant ------------------------
    for i in range(30):
        x = -58 + i * 4.0
        if 12 < i < 16:
            continue
        parts["paint"].append(
            M.prism("hoard", M.rect(x, -49.1, x + 3.9, -48.9), 0.2, 2.6, mats["screen"]))
    for i in range(3):
        L.box("cabin", (6.1, 2.6, 2.7), (-40 + i * 7.2, -38, 1.6), mats["paint"], bevel=0.04)
    for i in range(7):
        L.box("stack", (2.9, 1.4, rng.uniform(0.5, 1.2)),
              (2 + i * 3.6, -37, 0.7), mats["ply"])
    for i in range(5):
        L.box("rebar", (0.9, 7.0, 0.5), (26 + i * 1.3, -34, 0.7), mats["galv"])
    L.box("skip", (2.4, 5.2, 1.6), (40, -38, 1.0), mats["crane"], bevel=0.05)

    # ---- Crane, positioned for lifting coverage of the east wing ---------
    L.tower_crane((34, -18, 0.45), top + 16, 52, mats, slew=2.1)

    # ---- People ----------------------------------------------------------
    for (x, y, f) in ((6, -34, 0.5), (-24, -36, 2.4), (30, -30, -0.8), (18, -40, 1.6)):
        L.figure((x, y, 0.45), mats, facing=f)

    # ---- Urban context ---------------------------------------------------
    blocks = [
        (-108, -96, 40, 34, 26, 1), (-30, -92, 46, 30, 22, 0),
        (40, -84, 38, 28, 30, 1), (104, -60, 34, 40, 34, 0),
        (100, 40, 40, 46, 42, 1), (-104, 40, 38, 42, 30, 0),
        (-60, 96, 44, 34, 38, 1), (30, 104, 50, 36, 46, 0),
        (140, -130, 50, 46, 62, 0), (-150, -120, 46, 44, 54, 1),
        (170, 90, 52, 48, 70, 1), (-180, 70, 48, 44, 58, 0),
        (60, 190, 60, 50, 80, 0), (-90, 200, 56, 46, 66, 1),
    ]
    L.context_city(rng, blocks, mats, lit=0.4 if dusk else 0.0)

    # No camera may stand inside a context block. This is trivial to get wrong
    # and completely invisible in the source; the first Concept B render came
    # back showing the inside of a neighbour's third floor, which cost a full
    # render to discover and one more to confirm.
    for cam_name, (loc, _t, _mm) in CAMERAS.items():
        for (cx, cy, w, d, h, _era) in blocks:
            inside = (abs(loc[0] - cx) < w * 0.62 and abs(loc[1] - cy) < d * 0.62
                      and loc[2] < h)
            assert not inside, f"camera {cam_name} is inside the block at {cx},{cy}"

    for key, objs in parts.items():
        objs = [o for o in objs if o]
        if objs:
            L.join_all(f"b-{key}", objs)


def light(dusk):
    if dusk:
        L.sky_world(4.0, 292, strength=1.0, dusk=True)
        L.sun_lamp(4.0, 292, 3.6, color=(1.0, 0.70, 0.44), angle=1.8)
    else:
        # A LOW morning sun, not a high one. Concept A used 38 degrees and
        # every surface flattened out; raking light is what makes a slab edge
        # cast onto the floor below and a column read as round.
        L.sky_world(21, 128, strength=0.42)
        L.sun_lamp(21, 128, 7.5, color=(1.0, 0.91, 0.80), angle=0.5)


CAMERAS = {
    # HERO: from the far street corner, low, with the hoarding crossing the
    # foreground and the building running OUT OF FRAME to the right.
    "hero": ((-78, -57, 2.3), (8, -6, 20), 28),
    # GROUND: standing INSIDE the hoarding among the staged material, with
    # workers and stacks in the midground and the frame rising beyond.
    #
    # The first position stood under the podium and photographed an empty
    # car-park underside -- structurally accurate and completely lifeless. The
    # human-scale frame has to contain humans and the things they are working
    # with, or it is testing nothing.
    "ground": ((-6, -45, 1.66), (28, -12, 11), 35),
    # REAR: the loading edge, which nothing was composed for.
    "rear": ((72, 92, 3.2), (0, 6, 16), 35),
}


def main():
    args = L.argv()
    dusk = "--dusk" in args
    # NOT "--cycles": the Cycles addon parses sys.argv itself and claims
    # that flag even after the "--" separator, so Blender aborts with an
    # ambiguous-option error before the script ever runs.
    cycles = "--ref" in args
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
                     exposure=0.25 if dusk else -0.55)
        else:
            L.render(os.path.join(L.OUT, f"{NAME}-{suffix}-{key}.png"), cam,
                     width=1440, height=900, samples=48,
                     exposure=0.25 if dusk else -0.55)


main()
