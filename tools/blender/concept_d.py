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
import site_dressing as D
import human as H

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
def instance_group(name, source, placements, keep_source=False):
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

    if not keep_source:
        bpy.data.objects.remove(source, do_unlink=True)
    else:
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



# ---------------------------------------------------------------------------
# THE CITY
# ---------------------------------------------------------------------------
#
# The old neighbours layer was three meshes of tight infill authored to ENCLOSE
# the site — which was the point then, and is wrong now: it boxed the camera in
# so an orbit was a wall, and the dolly added in this phase has nothing to move
# through.
#
# So the city is pushed back to a ring that starts beyond the hoarding and
# builds outward and upward, and it is built the same way the tower's
# repetition is: a handful of ARCHETYPES, a couple of hundred instances, and
# every bit of variety coming from the transform and a seeded PRNG rather than
# from unique geometry. Four archetypes at a few hundred triangles each is
# kilobytes; two hundred unique buildings is a budget.
#
# Seeded, because a skyline that reshuffles on every build is not a skyline you
# can art-direct — and because the same seed has to produce the same city in a
# render and in the browser.

CITY_INNER = 96.0        # nothing closer than this: the orbit has to breathe

# WHERE THE FOG ENDS, which is where the city should.
#
# environment.js runs FogExp2, and three's is 1 - exp(-(density*depth)^2).
# Densities measured out of the running world: 0.0022 at high sun, 0.0050 at
# golden hour, 0.0090 at night. That puts the horizon at:
#
#     day     35% fogged at 300 m,  57% at 420 m,  84% at 620 m
#     dusk    89% fogged at 300 m,  99% at 420 m
#     night   99.9% fogged at 300 m
#
# A ring reaching 620 m was therefore spending instances on blocks that are
# 84% gone in the best light and entirely gone in the other two. 420 m is the
# useful edge by day and generous for everything else, and pulling the ring in
# puts the same instances where they can actually be seen.
CITY_OUTER = 420.0
CITY_COUNT = 220
# Past this, fog has eaten enough that a second tone is not worth an
# instanced node. Day fog is 35% at 300 m; night is total well before it.
CITY_TONE_BAND = 420.0

# The grid the city stands on. Pitch is one block plus its street; the road is
# the gap between cells and the blocks sit inside them.
CITY_GRID = 62.0
CITY_ROAD = 16.0
# Footprint radius per kind, for the overlap test — the archetype's own
# half-diagonal, which the transform scale then stretches up to 1.5x.
CITY_FOOTPRINT = {
    "nbtower": 20.0, "nbslab": 26.0, "nbpodium": 24.0, "nbshed": 27.0,
}

# WHERE THE CAMERA STANDS, and therefore where no building may.
#
# The first city put a block on top of the establishing station and the hero
# render came back as the inside of a wall. The stations are at 47-159 m and
# the city ring starts at 96 m, so the two overlap by design — a city that
# stopped beyond the furthest station would be too far away to read.
#
# So the blocks are kept off the camera instead of the camera kept out of the
# city, which is also what a street does. Blender coordinates (Z up), from the
# station eyes in SITE_JOURNEY: three (x, y, z) is Blender (x, -z, y).
CAMERA_KEEPOUT = [
    (-96.0, -132.0, 62.0),   # street establishing
    (-30.0, -60.0, 46.0),    # footpath
    (-8.0, -42.0, 42.0),     # site entry
    (95.0, 70.0, 52.0),      # rear
]


