"""
Shared library for the three Blender hero-environment concepts.

WHY THIS EXISTS
---------------
The production world reads as stacked boxes, and four sessions of shader and
camera work did not fix that, because the problem was never the renderer. This
library exists to establish a VISUAL DESTINATION in Blender first, where
lighting and materials are not the bottleneck, so the target can be judged
before another line of Three.js is written.

THE THREE THINGS THAT ACTUALLY STOP A FRAME LOOKING LIKE A GAME LEVEL
---------------------------------------------------------------------
1. STAGE VARIATION. A building under construction is a machine for making
   floors, and every floor is at a different point in that process. Ten
   identical slabs is the single loudest tell in the current world, louder
   than any material or light.

2. MATERIAL VARIATION AT TEXTURE SCALE. Concrete is not grey. It carries
   formwork marks at a metre scale, pour-to-pour colour steps, staining that
   runs downward from edges, and roughness that varies where it was worked.
   Flat RGB is what reads as CAD.

3. LIGHT CONTACT. Soffits go dark, junctions catch, and the ground under an
   object is darker than the ground beside it. Without contact, geometry
   floats regardless of how much of it there is.

Everything below serves one of those three.

MATERIALS ARE PROCEDURAL, NOT DOWNLOADED
----------------------------------------
Every texture here is built from Blender's own noise, wave and brick nodes.
Nothing is fetched. That is a licensing decision as much as a technical one:
provenance for a downloaded texture has to be tracked and honoured, and none
of these needs a photograph to do its job.
"""

import math
import os
import sys

import bpy


# ---------------------------------------------------------------------------
# Scene lifecycle
# ---------------------------------------------------------------------------

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 1.0
    return sc


def srgb(hex_value):
    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin((hex_value >> 16) & 255), lin((hex_value >> 8) & 255),
            lin(hex_value & 255), 1.0)


