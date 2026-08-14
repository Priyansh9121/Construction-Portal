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


def construction_hoist(name, x, y, z0, top, facade_y, landings, ties,
                       mats, rng, car_z):
    """
    A rack-and-pinion CONSTRUCTION HOIST, and why it is not a mast climber.

    The world previously carried `mast_climber` here, and the audit showed it
    was doing a hoist's job with a work platform's body: its 4.2 x 1.5 m open
    platform faced AWAY from the building, its ties stopped 1.89 m short of
    the facade and attached to nothing, and it had no landings at all -- a car
    stopping in mid-air beside a slab edge.

    Those are different machines. A mast-climbing work platform runs a long
    deck along a facade so trades can work ON that facade, and it needs no
    landings because nobody gets off. This site cannot use one: the street
    elevation is already fully scaffolded, which is exactly the face an MCWP
    would need. What the site actually needs, with no tower crane, is vertical
    TRANSPORT of people and material to seven floors -- a hoist.

    So this is a hoist, and it answers a hoist's questions:

        mast        modular sections, braced, rack up the cage face
        ties        real members from mast to SLAB EDGE, at slab levels
        cage        enclosed car with a gate, not an open platform
        landings    a platform, a gate and edge protection at every stop
        base        fenced enclosure with a loading threshold
    """
    out = []
    galv, paint, mesh, ply = (mats["galv"], mats["crane"], mats["screen"],
                              mats["ply"])
    mw = 0.65
    cw, cd, ch = 1.50, 2.60, 2.30              # cage width, depth, height
    cy0 = y + mw / 2                            # cage sits on the BUILDING side
    cy1 = cy0 + cd

    # ---- MAST -------------------------------------------------------------
    for i in range(int((top - z0) / 1.5)):
        zz = z0 + i * 1.5
        for sx in (-1, 1):
            for sy in (-1, 1):
                out.append(L.box(f"{name}c{i}{sx}{sy}", (0.08, 0.08, 1.5),
                                 (x + sx * mw / 2, y + sy * mw / 2, zz + 0.75), galv))
        for sy in (-1, 1):
            out.append(L.box(f"{name}h{i}{sy}", (mw, 0.05, 0.05),
                             (x, y + sy * mw / 2, zz + 1.5), galv))
        d = L.box(f"{name}d{i}", (0.045, 0.045, 1.62), (x, y - mw / 2, zz + 0.75), galv)
        d.rotation_euler = (0, math.radians(22 if i % 2 else -22), 0)
        out.append(d)
    # The rack faces the cage, because that is the face the pinion drives on.
    for i in range(int((top - z0) / 0.12)):
        out.append(L.box(f"{name}rk{i}", (0.09, 0.05, 0.06),
                         (x, cy0 + 0.05, z0 + 0.06 + i * 0.12), galv))

    # ---- TIES: mast to SLAB EDGE. The old ones stopped in mid-air. --------
    # The tie frame splays OUTSIDE the car, at +/- 0.95 against a 1.50 m car,
    # because the car runs on the building face of the mast and the ties run
    # to the same building. Inboard of the car they would occupy the travel
    # path -- which is exactly the defect this hoist replaced.
    for j, tz in enumerate(ties):
        run = facade_y - cy0
        for sx in (-1, 1):
            out.append(L.box(f"{name}ty{j}{sx}", (0.07, run, 0.07),
                             (x + sx * 0.95, cy0 + run / 2, tz + 1.1), galv))
            out.append(L.box(f"{name}tk{j}{sx}", (0.06, 0.06, 0.62),
                             (x + sx * 0.95, cy0 + 0.30, tz + 0.80), galv))
        out.append(L.box(f"{name}tx{j}", (0.62, 0.07, 0.07),
                         (x, facade_y - 0.10, tz + 1.1), galv))
        # The bracket that actually lands on the concrete.
        out.append(L.box(f"{name}tb{j}", (0.44, 0.22, 0.30),
                         (x, facade_y - 0.11, tz + 0.55), galv, bevel=0.02))

    # ---- LANDINGS: a platform, a gate and edge protection at every stop ---
    for j, (lz, is_open) in enumerate(landings):
        bridge = facade_y - cy1
        out.append(M.prism(f"{name}ld{j}", M.rect(x - 0.80, cy1, x + 0.80, facade_y),
                           lz - 0.05, 0.05, ply))
        for sx in (-1, 1):                      # bridge side rails + toe board
            out.append(M.prism(f"{name}lr{j}{sx}",
                               M.rect(x + sx * 0.78, cy1, x + sx * 0.80, facade_y),
                               lz, 1.10, galv))
        out.append(M.prism(f"{name}lt{j}", M.rect(x - 0.80, cy1, x + 0.80, cy1 + 0.04),
                           lz, 0.15, ply))
        # The landing gate: shut where nothing is being received, swung clear
        # where it is. A gate that is always open is not a gate.
        # Built at the ORIGIN and then hung, because M.prism returns geometry
        # already in world space: setting .location on a world-space prism
        # translates it a second time, which threw the open leaves 18 m east.
        g = M.prism(f"{name}lg{j}", M.rect(0.0, -0.03, 1.44, 0.03),
                    lz + 0.10, 1.05, mesh)
        g.location = (x - 0.72, cy1, 0.0)
        if is_open:
            g.rotation_euler = (0, 0, math.radians(78))
        out.append(g)

    # ---- CAGE -------------------------------------------------------------
    pz = z0 + car_z
    out.append(M.prism(f"{name}cf", M.rect(x - cw / 2, cy0, x + cw / 2, cy1),
                       pz, 0.07, paint))
    out.append(M.prism(f"{name}cr", M.rect(x - cw / 2, cy0, x + cw / 2, cy1),
                       pz + ch, 0.06, paint))
    for sx in (-1, 1):                          # solid lower, mesh upper sides
        out.append(M.prism(f"{name}cs{sx}",
                           M.rect(x + sx * cw / 2 - 0.04, cy0, x + sx * cw / 2, cy1),
                           pz, 1.10, paint))
        for k in range(7):
            yy = cy0 + 0.12 + k * (cd - 0.24) / 6.0
            out.append(L.box(f"{name}cm{sx}{k}", (0.03, 0.03, 1.10),
                             (x + sx * cw / 2 - 0.02, yy, pz + 1.68), mesh))
    out.append(M.prism(f"{name}cb", M.rect(x - cw / 2, cy0, x + cw / 2, cy0 + 0.05),
                       pz, ch, paint))          # back panel against the mast
    out.append(M.prism(f"{name}cg", M.rect(x - cw / 2, cy1 - 0.05, x + cw / 2, cy1),
                       pz, 1.15, paint))        # cage gate, lower leaf
    for dz in (0.22, 1.90):                     # guide rollers on the mast
        for sx in (-1, 1):
            out.append(L.box(f"{name}rl{sx}{dz}", (0.14, 0.20, 0.17),
                             (x + sx * 0.36, cy0 - 0.10, pz + dz), galv, bevel=0.03))
    out.append(L.box(f"{name}drv", (0.66, 0.58, 0.70), (x, cy0 + 0.34, pz + ch + 0.35),
                     paint, bevel=0.02))

    # ---- BASE ENCLOSURE: where material is loaded, and who may stand -----
    # by0 is 0.90 not 1.10: at 1.10 the back panel landed 0.10 m outside the
    # hoarding line. A machine enclosure on the public side of the boundary is
    # exactly the defect this hoist was rebuilt to remove.
    bx0, bx1 = x - 1.9, x + 1.9
    by0, by1 = y - 0.90, facade_y - 0.2
    for sx, (px0, px1) in ((-1, (bx0, bx0 + 0.06)), (1, (bx1 - 0.06, bx1))):
        out.append(M.prism(f"{name}bf{sx}", M.rect(px0, by0, px1, by1), z0, 2.05, mesh))
    out.append(M.prism(f"{name}bb", M.rect(bx0, by0, bx1, by0 + 0.06), z0, 2.05, mesh))
    # Loading threshold: a ramped ply lip so a pallet truck can run in.
    out.append(M.prism(f"{name}bt", M.rect(x - 1.1, by1 - 1.5, x + 1.1, by1),
                       z0, 0.06, ply))
    return out