def city_archetype(name, mats, w, d, floors, fh, kind):
    """One building type, authored at the origin and instanced from there.

    Four types rather than one scaled box, because a skyline reads as a city
    through VARIETY OF KIND — a slab block, a tower, a podium block and a low
    shed have different silhouettes, and no amount of scaling turns one into
    another.
    """
    parts = []
    h = floors * fh
    x0, y0, x1, y1 = -w / 2, -d / 2, w / 2, d / 2

    if kind == "tower":
        body = M.chamfered(x0, y0, x1, y1, min(w, d) * 0.18)
        parts.append(M.prism(f"{name}-b", body, 0.0, h, mats["conc"], bevel=0.12))
        # A crown, so the tops are not all flat lids.
        parts.append(M.prism(f"{name}-c", M.rect(x0 * 0.55, y0 * 0.55, x1 * 0.55, y1 * 0.55),
                             h, fh * 1.4, mats["conc"], bevel=0.1))
    elif kind == "slab":
        parts.append(M.prism(f"{name}-b", M.rect(x0, y0, x1, y1), 0.0, h,
                             mats["conc"], bevel=0.1))
        parts.append(M.prism(f"{name}-p", M.rect(x0 - 0.4, y0 - 0.4, x1 + 0.4, y1 + 0.4),
                             h, 0.5, mats["conc"], bevel=0.06))
    elif kind == "podium":
        parts.append(M.prism(f"{name}-p", M.rect(x0, y0, x1, y1), 0.0, fh * 2.2,
                             mats["conc"], bevel=0.1))
        parts.append(M.prism(f"{name}-b", M.rect(x0 * 0.62, y0 * 0.62, x1 * 0.62, y1 * 0.62),
                             fh * 2.2, h, mats["conc"], bevel=0.1))
    else:  # shed
        parts.append(M.prism(f"{name}-b", M.rect(x0, y0, x1, y1), 0.0, h,
                             mats["conc"], bevel=0.08))

    # ---- THE FACADE ------------------------------------------------------
    #
    # facade_bay, which the hero uses, says it in its own comment: "glazing
    # flush with the structure reads as a coloured face; glazing 200 mm behind
    # a mullion grid reads as a facade, because the reveal casts a shadow that
    # moves with the sun." The city never got it, and was a box with a flat
    # stripe stuck 120 mm PROUD of the wall — the opposite of a reveal.
    #
    # The recess is achieved by pushing the SPANDREL forward rather than by
    # cutting the glass back. Identical from outside, and it needs no boolean
    # on a mesh that has to stay cheap enough to instance two hundred times.
    #
    # It only reads at all because noon is sun-dominant now (item 4). Under the
    # old 3.4 key against 3.8 hemisphere fill there was barely a directional
    # source to cast the shadow this depends on.
    #
    # Two faces only: a block seen from 150 m does not need four elevations,
    # and the two that face the site are the two that show.
    band_h = min(0.95, fh * 0.34)          # spandrel: the floor line, opaque
    proud = 0.24                            # how far it stands off the glass
    fin_every = 5.5

    def facade_run(tag, fx0, fy0, fx1, fy1, z0, z1):
        n = max(1, int(round((z1 - z0) / fh)))
        for i in range(n):
            zf = z0 + i * fh
            if zf + band_h > z1:
                break
            # Spandrel, proud of the face. Its underside is the shadow line.
            parts.append(M.prism(
                f"{name}-{tag}s{i}", M.rect(fx0, fy0 - proud, fx1, fy0 + 0.03),
                zf, band_h, mats["spandrel"], bevel=0.03))
            parts.append(M.prism(
                f"{name}-{tag}t{i}", M.rect(fx0 - proud, fy0, fx0 + 0.03, fy1),
                zf, band_h, mats["spandrel"], bevel=0.03))
            # Vision glass, sitting back behind it.
            gz = zf + band_h
            gh = max(0.4, fh - band_h - 0.12)
            if gz + gh > z1:
                break
            parts.append(M.prism(
                f"{name}-{tag}g{i}", M.rect(fx0 + 0.35, fy0 - 0.03, fx1 - 0.35, fy0 + 0.04),
                gz, gh, mats["glass"], bevel=0.02))
            parts.append(M.prism(
                f"{name}-{tag}h{i}", M.rect(fx0 - 0.03, fy0 + 0.35, fx0 + 0.04, fy1 - 0.35),
                gz, gh, mats["glass"], bevel=0.02))

        # Vertical fins, full height, for a rhythm across the bands as well as
        # up them. One run each way, not a grid: at this distance the vertical
        # is what survives.
        span_x = fx1 - fx0
        for k in range(1, max(1, int(span_x / fin_every))):
            fx = fx0 + k * (span_x / max(1, int(span_x / fin_every)))
            parts.append(M.prism(
                f"{name}-{tag}f{k}", M.rect(fx - 0.11, fy0 - proud * 0.8, fx + 0.11, fy0 + 0.02),
                z0, z1 - z0, mats["spandrel"], bevel=0.02))
        span_y = fy1 - fy0
        for k in range(1, max(1, int(span_y / fin_every))):
            fy = fy0 + k * (span_y / max(1, int(span_y / fin_every)))
            parts.append(M.prism(
                f"{name}-{tag}v{k}", M.rect(fx0 - proud * 0.8, fy - 0.11, fx0 + 0.02, fy + 0.11),
                z0, z1 - z0, mats["spandrel"], bevel=0.02))

    if kind == "podium":
        facade_run("p", x0, y0, x1, y1, 0.0, fh * 2.2)
        facade_run("t", x0 * 0.62, y0 * 0.62, x1 * 0.62, y1 * 0.62, fh * 2.2, fh * 2.2 + h)
    else:
        facade_run("b", x0, y0, x1, y1, 0.0, h)

    return L.join_all(name, [o for o in parts if o])


