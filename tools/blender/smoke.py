"""
Smallest possible proof that BLENDER -> GLB -> APPLICATION actually works.

Deliberately trivial: one bevelled box, one material, one export. If this
fails, no amount of hero modelling is worth writing. It exercises every part
of the contract the real assets depend on -- reset, material, bevel with
hardened normals, modifier apply, origin-to-ground, export argument filtering,
measurement and validation.

    /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/smoke.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_build as B


def main():
    B.reset_scene()
    steel = B.material("test-steel", B.srgb(0xB4B8BC), metallic=1.0,
                       roughness=0.42)
    ob = B.box("smoke", (2.0, 1.0, 3.0), loc=(0, 0, 1.5), mat=steel,
               bevel=0.04, segments=2)
    ob = B.join("smoke", [ob])
    B.set_origin_to_ground(ob)

    stats = B.export_glb(ob, os.path.join(B.ASSET_DIR, "smoke.glb"))
    # 2 m wide, 3 m tall, 1 m deep once the exporter has rotated to Y-up.
    B.validate(stats, max_triangles=400, expect_size=(2.0, 3.0, 1.0))
    print(f"OK  {stats['file']}  {stats['triangles']} tris  "
          f"{stats['bytes']} bytes  size {stats['size_m']}  "
          f"materials {stats['materials']}")


main()