def _new_material(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (-200, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat, nt, bsdf


def _coord(nt, scale=1.0):
    """
    WORLD-space coordinates, so texture scale is in METRES.

    Object space was the obvious choice and it is wrong here: every concept
    joins its hundreds of parts into a handful of meshes, and after a join the
    object frame is the JOINED object's, not each part's. The first render
    came back with no formwork marks and no window rhythm at all for exactly
    this reason.
    """
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    geo.location = (-1400, 0)
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.location = (-1200, 0)
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    nt.links.new(geo.outputs["Position"], mp.inputs["Vector"])
    return mp


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------

def concrete(name="concrete", tint=0x9AA0A6, pour_step=0.06, wear=0.5,
             wet=0.0):
    """
    In-situ concrete with the four things that make it read as concrete:

      formwork marks   horizontal lines at a real ~600 mm lift spacing, from a
                       wave texture. This is the strongest single cue and it
                       is nearly free.
      pour variation   large-scale colour steps, because a wall is poured over
                       days and each pour cures differently.
      staining         a downward-biased darkening, since water runs down.
      worked roughness a noise break-up so the surface is not uniformly matt.
    """
    mat, nt, bsdf = _new_material(name)
    mp = _coord(nt, 1.0)

    # Formwork lift lines: horizontal bands every ~0.6 m.
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.location = (-950, 260)
    wave.wave_type = "BANDS"
    wave.bands_direction = "Z"
    wave.wave_profile = "SAW"
    wave.inputs["Scale"].default_value = 1.7
    wave.inputs["Distortion"].default_value = 1.2
    wave.inputs["Detail"].default_value = 2.0
    nt.links.new(mp.outputs["Vector"], wave.inputs["Vector"])

    # Large-scale pour variation.
    pour = nt.nodes.new("ShaderNodeTexNoise")
    pour.location = (-950, 60)
    pour.inputs["Scale"].default_value = 0.09
    pour.inputs["Detail"].default_value = 2.0
    nt.links.new(mp.outputs["Vector"], pour.inputs["Vector"])

    # Fine aggregate / surface break-up.
    grain = nt.nodes.new("ShaderNodeTexNoise")
    grain.location = (-950, -160)
    grain.inputs["Scale"].default_value = 14.0
    grain.inputs["Detail"].default_value = 6.0
    grain.inputs["Roughness"].default_value = 0.62
    nt.links.new(mp.outputs["Vector"], grain.inputs["Vector"])

    # Staining, biased downward: a stretched noise reads as run-off.
    stain_mp = nt.nodes.new("ShaderNodeMapping")
    stain_mp.location = (-1150, -420)
    stain_mp.inputs["Scale"].default_value = (2.4, 2.4, 0.16)
    tc2 = nt.nodes.new("ShaderNodeNewGeometry")
    tc2.location = (-1350, -420)
    nt.links.new(tc2.outputs["Position"], stain_mp.inputs["Vector"])
    stain = nt.nodes.new("ShaderNodeTexNoise")
    stain.location = (-950, -420)
    stain.inputs["Scale"].default_value = 1.1
    stain.inputs["Detail"].default_value = 5.0
    nt.links.new(stain_mp.outputs["Vector"], stain.inputs["Vector"])
    stain_ramp = nt.nodes.new("ShaderNodeValToRGB")
    stain_ramp.location = (-750, -420)
    stain_ramp.color_ramp.elements[0].position = 0.42
    stain_ramp.color_ramp.elements[1].position = 0.78
    nt.links.new(stain.outputs["Fac"], stain_ramp.inputs["Fac"])

    base = nt.nodes.new("ShaderNodeMixRGB")
    base.location = (-560, 120)
    base.blend_type = "MIX"
    base.inputs["Fac"].default_value = pour_step
    base.inputs["Color1"].default_value = srgb(tint)
    base.inputs["Color2"].default_value = srgb(0x6E747A)
    nt.links.new(pour.outputs["Fac"], base.inputs["Fac"])

    lifts = nt.nodes.new("ShaderNodeMixRGB")
    lifts.location = (-380, 120)
    lifts.blend_type = "MULTIPLY"
    lifts.inputs["Fac"].default_value = 0.16
    nt.links.new(base.outputs["Color"], lifts.inputs["Color1"])
    nt.links.new(wave.outputs["Color"], lifts.inputs["Color2"])

    stained = nt.nodes.new("ShaderNodeMixRGB")
    stained.location = (-380, -120)
    stained.blend_type = "MULTIPLY"
    stained.inputs["Fac"].default_value = 0.26 * wear
    nt.links.new(lifts.outputs["Color"], stained.inputs["Color1"])
    nt.links.new(stain_ramp.outputs["Color"], stained.inputs["Color2"])
    nt.links.new(stained.outputs["Color"], bsdf.inputs["Base Color"])

    rough = nt.nodes.new("ShaderNodeMapRange")
    rough.location = (-380, -320)
    rough.inputs["From Min"].default_value = 0.0
    rough.inputs["From Max"].default_value = 1.0
    rough.inputs["To Min"].default_value = 0.82 - wet * 0.55
    rough.inputs["To Max"].default_value = 0.98 - wet * 0.5
    nt.links.new(grain.outputs["Fac"], rough.inputs["Value"])
    nt.links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])

    bump = nt.nodes.new("ShaderNodeBump")
    bump.location = (-190, -320)
    bump.inputs["Strength"].default_value = 0.32
    bump.inputs["Distance"].default_value = 0.02
    nt.links.new(grain.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def galvanised(name="galv"):
    """Real metal. Metallic 1.0 with roughness variation -- the previous
    scaffold read as white line-work because it was neither."""
    mat, nt, bsdf = _new_material(name)
    mp = _coord(nt, 3.0)
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.location = (-800, 0)
    n.inputs["Scale"].default_value = 9.0
    n.inputs["Detail"].default_value = 5.0
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])

    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-560, 120)
    ramp.color_ramp.elements[0].color = srgb(0x6E767D)
    ramp.color_ramp.elements[1].color = srgb(0xA9B2B9)
    nt.links.new(n.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])

    r = nt.nodes.new("ShaderNodeMapRange")
    r.location = (-560, -140)
    r.inputs["To Min"].default_value = 0.28
    r.inputs["To Max"].default_value = 0.55
    nt.links.new(n.outputs["Fac"], r.inputs["Value"])
    nt.links.new(r.outputs["Result"], bsdf.inputs["Roughness"])
    bsdf.inputs["Metallic"].default_value = 1.0
    return mat