def build_streets(parts, mats):
    """The grid the city stands on.

    Long thin slabs on the cell lines. They are the reason blocks read as a
    city rather than as objects on a table: a building with a road beside it is
    in a place. Named "road" so LAYER_RULES routes them to the street layer,
    and built as a few long meshes rather than per-cell tiles — a road is the
    one thing here with no repetition worth instancing.
    """
    reach = CITY_OUTER + CITY_GRID
    half = int(reach // CITY_GRID) + 1
    for i in range(-half, half + 1):
        c = i * CITY_GRID + CITY_GRID / 2.0
        parts["paint"].append(
            M.prism(f"road-x{i}", M.rect(-reach, c - CITY_ROAD / 2, reach, c + CITY_ROAD / 2),
                    0.02, 0.10, mats["spandrel"], bevel=0.0))
        parts["paint"].append(
            M.prism(f"road-y{i}", M.rect(c - CITY_ROAD / 2, -reach, c + CITY_ROAD / 2, reach),
                    0.02, 0.10, mats["spandrel"], bevel=0.0))


def build_city(mats, empties):
    """A ring of instanced blocks, thinning and rising with distance."""
    rng = random.Random(1907)

    archetypes = [
        ("nbtower", 26.0, 24.0, 22, 3.5, "tower"),
        ("nbslab", 44.0, 18.0, 9, 3.6, "slab"),
        ("nbpodium", 32.0, 30.0, 14, 3.5, "podium"),
        ("nbshed", 38.0, 34.0, 3, 4.6, "shed"),
    ]

    placements = {name: [] for name, *_ in archetypes}

    # ---- ON A GRID, NOT SCATTERED ---------------------------------------
    #
    # Blocks on bare ground read as models on a table, and random polar
    # placement is what made them look scattered rather than built. Real
    # cities are blocks between streets, so placement walks a GRID: one
    # building per cell, jittered inside it so the rows are not mechanical,
    # and the gap between cells IS the street.
    #
    # Rejection sampling against what has already been placed is the one-line
    # answer to buildings growing through each other: keep a running list of
    # centres and footprint radii, and refuse anything that overlaps.
    placed = []                                    # (x, y, footprint radius)
    blocks = []                                    # every block, in placement order
    half = int(CITY_OUTER // CITY_GRID) + 1
    cells = [(i, k) for i in range(-half, half + 1) for k in range(-half, half + 1)]
    rng.shuffle(cells)

    for (i, k) in cells:
        cx, cy = i * CITY_GRID, k * CITY_GRID
        r = math.hypot(cx, cy)
        if r < CITY_INNER or r > CITY_OUTER or len(placed) >= CITY_COUNT:
            continue

        room = max(4.0, (CITY_GRID - CITY_ROAD) / 2.0 - 8.0)
        x = cx + rng.uniform(-room, room)
        y = cy + rng.uniform(-room, room)

        # Off the camera, and off the sight line between camera and site.
        # The block's own FOOTPRINT counts, not just its centre. Testing the
        # centre alone let a 26 m-wide block sit 63 m from a 62 m keep-out and
        # still swallow the camera — which is exactly what happened the moment
        # a tone change reshuffled the placement RNG and moved the blocks.
        foot_here = CITY_FOOTPRINT[kind]
        if any(math.hypot(x - kx, y - ky) < kr + foot_here
               for kx, ky, kr in CAMERA_KEEPOUT):
            continue

        # Kind by distance: sheds near, towers far, so the skyline rises AWAY
        # from the site and the hero stays the tallest thing near it.
        far = (r - CITY_INNER) / (CITY_OUTER - CITY_INNER)
        roll = rng.random()
        if far < 0.22:
            kind = "nbshed" if roll < 0.7 else "nbslab"
        elif far < 0.55:
            kind = "nbslab" if roll < 0.45 else ("nbpodium" if roll < 0.85 else "nbtower")
        else:
            kind = "nbtower" if roll < 0.55 else "nbpodium"

        foot = CITY_FOOTPRINT[kind]
        if any(math.hypot(x - px, y - py) < (foot + pr) * 0.62 for px, py, pr in placed):
            continue
        placed.append((x, y, foot))
        # Order matters for tone assignment below, which is why the blocks are
        # kept as one list rather than only bucketed by archetype: a block's
        # nearest neighbour is usually a DIFFERENT archetype, and a per-kind
        # random pick cannot see it.
        blocks.append({"kind": kind, "x": x, "y": y, "r": r})

    # ---- TONE, DECIDED BY NEIGHBOURS --------------------------------------
    #
    # The goal is narrower than a palette: stop adjacent blocks matching. That
    # is an assignment problem, not a material-count problem, so the three
    # slots already wired stay three and the effort goes into WHICH block gets
    # which.
    #
    # The band was 260 m, past which every block took tone 0 to keep the
    # instanced-node count down. Measured, that was 100 of 132 blocks on one
    # tone and a uniform far skyline — and the saving it bought was 8 instanced
    # nodes out of 12. Fog is only 35% at 300 m, so the far city is still two
    # thirds visible and worth varying. The band now covers the whole ring.
    #
    # Each block takes the tone least represented among the blocks already
    # placed within NEIGHBOUR_R of it. Ties break on the seeded PRNG, so the
    # city is still deterministic. Blocks past CITY_TONE_BAND take tone 0: fog
    # is 35% at 300 m and variation there is bought and thrown away.
    NEIGHBOUR_R = 95.0
    n_tones = 3
    for i, blk in enumerate(blocks):
        if blk["r"] >= CITY_TONE_BAND:
            blk["tone"] = 0
            continue
        near = [0] * n_tones
        for other in blocks[:i]:
            if "tone" not in other:
                continue
            if math.hypot(blk["x"] - other["x"], blk["y"] - other["y"]) < NEIGHBOUR_R:
                near[other["tone"]] += 1
        fewest = min(near)
        candidates = [t for t in range(n_tones) if near[t] == fewest]
        blk["tone"] = candidates[rng.randrange(len(candidates))]

    for blk in blocks:
        placements[blk["kind"]].append((blk["x"], blk["y"], 0.0, blk["tone"]))

    spread = [0, 0, 0]
    for blk in blocks:
        spread[blk["tone"]] += 1
    print(f"CITY tones: {spread[0]} / {spread[1]} / {spread[2]}")

    # ---- TONE ------------------------------------------------------------
    #
    # A city reads through tonal variation, and per-instance colour is not
    # available through EXT_mesh_gpu_instancing — an instanced node carries one
    # mesh, and a mesh carries its material. So tone is a MATERIAL split, not a
    # geometry one: the same four archetypes are instanced once per tone, with
    # the material overridden at OBJECT level so every group still shares one
    # mesh datablock and therefore one set of accessors.
    #
    # The two city materials already existed — concept_lib builds city_warm
    # (brick) and city_cool (concrete), both already in SITE_SURFACES and in
    # EXPORT_UV_TILE — so two of the three tones cost nothing at all to add.
    #
    # VARIED BY DISTANCE, because fog decides where variation is worth paying
    # for: 35% fogged at 300 m and 57% at 420 m by day, and effectively total
    # at night. Blocks past CITY_TONE_BAND get ONE tone, which also keeps the
    # instanced-node count down where it buys nothing.
    tones = [mats["conc"], mats.get("city_warm"), mats.get("city_cool")]
    tones = [t for t in tones if t]

    for name, w, d, floors, fh, kind in archetypes:
        pl = placements[name]
        if not pl:
            continue
        src = city_archetype(name, mats, w, d, floors, fh, kind)

        # Rings first, then AO: the bake can only write what the mesh can hold,
        # and a city body is eighteen vertices before this.
        ground_rings(src)
        bake_vertex_ao([src], with_ground=True, strength=0.95)

        # Near blocks split across the tones; far blocks share one.
        groups = {i: [] for i in range(len(tones))}
        for (x, y, z, tone) in pl:
            groups[min(tone, len(tones) - 1)].append((x, y, z))

        first = True
        for ti, places in groups.items():
            if not places:
                continue
            # One object per tone, all sharing src's mesh data.
            proxy = bpy.data.objects.new(f"{name}t{ti}", src.data)
            bpy.context.scene.collection.objects.link(proxy)
            if proxy.material_slots:
                proxy.material_slots[0].link = "OBJECT"
                proxy.material_slots[0].material = tones[ti]
            e, made = instance_group(f"{name}t{ti}", proxy, places,
                                     keep_source=True)
            for dup in made:
                if dup.material_slots:
                    dup.material_slots[0].link = "OBJECT"
                    dup.material_slots[0].material = tones[ti]
                dup.rotation_euler = (0.0, 0.0, rng.uniform(0.0, math.tau))
                sc = rng.uniform(0.68, 1.12)
                dup.scale = (sc, sc, rng.uniform(0.55, 1.9))
            empties.append(e)
            print(f"CITY {name} tone{ti}: {len(made)} instances")
            first = False
        bpy.data.objects.remove(src, do_unlink=True)



# ---------------------------------------------------------------------------
# AMBIENT OCCLUSION, BAKED TO VERTEX COLOURS
# ---------------------------------------------------------------------------
#
# The single biggest tell in the browser was that nothing was grounded: every
# building met the ground on a hard flat line and every recess was as bright as
# every face. That is what makes geometry look pasted onto a plane.
#
# WHY BAKED AND NOT SCREEN-SPACE. This world is entirely static except the
# crowd, and SSAO measured 0.631 ms of GPU on desktop and 0.922 ms at a phone
# viewport — costing MORE at the smaller size, because its cost here is the
# second full geometry pass rather than the fullscreen AO. Paying that every
# frame for something that never changes is the wrong trade.
#
# WHY IT NEEDED GEOMETRY FIRST. Measured before building: a city tower body is
# EIGHTEEN vertices. Vertex AO on eight bottom corners and eight top ones is
# not occlusion, it is a vertical ramp up a seventy-metre building. So the
# archetypes get horizontal rings near the ground, close together low down
# where contact shading actually lives, and the AO is carried on those.
#
# Analytic rather than Cycles: a BVH and a cosine-weighted hemisphere per
# vertex is deterministic, needs no render engine, and takes seconds.

AO_RAYS = 24
AO_DIST = 14.0          # beyond this nothing is "contact"


def ground_rings(ob, heights=(0.6, 1.4, 2.6, 4.5, 7.5, 12.0)):
    """Cut horizontal rings into a box so it can carry a contact gradient.

    Spaced geometrically: AO from the ground falls off fast, so the samples
    have to be dense where the falloff is and sparse where it is not. A
    uniform subdivision spends its vertices in the wrong place.
    """
    import bmesh
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    zmax = max((v.co.z for v in bm.verts), default=0.0)
    for h in heights:
        if h >= zmax - 0.2:
            break
        bmesh.ops.bisect_plane(
            bm, geom=list(bm.faces) + list(bm.edges) + list(bm.verts),
            plane_co=(0.0, 0.0, h), plane_no=(0.0, 0.0, 1.0), clear_inner=False,
            clear_outer=False)
    bm.to_mesh(me)
    bm.free()
    me.update()
    return ob


def bake_vertex_ao(objects, with_ground=True, strength=1.0):
    """Write ambient occlusion into each object's colour attribute.

    Occlusion is sampled against the object itself plus a ground plane. For an
    INSTANCED archetype that is the whole truth available: every instance
    shares one mesh, so occlusion between neighbours cannot be represented and
    is not attempted. Ground contact and self-occlusion are, and they are the
    two that carry the frame.
    """
    import bmesh
    import mathutils
    from mathutils.bvhtree import BVHTree

    for ob in objects:
        if ob is None or ob.type != "MESH":
            continue
        me = ob.data

        verts = [v.co.copy() for v in me.vertices]
        polys = [tuple(p.vertices) for p in me.polygons]
        if with_ground:
            base = len(verts)
            R = 400.0
            verts += [mathutils.Vector((-R, -R, 0.0)), mathutils.Vector((R, -R, 0.0)),
                      mathutils.Vector((R, R, 0.0)), mathutils.Vector((-R, R, 0.0))]
            polys.append((base, base + 1, base + 2, base + 3))
        bvh = BVHTree.FromPolygons(verts, polys, all_triangles=False, epsilon=0.0)

        attr = me.color_attributes.get("Col")
        if attr is None:
            attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR",
                                           domain="POINT")

        # Cosine-weighted hemisphere, generated once and reoriented per vertex.
        rays = []
        golden = math.pi * (3.0 - math.sqrt(5.0))
        for i in range(AO_RAYS):
            z = math.sqrt((i + 0.5) / AO_RAYS)
            r = math.sqrt(max(0.0, 1.0 - z * z))
            a = i * golden
            rays.append(mathutils.Vector((math.cos(a) * r, math.sin(a) * r, z)))

        for vi, v in enumerate(me.vertices):
            n = mathutils.Vector(v.normal)
            if n.length < 1e-6:
                n = mathutils.Vector((0.0, 0.0, 1.0))
            n.normalize()
            # A basis with n as up, so the cosine hemisphere lands correctly.
            up = mathutils.Vector((0.0, 0.0, 1.0))
            if abs(n.z) > 0.99:
                up = mathutils.Vector((1.0, 0.0, 0.0))
            t = n.cross(up).normalized()
            bt = n.cross(t)
            origin = v.co + n * 0.02

            hits = 0
            for d in rays:
                world = t * d.x + bt * d.y + n * d.z
                loc, _, _, dist = bvh.ray_cast(origin, world, AO_DIST)
                if loc is not None:
                    # Nearer occluders matter more than distant ones.
                    hits += 1.0 - (dist / AO_DIST)
            ao = 1.0 - (hits / AO_RAYS) * strength
            ao = max(0.06, min(1.0, ao))

            prev = attr.data[vi].color
            attr.data[vi].color = (prev[0] * ao if prev[0] else ao,
                                   prev[1] * ao if prev[1] else ao,
                                   prev[2] * ao if prev[2] else ao, 1.0)
        me.color_attributes.active_color = attr
        vals = [attr.data[i].color[0] for i in range(len(me.vertices))]
        print(f"AO   {ob.name}: {len(me.vertices)} verts  "
              f"range {min(vals):.2f}-{max(vals):.2f}  mean {sum(vals)/len(vals):.2f}")


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

    bake_vertex_ao([clad_src, fit_src], with_ground=False, strength=0.85)
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
    #
    # Every crane object is prefixed "mc" so C's LAYER_RULES route it to the
    # SCAFFOLD layer. A crane is site logistics, not architecture — and the
    # counterweight is concrete, so leaving it in the architecture layer would
    # have widened the `conc` bounding box that checkSiteScale measures by
    # 8 m and quietly reintroduced the arbitrary-object bug that check was
    # rewritten to escape.
    SEC = 5.0
    half = MAST_W / 2
    sections = int((CRANE_H - 6.0) // SEC)

    sec_parts = []
    for cx in (-half, half):
        for cy in (-half, half):
            sec_parts.append(M.column(f"mccsleg{cx}{cy}", cx, cy, 0.0, SEC, 0.26,
                                      mats["galv"]))
    for cy in (-half, half):
        sec_parts.append(M.prism(f"mccstie{cy}", M.rect(-half, cy - 0.13, half, cy + 0.13),
                                 SEC - 0.3, 0.26, mats["galv"], bevel=0.02))
        sec_parts.append(strut(f"mccsdg{cy}", (-half, cy, 0.1), (half, cy, SEC - 0.35),
                               0.17, mats["galv"]))
    for cx in (-half, half):
        sec_parts.append(M.prism(f"mccstx{cx}", M.rect(cx - 0.13, -half, cx + 0.13, half),
                                 SEC - 0.3, 0.26, mats["galv"], bevel=0.02))
    section = L.join_all("mccmastsec", [o for o in sec_parts if o])
    e3, _ = instance_group(
        "mcinstmast", section,
        [(CRANE_X, CRANE_Y, s * SEC) for s in range(sections)])
    empties.append(e3)

    slew = sections * SEC
    parts["galv"].append(
        M.prism("mccslew", M.rect(CRANE_X - half - 0.3, CRANE_Y - half - 0.3,
                                CRANE_X + half + 0.3, CRANE_Y + half + 0.3),
                slew, 1.6, mats["galv"], bevel=0.04))

    # Jib and counter-jib, deep enough to read against a skyline.
    jib_z = slew + 1.6
    parts["galv"].append(
        M.prism("mccjib", M.rect(CRANE_X - 0.9, CRANE_Y - 0.9,
                               CRANE_X + JIB, CRANE_Y + 0.9),
                jib_z, 2.1, mats["galv"], bevel=0.04))
    parts["galv"].append(
        M.prism("mcccj", M.rect(CRANE_X - COUNTER_JIB, CRANE_Y - 1.0,
                              CRANE_X - 0.9, CRANE_Y + 1.0),
                jib_z, 2.3, mats["galv"], bevel=0.04))

    # The A-frame and its pendants. This is the part that makes it a crane.
    apex = (CRANE_X, CRANE_Y, jib_z + APEX_H)
    for cy in (-half, half):
        parts["galv"].append(
            strut(f"mccap{cy}", (CRANE_X - half, CRANE_Y + cy, jib_z), apex,
                  0.28, mats["galv"]))
        parts["galv"].append(
            strut(f"mccap2{cy}", (CRANE_X + half, CRANE_Y + cy, jib_z), apex,
                  0.28, mats["galv"]))
    for frac in (0.42, 0.78):
        parts["galv"].append(
            strut(f"mccpend{int(frac * 100)}",
                  apex, (CRANE_X + JIB * frac, CRANE_Y, jib_z + 2.1),
                  0.16, mats["galv"]))
    parts["galv"].append(
        strut("mccpendc", apex,
              (CRANE_X - COUNTER_JIB + 1.5, CRANE_Y, jib_z + 2.3),
              0.18, mats["galv"]))

    parts["conc"].append(
        M.prism("mccctw", M.rect(CRANE_X - COUNTER_JIB + 1.0, CRANE_Y - 1.6,
                               CRANE_X - COUNTER_JIB + 5.5, CRANE_Y + 1.6),
                jib_z + 0.5, 2.6, mats["conc"], bevel=0.05))
    parts["galv"].append(
        M.prism("mcccab", M.rect(CRANE_X + 1.4, CRANE_Y - 1.3,
                               CRANE_X + 4.6, CRANE_Y + 1.3),
                jib_z - 3.0, 3.0, mats["galv"], bevel=0.06))

    # Trolley and hook block, out over the deck where the load lands.
    parts["galv"].append(
        M.prism("mcctrolley", M.rect(CRANE_X + 26.0, CRANE_Y - 0.7,
                                   CRANE_X + 28.4, CRANE_Y + 0.7),
                jib_z - 0.7, 0.7, mats["galv"], bevel=0.03))
    parts["galv"].append(
        strut("mccrope", (CRANE_X + 27.2, CRANE_Y, jib_z - 0.7),
              (CRANE_X + 27.2, CRANE_Y, TOP + 2.5), 0.06, mats["galv"]))
    parts["galv"].append(
        M.prism("mcchook", M.rect(CRANE_X + 26.6, CRANE_Y - 0.4,
                                CRANE_X + 27.8, CRANE_Y + 0.4),
                TOP + 1.6, 0.9, mats["galv"], bevel=0.04))


    # ---- HOARDING, GATE AND THE STREET ----------------------------------
    #
    # The plot is 64 x 52 m now, so C's 22 m hoarding line does not fit it.
    # Named with C's prefixes so LAYER_RULES routes them to the street layer.
    hx0, hy0, hx1, hy1 = PODX0 - 3.5, PODY0 - 3.5, PODX1 + 3.5, PODY1 + 3.5
    for i in range(26):
        x = hx0 + i * (hx1 - hx0) / 26.0
        if -9.0 < x < 9.0:
            continue                     # the gate opening, on the street side
        parts["paint"].append(
            M.prism(f"hoard-s{i}", M.rect(x, hy0, x + (hx1 - hx0) / 26.0 - 0.12, hy0 + 0.16),
                    0.4, 2.4, mats["spandrel"], bevel=0.02))
    for i in range(20):
        y = hy0 + i * (hy1 - hy0) / 20.0
        for hx in (hx0, hx1):
            parts["paint"].append(
                M.prism(f"hoard-{'w' if hx < 0 else 'e'}{i}",
                        M.rect(hx, y, hx + 0.16, y + (hy1 - hy0) / 20.0 - 0.12),
                        0.4, 2.4, mats["spandrel"], bevel=0.02))

    # Gate posts either side of the opening.
    for gx in (-9.0, 9.0):
        parts["galv"].append(
            M.column(f"gate{int(gx)}", gx, hy0 + 0.08, 0.4, 3.0, 0.22, mats["galv"]))

    # Site content, from the same dressing library C uses, laid out for this
    # plot rather than C's. An empty site was the single largest cause of the
    # game-like read, and that finding does not stop applying because the
    # building got taller.
    D.dress(parts, mats, rng, PODX0 + 2, PODX1 - 2, PODY0 + 2, PODY1 - 2, pad_z=0.5)

    # ---- PEOPLE ----------------------------------------------------------
    # Scale is what a person gives a 106 m building, and nothing else does.
    for nm, x, y, z, face, pose in (
            ("wk-gate", -6.0, -27.5, 0.5, 0.4, "stand"),
            ("wk-yard", 14.0, -18.0, 0.5, 2.3, "carry"),
            ("wk-pod", -18.0, 6.0, 0.5, 1.1, "stand"),
            ("wk-path", 22.0, -31.0, 0.36, 3.1, "stand"),
            ("wk-deck", 6.0, -8.0, TOP + 0.06, 2.0, "signal")):
        w = H.worker(nm, mats, pose=pose, facing=face,
                     height=rng.uniform(1.68, 1.83), seed=int(abs(x) * 7))
        w.location = (x, y, z)
        parts.setdefault("people", []).append(w)

    build_streets(parts, mats)
    build_city(mats, empties)

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

    # AO on the authored geometry, after the join so the bake sees the whole
    # layer occluding itself rather than each part in isolation. People are
    # skipped: the five static figures are small, and the crowd carries its own
    # colour attribute from the VAT bake.
    for layer, objs in merged.items():
        if layer == "people":
            continue
        bake_vertex_ao(objs, with_ground=True, strength=0.9)

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
        # ACTIVE, not MATERIAL — learned on the crowd figure: "MATERIAL"
        # exports only colours the material graph is seen to consume and
        # silently writes nothing when the graph does not read them.
        "export_vertex_color": "ACTIVE",
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
