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
    from mathutils import Vector

    def strut(nm, p0, p1, r, mat, verts=12):
        """A cylinder that actually spans two points, so nothing floats."""
        d = Vector(p1) - Vector(p0)
        ob = L.cyl(nm, r, d.length, tuple((Vector(p0) + Vector(p1)) / 2), mat,
                   verts=verts)
        ob.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
        return ob

    cz = ground_z + 1.15                        # chassis deck height

    # ---- CHASSIS: TWO RAILS AND A BELLY, NOT ONE SLAB --------------------
    #
    # The carrier was a single 11.9 x 2.7 x 0.95 box. At 25-45 m that is the
    # strongest toy cue the machine had: a real carrier is a pair of deep
    # longitudinal rails with the running gear hung between them, and it has
    # UNDERSIDE DEPTH. One smooth slab has no structure to read.
    for sy in (-1, 1):
        out.append(L.box(f"{name}rail{sy}", (11.90, 0.34, 0.72),
                         (x, y + sy * 0.98, cz - 0.10), paint, bevel=0.03))
    out.append(L.box(f"{name}belly", (10.60, 1.70, 0.34), (x, y, cz - 0.34),
                     blk, bevel=0.03))
    out.append(L.box(f"{name}deck", (11.90, 2.62, 0.26), (x, y, cz + 0.36),
                     paint, bevel=0.03))
    # Engine / equipment body behind the road cab, stepped in from the deck
    # edge so the deck line survives as a shadow.
    out.append(L.box(f"{name}eng", (3.40, 2.30, 0.86), (x - 1.30, y, cz + 0.92),
                     paint, bevel=0.05))
    out.append(L.box(f"{name}grille", (0.10, 1.90, 0.54), (x - 3.02, y, cz + 0.92),
                     galv))

    # ---- ROAD CAB: a nose, a screen and a roof, not a cube ---------------
    out.append(L.box(f"{name}cab", (2.30, 2.42, 1.20), (x - 4.55, y, cz + 1.10),
                     paint, bevel=0.10))
    out.append(L.box(f"{name}cabr", (2.16, 2.28, 0.16), (x - 4.55, y, cz + 1.78),
                     paint, bevel=0.06))
    ws = L.box(f"{name}cabg", (0.10, 2.10, 0.96), (x - 5.62, y, cz + 1.20),
               mats["glass"])
    ws.rotation_euler = (0, math.radians(14), 0)      # raked windscreen
    out.append(ws)
    for sy in (-1, 1):
        out.append(L.box(f"{name}cabs{sy}", (1.50, 0.08, 0.66),
                         (x - 4.35, y + sy * 1.21, cz + 1.26), mats["glass"]))
        out.append(L.box(f"{name}mir{sy}", (0.10, 0.34, 0.42),
                         (x - 5.70, y + sy * 1.34, cz + 1.62), blk))

    # ---- RUNNING GEAR: tyre, rim, hub, and a gap to the body -------------
    #
    # Six plain cylinders was the other half of the toy read. A wheel at this
    # distance needs three things and only three: a rubber sidewall, a
    # recessed metal rim, and a hub. Tread blocks would not survive 25 m and
    # are deliberately not modelled.
    AXLES = (-4.30, 2.05, 3.75)                  # 1 steer + tandem rear
    for i, ax in enumerate(AXLES):
        for sy in (-1, 1):
            wy = y + sy * 1.24
            out.append(L.cyl(f"{name}tyre{i}{sy}", 0.62, 0.42,
                             (x + ax, wy, ground_z + 0.62), blk, axis="Y",
                             verts=24))
            out.append(L.cyl(f"{name}rim{i}{sy}", 0.40, 0.30,
                             (x + ax, wy - sy * 0.07, ground_z + 0.62), galv,
                             axis="Y", verts=20))
            out.append(L.cyl(f"{name}hub{i}{sy}", 0.15, 0.40,
                             (x + ax, wy - sy * 0.04, ground_z + 0.62), galv,
                             axis="Y", verts=14))
        # FENDER over each wheel, so the wheels belong to the carrier rather
        # than being parked under an orange box.
        out.append(L.box(f"{name}fen{i}", (1.70, 2.86, 0.16),
                         (x + ax, y, ground_z + 1.34), paint, bevel=0.05))
        for sy in (-1, 1):
            out.append(L.box(f"{name}fes{i}{sy}", (1.70, 0.10, 0.34),
                             (x + ax, y + sy * 1.43, ground_z + 1.18), paint))
    # Access steps, the one human-scale element that survives this distance.
    for k in range(3):
        out.append(L.box(f"{name}step{k}", (0.52, 0.10, 0.05),
                         (x - 3.60, y - 1.44, ground_z + 0.55 + k * 0.32), galv))

    # ---- OUTRIGGERS: a load path you can follow to the road --------------
    #
    # The machine is standing on these, not on its wheels, and the render has
    # to say so: housing -> telescoping beam -> jack barrel -> rod -> foot ->
    # pad -> mat -> road, with every joint actually touching the next.
    PAD_T, MAT_T = 0.16, 0.09
    mat_top = ground_z + MAT_T
    pad_top = mat_top + PAD_T
    for sx in (-1, 1):
        for sy in (-1, 1):
            ox, oy = x + sx * base / 2, y + sy * span / 2
            beam_z = cz - 0.26
            out.append(L.box(f"{name}obh{sx}{sy}", (1.30, 1.05, 0.62),
                             (x + sx * 1.10, y + sy * 0.80, beam_z), paint,
                             bevel=0.03))
            out.append(L.box(f"{name}obs{sx}{sy}", (base * 0.34, 0.46, 0.44),
                             (x + sx * base * 0.20, y + sy * span * 0.28, beam_z),
                             paint, bevel=0.02))
            out.append(L.box(f"{name}obb{sx}{sy}", (base * 0.40, 0.34, 0.32),
                             (ox - sx * base * 0.12, oy - sy * span * 0.10, beam_z),
                             galv, bevel=0.02))
            out.append(L.cyl(f"{name}ojb{sx}{sy}", 0.20, 0.62,
                             (ox, oy, beam_z - 0.28), paint, verts=14))
            out.append(strut(f"{name}ojr{sx}{sy}", (ox, oy, beam_z - 0.52),
                             (ox, oy, pad_top + 0.06), 0.11, galv, verts=12))
            out.append(L.cyl(f"{name}ofoot{sx}{sy}", 0.30, 0.16,
                             (ox, oy, pad_top + 0.02), galv, verts=14))
            out.append(L.box(f"{name}op{sx}{sy}", (1.05, 1.05, PAD_T),
                             (ox, oy, mat_top + PAD_T / 2), blk, bevel=0.02))
            out.append(L.box(f"{name}om{sx}{sy}", (1.45, 1.45, MAT_T),
                             (ox, oy, ground_z + MAT_T / 2), ply))

    # ---- SLEW AND UPPER: a real rotational interface ---------------------
    sz = cz + 0.70
    out.append(L.cyl(f"{name}slewb", 1.28, 0.22, (x, y, sz - 0.30), paint, verts=24))
    out.append(L.cyl(f"{name}slew", 1.06, 0.26, (x, y, sz - 0.08), galv, verts=24))
    out.append(L.cyl(f"{name}turn", 1.34, 0.20, (x, y, sz + 0.14), paint, verts=24))
    # Upper body, stepped: machinery house plus a lower rear cowl, so the
    # silhouette has a shoulder instead of one flat lid.
    out.append(L.box(f"{name}house", (2.90, 2.30, 1.34), (x, y + 0.70, sz + 0.94),
                     paint, bevel=0.06))
    out.append(L.box(f"{name}cowl", (2.40, 1.55, 0.72), (x, y + 1.62, sz + 0.62),
                     paint, bevel=0.05))
    out.append(L.box(f"{name}hgr", (0.08, 1.30, 0.50), (x + 1.47, y + 0.70, sz + 0.94),
                     galv))

    # ---- OPERATOR CAB ----------------------------------------------------
    out.append(L.box(f"{name}ocab", (1.30, 1.06, 1.46), (x - 1.62, y - 1.30, sz + 0.88),
                     paint, bevel=0.08))
    og = L.box(f"{name}ocg", (0.09, 0.92, 1.10), (x - 2.24, y - 1.30, sz + 0.92),
               mats["glass"])
    og.rotation_euler = (0, math.radians(-11), 0)
    out.append(og)
    out.append(L.box(f"{name}ocf", (1.14, 0.08, 1.06), (x - 1.62, y - 1.81, sz + 0.92),
                     mats["glass"]))
    out.append(L.box(f"{name}ocr", (1.20, 0.98, 0.10), (x - 1.62, y - 1.30, sz + 1.62),
                     paint, bevel=0.04))

    # ---- COUNTERWEIGHT: slabs, on a bracket that carries them ------------
    for sy in (-1, 1):
        out.append(L.box(f"{name}cwb{sy}", (0.22, 1.10, 0.90),
                         (x + sy * 1.10, y + 1.95, sz + 0.74), paint))
    for i in range(3):
        out.append(L.box(f"{name}cw{i}", (2.55, 0.60, 0.38),
                         (x, y + 2.05, sz + 0.32 + i * 0.46), blk, bevel=0.03))
        out.append(L.box(f"{name}cwl{i}", (2.62, 0.10, 0.09),
                         (x, y + 2.05, sz + 0.32 + i * 0.46), galv))

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
    def at(t):
        """A point a fraction t along the boom axis."""
        return (x, pivot[1] + dirn[0] * length * t, pivot[2] + dirn[1] * length * t)

    # A TELESCOPIC BOOM IS A NESTED STACK OF BOXES, AND IT HAS TO SHOW IT.
    #
    # Three overlapping tapered boxes rendered as one smooth orange cone --
    # the thing read as a toy because a manufactured boom has a visible STEP
    # at every section mouth, and this had none. Each section now ends in a
    # collar at the mouth of the one it slides out of, which is the single
    # detail that says "this extends" rather than "this was lathed".
    for i, (f0, f1, w) in enumerate(((0.00, 0.42, 0.86), (0.40, 0.74, 0.70),
                                     (0.72, 1.00, 0.56))):
        mid = (f0 + f1) / 2
        seg = L.box(f"{name}bm{i}", (w, length * (f1 - f0), w * 1.06),
                    at(mid), paint, bevel=0.02)
        seg.rotation_euler = (a, 0, 0)
        out.append(seg)
        if i:                                   # the section mouth it exits
            col = L.box(f"{name}bc{i}", (w * 1.20, 0.26, w * 1.24), at(f0),
                        galv, bevel=0.02)
            col.rotation_euler = (a, 0, 0)
            out.append(col)
        # Longitudinal rib down each flank: a fabricated box section has a
        # weld line, and it is what stops a flat face reading as plastic.
        for sx in (-1, 1):
            rib = L.box(f"{name}br{i}{sx}", (0.05, length * (f1 - f0) * 0.92,
                                             w * 0.30),
                        (x + sx * w / 2, at(mid)[1], at(mid)[2]), galv)
            rib.rotation_euler = (a, 0, 0)
            out.append(rib)

    # ---- BOOM HEAD: cheeks, sheaves, and a rope that leaves from them ----
    head = (x, hy, hz)
    for sx in (-1, 1):
        out.append(L.box(f"{name}hc{sx}", (0.06, 1.05, 0.62),
                         (x + sx * 0.30, hy - 0.10, hz - 0.05), galv, bevel=0.02))
    for k, off in enumerate((-0.16, 0.0, 0.16)):
        out.append(L.cyl(f"{name}sh{k}", 0.26, 0.13, (x + off, hy, hz), galv,
                         axis="X", verts=16))
    # ---- BOOM HEEL AND PIVOT --------------------------------------------
    #
    # The boom was growing straight out of the machinery house. A real
    # telescopic boom lands on a HEEL carried between two pivot cheeks with a
    # pin through them, and that junction is one of the strongest silhouette
    # cues the machine has -- it is where the load path turns the corner.
    for sx in (-1, 1):
        out.append(L.box(f"{name}pc{sx}", (0.16, 1.30, 1.55),
                         (x + sx * 0.62, pivot[1] + 0.18, pivot[2] - 0.24),
                         paint, bevel=0.03))
    out.append(L.cyl(f"{name}pin", 0.20, 1.70, pivot, galv, axis="X", verts=16))
    heel = L.box(f"{name}heel", (1.02, 1.20, 1.02), at(0.045), paint, bevel=0.03)
    heel.rotation_euler = (a, 0, 0)
    out.append(heel)

    # ---- LUFFING CYLINDER: barrel and rod, both ends anchored ------------
    #
    # The old one was a box floating beside the boom at a hard-coded 52
    # degrees that agreed with nothing. This spans from a real anchor on the
    # turntable to a real attachment under the boom, so the angle is a
    # CONSEQUENCE of the boom position rather than a number typed next to it.
    lo = (x, y + 0.34, sz + 0.30)
    up = (at(0.27)[0], at(0.27)[1] - 0.30, at(0.27)[2] - 0.46)
    mid = tuple(lo[i] + (up[i] - lo[i]) * 0.56 for i in range(3))
    out.append(strut(f"{name}lcb", lo, mid, 0.23, paint, verts=16))
    out.append(strut(f"{name}lcr", mid, up, 0.13, galv, verts=14))
    for nm2, pt in ((f"{name}lce0", lo), (f"{name}lce1", up)):
        out.append(L.cyl(nm2, 0.15, 0.52, pt, galv, axis="X", verts=12))
    return out, head


