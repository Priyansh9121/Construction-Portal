"""
Site content: the evidence that work happens here.

WHY THIS IS THE BIGGEST SINGLE CAUSE
------------------------------------
The reset diagnosis ranked an EMPTY SITE as the strongest cause of the
game-like look, above materials and above lighting. A correctly modelled,
correctly lit, correctly textured building with nothing around it still reads
as an architectural model, because a real site is dense with the residue of
work: things half-used, things staged for tomorrow, things nobody has put
away.

LOGISTICS, NOT SCATTER
----------------------
Randomly strewn props read as debris and make a site look abandoned rather
than operational. Real sites are messy but ORGANISED: material sits near the
work that consumes it, deliveries land near the gate, waste collects near the
skip, and the crane's pick zone is kept clear because it has to be.

So everything here is placed by ZONE, and every cluster answers "why is this
here?":

    delivery      inside the gate, where a truck can reach: wrapped pallets,
                  timber, rebar bundles, cable reels
    facade        at the foot of the scaffold: spare tubes, fittings, boards,
                  a ladder
    waste         by the lane: skip, bins, offcuts
    services      near the cabin: bottles, a generator, small plant
    deck          on the working level: rebar, formwork, hoses, tools

TOLERANCE
---------
Nothing stacked by hand is square. Every item gets a few degrees of yaw and a
few millimetres of offset -- enough to read as human assembly, never enough to
read as bad engineering. Structural geometry is untouched: a column that leans
is a defect, a pallet that leans is a Tuesday.
"""

import math
import random

import bpy

import concept_lib as L
import concept_mesh as M


def _jitter(ob, rng, yaw=0.10, tilt=0.0, shift=0.03):
    """Human assembly: a few degrees off square, a few millimetres off place."""
    if ob is None:
        return None
    ob.rotation_euler = (rng.uniform(-tilt, tilt), rng.uniform(-tilt, tilt),
                         ob.rotation_euler.z + rng.uniform(-yaw, yaw))
    ob.location.x += rng.uniform(-shift, shift)
    ob.location.y += rng.uniform(-shift, shift)
    return ob


def plank_stack(name, x, y, z, mats, rng, w=1.2, d=2.4, layers=7):
    """
    A stack of boards, built as REAL BOARDS rather than as one block.

    A solid box painted like timber reads as a box. What says "stack" is the
    row of parallel edges down its side and the one board that is not quite
    flush with the rest.
    """
    out = []
    t = 0.032
    n = max(3, int(w / 0.16))
    for lv in range(layers):
        for i in range(n):
            b = L.box(f"{name}{lv}{i}", (w / n - 0.008, d, t),
                      (x - w / 2 + (i + 0.5) * w / n, y, z + t / 2 + lv * t),
                      mats["ply"])
            # The top layer is the one someone has been taking from.
            if lv == layers - 1 and rng.random() < 0.4:
                b.location.y += rng.uniform(-0.14, 0.14)
                b.rotation_euler = (0, 0, rng.uniform(-0.05, 0.05))
            out.append(b)
    return out


def rebar_bundle(name, x, y, z, mats, rng, length=6.0, count=9):
    """Reinforcement, banded. Bars sag and never lie in a perfect hexagon."""
    out = []
    r = 0.016
    rows = [(0, 5), (0.031, 4)]
    idx = 0
    for (dz, n) in rows:
        for i in range(n):
            bar = L.cyl(f"{name}{idx}", r, length + rng.uniform(-0.2, 0.2),
                        (x + (i - n / 2) * 0.036 + rng.uniform(-0.004, 0.004),
                         y + rng.uniform(-0.05, 0.05), z + r + dz),
                        mats["galv"], axis="Y", verts=6)
            out.append(bar)
            idx += 1
    for band_y in (-length * 0.3, length * 0.3):
        out.append(L.box(f"{name}band{band_y:.0f}", (0.2, 0.02, 0.07),
                         (x, y + band_y, z + 0.035), mats["galv"]))
    return out


def hose(name, pts, mats, radius=0.022):
    """
    A hose or lead, as a real curve with a round bevel.

    This is the cheapest high-value prop on a construction site: a coiled hose
    lying across the ground is instantly legible as "somebody is working here",
    and a curve with a bevel costs almost nothing.
    """
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = radius
    data.bevel_resolution = 2
    data.resolution_u = 3
    spline = data.splines.new("NURBS")
    spline.points.add(len(pts) - 1)
    for i, (x, y, z) in enumerate(pts):
        spline.points[i].co = (x, y, z, 1.0)
    spline.use_endpoint_u = True
    spline.order_u = 3
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mats["workwear"])
    return ob


