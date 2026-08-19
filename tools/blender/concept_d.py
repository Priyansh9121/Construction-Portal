"""
CONCEPT D — THE LOGIN WORLD'S HERO: a 30-floor tower under construction

WHY D EXISTS
------------
C is a 22 x 34 m infill plot with a 27.7 m building, and its whole construction
method is derived from that: hoist ties on slab edges at levels 1/3/5/6, and a
mobile crane whose standing position was measured against a 25.6 m scaffold.
A 100 m tower cannot be served that way, so raising C's LEVELS produces an
incoherent site rather than a taller building.

A2 already had the right form — podium, transfer level, offset tower, setback,
offset core — on a 64 x 52 m plot, and it had no export path at all. D is A2's
massing brought into C's export pipeline and grown to 30 floors, and the bigger
plot is what lets a TOWER CRANE stand, which is both the honest answer for a
building this tall and a far better silhouette than a mobile crane that is not
always on site.

    Blender -b -P tools/blender/concept_d.py -- --export

THE THREE ZONES, AND WHY THEY ARE THE CHEAP SHAPE AS WELL AS THE TRUE ONE
-------------------------------------------------------------------------
Twenty-two identical floors is an extrusion, and an extrusion is what killed
Concept A. But a tower under construction is not uniform: it has completed
floors below, fitting-out in the middle, and a structural frontier of three or
four floors at the top where the work actually is.

So the repetition gets instanced and the frontier stays unique:

    completed   clad, glazed, done          ONE mesh, instanced per level
    fitout      frame and slab, unclad      ONE mesh, instanced per level
    frontier    formwork, props, rebar,     unique geometry, every level
                open slab edges, the pour     different

That spends the bytes where the eye goes — the top of the building, where the
cranes and the work are — and spends nothing on the twenty floors that are
simply finished. It is the truthful shape and the cheap one at the same time.

Instancing is real GPU instancing: linked duplicates parented to an Empty,
exported through EXT_mesh_gpu_instancing, which was verified end to end
(Blender -> meshopt -> three) before any of this was built. See
docs/phase-f-world.md.
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy

import concept_lib as L
import concept_mesh as M
import concept_c as C

NAME = "D-highrise"

# ---- The project, in metres ------------------------------------------------
# A2's plot. Big enough for a tower crane to stand and slew, which is the whole
# reason the massing moved here.
PODX0, PODY0, PODX1, PODY1 = -32.0, -26.0, 32.0, 26.0

PODIUM_LEVELS = 4
PODIUM_H = 4.5
TRANSFER = PODIUM_LEVELS * PODIUM_H              # 18.0 m, top of podium

# The tower sits on the podium's street corner, so the podium roof behind it
# reads as a terrace rather than as leftover.
TOWX0, TOWY0, TOWX1, TOWY1 = -4.0, -22.0, 30.0, 8.0
TOWER_LEVELS = 26
TOWER_H = 3.4
TOP = TRANSFER + TOWER_LEVELS * TOWER_H          # 106.4 m

# 4 podium + 26 tower = 30 floors.
FLOORS = PODIUM_LEVELS + TOWER_LEVELS

SETBACK_FROM = 21                                # the top six step in
CORE = (18.0, -8.0, 28.0, 2.0)                   # offset to the blind flank

# The three zones, as tower level indices.
COMPLETE_TO = 17                                 # 1..17 clad and finished
FITOUT_TO = 22                                   # 18..22 framed, unclad
# 23..26 are the frontier: unique, and where the work is.

# ---- The tower crane -------------------------------------------------------
# Stands off the north-west corner of the podium, clear of the tower footprint
# and inside the hoarding. Its jib has to clear the finished top, so the hook
# rides above TOP with room for the block and the sling.
CRANE_X, CRANE_Y = -24.0, 16.0
CRANE_H = TOP + 12.0
JIB = 46.0
COUNTER_JIB = 17.0
# 3.0 m lattice, not the 2.1 m one sized for a 27 m building.
MAST_W = 3.0
APEX_H = 11.0


def strut(name, p0, p1, thick, mat):
    """A member running between two points, at any angle.

    concept_mesh builds prisms up Z, which is right for columns and useless for
    a crane: the A-frame, its pendants and the mast diagonals are all diagonal
    by definition, and a tower crane without them reads as a pole. This builds
    the member along Z at the right length and then rotates it onto the line.
    """
    import mathutils
    x0, y0, z0 = p0
    x1, y1, z1 = p1
    v = mathutils.Vector((x1 - x0, y1 - y0, z1 - z0))
    length = v.length
    if length < 1e-4:
        return None
    ob = M.prism(name, M.rect(-thick / 2, -thick / 2, thick / 2, thick / 2),
                 0.0, length, mat, bevel=0.02)
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = mathutils.Vector((0, 0, 1)).rotation_difference(v)
    ob.location = (x0, y0, z0)
    return ob


def tower_plate(level):
    """The plate at a tower level. The setback steps the west and south edges
    in; the street corner is chamfered the whole way up."""
    x0, y0 = TOWX0, TOWY0
    if level >= SETBACK_FROM:
        x0 += 7.0
        y0 += 5.0
    return M.chamfered(x0, y0, TOWX1, TOWY1, 4.0)


def tower_columns(level):
    """The tower's 7 m office grid, skipping the core."""
    plate = tower_plate(level)
    xs = [x for x in range(-3, 31, 7)]
    ys = [y for y in range(-21, 9, 7)]
    out = []
    for x in xs:
        for y in ys:
            if CORE[0] <= x <= CORE[2] and CORE[1] <= y <= CORE[3]:
                continue
            if level >= SETBACK_FROM and (x < TOWX0 + 7.0 or y < TOWY0 + 5.0):
                continue
            out.append((x, y))
    return plate, out


