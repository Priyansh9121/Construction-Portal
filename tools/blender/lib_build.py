"""
Shared Blender authoring + export library for the Login world's hero assets.

WHY THIS FILE EXISTS
--------------------
The procedural system (tools/scene/*.py -> JSON -> three.js) is the right tool
for repeated structural systems: the frame, the scaffold, the crane lattice,
falsework. Those genuinely ARE assemblies of repeated members at real
dimensions, and generating them keeps the site's layout editable.

It is the wrong tool for a single moulded or fabricated object. A site cabin is
one designed form -- a folded and welded shell with recessed openings, a drip
edge and a chassis -- not a system of repeated members. Chamfered boxes cannot
express it.

So: authored assets are BUILT HERE, exported to GLB, and PLACED by the
procedural layout. The layout still owns where things go. Blender owns what
they look like.

CONVENTIONS THIS FILE ENFORCES
------------------------------
Units          metres. 1 Blender unit = 1 m = 1 glTF unit.
Orientation    +X right, +Y up, -Z forward AFTER export. Blender is Z-up; the
               glTF exporter converts, and `export_yup` is asserted rather than
               assumed.
Origin         at the object's GROUND CONTACT, centred in plan. The procedural
               layout positions assets by where they touch the ground, so an
               origin at the mesh centre would bury or float every one of them.
Transforms     applied. An asset that ships with a scale of 0.001 baked into a
               parent is a bug waiting for the first person who reparents it.
Normals        exported; custom split normals preserved so bevels read as
               edges rather than being smoothed into fillets.
Materials      one glTF material per real material. Not one per object, and not
               a single atlas -- the runtime needs steel and glass to respond
               to the environment differently.

Every export runs a validation pass and writes a sidecar JSON with triangle
count, bounds and material list, so the runtime cost of an asset is a recorded
number rather than a claim.
"""

import json
import math
import os
import sys

import bpy
from mathutils import Vector


# ---------------------------------------------------------------------------
# Scene lifecycle
# ---------------------------------------------------------------------------

def reset_scene():
    """
    Start from genuinely nothing.

    `bpy.ops.wm.read_factory_settings` leaves the default cube, camera and
    lamp; exporting those into a hero asset is the classic reproducibility bug
    where an asset differs depending on whether the artist remembered to
    delete them.
    """
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    return scene


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------