def site_lighting(name, mats, rng, soffit_z, festoon, task):
    """
    Temporary site lighting, and why it is not a cheat.

    The ground floor is 34 m deep, 7.2 m to the soffit and has no facade. The
    sun at 46 degrees penetrates 4.4 m of it, and that lit strip sits BELOW
    the sightline over a 2.4 m hoarding from a 1.7 m eye at 70 m -- so every
    part of the ground floor the production camera can see is in shadow. It
    measured 0.064 against a hoarding at 0.27: a lit band with a black hole
    over it, which is exactly why it read as sealed.

    No amount of staged material fixes that, because at 70 m contents do not
    resolve. A real site does not work an unlit basement-dark floor either --
    it hangs festoon and stands task lights, and that equipment is visible,
    directional and limited. Every luminaire here has a FIXTURE. There is no
    invisible fill light in this world, and adding one would have been the
    dishonest version of this fix.
    """
    out = []
    galv, paint = mats["galv"], mats["crane"]
    lamp_mat = bpy.data.materials.get("lamp")
    if lamp_mat is None:
        lamp_mat = bpy.data.materials.new("lamp")
        lamp_mat.use_nodes = True
        nt = lamp_mat.node_tree
        for n in list(nt.nodes):
            if n.type != "OUTPUT_MATERIAL":
                nt.nodes.remove(n)
        em = nt.nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = (1.0, 0.94, 0.82, 1.0)
        em.inputs["Strength"].default_value = 42.0
        nt.links.new(em.outputs["Emission"],
                     nt.nodes["Material Output"].inputs["Surface"])

    # FESTOON: a catenary of caged lamps down the haul route. The receding
    # line of points is the depth cue -- it is the one thing at this distance
    # that says "this space goes back", which a pallet cannot say.
    x0, y0, y1, n = festoon
    for i in range(n):
        t = i / (n - 1.0)
        yy = y0 + (y1 - y0) * t
        sag = 0.42 * math.sin(math.pi * t)
        zz = soffit_z - 0.55 - sag
        out.append(L.cyl(f"{name}fl{i}", 0.055, 0.16, (x0, yy, zz), lamp_mat, verts=8))
        out.append(L.box(f"{name}fc{i}", (0.16, 0.16, 0.05), (x0, yy, zz + 0.13), galv))
        lt = bpy.data.lights.new(f"{name}fL{i}", "POINT")
        lt.energy, lt.shadow_soft_size = 220.0, 0.09
        lt.color = (1.0, 0.93, 0.80)
        ob = bpy.data.objects.new(f"{name}fL{i}", lt)
        ob.location = (x0, yy, zz)
        bpy.context.collection.objects.link(ob)
    # The cable the lamps hang from, because a floating string of bulbs is a
    # game asset.
    for i in range(n - 1):
        t0, t1 = i / (n - 1.0), (i + 1) / (n - 1.0)
        ya, yb = y0 + (y1 - y0) * t0, y0 + (y1 - y0) * t1
        za = soffit_z - 0.40 - 0.42 * math.sin(math.pi * t0)
        zb = soffit_z - 0.40 - 0.42 * math.sin(math.pi * t1)
        seg = L.cyl(f"{name}fw{i}", 0.012, math.hypot(yb - ya, zb - za),
                    (x0, (ya + yb) / 2, (za + zb) / 2), galv, axis="Y", verts=4)
        seg.rotation_euler = (math.atan2(zb - za, yb - ya), 0, 0)
        out.append(seg)

    # TASK LIGHTS: tripod floods where a specific job happens, aimed at it.
    for j, (tx, ty, tz, aim) in enumerate(task):
        for k in range(3):
            a = k * math.tau / 3.0
            leg = L.cyl(f"{name}tg{j}{k}", 0.028, tz,
                        (tx + math.cos(a) * 0.30, ty + math.sin(a) * 0.30, tz / 2),
                        galv, verts=6)
            leg.rotation_euler = (math.sin(a) * 0.22, -math.cos(a) * 0.22, 0)
            out.append(leg)
        out.append(L.box(f"{name}th{j}", (0.44, 0.24, 0.30), (tx, ty, tz + 0.14),
                         paint, bevel=0.03))
        out.append(L.box(f"{name}tl{j}", (0.38, 0.05, 0.24),
                         (tx, ty - 0.13, tz + 0.14), lamp_mat))
        lt = bpy.data.lights.new(f"{name}tL{j}", "SPOT")
        lt.energy, lt.spot_size, lt.spot_blend = 2600.0, math.radians(96), 0.5
        lt.shadow_soft_size, lt.color = 0.16, (1.0, 0.95, 0.86)
        ob = bpy.data.objects.new(f"{name}tL{j}", lt)
        ob.location = (tx, ty - 0.14, tz + 0.14)
        ob.rotation_euler = (math.radians(aim), 0, 0)
        bpy.context.collection.objects.link(ob)
    return out
