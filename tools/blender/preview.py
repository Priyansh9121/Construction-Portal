"""
Render an authored GLB to a PNG, so an asset can be LOOKED AT without
rebuilding the whole application.

The browser remains the final judge -- an asset only really exists once it is
lit by the world's own sky and stood next to the frame it belongs to. But a
modelling error (an inside-out face, a wall in the wrong place, a door at knee
height) is much cheaper to catch here than after a dev-server round trip.

    Blender -b -P tools/blender/preview.py -- cabin.glb out.png [--turn 45]
"""

import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_build as B


def argv():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if len(a) < 2:
        raise SystemExit("usage: -- <asset.glb> <out.png> [--turn deg]")
    turn = float(a[a.index("--turn") + 1]) if "--turn" in a else 38.0
    # Sun azimuth is independent of the camera on purpose. Profiled sheet and
    # recessed reveals only read under RAKING light; a sun locked to the camera
    # would light every wall near-perpendicular and hide exactly the detail
    # these assets exist to carry.
    sun = float(a[a.index("--sun") + 1]) if "--sun" in a else turn + 130.0
    # Framing multiplier. The default fits a roughly cubic object; a tall thin
    # one (a 7 m light tower) needs the camera further back or its head falls
    # outside the frame -- which looks exactly like a missing lamp head.
    dist = float(a[a.index("--dist") + 1]) if "--dist" in a else 1.9
    return a[0], a[1], turn, sun, dist


def main():
    name, out, turn, sun_az, fit = argv()
    B.reset_scene()
    bpy.ops.import_scene.gltf(filepath=os.path.join(B.ASSET_DIR, name))

    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    lo = [1e9] * 3
    hi = [-1e9] * 3
    for o in objs:
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            for i in range(3):
                lo[i] = min(lo[i], p[i]); hi[i] = max(hi[i], p[i])
    ctr = [(lo[i] + hi[i]) / 2 for i in range(3)]
    span = max(hi[i] - lo[i] for i in range(3))

    # Ground plane, so the asset has something to sit on and cast onto.
    ground = B.box("ground", (span * 8, span * 8, 0.02), (ctr[0], ctr[1], lo[2] - 0.01),
                   B.material("prev-ground", B.srgb(0x6B6259), 0.0, 0.95))

    # Sun roughly where the world's key light sits: low and to one side, which
    # is the condition that makes profiled sheet and recessed openings read.
    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 1.9
    sun_data.angle = math.radians(1.6)
    sun = bpy.data.objects.new("sun", sun_data)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(58), 0, math.radians(sun_az))

    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.42, 0.52, 0.68, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    bpy.context.scene.world = world

    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    a = math.radians(turn)
    dist = span * fit
    cam.location = (ctr[0] + math.sin(a) * dist, ctr[1] - math.cos(a) * dist,
                    lo[2] + span * 0.5)
    # Aim at a point slightly below centre: looking very slightly up at an
    # object is how it is seen on site.
    # Aim with to_track_quat rather than hand-rolled Euler angles: a camera
    # points down its local -Z with +Y up, and deriving that by hand is how the
    # first render of this file ended up staring at the ground.
    from mathutils import Vector
    target = Vector((ctr[0], ctr[1], lo[2] + (hi[2] - lo[2]) * 0.5))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam

    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.render.resolution_x, sc.render.resolution_y = 1100, 750
    sc.render.film_transparent = False
    sc.render.filepath = out
    sc.view_settings.view_transform = "AgX"
    if hasattr(sc, "eevee"):
        sc.eevee.taa_render_samples = 48
    bpy.ops.render.render(write_still=True)
    print(f"OK  rendered {name} -> {out}")


main()
