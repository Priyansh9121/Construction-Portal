"""
Emit web-resolution copies of the CC0 maps, once, for runtime delivery.

WHY TEXTURES ARE NOT EMBEDDED IN THE GLBs
-----------------------------------------
Embedding put a full copy of every map into every layer that used it: the
street layer alone reached 14.9 MB and the set totalled about 30 MB. The same
concrete image was shipped four times.

Shipping each map ONCE and attaching it at runtime by material name gives:

  - one copy, cached by the browser across all layers
  - per-device resolution control, so a phone need not fetch desktop maps
  - geometry GLBs that stay small and load first

The GLBs still carry the UVs, so this is real glTF PBR with an external
texture, not a return to runtime triplanar.

    Blender -b -P tools/blender/prep_web_textures.py
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import concept_lib as L

OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "frontend", "public", "world", "textures", "cc0")

# 512 for a surface read at 10-40 m through a 2.4 m tile is ~210 px/m, which is
# more than the camera resolves. 1K was authoring resolution, not delivery.
WEB_SIZE = 512


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name in sorted(os.listdir(L.CC0_DIR)):
        if not name.endswith(".jpg"):
            continue
        img = bpy.data.images.load(os.path.join(L.CC0_DIR, name), check_existing=False)
        img.scale(WEB_SIZE, WEB_SIZE)
        img.file_format = "JPEG"
        # Normals are data: quality must stay high or the surface shimmers.
        bpy.context.scene.render.image_settings.quality = 92 if "normal" in name else 84
        out = os.path.join(OUT, name)
        img.filepath_raw = out
        img.save()
        bpy.data.images.remove(img)
        size = os.path.getsize(out)
        total += size
        print(f"OK  {name:26s} {WEB_SIZE}px  {size / 1024:6.0f} KB")
    print(f"OK  TOTAL web texture payload {total / 1024:.0f} KB")


main()