def coiled_hose(name, cx, cy, cz, mats, rng, turns=2.4, r0=0.55):
    """A hose coiled on the ground, which is how they are actually left."""
    pts = []
    steps = int(turns * 12)
    for i in range(steps):
        t = i / steps * turns * math.tau
        r = r0 - (i / steps) * 0.16
        pts.append((cx + math.cos(t) * r + rng.uniform(-0.02, 0.02),
                    cy + math.sin(t) * r + rng.uniform(-0.02, 0.02),
                    cz + 0.022 + (i % 3) * 0.004))
    return hose(name, pts, mats)


def cable_reel(name, x, y, z, mats, rng):
    """A drum on its side, half unwound."""
    out = []
    for dz in (0.0, 0.62):
        d = L.cyl(f"{name}f{dz}", 0.52, 0.05, (x, y, z + 0.52), mats["ply"],
                  axis="Y", verts=16)
        d.location.y += dz - 0.31
        out.append(d)
    out.append(L.cyl(f"{name}core", 0.26, 0.58, (x, y, z + 0.52), mats["workwear"],
                     axis="Y", verts=12))
    for o in out:
        _jitter(o, rng, yaw=0.0, tilt=0.02)
    return out


def bin_skip(name, x, y, z, mats, rng, w=2.1, d=4.4, h=1.35):
    """A skip: tapered sides, a lip, and offcuts standing out of it."""
    out = []
    body = M.prism(name, [(-w / 2, -d / 2), (w / 2, -d / 2),
                          (w / 2 * 1.08, d / 2), (-w / 2 * 1.08, d / 2)],
                   0.0, h, mats["crane"], bevel=0.03)
    body.location = (x, y, z)
    out.append(body)
    out.append(L.box(f"{name}lip", (w * 1.1, d * 1.02, 0.09), (x, y, z + h),
                     mats["crane"], bevel=0.02))
    # Offcuts sticking out, which is what makes a skip read as full.
    for i in range(6):
        p = L.box(f"{name}sc{i}", (rng.uniform(0.1, 0.3), rng.uniform(0.9, 2.2),
                                   rng.uniform(0.05, 0.12)),
                  (x + rng.uniform(-w * 0.35, w * 0.35),
                   y + rng.uniform(-d * 0.35, d * 0.35),
                   z + h + rng.uniform(-0.1, 0.22)), mats["ply"])
        p.rotation_euler = (rng.uniform(-0.5, 0.5), rng.uniform(-0.3, 0.3),
                            rng.uniform(0, 3.14))
        out.append(p)
    return out


def wrapped_pallet(name, x, y, z, mats, rng):
    """A delivery still shrink-wrapped: the clearest 'arrived today' signal."""
    out = []
    out.append(L.box(f"{name}p", (1.2, 0.85, 0.14), (x, y, z + 0.07), mats["ply"]))
    hgt = rng.uniform(0.5, 1.0)
    body = L.box(f"{name}b", (1.14, 0.8, hgt), (x, y, z + 0.14 + hgt / 2),
                 mats["paint"], bevel=0.02)
    out.append(body)
    for o in out:
        _jitter(o, rng, yaw=0.14)
    return out


def tube_pile(name, x, y, z, mats, rng, count=14):
    """Loose scaffold tube, stacked the way it comes off a lorry."""
    out = []
    for i in range(count):
        row = i // 5
        col = i % 5
        t = L.cyl(f"{name}{i}", 0.024, rng.uniform(2.4, 4.0),
                  (x + col * 0.055 + row * 0.028 + rng.uniform(-0.01, 0.01),
                   y + rng.uniform(-0.12, 0.12),
                   z + 0.024 + row * 0.048), mats["galv"], axis="Y", verts=6)
        t.rotation_euler = (0, 0, rng.uniform(-0.03, 0.03))
        out.append(t)
    return out


