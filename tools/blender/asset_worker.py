"""
A site worker, for HUMAN SCALE.

WHY THIS IS AUTHORED, AND WHY IT IS NOT RIGGED
----------------------------------------------
The previous worker was five axis-aligned boxes. It established scale and
nothing else: it read as a marker, not a person, because a person's silhouette
is asymmetric and a stack of centred boxes never is.

The brief allows a small idle rig. This deliberately does not use one, and the
reason is measured rather than aesthetic: in the composed frame these figures
stand roughly 18-26 px tall. A weight-shift animation at that size moves
sub-pixel, so it would cost skinning, an animation mixer and a per-frame update
to deliver nothing visible -- while adding the exact risk the brief warns
about, since a badly-weighted idle is what makes a low-poly human uncanny.

What DOES read at 20 px is silhouette. So the budget goes there:

  - a stance with weight on one leg and the other set back, which is what
    breaks the "stack of boxes" symmetry
  - arms away from the body, so the torso has a gap either side of it
  - a hard hat with a real brim, the single most identifiable profile on a
    construction site
  - hi-vis over the shoulders and around the chest, which is what the eye
    actually locks onto

Three of these are placed at different yaws. Three believable workers beat
twenty NPCs, and the variety comes from orientation rather than from three
meshes doing nearly the same thing.

    /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/asset_worker.py
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_build as B

TALL = 1.78


def materials():
    return {
        # Hi-vis is retroreflective, so a little emission is physically
        # honest rather than a cheat: it is the one thing on a dusk site that
        # stays legible when everything around it has gone to silhouette.
        "hiviz": B.material("wk-hiviz", B.srgb(0xCBE034), 0.0, 0.62,
                            emission=B.srgb(0x59660E), emission_strength=0.55),
        "work": B.material("wk-work", B.srgb(0x2C3540), 0.0, 0.85),
        "boot": B.material("wk-boot", B.srgb(0x191B1E), 0.0, 0.7),
        "skin": B.material("wk-skin", B.srgb(0x8A6A52), 0.0, 0.78),
        "hat": B.material("wk-hat", B.srgb(0xE8E4DC), 0.0, 0.42),
    }


def limb(name, size, loc, mat, rot=(0, 0, 0), bevel=0.02):
    ob = B.box(name, size, loc, mat, bevel=bevel, segments=2)
    ob.rotation_euler = rot
    return ob


def figure(M):
    parts = []

    # ---- Legs: weight on the left, right set back and slightly turned ------
    parts.append(limb("thigh-l", (0.15, 0.17, 0.44), (-0.095, 0.0, 0.70), M["work"]))
    parts.append(limb("shin-l", (0.13, 0.14, 0.46), (-0.095, 0.005, 0.30), M["work"]))
    parts.append(limb("thigh-r", (0.15, 0.17, 0.44), (0.095, -0.055, 0.70), M["work"],
                      rot=(math.radians(-9), 0, 0)))
    parts.append(limb("shin-r", (0.13, 0.14, 0.46), (0.095, -0.115, 0.30), M["work"],
                      rot=(math.radians(-6), 0, 0)))
    for sx, dy in ((-1, 0.02), (1, -0.13)):
        parts.append(limb(f"boot{sx}", (0.14, 0.27, 0.11), (sx * 0.095, dy, 0.055),
                          M["boot"], bevel=0.025))

    # ---- Torso: workwear core with the hi-vis vest OVER it -----------------
    # Two shells rather than one coloured block. The vest stopping short of
    # the waist and the shoulders showing through is what makes it read as
    # clothing rather than as a painted stripe.
    parts.append(limb("torso", (0.38, 0.22, 0.52), (0, -0.01, 1.18), M["work"],
                      bevel=0.035))
    parts.append(limb("vest", (0.405, 0.245, 0.34), (0, -0.01, 1.24), M["hiviz"],
                      bevel=0.06))
    parts.append(limb("collar", (0.44, 0.27, 0.06), (0, -0.01, 1.42), M["hiviz"],
                      bevel=0.02))

    # ---- Arms: away from the body, one bent as if holding something --------
    parts.append(limb("arm-l", (0.11, 0.13, 0.30), (-0.258, 0.01, 1.28), M["hiviz"],
                      rot=(0, math.radians(7), 0)))
    parts.append(limb("fore-l", (0.10, 0.12, 0.28), (-0.275, 0.02, 1.00), M["work"],
                      rot=(0, math.radians(4), 0)))
    parts.append(limb("arm-r", (0.11, 0.13, 0.30), (0.258, -0.02, 1.28), M["hiviz"],
                      rot=(0, math.radians(-7), 0)))
    parts.append(limb("fore-r", (0.10, 0.20, 0.12), (0.278, -0.13, 1.09), M["work"],
                      rot=(math.radians(52), 0, 0)))
    for sx, z, y in ((-1, 0.855, 0.03), (1, 1.045, -0.20)):
        parts.append(limb(f"hand{sx}", (0.085, 0.10, 0.10), (sx * 0.28, y, z),
                          M["skin"], bevel=0.03))

    # ---- Head and hard hat -------------------------------------------------
    parts.append(limb("neck", (0.10, 0.10, 0.08), (0, -0.01, 1.455), M["skin"]))
    parts.append(limb("head", (0.155, 0.185, 0.20), (0, -0.015, 1.585), M["skin"],
                      bevel=0.05))
    # The hat is a crown plus a real BRIM. The brim must sit ON TOP of the
    # skull, not across it: the first pass put it at 1.695 against a head
    # reaching 1.715, so it cut through at ear level and the silhouette read
    # as a fedora rather than as PPE.
    parts.append(limb("brim", (0.205, 0.245, 0.018), (0, -0.028, 1.694), M["hat"],
                      bevel=0.008))
    parts.append(limb("crown", (0.178, 0.196, 0.088), (0, -0.018, 1.744), M["hat"],
                      bevel=0.042))
    return parts


def main():
    B.reset_scene()
    M = materials()
    ob = B.join("worker", figure(M))
    B.set_origin_to_ground(ob)

    stats = B.export_glb(ob, os.path.join(B.ASSET_DIR, "worker.glb"))
    B.validate(stats, max_triangles=4000, expect_size=(0.62, TALL, 0.5), tol=0.3)
    print(f"OK  {stats['file']}  {stats['triangles']} tris  "
          f"{stats['bytes'] / 1024:.1f} KB  size {stats['size_m']}  "
          f"{len(stats['materials'])} materials")


main()
