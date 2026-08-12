"""
Bake the Blender procedural materials down to real PBR image maps.

WHY THIS EXISTS
---------------
glTF cannot carry a node tree. Every surface in the concept scene is a
procedural graph -- formwork lift lines, pour-to-pour colour steps, run-off
staining, worked roughness -- and the production GLBs currently ship flat
constants in their place, which is why the world still reads as a clean
untextured model.

WHY SWATCHES, NOT PER-OBJECT BAKES
----------------------------------
The obvious approach is to UV-unwrap every production mesh and bake each one.
That is the wrong trade here:

  - it needs a good unwrap on hundreds of joined faces, and a bad unwrap
    shows as stretching, which is one of the failure modes M4 explicitly
    tests for
  - the texel density would vary wildly between a 34 m party wall and a
    600 mm column
  - it produces unique, un-reusable maps and a large payload

Instead each MATERIAL is baked once onto a flat plane of known world size, so
the result is a swatch with a real metre scale. The runtime then projects it
TRIPLANAR -- sampling three times in world space and blending by the surface
normal -- so there are no UVs to stretch, no seams to line up, and one swatch
is correct on a column, a soffit and a road at the same time.

The procedural materials already sample world-space Position, so a plane
spanning TILE metres at the origin bakes exactly TILE metres of surface.

LIGHTING IS NEVER BAKED IN
--------------------------
Diffuse bake with direct and indirect contributions OFF. The world has a real
sun that moves and will later have a moon, so any light baked into albedo
would be wrong within the hour.

    Blender -b -P tools/blender/bake_materials.py
"""

import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import concept_lib as L

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "frontend", "public", "world", "textures")

# One tile is 4 m of real surface. Big enough that repetition is not obvious
# under triplanar blending, small enough that 512 px still gives 128 px/m --
# ample for surfaces read at 10-40 m.
TILE = 4.0

# Which materials get maps, and at what resolution.
#
# Resolution follows how close the camera gets and how much screen the surface
# covers, not a blanket default. Concrete is the building, so it gets the most;
# the road is large but always oblique; brick is mid-distance.
PLAN = [
    ("conc",       1024, "concrete"),
    ("wet",         512, "wet concrete"),
    ("earth",       512, "compacted site ground"),
    ("ply",         512, "plywood formwork"),
    ("city_warm",   512, "neighbour masonry, warm"),
    ("city_cool",   512, "neighbour render, cool"),
    ("spandrel",    512, "asphalt carriageway"),
]


def make_plane(material):
    """A TILE-metre plane at the origin, carrying the material to be baked."""
    bpy.ops.mesh.primitive_plane_add(size=TILE, location=(0, 0, 0))
    ob = bpy.context.active_object
    ob.data.materials.clear()
    ob.data.materials.append(material)
    return ob


def bake_channel(ob, material, kind, size, path):
    """
    Bake one channel to a file.

    Cycles is the only engine that bakes, and DIFFUSE with direct and indirect
    switched off is the correct way to get albedo alone -- `EMIT` would need
    the tree rewired and `COMBINED` would bake the lamp into the colour.
    """
    image = bpy.data.images.new(f"bake-{kind}", size, size,
                                alpha=False, float_buffer=False)
    # Normal and roughness are DATA, not colour. Tagging them sRGB here is the
    # classic way to end up with a washed-out roughness map that no amount of
    # material tuning fixes.
    image.colorspace_settings.name = "sRGB" if kind == "albedo" else "Non-Color"

    nt = material.node_tree
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.select = True
    nt.nodes.active = tex

    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 24 if kind == "normal" else 16
    sc.cycles.use_denoising = False
    sc.render.bake.margin = 24
    sc.render.bake.use_clear = True

    if kind == "albedo":
        sc.render.bake.use_pass_direct = False
        sc.render.bake.use_pass_indirect = False
        sc.render.bake.use_pass_color = True
        bpy.ops.object.bake(type="DIFFUSE")
    elif kind == "roughness":
        bpy.ops.object.bake(type="ROUGHNESS")
    else:
        sc.render.bake.normal_space = "TANGENT"
        bpy.ops.object.bake(type="NORMAL")

    # JPEG for colour and roughness, PNG for normals: JPEG's chroma subsampling
    # mangles the per-channel precision a normal map depends on, and a bad
    # normal reads as shimmering rather than as compression.
    if kind == "normal":
        image.file_format = "PNG"
        out = f"{path}.png"
    else:
        image.file_format = "JPEG"
        image.filepath_raw = f"{path}.jpg"
        sc.render.image_settings.quality = 88
        out = f"{path}.jpg"
    image.filepath_raw = out
    image.save()
    nt.nodes.remove(tex)
    bpy.data.images.remove(image)
    return out


def main():
    L.reset()
    os.makedirs(OUT, exist_ok=True)
    mats = L.standard_materials(wear=0.72)

    # A neutral world so nothing tints an albedo bake.
    world = bpy.data.worlds.new("bake")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.0
    bpy.context.scene.world = world

    total = 0
    for key, size, label in PLAN:
        mat = mats[key]
        ob = make_plane(mat)
        for kind in ("albedo", "roughness", "normal"):
            path = os.path.join(OUT, f"{key}-{kind}")
            # Normals stay at 512 regardless: they describe micro relief, and
            # a 1024 PNG normal cost 1.8 MB for detail no camera resolves.
            res = 512 if kind == "normal" else size
            out = bake_channel(ob, mat, kind, res, path)
            total += os.path.getsize(out)
            print(f"OK  {os.path.basename(out):28s} {res}px  "
                  f"{os.path.getsize(out) / 1024:6.0f} KB   {label}")

        bpy.data.objects.remove(ob, do_unlink=True)

    print(f"OK  TOTAL texture payload {total / 1024:.0f} KB  "
          f"tile = {TILE} m")


main()