def painted(name, color, rough=0.42, wear=0.35):
    """Painted steel: crane, plant, hoarding. Wear exposes darker metal."""
    mat, nt, bsdf = _new_material(name)
    mp = _coord(nt, 2.0)
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.location = (-800, 0)
    n.inputs["Scale"].default_value = 6.0
    n.inputs["Detail"].default_value = 6.0
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-600, 0)
    ramp.color_ramp.elements[0].position = 0.55
    ramp.color_ramp.elements[1].position = 0.82
    nt.links.new(n.outputs["Fac"], ramp.inputs["Fac"])
    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.location = (-380, 0)
    mix.blend_type = "MIX"
    mix.inputs["Fac"].default_value = wear
    mix.inputs["Color1"].default_value = srgb(color)
    mix.inputs["Color2"].default_value = srgb(0x4A4640)
    nt.links.new(ramp.outputs["Color"], mix.inputs["Fac"])
    nt.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])

    # Roughness and relief from a finer noise. Without this the baked normal
    # came out blank (4 KB of flat blue) and asphalt read as painted card.
    fine = nt.nodes.new("ShaderNodeTexNoise")
    fine.location = (-800, -260)
    fine.inputs["Scale"].default_value = 42.0
    fine.inputs["Detail"].default_value = 8.0
    fine.inputs["Roughness"].default_value = 0.7
    nt.links.new(mp.outputs["Vector"], fine.inputs["Vector"])
    rr = nt.nodes.new("ShaderNodeMapRange")
    rr.location = (-560, -260)
    rr.inputs["To Min"].default_value = max(0.05, rough - 0.14)
    rr.inputs["To Max"].default_value = min(1.0, rough + 0.14)
    nt.links.new(fine.outputs["Fac"], rr.inputs["Value"])
    nt.links.new(rr.outputs["Result"], bsdf.inputs["Roughness"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.location = (-320, -320)
    bump.inputs["Strength"].default_value = 0.28
    bump.inputs["Distance"].default_value = 0.012
    nt.links.new(fine.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Metallic"].default_value = 0.25
    return mat


def plywood(name="ply"):
    """Formwork ply: grain along one axis, seams, and site staining."""
    mat, nt, bsdf = _new_material(name)
    mp = _coord(nt, 1.0)
    w = nt.nodes.new("ShaderNodeTexWave")
    w.location = (-800, 120)
    w.wave_type = "BANDS"
    w.bands_direction = "X"
    w.wave_profile = "SIN"
    w.inputs["Scale"].default_value = 26.0
    w.inputs["Distortion"].default_value = 9.0
    w.inputs["Detail"].default_value = 3.0
    nt.links.new(mp.outputs["Vector"], w.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-560, 120)
    ramp.color_ramp.elements[0].color = srgb(0xB07C3E)
    ramp.color_ramp.elements[1].color = srgb(0xD8A860)
    nt.links.new(w.outputs["Color"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.78
    bump = nt.nodes.new("ShaderNodeBump")
    bump.location = (-300, -200)
    bump.inputs["Strength"].default_value = 0.12
    nt.links.new(w.outputs["Color"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def earth(name="earth", damp=0.25):
    """Compacted site ground: tonal variation, tracks, damp patches."""
    mat, nt, bsdf = _new_material(name)
    mp = _coord(nt, 0.06)
    big = nt.nodes.new("ShaderNodeTexNoise")
    big.location = (-900, 160)
    big.inputs["Scale"].default_value = 2.2
    big.inputs["Detail"].default_value = 8.0
    nt.links.new(mp.outputs["Vector"], big.inputs["Vector"])
    fine = nt.nodes.new("ShaderNodeTexNoise")
    fine.location = (-900, -80)
    fine.inputs["Scale"].default_value = 24.0
    fine.inputs["Detail"].default_value = 8.0
    nt.links.new(mp.outputs["Vector"], fine.inputs["Vector"])

    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-660, 160)
    ramp.color_ramp.elements[0].color = srgb(0x6B5A45)
    ramp.color_ramp.elements[1].color = srgb(0x9C8768)
    nt.links.new(big.outputs["Fac"], ramp.inputs["Fac"])

    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.location = (-420, 80)
    mix.blend_type = "MULTIPLY"
    mix.inputs["Fac"].default_value = 0.3
    nt.links.new(ramp.outputs["Color"], mix.inputs["Color1"])
    nt.links.new(fine.outputs["Color"], mix.inputs["Color2"])
    nt.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])

    r = nt.nodes.new("ShaderNodeMapRange")
    r.location = (-420, -200)
    r.inputs["To Min"].default_value = 0.55 + (1 - damp) * 0.3
    r.inputs["To Max"].default_value = 1.0
    nt.links.new(big.outputs["Fac"], r.inputs["Value"])
    nt.links.new(r.outputs["Result"], bsdf.inputs["Roughness"])

    bump = nt.nodes.new("ShaderNodeBump")
    bump.location = (-220, -260)
    bump.inputs["Strength"].default_value = 0.5
    bump.inputs["Distance"].default_value = 0.06
    nt.links.new(fine.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def _shift(hex_value, factor):
    """Scale an sRGB hex toward black, for joints and tonal variation."""
    r = min(255, int(((hex_value >> 16) & 255) * factor))
    g = min(255, int(((hex_value >> 8) & 255) * factor))
    b = min(255, int((hex_value & 255) * factor))
    return (r << 16) | (g << 8) | b


def city_facade(name="city", tint=0x6E7684, lit=0.0):
    """
    A context building's facade, as a SHADER rather than as geometry.

    A brick texture at floor spacing gives window rhythm, spandrel colour and
    -- at night -- a scatter of lit rooms, at zero geometric cost. Distant
    architecture does not need modelled windows; it needs the RHYTHM of them,
    and that is what separates urban context from extruded cuboids.
    """
    mat, nt, bsdf = _new_material(name)
    mp = _coord(nt, 1.0)
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.location = (-900, 60)
    brick.inputs["Scale"].default_value = 0.34
    brick.inputs["Mortar Size"].default_value = 0.055
    brick.inputs["Mortar Smooth"].default_value = 0.1
    brick.inputs["Bias"].default_value = 0.0
    brick.inputs["Brick Width"].default_value = 1.5
    brick.inputs["Row Height"].default_value = 0.62
    # THE FIELD IS THE MASONRY; THE JOINT IS THE DARK LINE.
    #
    # This was inverted: the brick field carried a near-black and the MORTAR
    # carried the light tint, so a whole neighbouring building baked out almost
    # black and read as a hole in the street. Real masonry is mid-tone with a
    # recessed joint reading darker.
    brick.inputs["Color1"].default_value = srgb(tint)
    brick.inputs["Color2"].default_value = srgb(_shift(tint, 0.88))
    brick.inputs["Mortar"].default_value = srgb(_shift(tint, 0.62))
    nt.links.new(mp.outputs["Vector"], brick.inputs["Vector"])
    nt.links.new(brick.outputs["Color"], bsdf.inputs["Base Color"])

    r = nt.nodes.new("ShaderNodeMapRange")
    r.location = (-600, -160)
    r.inputs["To Min"].default_value = 0.12       # glazing
    r.inputs["To Max"].default_value = 0.7        # spandrel
    nt.links.new(brick.outputs["Fac"], r.inputs["Value"])
    nt.links.new(r.outputs["Result"], bsdf.inputs["Roughness"])

    # The brick pattern also drives relief, so mortar joints sit BELOW the
    # face. Kept shallow -- deep mortar reads as a dry-stone wall.
    bump = nt.nodes.new("ShaderNodeBump")
    bump.location = (-380, -320)
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.01
    nt.links.new(brick.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    if lit > 0:
        # A second, offset brick pattern decides WHICH rooms are lit, so the
        # windows do not all come on together.
        pick = nt.nodes.new("ShaderNodeTexBrick")
        pick.location = (-900, -380)
        pick.inputs["Scale"].default_value = 0.34
        pick.inputs["Brick Width"].default_value = 1.5
        pick.inputs["Row Height"].default_value = 0.62
        pick.inputs["Color1"].default_value = (0, 0, 0, 1)
        pick.inputs["Color2"].default_value = (1, 1, 1, 1)
        pick.inputs["Squash"].default_value = 0.72
        nt.links.new(mp.outputs["Vector"], pick.inputs["Vector"])
        gate = nt.nodes.new("ShaderNodeMath")
        gate.location = (-660, -380)
        gate.operation = "MULTIPLY"
        gate.inputs[1].default_value = lit
        nt.links.new(pick.outputs["Color"], gate.inputs[0])
        emit = nt.nodes.new("ShaderNodeMath")
        emit.location = (-480, -380)
        emit.operation = "MULTIPLY"
        emit.inputs[1].default_value = 2.6
        nt.links.new(gate.outputs["Value"], emit.inputs[0])
        bsdf.inputs["Emission Color"].default_value = srgb(0xFFD9A0)
        nt.links.new(emit.outputs["Value"], bsdf.inputs["Emission Strength"])
    return mat


def glass(name="glass"):
    mat, nt, bsdf = _new_material(name)
    bsdf.inputs["Base Color"].default_value = srgb(0x1A2229)
    bsdf.inputs["Roughness"].default_value = 0.06
    bsdf.inputs["Metallic"].default_value = 0.0
    return mat


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def box(name, size, loc, mat=None, bevel=0.0, rot=None, collection=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    if rot:
        ob.rotation_euler = rot
    if mat:
        ob.data.materials.append(mat)
    if bevel > 0:
        m = ob.modifiers.new("bev", "BEVEL")
        m.width = bevel
        m.segments = 2
        m.limit_method = "ANGLE"
        m.angle_limit = math.radians(40)
        m.harden_normals = True
        for p in ob.data.polygons:
            p.use_smooth = True
    return ob


def cyl(name, radius, length, loc, mat=None, axis="Z", verts=10):
    rot = {"Z": (0, 0, 0), "X": (0, math.radians(90), 0),
           "Y": (math.radians(90), 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius,
                                        depth=length, location=loc,
                                        rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    if mat:
        ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def join_all(name, objects):
    objects = [o for o in objects if o]
    if not objects:
        return None
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    return ob


# ---------------------------------------------------------------------------
# Lighting and render
# ---------------------------------------------------------------------------

def sky_world(sun_elev_deg, sun_rot_deg, strength=1.0, dusk=False):
    """
    Blender's physical Sky texture as the environment.

    This is the whole reason the concept renders will beat the browser
    immediately: the environment is a real sky model, so bounce light has the
    correct colour and gradient without any of it being hand-painted.
    """
    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    nt = world.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_WORLD":
            nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == "OUTPUT_WORLD")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "NISHITA"
    sky.sun_elevation = math.radians(sun_elev_deg)
    sky.sun_rotation = math.radians(sun_rot_deg)
    sky.altitude = 120
    sky.air_density = 1.5 if dusk else 0.85
    sky.dust_density = 3.0 if dusk else 0.9
    sky.sun_intensity = 0.5 if dusk else 1.0
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    bpy.context.scene.world = world
    return world


def sun_lamp(elev_deg, rot_deg, energy, color=(1.0, 0.95, 0.88), angle=0.9):
    d = bpy.data.lights.new("sun", "SUN")
    d.energy = energy
    d.color = color
    d.angle = math.radians(angle)
    ob = bpy.data.objects.new("sun", d)
    bpy.context.collection.objects.link(ob)
    # Blender's sun points down -Z; rotate to the given elevation/azimuth.
    ob.rotation_euler = (math.radians(90 - elev_deg), 0, math.radians(rot_deg))
    return ob


def camera(name, loc, target, mm=35, sensor=36):
    from mathutils import Vector
    d = bpy.data.cameras.new(name)
    d.lens = mm
    d.sensor_width = sensor
    ob = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob


def render(out_path, cam, width=1440, height=900, samples=64, exposure=0.0,
           engine="BLENDER_EEVEE_NEXT"):
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.engine = engine
    sc.render.resolution_x = width
    sc.render.resolution_y = height
    sc.render.resolution_percentage = 100
    sc.render.filepath = out_path
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "AgX"
    # The look enum's names differ between Blender releases, so pick from what
    # this build actually offers rather than hard-coding a string.
    for candidate in ("AgX - Medium High Contrast", "AgX - Base Contrast", "None"):
        try:
            sc.view_settings.look = candidate
            break
        except TypeError:
            continue
    sc.view_settings.exposure = exposure

    if engine == "BLENDER_EEVEE_NEXT":
        ev = sc.eevee
        ev.taa_render_samples = samples
        # Ray-traced shadows and screen-space GI. This is what puts light in
        # contact with matter -- the thing AO cannot fake.
        for attr, val in (("use_raytracing", True), ("use_shadows", True),
                          ("use_volumetric_lights", True),
                          ("shadow_ray_count", 2), ("shadow_step_count", 6)):
            if hasattr(ev, attr):
                setattr(ev, attr, val)
        if hasattr(ev, "ray_tracing_options"):
            ev.ray_tracing_options.use_denoise = True
    else:
        sc.cycles.samples = samples
        sc.cycles.use_denoising = True

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print(f"OK  {os.path.basename(out_path)}  {engine}  {width}x{height}")


def argv():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, ".screenshots", "concepts")


# ---------------------------------------------------------------------------
# Site pieces shared by all three concepts
# ---------------------------------------------------------------------------

def tower_crane(base, mast_h, jib_len, mats, slew=0.6, back=None):
    """
    A lattice tower crane.

    Lattice, not a solid mast: the open web is most of how the eye identifies
    a crane, and a solid box mast is the difference between "crane" and
    "model of a crane". Built from real members so it silhouettes correctly
    from any bearing -- which matters because the production camera can walk
    all the way around it.
    """
    import math as _m
    parts = []
    galv, paint = mats["galv"], mats["crane"]
    bx, by, bz = base
    w = 1.9
    h = w / 2
    corners = [(-h, -h), (h, -h), (h, h), (-h, h)]

    parts.append(box("cbase", (7.0, 7.0, 0.9), (bx, by, bz + 0.45), mats["conc"]))
    for cx, cz in corners:
        parts.append(box("chord", (0.16, 0.16, mast_h),
                         (bx + cx, by + cz, bz + mast_h / 2), galv))
    sections = int(mast_h / 3.0)
    for i in range(sections + 1):
        z = bz + i * mast_h / sections
        for j in range(4):
            a, b = corners[j], corners[(j + 1) % 4]
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            ln = _m.hypot(b[0] - a[0], b[1] - a[1])
            ang = _m.atan2(b[1] - a[1], b[0] - a[0])
            parts.append(box("htie", (ln, 0.11, 0.11), (bx + mx, by + my, z),
                             galv, rot=(0, 0, ang)))
        if i < sections:
            z1 = bz + (i + 1) * mast_h / sections
            for j in range(4):
                a, b = corners[j], corners[(j + 1) % 4]
                ln = _m.hypot(b[0] - a[0], b[1] - a[1], )
                diag = _m.hypot(ln, z1 - z)
                ang = _m.atan2(b[1] - a[1], b[0] - a[0])
                pitch = _m.atan2(z1 - z, ln)
                mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
                parts.append(box("brace", (diag, 0.075, 0.075),
                                 (bx + mx, by + my, (z + z1) / 2), galv,
                                 rot=(0, -pitch if i % 2 else pitch, ang)))

    # Slewing platform, cab, jib and counter-jib.
    top = bz + mast_h
    ca, sa = _m.cos(slew), _m.sin(slew)
    parts.append(box("cabin", (2.2, 2.0, 2.0),
                     (bx + ca * 2.4, by + sa * 2.4, top + 1.4), mats["crane"],
                     bevel=0.08, rot=(0, 0, slew)))
    back = back if back is not None else jib_len * 0.34
    for name, length, sign, depth in (("jib", jib_len, 1, 1.7), ("cjib", back, -1, 1.5)):
        n = max(3, int(length / 3.0))
        for i in range(n):
            t0 = (i / n) * length * sign
            t1 = ((i + 1) / n) * length * sign
            for dz in (0.0, depth):
                parts.append(box("jc", (abs(t1 - t0), 0.13, 0.13),
                                 (bx + ca * (t0 + t1) / 2, by + sa * (t0 + t1) / 2,
                                  top + 2.6 + dz), galv, rot=(0, 0, slew)))
            parts.append(box("jd", (0.09, 0.09, depth),
                             (bx + ca * t1, by + sa * t1, top + 2.6 + depth / 2), galv))
    parts.append(box("cwt", (3.0, 2.6, 2.0),
                     (bx - ca * back, by - sa * back, top + 2.4), mats["crane"],
                     bevel=0.06, rot=(0, 0, slew)))
    # Hook block on its fall.
    tx, ty = bx + ca * jib_len * 0.55, by + sa * jib_len * 0.55
    parts.append(box("fall", (0.05, 0.05, mast_h * 0.42),
                     (tx, ty, top + 2.6 - mast_h * 0.21), galv))
    parts.append(box("hook", (1.0, 0.8, 0.9),
                     (tx, ty, top + 2.6 - mast_h * 0.42), mats["crane"], bevel=0.05))
    return join_all("crane", parts)


def context_city(rng, blocks, mats, lit=0.0):
    """
    Neighbouring urban fabric.

    Every block is a podium, a shaft, a setback cap and rooftop plant, and its
    facade carries a WINDOW RHYTHM from the brick shader. Distant architecture
    does not need modelled windows; it needs the rhythm of them, which is what
    separates a city from a row of extruded cuboids.
    """
    parts = []
    for (cx, cy, w, d, h, era) in blocks:
        mat = mats["city_warm"] if era else mats["city_cool"]
        ph = rng.uniform(4.0, 7.5)
        parts.append(box("podium", (w * 1.12, d * 1.12, ph), (cx, cy, ph / 2), mat))
        sh = h * rng.uniform(0.66, 0.86)
        parts.append(box("shaft", (w, d, sh), (cx, cy, ph + sh / 2), mat))
        ch = h - sh
        if ch > 2:
            parts.append(box("cap", (w * rng.uniform(0.6, 0.82), d * rng.uniform(0.6, 0.82),
                                     ch), (cx, cy, ph + sh + ch / 2), mat))
        parts.append(box("plant", (rng.uniform(3, 6), rng.uniform(3, 6), rng.uniform(1.4, 2.8)),
                         (cx + rng.uniform(-w * 0.2, w * 0.2),
                          cy + rng.uniform(-d * 0.2, d * 0.2),
                          ph + h + 1.0), mats["city_cool"]))
        parts.append(box("parapet", (w * 1.02, d * 1.02, 0.7),
                         (cx, cy, ph + h + 0.35), mats["city_cool"]))
    return join_all("city", parts)


def figure(loc, mats, facing=0.0):
    """A worker, for scale. Silhouette only -- these are 20 px tall."""
    parts = []
    hv, wk, hat = mats["hiviz"], mats["workwear"], mats["hat"]
    x, y, z = loc
    parts.append(box("legs", (0.34, 0.24, 0.86), (x, y, z + 0.43), wk, bevel=0.04))
    parts.append(box("torso", (0.42, 0.26, 0.56), (x, y, z + 1.16), hv, bevel=0.06))
    parts.append(box("head", (0.17, 0.19, 0.22), (x, y, z + 1.56), mats["skin"], bevel=0.05))
    parts.append(box("hat", (0.24, 0.27, 0.09), (x, y, z + 1.70), hat, bevel=0.03))
    parts.append(box("brim", (0.27, 0.31, 0.02), (x, y - 0.03, z + 1.665), hat))
    ob = join_all("worker", parts)
    ob.rotation_euler = (0, 0, facing)
    return ob


def standard_materials(wear=0.5, lit=0.0):
    """The full material set every concept shares, so a difference between
    two concepts is a difference in ARCHITECTURE, not in colour grading."""
    return {
        "conc": concrete("conc", 0x9AA0A6, wear=wear),
        # Fresh concrete: darker, bluer, and much smoother because it is wet.
        "wet": concrete("wet", 0x6F757C, wear=0.15, wet=0.85),
        "ply": plywood("ply"),
        "galv": galvanised("galv"),
        "paint": painted("paint", 0x8A9096, rough=0.5),
        "crane": painted("crane", 0xC8611A, rough=0.44, wear=0.4),
        "screen": painted("screen", 0x2F6F8C, rough=0.62, wear=0.25),
        "spandrel": painted("spandrel", 0x3A4149, rough=0.4, wear=0.15),
        "glass": glass("glass"),
        "city_warm": city_facade("city_warm", 0xA89684, lit=lit),
        "city_cool": city_facade("city_cool", 0x93A0AD, lit=lit),
        "earth": earth("earth"),
        "hiviz": painted("hiviz", 0xCBE034, rough=0.62, wear=0.1),
        "workwear": painted("workwear", 0x2C3540, rough=0.85, wear=0.1),
        "hat": painted("hat", 0xE8E4DC, rough=0.42, wear=0.1),
        "skin": painted("skin", 0x8A6A52, rough=0.78, wear=0.05),
    }
