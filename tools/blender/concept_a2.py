"""
CONCEPT A2 — HIGH-RISE URBAN PROJECT (replaces the dead Concept A)

WHY A2 EXISTS
-------------
Concept A was 21 identical floors on an identical column grid and it read as
BIM from every angle. It is not being rescued. A2 keeps only the brief -- a
tall building on a city plot -- and rebuilds it in the mesh language that made
Concept B and C work.

THE ARCHITECTURAL IDEA
----------------------
A podium-and-tower project, which is the form almost every real high-rise on a
city block actually takes, and every part of it has a structural reason:

  podium        4 tall commercial levels covering the WHOLE plot, because
                floorplate at street level is worth more than daylight
  transfer      the podium's grid is 10.5 m for retail; the tower's is 7 m for
                offices. They do not align, so a TRANSFER LEVEL of deep beams
                sits at the podium roof and carries the tower's columns down
                onto a different grid. This is the single most legible
                structural event in the whole set of concepts.
  tower         OFFSET on the podium, not centred, pushed to the street corner
                so the podium roof becomes a usable terrace behind it
  setback       the top four levels step in again, which is what a daylight
                or plot-ratio constraint does to a tower
  core          offset within the tower toward the blind flank, so the good
                elevations stay free -- and it runs past the top slab as the
                lift overrun

That gives four different floor plates up the height of one building. It
cannot read as an extrusion, because it is not one.

    Blender -b -P tools/blender/concept_a2.py -- [--frames hero,ground,rear] [--cycles]
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import concept_lib as L
import concept_mesh as M

NAME = "A2-highrise"

# ---- The project, in metres ------------------------------------------------
# Podium covers the plot; the tower sits on its north-east corner.
PODX0, PODY0, PODX1, PODY1 = -32.0, -26.0, 32.0, 26.0
PODIUM_LEVELS = 4
PODIUM_H = 4.5
TRANSFER = PODIUM_LEVELS * PODIUM_H          # 18 m: top of podium
TOWX0, TOWY0, TOWX1, TOWY1 = -4.0, -22.0, 30.0, 8.0
TOWER_LEVELS = 16
TOWER_H = 3.4
SETBACK_FROM = 13                            # top four levels step in
CORE = (18.0, -8.0, 28.0, 2.0)               # offset toward the blind flank
TOP = TRANSFER + TOWER_LEVELS * TOWER_H      # 72.4 m


def tower_plate(level):
    """Four distinct plates up the height: the setback steps the west and
    south edges in, and the street corner is chamfered throughout."""
    x0, y0 = TOWX0, TOWY0
    if level >= SETBACK_FROM:
        x0 += 7.0
        y0 += 5.0
    return M.chamfered(x0, y0, TOWX1, TOWY1, 4.0)


def build(dusk=False):
    L.reset()
    rng = random.Random(23)
    mats = L.standard_materials(wear=0.66, lit=0.42 if dusk else 0.0)
    parts = {"conc": [], "galv": [], "ply": [], "paint": [], "glass": []}

    # ---- Street, footpath, plot -----------------------------------------
    L.box("ground", (600, 600, 0.4), (0, 0, -0.2), mats["earth"])
    L.box("street", (600, 15, 0.32), (0, -44, 0.04), mats["spandrel"])
    L.box("kerb", (600, 0.4, 0.42), (0, -36.5, 0.19), mats["conc"])
    L.box("path", (600, 8.0, 0.34), (0, -32.5, 0.16), mats["conc"])
    L.box("pad", (72, 60, 0.5), (0, 0, 0.2), mats["conc"])

    # ---- PODIUM ----------------------------------------------------------
    pod_outline = M.chamfered(PODX0, PODY0, PODX1, PODY1, 5.0)
    for lvl in range(1, PODIUM_LEVELS + 1):
        z = lvl * PODIUM_H
        parts["conc"].append(
            M.slab(f"pod{lvl}", pod_outline, z, 0.36, mats["conc"],
                   voids=[CORE], edge_band=0.35))
        # Podium grid: 10.5 m, wide for retail.
        for x in range(-31, 32, 10):
            for y in range(-26, 27, 13):
                if CORE[0] < x < CORE[2] and CORE[1] < y < CORE[3]:
                    continue
                parts["conc"].append(
                    M.column(f"pc{lvl}{x}{y}", x, y, z - PODIUM_H, PODIUM_H, 0.75,
                             mats["conc"]))
        # The lowest two podium levels are being clad.
        if lvl <= 2:
            for i in range(9):
                ax = PODX0 + 3.0 + i * 6.9
                parts["glass"] += [o for o in M.facade_bay(
                    f"fb{lvl}{i}", (ax, PODY0), (ax + 6.4, PODY0), z - PODIUM_H,
                    PODIUM_H, mats["glass"], mats["spandrel"], mullions=3) if o]

    # ---- THE TRANSFER LEVEL ----------------------------------------------
    #
    # Deep beams at the podium roof carrying the tower's 7 m grid down onto the
    # podium's 10.5 m grid. This is the structural event the whole form turns
    # on, and it is the thing that makes the building look ENGINEERED.
    for y in range(-22, 9, 10):
        parts["conc"].append(
            M.prism(f"tb{y}", M.rect(TOWX0 - 1, y - 0.9, TOWX1 + 1, y + 0.9),
                    TRANSFER - 2.4, 2.4, mats["conc"], bevel=0.04))
    parts["conc"].append(
        M.prism("tcap", M.rect(TOWX0 - 1.4, TOWY0 - 1.4, TOWX1 + 1.4, TOWY1 + 1.4),
                TRANSFER, 0.45, mats["conc"], bevel=0.04))

    # ---- TOWER -----------------------------------------------------------
    for lvl in range(1, TOWER_LEVELS + 1):
        z = TRANSFER + lvl * TOWER_H
        outline = tower_plate(lvl)
        x0 = TOWX0 + (7.0 if lvl >= SETBACK_FROM else 0.0)
        y0 = TOWY0 + (5.0 if lvl >= SETBACK_FROM else 0.0)

        if lvl == TOWER_LEVELS:
            parts["ply"].append(
                M.prism("deck", M.rect(x0 + 0.5, y0 + 0.5, TOWX1 - 0.5, TOWY1 - 0.5),
                        z - 0.32, 0.06, mats["ply"]))
            for i in range(9):
                yy = y0 + 1.2 + i * 2.4
                if yy > TOWY1 - 1:
                    break
                parts["ply"].append(
                    M.prism(f"sol{i}", M.rect(x0 + 0.5, yy - 0.09, TOWX1 - 0.5, yy + 0.09),
                            z - 0.58, 0.26, mats["ply"]))
        elif lvl == TOWER_LEVELS - 1:
            slab = M.slab(f"slab{lvl}", outline, z, 0.3, mats["wet"],
                          voids=[CORE], edge_band=0.3)
            M.cut(slab, M.prism("pcut", M.rect(12.0, TOWY0 - 8, TOWX1 + 8, TOWY1 + 8),
                                z - 2.0, 4.0))
            parts["conc"].append(slab)
            for x in range(0, 31, 7):
                if x < 12:
                    continue
                for y in range(-20, 9, 7):
                    for dx, dy in ((-0.2, -0.2), (0.2, -0.2), (0.2, 0.2), (-0.2, 0.2)):
                        h = rng.uniform(0.85, 1.25)
                        parts["galv"].append(
                            L.cyl("bar", 0.015, h, (x + dx, y + dy, z + h / 2),
                                  mats["galv"], verts=5))
        else:
            parts["conc"].append(
                M.slab(f"slab{lvl}", outline, z, 0.3, mats["conc"],
                       voids=[CORE], edge_band=0.3))

        # Tower grid: 7 m, and it stops at the setback line.
        if lvl < TOWER_LEVELS:
            for x in range(-4, 31, 7):
                for y in range(-22, 9, 7):
                    if x < x0 - 0.5 or y < y0 - 0.5:
                        continue
                    if CORE[0] < x < CORE[2] and CORE[1] < y < CORE[3]:
                        continue
                    parts["conc"].append(
                        M.column(f"tc{lvl}{x}{y}", x, y, z, TOWER_H, 0.6, mats["conc"]))

        # Falsework under the two newest plates.
        if lvl >= TOWER_LEVELS - 1:
            x = x0 + 1.6
            while x < TOWX1 - 1.0:
                y = y0 + 1.6
                while y < TOWY1 - 1.0:
                    parts["galv"].append(
                        L.cyl("prop", 0.045, TOWER_H - 0.34,
                              (x, y, z - TOWER_H + (TOWER_H - 0.34) / 2),
                              mats["galv"], verts=6))
                    y += 1.9
                x += 1.9

        # Safety screens on the top two working levels, as SEPARATE PANELS.
        #
        # A continuous opaque wrap seals the top of the tower into a solid blue
        # box -- which is exactly what killed Concept A's silhouette and what
        # the first A2 render did again. Real screens are perforated panels
        # hung off the slab edge with visible joints between them, so the
        # structure behind stays legible and the top still reads as a working
        # level rather than as a finished penthouse.
        if lvl >= TOWER_LEVELS - 1:
            h = TOWER_H * 1.08
            panel, gap = 2.6, 0.45
            for (ax, ay, bx, by) in ((x0, y0, TOWX1, y0), (x0, TOWY1, TOWX1, TOWY1),
                                     (x0, y0, x0, TOWY1), (TOWX1, y0, TOWX1, TOWY1)):
                span = math.hypot(bx - ax, by - ay)
                n = max(1, int(span / (panel + gap)))
                for i in range(n):
                    t0 = (i * (panel + gap)) / span
                    t1 = (i * (panel + gap) + panel) / span
                    p0 = (ax + (bx - ax) * t0, ay + (by - ay) * t0)
                    p1 = (ax + (bx - ax) * t1, ay + (by - ay) * t1)
                    sc = M.wall(f"scr{lvl}{i}", p0, p1, h, 0.08, mats["screen"],
                                z=z - 0.25)
                    if sc:
                        parts["paint"].append(sc)
        elif lvl < TOWER_LEVELS - 2:
            for hh in (0.5, 1.05):
                for (ax, ay, bx, by) in ((x0, y0, TOWX1, y0), (x0, TOWY1, TOWX1, TOWY1)):
                    r = M.wall(f"rail{lvl}{hh}", (ax, ay), (bx, by), 0.045, 0.045,
                               mats["galv"], z=z + hh)
                    if r:
                        parts["galv"].append(r)

    # ---- Core, running past the top slab as the lift overrun -------------
    parts["conc"] += M.stair_core("core", *CORE, 0.2, TOP + 5.2, mats["conc"], 0.3)

    # ---- Crane, hoist, compound, people ---------------------------------
    L.tower_crane((-24, 16, 0.5), TOP + 14, 52, mats, slew=2.2)

    # Hoist mast up the tower's west flank, tied back.
    for i in range(int((TOP - 4) / 1.5)):
        parts["galv"].append(
            M.prism(f"hm{i}", M.rect(-7.6, -14.8, -6.4, -13.6), i * 1.5, 1.2,
                    mats["galv"]))
    L.box("hoistcar", (2.4, 3.0, 2.4), (-8.9, -14.2, 26.0), mats["crane"], bevel=0.05)

    for i in range(20):
        x = PODX0 - 4 + i * 3.6
        if 6 < i < 10:
            continue
        parts["paint"].append(
            M.prism(f"hoard{i}", M.rect(x, -32.2, x + 3.5, -32.0), 0.2, 2.4,
                    mats["screen"]))
    for i in range(3):
        L.box("cabin", (6.1, 2.6, 2.7), (-28 + i * 7.2, 34.0, 1.55), mats["paint"],
              bevel=0.05)
    for i in range(6):
        L.box("stack", (2.8, 1.3, rng.uniform(0.5, 1.05)), (-16 + i * 3.4, 33.0, 0.65),
              mats["ply"])
    L.box("skip", (2.4, 5.0, 1.6), (16, 34.0, 1.0), mats["crane"], bevel=0.05)

    for (x, y, f) in ((-14, -30, 0.5), (4, -31, 2.4), (-24, 31, -0.9)):
        L.figure((x, y, 0.36), mats, facing=f)

    # ---- The city, with REAL window reveals on the near neighbours -------
    #
    # This is the technique that made Concept C work and it is not optional:
    # flat facades with a window texture read as scenery, 600 mm reveals read
    # as buildings.
    for (nx, ny, w, d, nh) in ((-62, -6, 22, 40, 34), (66, 10, 24, 44, 40),
                               (-20, 62, 30, 24, 28)):
        body = M.prism(f"nb{nx}", M.rect(nx - w / 2, ny - d / 2, nx + w / 2, ny + d / 2),
                       0.2, nh, mats["city_warm"] if nx < 0 else mats["city_cool"],
                       bevel=0.06)
        parts["conc"].append(body)
        parts["conc"].append(
            M.parapet(f"np{nx}", M.rect(nx - w / 2 - 0.3, ny - d / 2 - 0.3,
                                        nx + w / 2 + 0.3, ny + d / 2 + 0.3),
                      nh + 0.2, 1.2, 0.5, mats["conc"]))
        face_y = ny - d / 2 - 0.35
        for lv in range(1, int(nh / 3.5)):
            for i in range(max(2, int(w / 5.0))):
                wx = nx - w / 2 + 3.0 + i * 5.0
                if wx > nx + w / 2 - 2.0:
                    break
                M.cut(body, M.prism(f"nw{nx}{lv}{i}",
                                    M.rect(wx - 1.1, face_y, wx + 1.1, face_y + 0.7),
                                    0.2 + lv * 3.5, 1.8))

    blocks = []
    for i in range(9):
        blocks.append((rng.uniform(-190, 190), 110 + i * 30, rng.uniform(24, 42),
                       rng.uniform(22, 34), rng.uniform(28, 78), i % 2))
        blocks.append((-150 - i * 26, rng.uniform(-60, 40), rng.uniform(22, 36),
                       rng.uniform(24, 36), rng.uniform(24, 62), (i + 1) % 2))
        blocks.append((150 + i * 26, rng.uniform(-60, 60), rng.uniform(22, 36),
                       rng.uniform(24, 36), rng.uniform(26, 70), i % 2))
    L.context_city(rng, blocks, mats, lit=0.42 if dusk else 0.0)

    for cam_name, (loc, _t, _mm) in CAMERAS.items():
        for (cx, cy, w, d, h, _era) in blocks:
            if (abs(loc[0] - cx) < w * 0.62 and abs(loc[1] - cy) < d * 0.62
                    and loc[2] < h):
                raise AssertionError(f"camera {cam_name} is inside a block")

    for key, objs in parts.items():
        objs = [o for o in objs if o]
        if objs:
            L.join_all(f"a2-{key}", objs)


def light(dusk):
    if dusk:
        L.sky_world(4.0, 236, strength=0.55, dusk=True)
        L.sun_lamp(4.0, 236, 4.2, color=(1.0, 0.7, 0.44), angle=1.7)
    else:
        L.sky_world(40, 208, strength=0.5)
        L.sun_lamp(40, 208, 6.2, color=(1.0, 0.95, 0.87), angle=0.6)


CAMERAS = {
    # HERO: from the far footpath up the street. 28 mm at eye height, the tower
    # cropping at the top -- a view INTO a place, not an inventory photograph.
    "hero": ((-68.0, -86.0, 1.7), (-2.0, -16.0, 34.0), 28),
    # GROUND: on the footpath by the site gate, podium and transfer overhead.
    "ground": ((-30.0, -40.0, 1.68), (6.0, -18.0, 16.0), 35),
    # REAR: the far corner, where the podium terrace and the core are exposed.
    "rear": ((78.0, 76.0, 4.0), (4.0, 4.0, 30.0), 35),
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
                     exposure=0.25 if dusk else -0.45)
        else:
            L.render(os.path.join(L.OUT, f"{NAME}-{suffix}-{key}.png"), cam,
                     width=1440, height=900, samples=48,
                     exposure=0.25 if dusk else -0.45)


main()