def mobile_crane(name, x, y, ground_z, hook, boom_deg, mats, rng,
                 base=6.3, span=6.4):
    """
    A CONCEPTUAL/REPRESENTATIVE 3-axle all-terrain mobile crane.

    Proportioned on the Liebherr LTM 1055-3.2 family -- 3 axles, 55 t class,
    telescopic boom 10.2 m retracted to 40 m extended, 12 t ballast. Those
    four figures are from published listings. Everything else here, including
    the outrigger base, is REPRESENTATIVE and is not a manufacturer figure.

    It is a periodic visitor, not a resident: the tower crane was rejected by
    site geometry, so heavy and awkward lifts arrive with the crane and leave
    with it. The hoist does the routine work.
    """
    out = []
    galv, paint, blk, ply = (mats["galv"], mats["crane"], mats["workwear"],
                             mats["ply"])
    cz = ground_z + 1.15                        # chassis deck height

    # ---- CARRIER: 3 axles, along the lane --------------------------------
    out.append(L.box(f"{name}ch", (11.90, 2.70, 0.95), (x, y, cz), paint, bevel=0.06))
    out.append(L.box(f"{name}cab", (2.30, 2.45, 1.45), (x - 4.55, y, cz + 1.16),
                     paint, bevel=0.10))
    for i, ax in enumerate((-4.30, 2.05, 3.75)):
        for sy in (-1, 1):
            out.append(L.cyl(f"{name}w{i}{sy}", 0.62, 0.42,
                             (x + ax, y + sy * 1.24, ground_z + 0.62), blk,
                             axis="Y", verts=16))
    # ---- OUTRIGGERS: beams out to the support base, with pads ------------
    for sx in (-1, 1):
        for sy in (-1, 1):
            ox, oy = x + sx * base / 2, y + sy * span / 2
            out.append(L.box(f"{name}ob{sx}{sy}", (base / 2, 0.34, 0.30),
                             (x + sx * base / 4, y + sy * span / 2, cz - 0.30), paint))
            out.append(L.cyl(f"{name}oj{sx}{sy}", 0.16, 1.10, (ox, oy, cz - 0.75),
                             galv, verts=10))
            out.append(L.box(f"{name}op{sx}{sy}", (1.05, 1.05, 0.16),
                             (ox, oy, ground_z + 0.10), blk, bevel=0.02))
            out.append(L.box(f"{name}om{sx}{sy}", (1.45, 1.45, 0.09),
                             (ox, oy, ground_z + 0.03), ply))
    # ---- SUPERSTRUCTURE: slews to face the building ----------------------
    sz = cz + 0.70
    out.append(L.cyl(f"{name}slew", 1.05, 0.34, (x, y, sz - 0.10), galv, verts=20))
    out.append(L.box(f"{name}house", (3.10, 2.55, 1.75), (x, y + 0.55, sz + 0.90),
                     paint, bevel=0.06))
    out.append(L.box(f"{name}ocab", (1.35, 1.10, 1.55), (x - 1.55, y - 1.35, sz + 0.85),
                     paint, bevel=0.10))
    # Counterweight: a stack of slabs, on the opposite side to the load.
    for i in range(3):
        out.append(L.box(f"{name}cw{i}", (2.55, 0.62, 0.42),
                         (x, y + 2.05, sz + 0.34 + i * 0.44), blk, bevel=0.02))

    # ---- TELESCOPIC BOOM: base plus two extended sections ----------------
    pivot = (x, y - 0.55, sz + 0.55)
    hx, hy, hz = hook
    length = math.hypot(hy - pivot[1], hz - pivot[2])
    dirn = ((hy - pivot[1]) / length, (hz - pivot[2]) / length)
    # A box built long in +Y is swung onto the boom line by rotating about X
    # through atan2(dz, dy). Using (boom_deg - 90) instead put every section
    # 20 degrees BELOW horizontal -- three orange bars sticking sideways out
    # of the building, which is what the first lift render showed.
    a = math.atan2(dirn[1], dirn[0])
    for i, (f0, f1, w) in enumerate(((0.00, 0.42, 0.80), (0.40, 0.74, 0.66),
                                     (0.72, 1.00, 0.54))):
        mid = (f0 + f1) / 2
        seg = L.box(f"{name}bm{i}", (w, length * (f1 - f0), w * 1.10),
                    (x, pivot[1] + dirn[0] * length * mid,
                     pivot[2] + dirn[1] * length * mid), paint, bevel=0.03)
        seg.rotation_euler = (a, 0, 0)
        out.append(seg)
    head = (x, hy, hz)
    out.append(L.cyl(f"{name}sheave", 0.34, 0.50, head, galv, axis="X", verts=16))
    # Luffing ram, so the boom angle is held by something.
    ram = L.box(f"{name}ram", (0.34, 3.30, 0.34), (x, pivot[1] + 1.15, pivot[2] + 1.55),
                galv)
    ram.rotation_euler = (math.radians(52) - math.pi / 2, 0, 0)
    out.append(ram)
    return out, head
