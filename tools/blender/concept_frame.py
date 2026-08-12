"""
A reinforced-concrete frame that TELLS TIME VERTICALLY.

THE ONE IDEA
------------
A building under construction is a machine for making floors, and every floor
is at a different point in that process. The production world's frame is ten
identical slabs on identical columns, and that single fact is a louder "this is
CAD" signal than any material or light -- because no real frame has ever looked
like that.

Reading up a real frame:

    fitout      structure struck long ago, facade going on, partitions inside
    struck      bare concrete, edge protection only, props all removed
    backprop    a ring of props still carrying the slab above while it gains
                strength -- this is the level that says "recently poured"
    formwork    plywood deck on soldier beams over a forest of falsework,
                with no slab above it yet
    pour        a PARTIAL slab, the pour front visible, starter bars standing
                out of the columns, and safety screens at the open edge

The silhouette does the work. From 200 m you cannot see a formwork panel, but
you can see that the top three floors have a different profile from the bottom
six, and that is what reads as "under construction".

FOOTPRINT
---------
`plan` is a list of rectangles, so a floor plate can be an L, a U or a plate
with a notch. A rectangle extruded ten times is the shape the eye files under
"model"; anything with a re-entrant corner is not.
"""

import math
import random

import concept_lib as L


STAGES = ["fitout", "struck", "backprop", "formwork", "pour"]


def _rect_cells(rect, bay):
    """Column grid positions inside one rectangle of the plan."""
    x0, z0, x1, z1 = rect
    nx = max(1, int(round((x1 - x0) / bay)))
    nz = max(1, int(round((z1 - z0) / bay)))
    xs = [x0 + i * (x1 - x0) / nx for i in range(nx + 1)]
    zs = [z0 + j * (z1 - z0) / nz for j in range(nz + 1)]
    return xs, zs


def build_frame(plan, storeys, mats, bay=8.0, storey_h=3.6, col=0.65,
                slab_t=0.32, seed=7, core=None, pour_fraction=0.55,
                screens_from=None):
    """
    Returns a dict of joined objects, grouped by material so the caller can
    place, light and count them.

    `plan`     list of (x0, z0, x1, z1) rectangles making the floor plate
    `core`     (x0, z0, x1, z1) of the lift/stair core, which runs the full
               height and OVERRUNS the top slab -- the strongest single
               silhouette element on any concrete frame
    """
    rng = random.Random(seed)
    conc, ply, galv, paint = mats["conc"], mats["ply"], mats["galv"], mats["paint"]
    parts = {"conc": [], "ply": [], "galv": [], "paint": [], "glass": []}

    top = storeys * storey_h
    screens_from = screens_from if screens_from is not None else storeys - 2

    # ---- Columns: full height, stopping at the level they have reached -----
    for rect in plan:
        xs, zs = _rect_cells(rect, bay)
        for x in xs:
            for z in zs:
                # A little jitter in height so the tops are not a flat comb.
                h = top + rng.uniform(-0.15, 0.15)
                parts["conc"].append(
                    L.box(f"col{x:.0f}{z:.0f}", (col, col, h),
                          (x, z, h / 2), conc, bevel=0.02))

    # ---- Core: full height plus the lift overrun --------------------------
    if core:
        cx0, cz0, cx1, cz1 = core
        ch = top + storey_h * 1.7
        parts["conc"].append(
            L.box("core", (cx1 - cx0, cz1 - cz0, ch),
                  ((cx0 + cx1) / 2, (cz0 + cz1) / 2, ch / 2), conc, bevel=0.03))

    # ---- Floors -----------------------------------------------------------
    for level in range(1, storeys + 1):
        y = level * storey_h
        # Which stage this floor is in, counting down from the top.
        from_top = storeys - level
        if from_top == 0:
            stage = "pour"
        elif from_top == 1:
            stage = "formwork"
        elif from_top <= 3:
            stage = "backprop"
        elif level <= max(2, int(storeys * 0.22)):
            # Facade only on the lowest fifth. The first render made every
            # floor more than four from the top a "fitout" floor, so a
            # 21-storey tower glazed 17 of them and completed itself -- the
            # exact opposite of the thing this concept exists to show.
            stage = "fitout"
        else:
            stage = "struck"

        for rect in plan:
            x0, z0, x1, z1 = rect
            w, d = x1 - x0, z1 - z0
            cxm, czm = (x0 + x1) / 2, (z0 + z1) / 2

            if stage == "formwork":
                # No slab: a plywood deck on soldier beams, over falsework.
                parts["ply"].append(
                    L.box(f"deck{level}", (w, d, 0.05), (cxm, czm, y - 0.03), ply))
                n = max(2, int(d / 1.6))
                for i in range(n):
                    zz = z0 + (i + 0.5) * d / n
                    parts["ply"].append(
                        L.box(f"sol{level}{i}", (w, 0.16, 0.24),
                              (cxm, zz, y - 0.19), ply))
                _falsework(parts, galv, rect, y - storey_h, storey_h, 1.7, rng)
                continue

            if stage == "pour":
                # A PARTIAL slab: the pour front is the most legible single
                # piece of evidence that this building is being built today.
                pw = w * pour_fraction
                parts["conc"].append(
                    L.box(f"slab{level}", (pw, d, slab_t),
                          (x0 + pw / 2, czm, y), mats["wet"], bevel=0.02))
                _starters(parts, galv, rect, y, bay, rng, only_beyond=x0 + pw)
                _falsework(parts, galv, rect, y - storey_h, storey_h, 2.1, rng)
            else:
                parts["conc"].append(
                    L.box(f"slab{level}", (w, d, slab_t), (cxm, czm, y), conc,
                          bevel=0.02))

            # Perimeter downstand: the shadow line that gives a floor depth.
            ds = 0.62
            for (sx, sz, sw, sd) in ((cxm, z0, w, 0.4), (cxm, z1, w, 0.4),
                                     (x0, czm, 0.4, d), (x1, czm, 0.4, d)):
                parts["conc"].append(
                    L.box(f"ds{level}", (sw, sd, ds), (sx, sz, y - ds / 2 - slab_t / 2),
                          conc, bevel=0.02))

            if stage == "backprop":
                _falsework(parts, galv, rect, y - storey_h, storey_h, 3.4, rng)

            if stage == "fitout":
                _facade(parts, mats, rect, y, storey_h, rng)

            # Edge protection on every struck floor.
            if stage in ("struck", "backprop", "fitout"):
                _edge_rails(parts, galv, rect, y, rng)

        # Safety screens: the tall panels that wrap the working levels and
        # change the building's outline completely.
        if level >= screens_from:
            _screens(parts, mats, plan, y, storey_h)

    joined = {}
    for key, objs in parts.items():
        if objs:
            joined[key] = L.join_all(f"frame-{key}", objs)
    return joined


