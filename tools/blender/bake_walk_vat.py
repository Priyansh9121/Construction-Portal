"""
BAKE A WALK CYCLE INTO A VERTEX ANIMATION TEXTURE

    Blender -b -P tools/blender/bake_walk_vat.py -- [--frames 24] [--out DIR]

WHY A TEXTURE AND NOT A SKELETON
--------------------------------
A crowd is the difference between a dozen figures and a thousand, and per-figure
skeletal animation is what decides which you get: every skinned character is its
own draw call, its own bone matrices and its own CPU update. A vertex animation
texture moves the whole problem to the GPU — one mesh, one instanced draw, and a
texture lookup in the vertex shader that says where this vertex is at this
moment of the cycle.

The requirement it puts on the mesh is absolute: TOPOLOGY MUST NOT CHANGE across
the cycle. A texture of vertex positions has no way to describe a mesh whose
vertex count changed between frames, so `human.worker()` gained a `phase`
argument that moves the same limb targets its poses already move, and this
script asserts the vertex count is identical at every phase rather than assuming
it.

WHY IT SHIPS AS ITS OWN FILE
----------------------------
`build_assets.sh` exports every GLB with `export_image_format: "NONE"`, which is
the mechanism that took the street layer from 11.49 MB to 0.91 MB. It would
strip a VAT out of `login-site-people.glb` exactly as readily as it strips a
concrete map, and the result would be a crowd whose animation data silently did
not ship.

So the VAT is written to `frontend/public/world/textures/` and fetched at
runtime, the same way the CC0 surface maps are — and its decode bounds are
written beside it as JSON, because an 8-bit texture is meaningless without the
range it was normalised into.

THE ENCODING
------------
One texel per vertex per frame: width = vertex count, height = frame count.
RGB carries the position, normalised into the mesh's own animated bounding box
and quantised to 8 bits per axis.

8 bits over a figure ~1.8 m tall is about 8 mm of quantisation, which is a
third of a pixel at the distance a crowd is seen from. If that ever shows, the
upgrade is to split each axis across two channels rather than to add frames.
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy

import concept_lib as L
import human as H



def flatten_to_vertex_colours(ob, mats):
    """Collapse a multi-material figure to ONE material carrying vertex colours.

    A worker is forty pixels tall in the frame this crowd exists for, and four
    material slots on a body that size buys nothing while costing everything:
    four glTF primitives, four sets of accessors, four draw calls per figure,
    and four vertex animation textures to keep in step with them.

    So each material's base colour is written into the mesh's colour attribute
    and every slot is replaced by one. The look is preserved — hi-vis stays
    hi-vis — and the body becomes a single primitive.
    """
    me = ob.data

    def base_colour(mat):
        """The colour a material actually renders, not the socket's default.

        concept_lib builds these procedurally: Base Color is LINKED to a mix
        that blends the material's own colour with a common grime, so the
        socket's `default_value` is an untouched 0.8 grey and so is
        `diffuse_color`. Reading either produced a crowd of 1596 vertices all
        carrying exactly (0.8, 0.8, 0.8) — which is what shipped, and what
        dumping the COLOR_0 accessor said in one line after two renders had
        failed to.

        So follow the link one level and read the mix's own inputs, blending by
        its factor to keep the weathering. One level is enough for every
        material this figure wears; anything deeper falls back rather than
        guessing.
        """
        if not mat:
            return (0.8, 0.8, 0.8, 1.0)
        if mat.use_nodes:
            for n in mat.node_tree.nodes:
                if n.type != "BSDF_PRINCIPLED":
                    continue
                inp = n.inputs["Base Color"]
                if not inp.is_linked:
                    return tuple(inp.default_value)
                src = inp.links[0].from_node
                c1 = src.inputs.get("Color1")
                c2 = src.inputs.get("Color2")
                fac = src.inputs.get("Fac")
                if c1 is not None and not c1.is_linked:
                    a = tuple(c1.default_value)
                    if (c2 is not None and not c2.is_linked
                            and fac is not None and not fac.is_linked):
                        f = float(fac.default_value)
                        b = tuple(c2.default_value)
                        return tuple(a[i] * (1 - f) + b[i] * f for i in range(4))
                    return a
        return tuple(mat.diffuse_color)

    slot_colour = [base_colour(sl.material) for sl in ob.material_slots] or [(0.8,) * 4]

    attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
    per_vert = [None] * len(me.vertices)
    for poly in me.polygons:
        col = slot_colour[min(poly.material_index, len(slot_colour) - 1)]
        for vi in poly.vertices:
            per_vert[vi] = col
    for vi, col in enumerate(per_vert):
        attr.data[vi].color = col or (0.8, 0.8, 0.8, 1.0)
    me.color_attributes.active_color = attr

    ob.data.materials.clear()
    ob.data.materials.append(mats["crowd_flat"])
    for poly in me.polygons:
        poly.material_index = 0
    return ob


def bake(frames=24, out_dir=None):
    L.reset()
    mats = L.standard_materials(wear=0.6)

    # The single slot the whole crowd wears. White base so the vertex colours
    # are the colour rather than a tint of one.
    flat = bpy.data.materials.new("crowd_flat")
    flat.use_nodes = True
    bsdf = next(n for n in flat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.82
    # The material has to READ the colour attribute, or the exporter has no
    # reason to write one: export_vertex_color="MATERIAL" means "export what
    # the material uses", and a constant Base Color uses nothing. The first
    # attempt shipped a figure with no COLOR_0 at all.
    cattr = flat.node_tree.nodes.new("ShaderNodeVertexColor")
    cattr.layer_name = "Col"
    flat.node_tree.links.new(cattr.outputs["Color"], bsdf.inputs["Base Color"])
    mats["crowd_flat"] = flat

    # ---- Sample the cycle ------------------------------------------------
    samples = []
    vcount = None
    for f in range(frames):
        ob = H.worker(f"vat{f}", mats, pose="walk", facing=0.0,
                      height=1.75, seed=0, phase=f / frames)
        me = ob.data
        if vcount is None:
            vcount = len(me.vertices)
        elif len(me.vertices) != vcount:
            raise SystemExit(
                f"topology changed at phase {f}: {len(me.vertices)} vertices "
                f"against {vcount} at phase 0. A VAT cannot encode that.")
        samples.append([tuple(v.co) for v in me.vertices])
        bpy.data.objects.remove(ob, do_unlink=True)

    print(f"VAT  {vcount} vertices x {frames} frames")

    # ---- THE ORDER THE RUNTIME WILL SEE ---------------------------------
    #
    # Blender's vertex order is NOT the glTF's. The exporter splits vertices by
    # normal and UV and welds others, and this mesh went from 456 vertices in
    # Blender to 374 in the GLB — so a texture indexed by Blender's order poses
    # every figure with somebody else's vertices. The crowd still looked
    # human, because it is the same cloud of points; the limbs were simply
    # wrong, and no counter would ever have said so.
    #
    # So the base mesh is exported FIRST, re-imported to read the order the
    # runtime will actually receive, and every frame is resampled through a
    # map from exported vertex to original vertex. They correspond exactly at
    # phase 0, which is what makes the map exact rather than nearest-fit.
    base = H.worker("crowd", mats, pose="walk", facing=0.0, height=1.75,
                    seed=0, phase=0.0)
    flatten_to_vertex_colours(base, mats)
    out_dir = out_dir or os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "frontend", "public", "world", "textures")
    os.makedirs(out_dir, exist_ok=True)
    glb = os.path.join(out_dir, "crowd-figure.glb")
    for o in bpy.context.scene.objects:
        o.select_set(o is base)
    bpy.context.view_layer.objects.active = base
    bpy.ops.export_scene.gltf(
        filepath=glb, export_format="GLB", use_selection=True,
        export_yup=True, export_apply=True, export_normals=True,
        export_materials="EXPORT", export_image_format="NONE",
        export_cameras=False, export_lights=False, export_animations=False,
        # ACTIVE, not MATERIAL. "MATERIAL" exports only colours the material
        # graph is seen to consume, and it declined to write COLOR_0 even with
        # a Vertex Color node wired into Base Color — the figure shipped with
        # no colour at all, twice. ACTIVE writes the mesh's active colour
        # attribute and does not depend on inferring intent from a node tree.
        export_vertex_color="ACTIVE", export_all_vertex_colors=False,
        export_texcoords=False)

    before = set(o.name for o in bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=glb)
    imported = [o for o in bpy.context.scene.objects
                if o.name not in before and o.type == "MESH"]
    if not imported:
        raise SystemExit("re-import produced no mesh; cannot learn the glTF order")

    # Blender's glTF IMPORTER converts Y-up back to Z-up on the way in, so the
    # re-imported mesh is already in the same space as the samples. Converting
    # again scrambled every match: 1662 of 1662 fell through to nearest-fit and
    # the bounds collapsed from 1.76 m tall to 0.27 m.
    key = {}
    for vi, v in enumerate(samples[0]):
        key.setdefault((round(v[0], 5), round(v[1], 5), round(v[2], 5)), vi)

    order = []
    misses = 0
    for imp in imported:
        for v in imp.data.vertices:
            blen = tuple(v.co)
            k = (round(blen[0], 5), round(blen[1], 5), round(blen[2], 5))
            vi = key.get(k)
            if vi is None:
                # Nearest, for a vertex the exporter nudged.
                misses += 1
                vi = min(range(len(samples[0])),
                         key=lambda j: (samples[0][j][0] - blen[0]) ** 2
                         + (samples[0][j][1] - blen[1]) ** 2
                         + (samples[0][j][2] - blen[2]) ** 2)
            order.append(vi)

    print(f"VAT  glTF order: {len(order)} vertices ({misses} matched by nearest)")
    samples = [[frame[i] for i in order] for frame in samples]
    vcount = len(order)
    for o in imported:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.objects.remove(base, do_unlink=True)

    # ---- Bounds, per axis, over the WHOLE cycle --------------------------
    lo = [min(p[i] for fr in samples for p in fr) for i in range(3)]
    hi = [max(p[i] for fr in samples for p in fr) for i in range(3)]
    span = [max(1e-6, hi[i] - lo[i]) for i in range(3)]
    print(f"VAT  bounds lo={[round(v, 3) for v in lo]} hi={[round(v, 3) for v in hi]}")

    # ---- Write the image -------------------------------------------------
    # Blender images are bottom-up and float RGBA; the PNG save quantises to
    # 8 bits per channel, which is the format the runtime decodes.
    img = bpy.data.images.new("walk_vat", width=vcount, height=frames,
                              alpha=False, float_buffer=False)
    px = [0.0] * (vcount * frames * 4)
    for fi, frame in enumerate(samples):
        for vi, p in enumerate(frame):
            o = (fi * vcount + vi) * 4
            px[o + 0] = (p[0] - lo[0]) / span[0]
            px[o + 1] = (p[1] - lo[1]) / span[1]
            px[o + 2] = (p[2] - lo[2]) / span[2]
            px[o + 3] = 1.0
    img.pixels = px

    path = os.path.join(out_dir, "walk-vat.png")
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()

    meta = {
        "vertices": vcount,
        "frames": frames,
        "lo": lo,
        "hi": hi,
        "note": "RGB is position normalised into [lo, hi] per axis. "
                "Row = frame, column = vertex. Y-up conversion is applied by "
                "the runtime, not here: these are Blender Z-up coordinates.",
    }
    with open(os.path.join(out_dir, "walk-vat.json"), "w") as fh:
        json.dump(meta, fh, indent=2)

    # ---- THE COUNT IS THE THING THAT SPEAKS ------------------------------
    #
    # Both of this pipeline's bugs were silent and both would have been caught
    # here. Blender's 456 vertices became 1662 in the GLB, and meshopt welded
    # 1662 back to 374 — in each case a texture indexed by one order was used
    # to pose a mesh in another, and the crowd still looked like people because
    # it was the same cloud of points. Nothing threw. Only the count disagreed.
    #
    # So the count is asserted against the FILE THAT SHIPS, by reading its
    # accessor back out of the GLB rather than trusting the exporter's report.
    with open(glb, "rb") as fh:
        blob = fh.read()
    j_len = int.from_bytes(blob[12:16], "little")
    gltf = json.loads(blob[20:20 + j_len])
    prims = [pr for m in gltf["meshes"] for pr in m["primitives"]]
    if len(prims) != 1:
        raise SystemExit(
            f"the figure exported as {len(prims)} primitives. A VAT indexes one "
            "vertex list; more than one primitive means more than one texture "
            "and a draw call each. Flatten it to a single material.")
    shipped = gltf["accessors"][prims[0]["attributes"]["POSITION"]]["count"]
    if shipped != vcount:
        raise SystemExit(
            f"VERTEX COUNT MISMATCH: the shipped GLB has {shipped} vertices and "
            f"the texture is {vcount} wide. Every figure would be posed with the "
            "wrong vertices, and it would still look like a person. Re-bake "
            "against the file that ships.")
    print(f"VAT  OK   shipped GLB {shipped} vertices == texture width {vcount}")

    png = os.path.getsize(path)
    gsz = os.path.getsize(glb)
    print(f"VAT  walk-vat.png     {png:>8} bytes  ({png / 1024:.1f} KB)")
    print(f"VAT  crowd-figure.glb {gsz:>8} bytes  ({gsz / 1024:.1f} KB)")
    print(f"VAT  TOTAL            {png + gsz:>8} bytes  "
          f"({(png + gsz) / 1024:.1f} KB) — the same for ten figures or ten thousand")
    return meta


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    frames = int(args[args.index("--frames") + 1]) if "--frames" in args else 24
    out = args[args.index("--out") + 1] if "--out" in args else None
    bake(frames=frames, out_dir=out)


if __name__ == "__main__":
    main()