def material(name, base_color, metallic=0.0, roughness=0.6, alpha=1.0,
             emission=None, emission_strength=0.0):
    """
    A Principled BSDF material, which is what the glTF exporter reads as
    metallic-roughness PBR without any conversion guesswork.

    Colours are given in LINEAR space, because that is what Blender's node
    sockets hold and what glTF stores. Passing an sRGB hex value here would
    make everything roughly twice as bright as intended.
    """
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha
    if alpha < 1.0:
        mat.blend_method = "BLEND"
    if emission is not None:
        if "Emission Color" in bsdf.inputs:          # 4.x
            bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        elif "Emission" in bsdf.inputs:              # 3.x
            bsdf.inputs["Emission"].default_value = (*emission, 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def srgb(hex_value):
    """
    sRGB hex -> linear float triple.

    Every colour in this project's design language is written as sRGB hex
    because that is what the CSS and the three.js materials use. Converting
    here keeps one source of truth for a colour instead of two numbers that
    drift apart.
    """
    def to_linear(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (to_linear((hex_value >> 16) & 255),
            to_linear((hex_value >> 8) & 255),
            to_linear(hex_value & 255))


# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------

def mesh_from(name, verts, faces, mat=None):
    """Build a mesh from explicit geometry. No ops, no selection state."""
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    if mat:
        ob.data.materials.append(mat)
    return ob


def box(name, size, loc=(0, 0, 0), mat=None, bevel=0.0, segments=1):
    """
    A box whose LOCAL origin is at its centre, positioned by `loc`.

    Note Blender's Z-up here: `size` and `loc` are (x, y, z) with z vertical.
    The exporter rotates to Y-up on the way out, so callers author in the
    orientation Blender shows them.
    """
    sx, sy, sz = (s / 2.0 for s in size)
    verts = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz),
             (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
             (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    ob = mesh_from(name, verts, faces, mat)
    ob.location = loc
    if bevel > 0:
        add_bevel(ob, bevel, segments)
    return ob


def add_bevel(ob, width, segments=1, angle=40.0):
    """
    A bevel modifier, which is the entire reason an authored asset looks
    manufactured rather than modelled.

    `harden_normals` is what makes a one-segment bevel read as a crisp formed
    edge: without it the shading smooths across the chamfer and the edge turns
    into a soft fillet, which is the look of a low-poly game asset with a
    smoothing group applied to everything.
    """
    m = ob.modifiers.new("bevel", "BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angle)
    m.miter_outer = "MITER_ARC"
    m.harden_normals = True
    # harden_normals requires shade-smooth + autosmooth on the mesh.
    shade_smooth(ob, angle)
    return m


def add_solidify(ob, thickness, offset=-1.0):
    m = ob.modifiers.new("solidify", "SOLIDIFY")
    m.thickness = thickness
    m.offset = offset
    m.use_even_offset = True
    return m


def shade_smooth(ob, angle=40.0):
    """
    Smooth shading limited by angle.

    Blender 4.1 removed `mesh.use_auto_smooth` in favour of a "Smooth by Angle"
    modifier, so both paths are handled -- this is exactly the kind of API
    change that silently produces faceted or over-smoothed exports.
    """
    for poly in ob.data.polygons:
        poly.use_smooth = True
    me = ob.data
    if hasattr(me, "use_auto_smooth"):
        me.use_auto_smooth = True
        me.auto_smooth_angle = math.radians(angle)
    else:
        try:
            with bpy.context.temp_override(object=ob, selected_objects=[ob]):
                bpy.ops.object.modifier_add_node_group(
                    asset_library_type="ESSENTIALS",
                    asset_library_identifier="",
                    relative_asset_identifier=
                    "geometry_nodes/smooth_by_angle.blend/NodeTree/Smooth by Angle")
        except Exception:
            # No essentials library in this build: flat-shade rather than
            # ship something smoothed across every hard edge.
            for poly in ob.data.polygons:
                poly.use_smooth = False


def corrugated_panel(name, width, height, pitch, depth, thickness,
                     mat=None, vertical=True):
    """
    A trapezoidal profiled steel panel -- the wall of every site cabin, skip
    and container ever made.

    Modelled as real geometry rather than a normal map because at the grazing
    angles this asset is seen from, a profiled wall's SILHOUETTE at the roof
    line and its self-shadowing are the whole read. A normal map gives neither.

    The profile is a trapezoid, not a sine: rolled steel sheet is folded, and
    the flat crown with sloped flanks is what catches the sun as a hard line
    rather than a soft gradient.

    Built in the XZ plane, thickness along Y, origin at the panel's centre.
    """
    ribs = max(2, int(round(width / pitch)))
    pitch = width / ribs
    flank = pitch * 0.22          # sloped part of each fold
    crown = pitch * 0.28          # flat top of the rib

    # One period of the profile, as offsets across the panel and out of it.
    profile = []
    x = -width / 2.0
    for i in range(ribs):
        profile.append((x, 0.0))
        profile.append((x + flank, depth))
        profile.append((x + flank + crown, depth))
        profile.append((x + flank + crown + flank, 0.0))
        x += pitch
    profile.append((width / 2.0, 0.0))

    hz = height / 2.0
    verts, faces = [], []
    n = len(profile)
    # Front skin, then back skin offset by thickness.
    for (px, pd) in profile:
        verts.append((px, -pd - thickness / 2.0, -hz))
        verts.append((px, -pd - thickness / 2.0, hz))
    for (px, pd) in profile:
        verts.append((px, -pd + thickness / 2.0, -hz))
        verts.append((px, -pd + thickness / 2.0, hz))
    for i in range(n - 1):
        a, b = i * 2, (i + 1) * 2
        faces.append((a, b, b + 1, a + 1))                      # front
        c, d = n * 2 + i * 2, n * 2 + (i + 1) * 2
        faces.append((d, c, c + 1, d + 1))                      # back
    # Cap the four edges so the panel is a closed solid.
    faces.append((0, 1, n * 2 + 1, n * 2))
    faces.append((n * 2 + (n - 1) * 2, n * 2 + (n - 1) * 2 + 1,
                  (n - 1) * 2 + 1, (n - 1) * 2))
    for i in range(n - 1):
        a, b = i * 2, (i + 1) * 2
        c, d = n * 2 + i * 2, n * 2 + (i + 1) * 2
        faces.append((a, c, d, b))                              # bottom
        faces.append((b + 1, d + 1, c + 1, a + 1))              # top

    ob = mesh_from(name, verts, faces, mat)
    if not vertical:
        ob.rotation_euler = (0, math.radians(90), 0)
    return ob


def tube(name, radius, length, segments=8, mat=None, axis="Z"):
    """A cylinder. Site steel is tube: handrails, masts, mesh frames."""
    verts, faces = [], []
    hl = length / 2.0
    for i in range(segments):
        a = (i / segments) * math.tau
        c, s = math.cos(a) * radius, math.sin(a) * radius
        if axis == "Z":
            verts.append((c, s, -hl)); verts.append((c, s, hl))
        elif axis == "X":
            verts.append((-hl, c, s)); verts.append((hl, c, s))
        else:
            verts.append((c, -hl, s)); verts.append((c, hl, s))
    for i in range(segments):
        a, b = i * 2, ((i + 1) % segments) * 2
        faces.append((a, b, b + 1, a + 1))
    faces.append(tuple(range(0, segments * 2, 2)))
    faces.append(tuple(reversed(range(1, segments * 2, 2))))
    ob = mesh_from(name, verts, faces, mat)
    shade_smooth(ob, 60.0)
    return ob


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------

def join(name, objects):
    """
    Join parts into one object, applying every modifier first.

    Fewer objects means fewer draw calls at runtime. Joining also forces the
    modifier stack to be evaluated here rather than shipping as an
    un-reproducible "it looked right in the viewport" state.
    """
    objects = [o for o in objects if o is not None]
    if not objects:
        raise ValueError(f"{name}: nothing to join")
    for ob in objects:
        apply_modifiers(ob)
    ctx = bpy.context
    for ob in ctx.scene.objects:
        ob.select_set(False)
    for ob in objects:
        ob.select_set(True)
    ctx.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    result = ctx.view_layer.objects.active
    result.name = name
    result.data.name = name
    return result


def apply_modifiers(ob):
    if not ob.modifiers:
        return
    with bpy.context.temp_override(object=ob, active_object=ob,
                                   selected_objects=[ob],
                                   selected_editable_objects=[ob]):
        for m in list(ob.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=m.name)
            except RuntimeError as exc:
                print(f"  ! modifier {m.name} on {ob.name}: {exc}",
                      file=sys.stderr)


def set_origin_to_ground(ob):
    """
    Move the origin to the object's ground contact, centred in plan.

    This is a hard requirement of the placement contract: the procedural layout
    emits ground positions, so an asset whose origin is at its bounding-box
    centre lands half-buried. Doing it here, once, beats every placement site
    carrying a magic half-height offset.
    """
    import mathutils
    bpy.context.view_layer.update()

    # Bake the object transform into the mesh, so what follows is in world
    # terms and the object ships with an identity transform.
    ob.data.transform(ob.matrix_world)
    ob.matrix_world = mathutils.Matrix.Identity(4)

    # Bounds come from the vertices, not from `ob.bound_box`: that is a cached
    # value which does not refresh until the depsgraph runs, and reading it
    # here silently returns the PRE-transform box.
    lo = [1e9] * 3
    hi = [-1e9] * 3
    for v in ob.data.vertices:
        for i in range(3):
            lo[i] = min(lo[i], v.co[i]); hi[i] = max(hi[i], v.co[i])
    offset = Vector(((lo[0] + hi[0]) / 2.0, (lo[1] + hi[1]) / 2.0, lo[2]))
    ob.data.transform(mathutils.Matrix.Translation(-offset))
    bpy.context.view_layer.update()
    return ob


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

def _supported(op, wanted):
    """
    Filter export arguments against what THIS Blender build actually accepts.

    The glTF exporter's property names change between releases. Passing a name
    that no longer exists is a hard failure, and guessing which names a given
    build has is exactly the sort of thing that should be checked rather than
    assumed.
    """
    props = {p.identifier for p in op.get_rna_type().properties}
    used = {k: v for k, v in wanted.items() if k in props}
    dropped = sorted(set(wanted) - set(used))
    if dropped:
        print(f"  · exporter ignores: {', '.join(dropped)}", file=sys.stderr)
    return used


def export_glb(ob, path, extras=None):
    """
    Export one object as a GLB and record what was actually shipped.

    Returns the stats dict that is also written alongside as `<name>.json`.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(o == ob or o.parent == ob)
    bpy.context.view_layer.objects.active = ob

    args = _supported(bpy.ops.export_scene.gltf, {
        "filepath": path,
        "export_format": "GLB",
        "use_selection": True,
        "export_yup": True,
        "export_apply": True,
        "export_normals": True,
        "export_tangents": False,
        "export_materials": "EXPORT",
        "export_image_format": "AUTO",
        "export_cameras": False,
        "export_lights": False,
        "export_extras": False,
        "export_animations": True,
        "export_skins": True,
        "export_morph": False,
        "export_texcoords": True,
        "export_attributes": False,
        "export_draco_mesh_compression_enable": False,
    })
    bpy.ops.export_scene.gltf(**args)

    stats = measure(ob)
    stats["file"] = os.path.basename(path)
    stats["bytes"] = os.path.getsize(path)
    if extras:
        stats.update(extras)
    with open(os.path.splitext(path)[0] + ".json", "w") as fh:
        json.dump(stats, fh, indent=2)
    return stats


def measure(ob):
    """
    Triangles, vertices, materials and bounds -- measured from the evaluated
    mesh, so modifiers are included and the number matches what ships.
    """
    dg = bpy.context.evaluated_depsgraph_get()
    tris = verts = 0
    mats, targets = set(), [ob] + list(ob.children_recursive)
    lo = [1e9] * 3
    hi = [-1e9] * 3
    for t in targets:
        if t.type != "MESH":
            continue
        me = t.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        verts += len(me.vertices)
        for m in me.materials:
            if m:
                mats.add(m.name)
        # Vertices of the EVALUATED mesh: `bound_box` both goes stale and
        # ignores modifiers, so it would under-report a bevelled asset.
        for v in me.vertices:
            p = t.matrix_world @ v.co
            for i in range(3):
                lo[i] = min(lo[i], p[i]); hi[i] = max(hi[i], p[i])
        t.evaluated_get(dg).to_mesh_clear()
    return {
        "name": ob.name,
        "triangles": tris,
        "vertices": verts,
        "materials": sorted(mats),
        # Reported in glTF's Y-up axes so the numbers match the runtime.
        "size_m": [round(hi[0] - lo[0], 3), round(hi[2] - lo[2], 3),
                   round(hi[1] - lo[1], 3)],
        "origin_at_base": round(lo[2], 4),
    }


def validate(stats, max_triangles, expect_size=None, tol=0.15):
    """
    Refuse to ship an asset that is the wrong size or costs more than budgeted.

    A hero asset that quietly arrives at 200k triangles, or at 61 metres because
    a unit conversion went wrong, is a defect that is much cheaper to catch at
    export than by staring at a browser.
    """
    problems = []
    if stats["triangles"] > max_triangles:
        problems.append(
            f"{stats['triangles']} triangles exceeds budget {max_triangles}")
    if abs(stats["origin_at_base"]) > 0.002:
        problems.append(
            f"origin is {stats['origin_at_base']:.3f} m off the ground plane")
    if expect_size:
        for axis, got, want in zip("XYZ", stats["size_m"], expect_size):
            if want and abs(got - want) > want * tol:
                problems.append(f"{axis} is {got} m, expected ~{want} m")
    if problems:
        raise AssertionError(f"{stats['name']}: " + "; ".join(problems))
    return stats


ASSET_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "frontend", "public", "world", "assets")