def dress(parts, mats, rng, PX0, PX1, PY0, PY1, pad_z=0.40):
    """
    Place every cluster by ZONE. See the module docstring for why each is
    where it is.
    """
    def add(key, objs):
        # Dressing introduces material groups the structural build does not
        # use (painted plant, rubber). Creating them here keeps the export's
        # (layer, material) grouping intact rather than forcing clutter into
        # a structural mesh.
        parts.setdefault(key, []).extend(o for o in objs if o)

    # ---- DELIVERY, inside the gate where a truck can reach ---------------
    for i in range(3):
        add("ply", wrapped_pallet(f"del{i}", -7.5 + i * 1.5, -13.5, pad_z, mats, rng))
    add("ply", plank_stack("tim", 6.4, -12.6, pad_z, mats, rng, layers=8))
    add("galv", rebar_bundle("rb1", -2.2, -9.5, pad_z, mats, rng))
    add("galv", rebar_bundle("rb2", -1.6, -9.5, pad_z, mats, rng, count=7))
    add("ply", cable_reel("reel", 8.2, -8.4, pad_z, mats, rng))

    # ---- FACADE ZONE, at the foot of the scaffold ------------------------
    add("galv", tube_pile("tube", -8.6, -15.2, pad_z, mats, rng))
    add("ply", plank_stack("board", -5.6, -15.4, pad_z, mats, rng,
                           w=0.9, d=3.9, layers=5))
    # A ladder left leaning where somebody stopped using it.
    add("galv", ladder("ladder", 2.6, -16.2, pad_z, mats, rng))

    # ---- WASTE, by the lane where a truck collects it --------------------
    add("crane", bin_skip("skip", 6.2, 20.6, pad_z, mats, rng))
    for i in range(2):
        b = L.box(f"binw{i}", (0.72, 0.72, 1.05), (-3.4 + i * 0.95, 21.2,
                                                   pad_z + 0.52),
                  mats["screen"], bevel=0.03)
        add("paint", [_jitter(b, rng, yaw=0.2)])

    # ---- SERVICES, near the cabin ----------------------------------------
    for i in range(4):
        g = L.cyl(f"gas{i}", 0.115, 1.3, (-9.4 + i * 0.27, 19.4, pad_z + 0.65),
                  mats["crane"], verts=10)
        add("crane", [_jitter(g, rng, tilt=0.03)])

    # ---- ACTIVE DECK: the work itself -----------------------------------
    deck_z = 4.6 + 6 * 3.3
    add("galv", rebar_bundle("rbd", -3.0, 4.0, deck_z, mats, rng, length=4.4, count=7))
    add("ply", plank_stack("form", 4.2, 2.0, deck_z, mats, rng,
                           w=1.0, d=2.6, layers=4))
    add("workwear", [coiled_hose("hoseD", 0.4, -2.0, deck_z, mats, rng)])

    # ---- HOSES AND LEADS on the ground ----------------------------------
    add("workwear", [coiled_hose("hoseA", -6.2, -6.5, pad_z, mats, rng)])
    add("workwear", [hose("leadA", [
        (-9.0, -17.5, pad_z + 0.02), (-6.0, -12.0, pad_z + 0.02),
        (-3.5, -6.0, pad_z + 0.02), (-3.0, 2.0, pad_z + 0.02),
        (-4.5, 9.0, pad_z + 0.02)], mats, radius=0.018)])
    return parts


def ladder(name, x, y, z, mats, rng, length=3.4, lean=0.26):
    """
    A real ladder: two stiles and rungs.

    It was ONE FLAT BOX 0.44 x 0.05 x 3.4 m, which edge-on rendered as an
    unexplained grey plank leaning in the middle of the site -- the artefact
    the entrance frame kept showing. A ladder is defined by the gap between
    its stiles; a solid panel is a board.
    """
    out = []
    w = 0.42
    for sx in (-1, 1):
        s = L.cyl(f"{name}s{sx}", 0.022, length, (x + sx * w / 2, y, z + length / 2),
                  mats["galv"], verts=6)
        out.append(s)
    rungs = int(length / 0.28)
    for i in range(1, rungs):
        out.append(L.cyl(f"{name}r{i}", 0.014, w, (x, y, z + i * 0.28),
                         mats["galv"], axis="X", verts=6))
    grp = L.join_all(name, out)
    grp.rotation_euler = (lean, 0, rng.uniform(-0.06, 0.06))
    return [grp]