# ---------------------------------------------------------------------------
# Instancing
# ---------------------------------------------------------------------------
#
# Blender's exporter emits EXT_mesh_gpu_instancing only for CHILDREN OF AN
# EMPTY, so each repeated element gets one authored mesh and one Empty holding
# its linked duplicates. The duplicates share a mesh datablock, which is what
# makes them one draw call rather than N.
#
def instance_group(name, source, placements):
    """Parent linked duplicates of `source` to a new Empty, one per placement.

    `placements` is a list of (x, y, z) translations. The source object itself
    is removed: it exists only to author the mesh, and leaving it in the scene
    would export a stray copy at the origin.
    """
    empty = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(empty)
    empty.location = (0.0, 0.0, 0.0)

    made = []
    for i, (x, y, z) in enumerate(placements):
        dup = bpy.data.objects.new(f"{name}-{i:02d}", source.data)
        dup.parent = empty
        dup.location = (x, y, z)
        bpy.context.scene.collection.objects.link(dup)
        made.append(dup)

    bpy.data.objects.remove(source, do_unlink=True)
    return empty, made


def build_typical_floor(name, mats, level, clad):
    """One tower floor, authored at z = 0 so instances can place it by height.

    Returns a single joined object, because an instanced node carries ONE mesh:
    a floor made of thirty separate objects cannot be instanced as a floor.
    """
    parts = []
    plate, cols = tower_columns(level)

    parts.append(M.slab(f"{name}-slab", plate, 0.0, 0.32, mats["conc"],
                        voids=[CORE], edge_band=0.3))
    for j, (x, y) in enumerate(cols):
        parts.append(M.column(f"{name}-c{j}", x, y, 0.0 - TOWER_H, TOWER_H, 0.62,
                              mats["conc"]))

    if clad:
        # The finished elevations, set out from the ACTUAL face extents.
        #
        # chamfered() cuts the (x0, y0) corner, so the south face starts at
        # x0 + c and the west face at y0 + c. The first version glazed from
        # TOWX0 with an invented bay width and so ran off both ends of the
        # face and stopped dead at the chamfer, which is exactly how it looked.
        # The chamfer now carries a bay of its own and the corner turns.
        cx, cy = TOWX0 + 4.0, TOWY0 + 4.0        # the chamfer's two ends
        south = [(cx + i * (TOWX1 - cx) / 5.0, cx + (i + 1) * (TOWX1 - cx) / 5.0)
                 for i in range(5)]
        for i, (a, b) in enumerate(south):
            parts += [o for o in M.facade_bay(
                f"{name}-fs{i}", (a, TOWY0), (b, TOWY0),
                0.0 - TOWER_H, TOWER_H, mats["glass"], mats["spandrel"],
                mullions=2) if o]

        east = [(TOWY0 + i * (TOWY1 - TOWY0) / 5.0,
                 TOWY0 + (i + 1) * (TOWY1 - TOWY0) / 5.0) for i in range(5)]
        for i, (a, b) in enumerate(east):
            parts += [o for o in M.facade_bay(
                f"{name}-fe{i}", (TOWX1, a), (TOWX1, b),
                0.0 - TOWER_H, TOWER_H, mats["glass"], mats["spandrel"],
                mullions=2) if o]

        # The corner itself. One bay on the diagonal, which is the whole point
        # of chamfering it in the first place.
        parts += [o for o in M.facade_bay(
            f"{name}-fc", (cx, TOWY0), (TOWX0, cy),
            0.0 - TOWER_H, TOWER_H, mats["glass"], mats["spandrel"],
            mullions=2) if o]
    else:
        # Fitting out: the frame is up and the edge protection is on, but the
        # skin is not. This is what the middle of a live tower looks like.
        for i in range(6):
            ax = TOWX0 + 1.0 + i * 5.6
            parts.append(M.prism(
                f"{name}-eg{i}", M.rect(ax, TOWY0 - 0.12, ax + 5.2, TOWY0 + 0.04),
                0.0 + 0.32, 1.05, mats["galv"], bevel=0.02))

    return L.join_all(name, [p for p in parts if p])


