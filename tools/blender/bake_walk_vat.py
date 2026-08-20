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


def bake(frames=24, out_dir=None):
    L.reset()
    mats = L.standard_materials(wear=0.6)

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
        export_cameras=False, export_lights=False, export_animations=False)

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