def mast_climber(name, x, y, z, top, mats, rng, car_z=12.0):
    """
    A rack-and-pinion mast climbing work platform.

    Replaces a plain orange cube. The cube was rejected outright, and the fix
    is not to bevel it: a machine has to answer HOW IT MOVES, HOW IT IS
    GUIDED, HOW IT IS ATTACHED and WHERE A PERSON STANDS. Every part below
    exists to answer one of those.

        mast        modular sections with diagonal bracing and a toothed rack
                    up one face -- the rack is HOW IT MOVES
        rollers     guide wheels gripping the mast -- HOW IT IS GUIDED
        ties        brackets back to the slab edges -- HOW IT IS ATTACHED
        platform    floor, kick rail, guard rails, mesh, a gate -- WHERE A
                    PERSON STANDS and how they get off
        drive       motor and gearbox housing over the rack
    """
    out = []
    galv, paint, mesh = mats["galv"], mats["crane"], mats["screen"]
    mw = 0.62                                    # mast is 620 mm square

    # ---- MAST: modular sections, braced, with a rack up the front --------
    sections = int(top / 1.5)
    for i in range(sections):
        zz = z + i * 1.5
        for sx in (-1, 1):
            for sy in (-1, 1):
                out.append(L.box(f"{name}c{i}{sx}{sy}", (0.075, 0.075, 1.5),
                                 (x + sx * mw / 2, y + sy * mw / 2, zz + 0.75),
                                 galv))
        for sy in (-1, 1):
            out.append(L.box(f"{name}h{i}{sy}", (mw, 0.05, 0.05),
                             (x, y + sy * mw / 2, zz + 1.5), galv))
        # One diagonal per section, alternating hand.
        d = L.box(f"{name}d{i}", (0.045, 0.045, 1.62), (x, y + mw / 2, zz + 0.75), galv)
        d.rotation_euler = (0, math.radians(22 if i % 2 else -22), 0)
        out.append(d)
    # The RACK: pitched teeth up the front face. This is the single detail
    # that says rack-and-pinion rather than "painted tower".
    for i in range(int(top / 0.12)):
        out.append(L.box(f"{name}rk{i}", (0.09, 0.05, 0.06),
                         (x, y - mw / 2 - 0.05, z + 0.06 + i * 0.12), galv))

    # ---- TIES back to the structure --------------------------------------
    for i in range(1, int(top / 6.0)):
        out.append(L.box(f"{name}t{i}", (0.08, 1.9, 0.08),
                         (x, y + mw / 2 + 0.95, z + i * 6.0), galv))

    # ---- PLATFORM ---------------------------------------------------------
    pw, pd = 4.2, 1.5
    px, pz = x, z + car_z
    out.append(L.box(f"{name}floor", (pw, pd, 0.08), (px, y - mw / 2 - pd / 2, pz),
                     paint, bevel=0.01))
    # Kick rail, then guard rails at 500 and 1100 -- real heights, and the
    # thing a worker's scale is read against.
    for hh, th in ((0.09, 0.18), (0.5, 0.045), (1.1, 0.045)):
        for sy in (-1, 1):
            out.append(L.box(f"{name}gr{hh}{sy}", (pw, 0.04, th),
                             (px, y - mw / 2 - pd / 2 + sy * pd / 2, pz + hh),
                             paint if hh < 0.2 else galv))
        for sx in (-1, 1):
            out.append(L.box(f"{name}ge{hh}{sx}", (0.04, pd, th),
                             (px + sx * pw / 2, y - mw / 2 - pd / 2, pz + hh),
                             paint if hh < 0.2 else galv))
    # Corner posts and mesh infill.
    for sx in (-1, 1):
        out.append(L.box(f"{name}p{sx}", (0.06, 0.06, 1.15),
                         (px + sx * pw / 2, y - mw / 2 - pd / 2, pz + 0.58), galv))
    n = int(pw / 0.16)
    for i in range(1, n):
        out.append(L.box(f"{name}m{i}", (0.02, 0.02, 0.92),
                         (px - pw / 2 + i * pw / n, y - mw / 2 - pd, pz + 0.55),
                         mesh))
    # ---- DRIVE: motor and gearbox over the rack --------------------------
    out.append(L.box(f"{name}drv", (0.7, 0.62, 0.75), (px, y - mw / 2 - 0.3, pz + 0.5),
                     paint, bevel=0.02))
    out.append(L.cyl(f"{name}mot", 0.17, 0.5, (px + 0.42, y - mw / 2 - 0.3, pz + 0.62),
                     galv, axis="X", verts=10))
    # ---- GUIDE ROLLERS: how it is held to the mast -----------------------
    for dz in (0.18, 1.0):
        for sx in (-1, 1):
            out.append(L.box(f"{name}rl{sx}{dz}", (0.13, 0.2, 0.16),
                             (px + sx * 0.34, y - mw / 2 + 0.04, pz + dz), galv,
                             bevel=0.03))
    return out
