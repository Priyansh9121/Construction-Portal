"""
Real mesh construction for hero architecture.

WHY THIS REPLACES box()
-----------------------
Concept A proved that the renderer was never the bottleneck: EEVEE Next with
ray-traced shadows, procedural PBR and a physical sky rendered the same
assembled-cuboid frame and it still read as BIM. The modelling LANGUAGE was
the problem, not the pixels.

A cube has no architecture in it. Every wall is the same wall, every slab edge
is the same edge, and a re-entrant corner has to be faked by placing two cubes
next to each other -- which leaves a seam the eye reads instantly.

So hero geometry is built the way a building is drawn: a PLAN OUTLINE is
extruded into a solid, openings are cut through it, and edges are inset and
bevelled. That gives real topology -- a slab with an atrium through it is one
mesh with a hole, not four boxes around a gap.

WHAT box() IS STILL FOR
-----------------------
Placeholders, distant LOD, collision proxies and small support objects. It is
not the hero language any more.
"""

import math

import bmesh
import bpy
from mathutils import Vector


# ---------------------------------------------------------------------------
# Profiles
# ---------------------------------------------------------------------------

def prism(name, outline, z0, height, mat=None, bevel=0.0, segments=1):
    """
    Extrude a closed 2D outline into a solid.

    This is the primitive that replaces box(). An outline can have any number
    of corners, so an L-plate, a chamfered corner or a plate with a notch is
    ONE mesh with real edges rather than several cubes with seams.
    """
    bm = bmesh.new()
    verts = [bm.verts.new((float(x), float(y), float(z0))) for (x, y) in outline]
    face = bm.faces.new(verts)

    ret = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=moved, vec=(0.0, 0.0, float(height)))

    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()

    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    if mat:
        ob.data.materials.append(mat)
    if bevel > 0:
        m = ob.modifiers.new("bev", "BEVEL")
        m.width = bevel
        m.segments = segments
        m.limit_method = "ANGLE"
        m.angle_limit = math.radians(35)
        m.harden_normals = True
        for p in ob.data.polygons:
            p.use_smooth = True
    return ob


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def l_plate(x0, y0, x1, y1, notch_x, notch_y):
    """
    An L-shaped floor plate as ONE outline.

    The re-entrant corner is the point: it is the single cheapest way to stop
    a floor plate reading as an extruded rectangle, and it has to be a real
    corner in one mesh rather than two overlapping boxes.
    """
    return [(x0, y0), (x1, y0), (x1, notch_y), (notch_x, notch_y),
            (notch_x, y1), (x0, y1)]


def chamfered(x0, y0, x1, y1, c):
    """A plate with one cut corner -- the classic response to a street corner
    or a sight line, and instantly legible as a DESIGNED decision."""
    return [(x0 + c, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0 + c)]


def taper(outline, factor, cx=0.0, cy=0.0):
    """Scale an outline about a point, for setbacks up a tower."""
    return [((x - cx) * factor + cx, (y - cy) * factor + cy) for (x, y) in outline]


# ---------------------------------------------------------------------------
# Operations
# ---------------------------------------------------------------------------

def cut(target, cutter, keep_cutter=False):
    """
    Boolean difference, applied.

    This is how an atrium, a lift shaft, a loading bay or a stair void becomes
    a real hole through a slab instead of a gap between two boxes.
    """
    m = target.modifiers.new("cut", "BOOLEAN")
    m.operation = "DIFFERENCE"
    m.object = cutter
    m.solver = "EXACT"
    with bpy.context.temp_override(object=target, active_object=target,
                                   selected_objects=[target],
                                   selected_editable_objects=[target]):
        bpy.ops.object.modifier_apply(modifier=m.name)
    if not keep_cutter:
        bpy.data.objects.remove(cutter, do_unlink=True)
    return target


def inset_top(ob, depth, raise_by=0.0):
    """
    Inset the upward-facing faces and optionally lift them.

    Used for slab edge bands, parapet upstands and podium copings -- the small
    steps that give a horizontal edge a shadow line instead of a knife edge.
    """
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    up = [f for f in bm.faces if f.normal.z > 0.7]
    if up:
        res = bmesh.ops.inset_region(bm, faces=up, thickness=depth, depth=0.0,
                                     use_even_offset=True)
        if raise_by:
            moved = set()
            for f in up:
                for v in f.verts:
                    moved.add(v)
            bmesh.ops.translate(bm, verts=list(moved), vec=(0, 0, raise_by))
        del res
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def solidify(ob, thickness, offset=-1.0):
    m = ob.modifiers.new("sol", "SOLIDIFY")
    m.thickness = thickness
    m.offset = offset
    m.use_even_offset = True
    return ob


def array_along(ob, count, offset, use_object=None):
    m = ob.modifiers.new("arr", "ARRAY")
    m.count = count
    m.use_relative_offset = False
    m.use_constant_offset = True
    m.constant_offset_displace = offset
    return ob


def apply_all(ob):
    with bpy.context.temp_override(object=ob, active_object=ob,
                                   selected_objects=[ob],
                                   selected_editable_objects=[ob]):
        for m in list(ob.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=m.name)
            except RuntimeError:
                pass
    return ob


# ---------------------------------------------------------------------------
# Architectural components
# ---------------------------------------------------------------------------