def _falsework(parts, galv, rect, base, storey_h, spacing, rng):
    """Props on a grid. Denser under a fresh pour than under an older one."""
    x0, z0, x1, z1 = rect
    x = x0 + 1.2
    while x < x1 - 0.8:
        z = z0 + 1.2
        while z < z1 - 0.8:
            parts["galv"].append(
                L.cyl(f"prop{x:.0f}{z:.0f}", 0.045, storey_h - 0.3,
                      (x + rng.uniform(-0.08, 0.08), z + rng.uniform(-0.08, 0.08),
                       base + (storey_h - 0.3) / 2), galv, verts=6))
            z += spacing
        x += spacing


def _starters(parts, galv, rect, y, bay, rng, only_beyond):
    """Column starter bars, grouped as real cages rather than a uniform comb:
    four bars per column, only where the next lift has not been cast."""
    xs, zs = _rect_cells(rect, bay)
    for x in xs:
        if x < only_beyond:
            continue
        for z in zs:
            for dx, dz in ((-0.2, -0.2), (0.2, -0.2), (0.2, 0.2), (-0.2, 0.2)):
                h = rng.uniform(0.9, 1.35)
                parts["galv"].append(
                    L.cyl(f"bar{x:.0f}{z:.0f}", 0.016, h,
                          (x + dx, z + dz, y + h / 2), galv, verts=5))


def _edge_rails(parts, galv, rect, y, rng):
    x0, z0, x1, z1 = rect
    for (sx, sz, sw, sd) in (((x0 + x1) / 2, z0, x1 - x0, 0.04),
                             ((x0 + x1) / 2, z1, x1 - x0, 0.04)):
        for h in (0.5, 1.05):
            parts["galv"].append(
                L.box("rail", (sw, sd, 0.04), (sx, sz, y + h), galv))


def _screens(parts, mats, plan, y, storey_h):
    """Perforated safety screens at the working levels. These are what make
    the top of a tower read as a working zone from a kilometre away."""
    for rect in plan:
        x0, z0, x1, z1 = rect
        h = storey_h * 1.15
        for (sx, sz, sw, sd) in (((x0 + x1) / 2, z0, x1 - x0, 0.09),
                                 ((x0 + x1) / 2, z1, x1 - x0, 0.09),
                                 (x0, (z0 + z1) / 2, 0.09, z1 - z0),
                                 (x1, (z0 + z1) / 2, 0.09, z1 - z0)):
            parts["paint"].append(
                L.box("screen", (sw, sd, h), (sx, sz, y + h / 2 - 0.2),
                      mats["screen"]))


def _facade(parts, mats, rect, y, storey_h, rng):
    """Facade going on at the lower levels: glazing bands and spandrels, so
    the bottom of the building is visibly FINISHED while the top is not."""
    x0, z0, x1, z1 = rect
    w = x1 - x0
    parts["glass"].append(
        L.box("glz", (w, 0.12, storey_h * 0.62),
              ((x0 + x1) / 2, z0 - 0.05, y - storey_h * 0.5), mats["glass"]))
    parts["paint"].append(
        L.box("spandrel", (w, 0.16, storey_h * 0.3),
              ((x0 + x1) / 2, z0 - 0.05, y - storey_h * 0.95), mats["spandrel"]))