def build(dusk=False):
    L.reset()
    rng = random.Random(31)
    mats = L.standard_materials(wear=0.6, lit=0.4 if dusk else 0.0)
    parts = {"conc": [], "galv": [], "ply": [], "paint": [], "glass": []}
    empties = []

    # ---- Ground, street, plot -------------------------------------------
    L.box("ground", (900, 900, 0.4), (0, 0, -0.2), mats["earth"])
    L.box("street", (900, 16, 0.32), (0, -46, 0.04), mats["spandrel"])
    L.box("kerb", (900, 0.4, 0.42), (0, -37.5, 0.19), mats["conc"])
    L.box("path", (900, 9.0, 0.34), (0, -33.0, 0.16), mats["conc"])
    L.box("sitepad", (76, 62, 0.5), (0, 0, 0.2), mats["conc"])

    # ---- PODIUM ----------------------------------------------------------
    pod = M.chamfered(PODX0, PODY0, PODX1, PODY1, 5.0)
    for lvl in range(1, PODIUM_LEVELS + 1):
        z = lvl * PODIUM_H
        parts["conc"].append(
            M.slab(f"pod{lvl}", pod, z, 0.36, mats["conc"],
                   voids=[CORE], edge_band=0.35))
        for x in range(-31, 32, 10):
            for y in range(-26, 27, 13):
                if CORE[0] < x < CORE[2] and CORE[1] < y < CORE[3]:
                    continue
                parts["conc"].append(
                    M.column(f"pc{lvl}x{x}y{y}", x, y, z - PODIUM_H, PODIUM_H,
                             0.75, mats["conc"]))
        if lvl <= 2:
            for i in range(9):
                ax = PODX0 + 3.0 + i * 6.9
                parts["glass"] += [o for o in M.facade_bay(
                    f"pfb{lvl}i{i}", (ax, PODY0), (ax + 6.4, PODY0),
                    z - PODIUM_H, PODIUM_H, mats["glass"], mats["spandrel"],
                    mullions=3) if o]

    # ---- THE TRANSFER LEVEL ----------------------------------------------
    # Deep beams carrying the tower's 7 m grid down onto the podium's 10.5 m
    # grid. The most legible structural event in the building.
    for y in range(-22, 9, 10):
        parts["conc"].append(
            M.prism(f"tb{y}", M.rect(TOWX0 - 1, y - 0.9, TOWX1 + 1, y + 0.9),
                    TRANSFER - 2.4, 2.4, mats["conc"], bevel=0.04))
    parts["conc"].append(
        M.prism("tcap", M.rect(TOWX0 - 1.4, TOWY0 - 1.4, TOWX1 + 1.4, TOWY1 + 1.4),
                TRANSFER, 0.45, mats["conc"], bevel=0.04))

    # ---- THE CORE --------------------------------------------------------
    # Slipformed ahead of the floors, so it runs past the frontier and past the
    # top slab as the lift overrun. It is the tallest thing on the building.
    parts["conc"].append(
        M.prism("core", M.rect(*CORE), 0.0, TOP + 5.5, mats["conc"], bevel=0.05))

    # ---- ZONE 1 and 2: the repetition, instanced -------------------------
    clad_src = build_typical_floor("tfclad", mats, 6, clad=True)
    fit_src = build_typical_floor("tffit", mats, 19, clad=False)

    clad_at = [(0.0, 0.0, TRANSFER + lvl * TOWER_H)
               for lvl in range(1, COMPLETE_TO + 1)]
    fit_at = [(0.0, 0.0, TRANSFER + lvl * TOWER_H)
              for lvl in range(COMPLETE_TO + 1, FITOUT_TO + 1)]

    e1, _ = instance_group("instclad", clad_src, clad_at)
    e2, _ = instance_group("instfit", fit_src, fit_at)
    empties += [e1, e2]

    # ---- ZONE 3: the frontier, unique ------------------------------------
    #
    # Four levels, each a different moment: the topmost is an open deck with
    # the pour running, below it formwork struck back, below that props still
    # in, and below that the first blockwork. Nothing here repeats.
    for k, lvl in enumerate(range(FITOUT_TO + 1, TOWER_LEVELS + 1)):
        z = TRANSFER + lvl * TOWER_H
        plate, cols = tower_columns(lvl)

        if lvl < TOWER_LEVELS:
            parts["conc"].append(
                M.slab(f"fr{lvl}", plate, z, 0.30, mats["conc"],
                       voids=[CORE], edge_band=0.26))
        for j, (x, y) in enumerate(cols):
            parts["conc"].append(
                M.column(f"frc{lvl}n{j}", x, y, z - TOWER_H, TOWER_H, 0.6,
                         mats["conc"]))

        # Props under the two most recent slabs, which is where they live.
        if k >= 2:
            for j, (x, y) in enumerate(cols[::2]):
                parts["galv"].append(
                    M.column(f"prop{lvl}n{j}", x + 1.6, y + 1.6, z - TOWER_H,
                             TOWER_H - 0.3, 0.09, mats["galv"]))

        # The top deck: formwork ply, not concrete.
        if lvl == TOWER_LEVELS:
            parts["ply"].append(
                M.slab(f"deck{lvl}", plate, z, 0.06, mats["ply"],
                       voids=[CORE], edge_band=0.0))
            for j, (x, y) in enumerate(cols):
                parts["galv"].append(
                    M.column(f"back{lvl}n{j}", x, y, z - TOWER_H + 0.2,
                             TOWER_H - 0.26, 0.08, mats["galv"]))

        # Edge protection, every frontier level, because a live edge without it
        # is the one thing a site would never allow.
        for i in range(7):
            ax = TOWX0 + 1.0 + i * 4.8
            if lvl >= SETBACK_FROM and ax < TOWX0 + 7.0:
                continue
            parts["galv"].append(
                M.prism(f"eg{lvl}i{i}", M.rect(ax, TOWY0 - 0.1, ax + 4.4, TOWY0 + 0.05),
                        z + 0.3, 1.1, mats["galv"], bevel=0.02))

    # ---- THE TOWER CRANE -------------------------------------------------
    #
    # A saddle-jib crane off the podium's north-west corner, outside the tower
    # footprint and inside the hoarding. On C's 22 x 34 m plot there was
    # nowhere to put one; that finding was about that plot.
    #
    # The first version was sized for the 27 m building it replaced: a 2.1 m
    # mast with 160 mm legs and no bracing, which at 118 m read as a washing
    # line. A crane this tall is a 3 m lattice with visible diagonals and an
    # A-FRAME above the slewing ring carrying pendants out to both jibs — the
    # apex is the silhouette, and without it nothing says tower crane.
    #
    # The mast is INSTANCED: one braced section, repeated up the height. It is
    # the same discipline as the floors and for the same reason.
    SEC = 5.0
    half = MAST_W / 2
    sections = int((CRANE_H - 6.0) // SEC)

    sec_parts = []
    for cx in (-half, half):
        for cy in (-half, half):
            sec_parts.append(M.column(f"csleg{cx}{cy}", cx, cy, 0.0, SEC, 0.26,
                                      mats["galv"]))
    for cy in (-half, half):
        sec_parts.append(M.prism(f"cstie{cy}", M.rect(-half, cy - 0.13, half, cy + 0.13),
                                 SEC - 0.3, 0.26, mats["galv"], bevel=0.02))
        sec_parts.append(strut(f"csdg{cy}", (-half, cy, 0.1), (half, cy, SEC - 0.35),
                               0.17, mats["galv"]))
    for cx in (-half, half):
        sec_parts.append(M.prism(f"cstx{cx}", M.rect(cx - 0.13, -half, cx + 0.13, half),
                                 SEC - 0.3, 0.26, mats["galv"], bevel=0.02))
    section = L.join_all("cmastsec", [o for o in sec_parts if o])
    e3, _ = instance_group(
        "instmast", section,
        [(CRANE_X, CRANE_Y, s * SEC) for s in range(sections)])
    empties.append(e3)

    slew = sections * SEC
    parts["galv"].append(
        M.prism("cslew", M.rect(CRANE_X - half - 0.3, CRANE_Y - half - 0.3,
                                CRANE_X + half + 0.3, CRANE_Y + half + 0.3),
                slew, 1.6, mats["galv"], bevel=0.04))

    # Jib and counter-jib, deep enough to read against a skyline.
    jib_z = slew + 1.6
    parts["galv"].append(
        M.prism("cjib", M.rect(CRANE_X - 0.9, CRANE_Y - 0.9,
                               CRANE_X + JIB, CRANE_Y + 0.9),
                jib_z, 2.1, mats["galv"], bevel=0.04))
    parts["galv"].append(
        M.prism("ccj", M.rect(CRANE_X - COUNTER_JIB, CRANE_Y - 1.0,
                              CRANE_X - 0.9, CRANE_Y + 1.0),
                jib_z, 2.3, mats["galv"], bevel=0.04))

    # The A-frame and its pendants. This is the part that makes it a crane.
    apex = (CRANE_X, CRANE_Y, jib_z + APEX_H)
    for cy in (-half, half):
        parts["galv"].append(
            strut(f"cap{cy}", (CRANE_X - half, CRANE_Y + cy, jib_z), apex,
                  0.28, mats["galv"]))
        parts["galv"].append(
            strut(f"cap2{cy}", (CRANE_X + half, CRANE_Y + cy, jib_z), apex,
                  0.28, mats["galv"]))
    for frac in (0.42, 0.78):
        parts["galv"].append(
            strut(f"cpend{int(frac * 100)}",
                  apex, (CRANE_X + JIB * frac, CRANE_Y, jib_z + 2.1),
                  0.16, mats["galv"]))
    parts["galv"].append(
        strut("cpendc", apex,
              (CRANE_X - COUNTER_JIB + 1.5, CRANE_Y, jib_z + 2.3),
              0.18, mats["galv"]))

    parts["conc"].append(
        M.prism("cctw", M.rect(CRANE_X - COUNTER_JIB + 1.0, CRANE_Y - 1.6,
                               CRANE_X - COUNTER_JIB + 5.5, CRANE_Y + 1.6),
                jib_z + 0.5, 2.6, mats["conc"], bevel=0.05))
    parts["galv"].append(
        M.prism("ccab", M.rect(CRANE_X + 1.4, CRANE_Y - 1.3,
                               CRANE_X + 4.6, CRANE_Y + 1.3),
                jib_z - 3.0, 3.0, mats["galv"], bevel=0.06))

    # Trolley and hook block, out over the deck where the load lands.
    parts["galv"].append(
        M.prism("ctrolley", M.rect(CRANE_X + 26.0, CRANE_Y - 0.7,
                                   CRANE_X + 28.4, CRANE_Y + 0.7),
                jib_z - 0.7, 0.7, mats["galv"], bevel=0.03))
    parts["galv"].append(
        strut("crope", (CRANE_X + 27.2, CRANE_Y, jib_z - 0.7),
              (CRANE_X + 27.2, CRANE_Y, TOP + 2.5), 0.06, mats["galv"]))
    parts["galv"].append(
        M.prism("chook", M.rect(CRANE_X + 26.6, CRANE_Y - 0.4,
                                CRANE_X + 27.8, CRANE_Y + 0.4),
                TOP + 1.6, 0.9, mats["galv"], bevel=0.04))

    return parts, empties, mats


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
def export_world(parts, empties):
    """C's layer split, plus the one thing C's export cannot do.

    C joins every object in a layer into one mesh per material key. That is
    right for authored geometry and fatal for instances: joining a hundred
    linked duplicates welds them into one mesh and there is nothing left to
    instance. So Empties and their children are held out of the join and
    exported alongside the joined meshes, with export_gpu_instances on.
    """
    C.bake_production_materials()

    instanced_names = set()
    for e in empties:
        instanced_names.add(e.name)
        for ch in e.children:
            instanced_names.add(ch.name)

    tagged = {}
    claimed = set(instanced_names)
    for key, objs in parts.items():
        for o in objs:
            if o is None or o.name in claimed:
                continue
            claimed.add(o.name)
            tagged.setdefault((C.layer_of(o.name), key), []).append(o)
    for o in list(bpy.context.scene.objects):
        if o.type != "MESH" or o.name in claimed:
            continue
        claimed.add(o.name)
        tagged.setdefault((C.layer_of(o.name), "misc"), []).append(o)

    merged = {}
    for (layer, key), objs in tagged.items():
        ob = L.join_all(f"{layer}-{key}", objs)
        if ob:
            L.uv_project_for_export(ob, L.EXPORT_UV_TILE.get(key, L.DEFAULT_UV_TILE))
            merged.setdefault(layer, []).append(ob)

    # Instances ride with the layer their Empty's name resolves to.
    for e in empties:
        merged.setdefault(C.layer_of(e.name), []).append(e)
        for ch in e.children:
            merged[C.layer_of(e.name)].append(ch)

    out_dir = os.environ.get("WORLD_EXPORT_DIR") or os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "frontend", "public", "world", "assets")
    os.makedirs(out_dir, exist_ok=True)

    report = []
    for layer, objs in merged.items():
        path = os.path.join(out_dir, f"login-site-{layer}.glb")
        stats = export_group_instanced(objs, path)
        report.append((layer, stats))
        print(f"OK  {os.path.basename(path)}  {stats['triangles']} tris  "
              f"{stats['bytes'] / 1024:.0f} KB")
    print(f"OK  TOTAL {sum(s['triangles'] for _, s in report)} triangles")
    return report