def slab(name, outline, z, thickness, mat, voids=(), edge_band=0.0):
    """
    A floor plate: one mesh, with real openings cut through it.

    `voids` are (x0, y0, x1, y1) rectangles -- atriums, cores, stair and lift
    shafts, service risers. A plate with a hole through it is the clearest
    single signal that a building has been DESIGNED rather than extruded.
    """
    ob = prism(name, outline, z - thickness, thickness, mat, bevel=0.02)
    for (vx0, vy0, vx1, vy1) in voids:
        cutter = prism(f"{name}-void", rect(vx0, vy0, vx1, vy1),
                       z - thickness - 1.0, thickness + 2.0)
        cut(ob, cutter)
    if edge_band:
        inset_top(ob, edge_band)
    return ob


def wall(name, a, b, height, thickness, mat, z=0.0, bevel=0.02):
    """A wall between two plan points, as a real extruded solid."""
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    ln = math.hypot(dx, dy)
    if ln < 1e-4:
        return None
    nx, ny = -dy / ln * thickness / 2, dx / ln * thickness / 2
    outline = [(ax + nx, ay + ny), (bx + nx, by + ny),
               (bx - nx, by - ny), (ax - nx, ay - ny)]
    return prism(name, outline, z, height, mat, bevel=bevel)


def column(name, x, y, z, height, size, mat, chamfer=0.03):
    """A column with chamfered arrises -- the formwork chamfer strip that
    every cast column on earth has, and that no cube has."""
    h = size / 2
    c = chamfer
    outline = [(x - h + c, y - h), (x + h - c, y - h), (x + h, y - h + c),
               (x + h, y + h - c), (x + h - c, y + h), (x - h + c, y + h),
               (x - h, y + h - c), (x - h, y - h + c)]
    return prism(name, outline, z, height, mat)


def stair_core(name, x0, y0, x1, y1, z0, height, mat, wall_t=0.25):
    """A core as four real walls around a void, not a solid block. Seen from
    above or through an open floor it has an INSIDE, which a cube does not."""
    parts = []
    for (a, b) in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)),
                   ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
        w = wall(f"{name}-w", a, b, height, wall_t, mat, z=z0)
        if w:
            parts.append(w)
    return parts


def parapet(name, outline, z, height, thickness, mat):
    """An upstand around a slab edge: outer prism minus an inner one."""
    ob = prism(name, outline, z, height, mat, bevel=0.02)
    inner = taper(outline, 1.0)
    shrunk = []
    cx = sum(p[0] for p in outline) / len(outline)
    cy = sum(p[1] for p in outline) / len(outline)
    for (x, y) in inner:
        vx, vy = x - cx, y - cy
        ln = math.hypot(vx, vy) or 1.0
        shrunk.append((x - vx / ln * thickness, y - vy / ln * thickness))
    cutter = prism(f"{name}-in", shrunk, z - 0.5, height + 1.0)
    return cut(ob, cutter)


def facade_bay(name, a, b, z, storey_h, mat_glass, mat_frame, mullions=3):
    """
    A curtain-wall bay: glazing set BACK behind a frame, with mullions.

    The recess is the whole point. Glazing flush with the structure reads as a
    coloured face; glazing 200 mm behind a mullion grid reads as a facade,
    because the reveal casts a shadow that moves with the sun.
    """
    parts = []
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    ln = math.hypot(dx, dy)
    if ln < 0.3:
        return parts
    ux, uy = dx / ln, dy / ln
    nx, ny = -uy, ux

    glass = wall(f"{name}-g", (ax + nx * 0.22, ay + ny * 0.22),
                 (bx + nx * 0.22, by + ny * 0.22), storey_h * 0.78, 0.05,
                 mat_glass, z=z + storey_h * 0.12, bevel=0.0)
    if glass:
        parts.append(glass)
    for i in range(mullions + 1):
        t = i / mullions
        px, py = ax + dx * t, ay + dy * t
        m = wall(f"{name}-m", (px - ux * 0.05, py - uy * 0.05),
                 (px + ux * 0.05, py + uy * 0.05), storey_h, 0.14, mat_frame, z=z)
        if m:
            parts.append(m)
    head = wall(f"{name}-h", a, b, 0.22, 0.2, mat_frame, z=z + storey_h * 0.9)
    if head:
        parts.append(head)
    return parts


def ribbon(name, x0, x1, section, mat=None):
    """
    A long surface extruded along X from a CROSS-SECTION.

    `section` is a list of (y, z) points read left to right across the strip.
    This is how a real street is described -- a crown at the centre, a fall to
    the gutter, a kerb upstand, a footpath falling back toward it -- and it
    produces genuine slopes instead of the stepped boxes a stack of flat
    prisms gives.

    The whole street corridor is one mesh, so there are no seams between road,
    gutter, kerb and pavement where a camera at eye height would find them.
    """
    verts, faces = [], []
    n = len(section)
    for (y, z) in section:
        verts.append((x0, y, z))
        verts.append((x1, y, z))
    for i in range(n - 1):
        a = i * 2
        faces.append((a, a + 1, a + 3, a + 2))
    # Close the underside so the strip is a solid, not a sheet: a one-sided
    # ribbon shows its back face the moment the camera drops below it.
    base = len(verts)
    for (y, _z) in section:
        verts.append((x0, y, -0.6))
        verts.append((x1, y, -0.6))
    for i in range(n - 1):
        a = base + i * 2
        faces.append((a + 2, a + 3, a + 1, a))
    for (i0, i1) in ((0, base), (n * 2 - 2, base + n * 2 - 2)):
        faces.append((i0, i0 + 1, i1 + 1, i1))
    for side in (0, 1):
        for i in range(n - 1):
            a = i * 2 + side
            b = (i + 1) * 2 + side
            c = base + (i + 1) * 2 + side
            d = base + i * 2 + side
            faces.append((a, b, c, d) if side == 0 else (d, c, b, a))

    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    if mat:
        ob.data.materials.append(mat)
    return ob