def export_group_instanced(objs, path):
    """C's export_group with GPU instancing switched on.

    export_apply is FALSE here, unlike C's. Applying modifiers realises a
    linked duplicate into its own mesh, which is exactly the thing being
    avoided — the instances would export as N separate meshes and the
    extension would never be written.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

    args = {
        "filepath": path, "export_format": "GLB", "use_selection": True,
        "export_yup": True, "export_apply": False, "export_normals": True,
        "export_materials": "EXPORT", "export_cameras": False,
        "export_image_format": "NONE",
        "export_lights": False, "export_extras": False,
        "export_animations": False, "export_texcoords": True,
        "export_draco_mesh_compression_enable": False,
        "export_gpu_instances": True,
    }
    props = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
    bpy.ops.export_scene.gltf(**{k: v for k, v in args.items() if k in props})

    dg = bpy.context.evaluated_depsgraph_get()
    tris = 0
    for o in objs:
        if o.type != "MESH":
            continue
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
    return {"triangles": tris, "meshes": len(objs),
            "bytes": os.path.getsize(path)}


def light(dusk):
    if dusk:
        L.sky_world(4.0, 236, strength=0.55, dusk=True)
        L.sun_lamp(4.0, 236, 4.2, color=(1.0, 0.7, 0.44), angle=1.7)
    else:
        L.sky_world(40, 208, strength=0.5)
        L.sun_lamp(40, 208, 6.2, color=(1.0, 0.95, 0.87), angle=0.6)


# Framed for a 106 m building, which is a different photograph from a 27 m one:
# the hero has to stand far enough back that the tower is not simply cropped.
CAMERAS = {
    "hero": ((-96.0, -132.0, 2.0), (-2.0, -14.0, 52.0), 32),
    "ground": ((-34.0, -52.0, 1.68), (6.0, -18.0, 26.0), 30),
    "crown": ((-58.0, -78.0, 74.0), (8.0, -10.0, 96.0), 45),
}


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parts, empties, mats = build(dusk="--dusk" in args)
    print(f"BUILT {NAME}: {FLOORS} floors, top of structure {TOP:.1f} m, "
          f"crane hook {CRANE_H:.1f} m")
    if "--frames" in args:
        dusk = "--dusk" in args
        light(dusk)
        which = args[args.index("--frames") + 1]
        for key in which.split(","):
            loc, tgt, mm = CAMERAS[key.strip()]
            cam = L.camera(f"cam-{key}", loc, tgt, mm=mm)
            out = os.environ.get("WORLD_FRAME_DIR") or L.OUT
            L.render(os.path.join(out, f"{NAME}-{key}.png"), cam,
                     width=1440, height=900, samples=48,
                     exposure=0.25 if dusk else -0.45)
    if "--export" in args:
        export_world(parts, empties)


if __name__ == "__main__":
    main()
