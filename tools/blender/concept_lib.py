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

    # THE BRICK NODE NEEDS (ALONG-FACE, HEIGHT), NOT (X, Y).
    #
    # Fed raw world position it samples the x,y of the vector -- so on a
    # facade perpendicular to X, x is CONSTANT across the whole face and
    # height never enters the pattern at all. The result is vertical stripes
    # with no floor lines: not a window rhythm, a barcode. That is what the
    # context terrace was actually showing.
    #
    # (x + y) varies along the face whichever way the block is turned, and z
    # is the storey axis, so rows land on floors and columns land on bays.
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    sep.location = (-1120, 60)
    nt.links.new(mp.outputs["Vector"], sep.inputs["Vector"])
    run = nt.nodes.new("ShaderNodeMath")
    run.location = (-980, 120)
    run.operation = "ADD"
    nt.links.new(sep.outputs["X"], run.inputs[0])
    nt.links.new(sep.outputs["Y"], run.inputs[1])
    face = nt.nodes.new("ShaderNodeCombineXYZ")
    face.location = (-980, -60)
    nt.links.new(run.outputs["Value"], face.inputs["X"])
    nt.links.new(sep.outputs["Z"], face.inputs["Y"])

    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.location = (-900, 60)
    # Metres, so every number below is a real building dimension.
    brick.inputs["Scale"].default_value = 1.0
    # Blender shrinks the cell by the mortar on BOTH sides, so mortar must
    # stay under half the cell or the pattern degenerates to solid mortar --
    # which is exactly what 1.15 against a 2.0 cell did: a flat pale wall.
    # 3.4 x 3.2 m bay less 2 x 0.9 m of pier and spandrel leaves a 1.6 x 1.4 m
    # opening, about 21% dark. That is a punched-window facade.
    brick.inputs["Mortar Size"].default_value = 0.9       # pier / spandrel
    brick.inputs["Mortar Smooth"].default_value = 0.15
    brick.inputs["Bias"].default_value = 0.0
    brick.inputs["Brick Width"].default_value = 3.4       # structural bay
    brick.inputs["Row Height"].default_value = 3.2        # floor to floor
    # THE CELL IS THE WINDOW; THE JOINT IS THE WALL BETWEEN THEM.
    #
    # An earlier attempt at this inverted it and a whole neighbour baked out
    # almost black -- but the cause was PROPORTION, not polarity: large dark
    # cells separated by a thin light joint is a black building. Sized as a
    # real facade instead -- a 2.0 x 1.4 m opening in a 1.15 m grid of pier
    # and spandrel -- the dark area lands near 35%, which is what a punched
    # window facade actually is.
    #
    # The roughness map below has always assumed cell = glazing (smooth) and
    # joint = wall (rough). Only the COLOURS disagreed with it. They no
    # longer do.
    brick.inputs["Color1"].default_value = srgb(_shift(tint, 0.24))
    brick.inputs["Color2"].default_value = srgb(_shift(tint, 0.31))
    brick.inputs["Mortar"].default_value = srgb(tint)
    nt.links.new(face.outputs["Vector"], brick.inputs["Vector"])
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
        # Matches the window grid above, so a "lit room" lands ON a window.
        pick.inputs["Scale"].default_value = 1.0
        pick.inputs["Brick Width"].default_value = 3.4
        pick.inputs["Row Height"].default_value = 3.2
        pick.inputs["Color1"].default_value = (0, 0, 0, 1)
        pick.inputs["Color2"].default_value = (1, 1, 1, 1)
        pick.inputs["Squash"].default_value = 0.72
        nt.links.new(face.outputs["Vector"], pick.inputs["Vector"])
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
    # THE SUN IS PROVIDED BY A LAMP, NOT BY THE SKY.
    #
    # Nishita's `sun_disc` defaults to True, so the sky texture contained a
    # sun AND a separate sun lamp was added on top -- the sun was counted
    # twice. Worse, the sky's disc is sampled as part of the world hemisphere,
    # which delivers it as broad soft fill rather than as a hard key, so
    # shadows filled in and every surface collapsed into one narrow value
    # band. That is the flatness, and it had nothing to do with the sun's
    # elevation: it was just as flat at any angle.
    #
    # The sky now supplies ATMOSPHERE AND AMBIENT ONLY. The lamp supplies the
    # key, at the sun's real angular diameter, which is what gives a shadow an
    # edge.
    sky.sun_disc = False
    sky.sun_intensity = 0.0
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])

    # ---- ATMOSPHERIC DEPTH ------------------------------------------------
    #
    # A world volume, not fog. The failure it fixes is that a building 300 m
    # away shared its black level with foreground scaffold, which destroys
    # scale: the eye reads distance from CONTRAST LOSS long before it reads it
    # from perspective.
    #
    # Density is deliberately tiny. At 3e-5 a surface 300 m away loses roughly
    # a tenth of its contrast and one 20 m away loses almost nothing, so the
    # viewer never thinks "there is fog" -- only "that is far away". Anything
    # an order of magnitude stronger becomes visible haze and reads as a
    # weather effect rather than as air.
    # See atmosphere_box() for the working implementation.
    # NOTE: a WORLD volume rendered the entire frame black in Cycles here,
    # even at a density of 3e-5 where the optical depth over 300 m is under
    # 0.01. Bisected by removing it and the frame returned immediately, so it
    # is the world-volume path itself and not the density. Atmospheric depth
    # is therefore left to the Nishita sky's own aerial perspective for now
    # and remains an open R1 item; a bounded volume box around the scene is
    # the next thing to try rather than an infinite world medium.

    bpy.context.scene.world = world
    return world


def sun_lamp(elev_deg, rot_deg, energy, color=(1.0, 0.95, 0.88), angle=0.545):
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
    # Blender's default far clip is 1000 m and this was never set. The far
    # context ring tops out around 430 m so it survived, but a cloud layer at
    # 680-1240 m altitude sits 1400-2600 m out along the sightline -- entirely
    # beyond the plane. The clouds were being built correctly and then clipped
    # away, which renders as a perfectly clean empty sky and looks exactly
    # like "the clouds did not work".
    d.clip_start = 0.05
    d.clip_end = 40000.0
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
        # Prefer the rhythm-carrying context shader; fall back to the plain
        # masonry keys so other concepts keep working unchanged.
        warm = mats.get("ctx_warm", mats["city_warm"])
        cool = mats.get("ctx_cool", mats["city_cool"])
        mat = warm if era else cool
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



def road_surface(name="asphalt", tile=(1.6, 1.6)):
    """
    Asphalt, with the grime where the water actually goes.

    The gutter is not painted on as a stripe. The cross-section already puts
    the gutter at the LOW POINT of the profile -- 0.02 m against a 0.22 m
    crown -- so grime is keyed to world Z across exactly that range. Fines and
    run-off collect at the low point because it is the low point, so the
    darkening lands in the gutter line on its own, follows the crossfall, and
    fades out toward the crown. Nothing has to know where the gutter is.

    That is also why it cannot become a cartoon stripe: it is a gradient over
    200 mm of real fall, not a band of a chosen width.
    """
    mat = cc0(name, "asphalt", tile, rough_boost=0.05)
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    base_link = bsdf.inputs["Base Color"].links[0]
    src, sock = base_link.from_node, base_link.from_socket

    geo = nt.nodes.new("ShaderNodeNewGeometry")
    geo.location = (-1500, -900)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    sep.location = (-1320, -900)
    nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])
    low = nt.nodes.new("ShaderNodeMapRange")
    low.location = (-1120, -900)
    low.clamp = True
    low.inputs["From Min"].default_value = 0.02      # gutter invert
    low.inputs["From Max"].default_value = 0.22      # carriageway crown
    low.inputs["To Min"].default_value = 1.0
    low.inputs["To Max"].default_value = 0.0
    nt.links.new(sep.outputs["Z"], low.inputs["Value"])

    grime = nt.nodes.new("ShaderNodeMixRGB")
    grime.location = (-360, 260)
    grime.blend_type = "MULTIPLY"
    grime.inputs["Color2"].default_value = srgb(0x6E6A62)
    nt.links.new(low.outputs["Result"], grime.inputs["Fac"])
    nt.links.new(sock, grime.inputs["Color1"])

    # ---- GATE CONTACT ----------------------------------------------------
    #
    # Tracked material LIGHTENS asphalt. Everything about site dirt wants to
    # be painted dark, but what actually comes out of a gate on tyres is dry
    # fines off a compacted haul route -- pale, dusty, and lighter than the
    # bitumen it lands on. Darkening here would read as oil, which no process
    # in this world produces.
    #
    # Keyed to real distance from the gate mouth at (0, -24) so it PEAKS at
    # the crossing and decays over 17 m, which is roughly as far as a wheel
    # carries it before it is worn off.
    gx = nt.nodes.new("ShaderNodeVectorMath")
    gx.location = (-1120, -1120)
    gx.operation = "DISTANCE"
    gx.inputs[1].default_value = (0.0, -24.0, 0.10)
    nt.links.new(geo.outputs["Position"], gx.inputs[0])
    gfall = nt.nodes.new("ShaderNodeMapRange")
    gfall.location = (-900, -1120)
    gfall.clamp = True
    gfall.inputs["From Min"].default_value = 3.0
    gfall.inputs["From Max"].default_value = 17.0
    gfall.inputs["To Min"].default_value = 0.55
    gfall.inputs["To Max"].default_value = 0.0
    nt.links.new(gx.outputs["Value"], gfall.inputs["Value"])
    tracked = nt.nodes.new("ShaderNodeMixRGB")
    tracked.location = (-180, 260)
    tracked.blend_type = "MIX"
    tracked.inputs["Color2"].default_value = srgb(0x9A8E78)
    nt.links.new(gfall.outputs["Result"], tracked.inputs["Fac"])
    nt.links.new(grime.outputs["Color"], tracked.inputs["Color1"])
    nt.links.new(tracked.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def standard_materials(wear=0.5, lit=0.0):
    """
    The full material set every concept shares, so a difference between two
    concepts is a difference in ARCHITECTURE, not in colour grading.

    Photographic CC0 sets replace the procedural swatches wherever a real
    surface exists for them. The procedural versions remain as the fallback
    when the CC0 files are not on disk -- and only as that.
    """
    if cc0_available():
        return {
            # Tiles measured from the images, in metres (horizontal, vertical).
            "conc": in_situ_concrete("conc", "concrete", (2.4, 2.4),
                                     tint=0xB8BAB8),
            "wet": cc0("wet", "concrete", (2.4, 2.4), tint=0x6F757C),
            # ~12 courses over the 512 px height at ~86 mm a course.
            # CONTEXT FACADES KEEP THE PROCEDURAL SHADER, DELIBERATELY.
            #
            # context_city's docstring promises "its facade carries a WINDOW
            # RHYTHM from the brick shader" -- and city_facade() does build
            # exactly that. But it was only ever called in the procedural
            # FALLBACK branch. The moment the CC0 sets landed, city_warm and
            # city_cool became plain brick and concrete photographs, and every
            # context block in the world silently lost its windows. That is
            # the whole reason the terrace reads as massing: a mid-distance
            # building with no opening rhythm has no scale and no function,
            # and no amount of photographic grain supplies either.
            #
            # The near neighbours are unaffected -- they carry modelled
            # openings and keep the photographic sets below.
            "ctx_warm": city_facade("ctx_warm", 0xA89684, lit=lit),
            "ctx_cool": city_facade("ctx_cool", 0x93A0AD, lit=lit),
            "city_warm": cc0("city_warm", "brick", (2.06, 1.03), wear_mask=0.7),
            "city_cool": cc0("city_cool", "concrete", (2.4, 2.4), tint=0xAEB6BE,
                             wear_mask=0.7),
            # CONCRETE BLOCKWORK. Infill was being built out of the in-situ
            # concrete material, so the envelope and the frame carrying it
            # were physically the same surface and the wall mass could not be
            # separated from the structure at any distance.
            #
            # It gets the concrete set, NOT the brick set: `tint` here is a
            # MULTIPLY, so tinting the brick photo grey produced blockwork
            # DARKER than the frame -- measured, -0.019 mean over level 1.
            # The separation that matters at 70 m is value, not coursing: a
            # 225 mm course subtends 0.6 px at the establishing camera. Dry
            # laid, clean and unweathered against a frame that has stood
            # through months of rain is a real ~1.5x albedo difference, and
            # it is flatter because a block face is not a formed face.
            "block": cc0("block", "concrete", (1.35, 0.68), rough_boost=0.20,
                         tint=0xDCDAD2),
            # ---- THE STREET IS FIVE MATERIALS, NOT ONE ------------------
            #
            # road, gutter, kerb, footpath and median were all handed
            # mats["spandrel"] -- one asphalt across the entire cross-section.
            # The profile described a kerb upstand and a gutter low point
            # correctly and then rendered them as the same substance, which is
            # the actual reason the foreground read as a single grey plane.
            #
            # Tile sizes are measured against real surfaces: 1.6 m of asphalt
            # spans about a lane width of aggregate; a 2.9 m footpath tile
            # lands the CC0 concrete near real bay size without repeating
            # visibly at eye level.
            "asphalt": road_surface("asphalt", tile=(1.6, 1.6)),
            "kerb": cc0("kerb", "concrete", (1.10, 1.10), tint=0xC6C3BA,
                        rough_boost=0.06),
            "footpath": cc0("footpath", "concrete", (2.90, 2.90),
                            tint=0xB4B2AA, rough_boost=0.14, wear_mask=0.5),
            "median_top": site_ground("median_top", base="ground",
                                      tile=(1.8, 1.8)),
            # The haul route is the SAME GROUND, trafficked. Compaction is
            # what makes it different: a tighter tile because the surface has
            # been broken down by wheels, a flatter roughness because it has
            # been rolled, and a paler drier tint because the fines have been
            # worked up and the moisture driven out of the top. Unused soil
            # keeps its own coarser identity.
            "haul": site_ground("haul", base="ground", tile=(1.15, 1.15)),
            # Road paint: thermoplastic, laid years ago and driven over.
            # Off-white rather than white, matte rather than glossy, and NOT
            # emissive -- glowing lane lines are the single clearest game cue
            # a street can have.
            "roadline": painted("roadline", 0xC9C3B6, rough=0.74, wear=0.55),
            "spandrel": cc0("spandrel", "asphalt", (2.0, 2.0)),
            "earth": site_ground("earth"),
            "ply": cc0("ply", "ply", (2.0, 2.0)),
            "galv": galvanised("galv"),
            "paint": painted("paint", 0x8A9096, rough=0.5),
            "crane": painted("crane", 0xC8611A, rough=0.44, wear=0.4),
            "screen": painted("screen", 0x2F6F8C, rough=0.62, wear=0.25),
            "glass": glass("glass"),
        # An unlit room seen through glazing. Not decoration: without a dark
        # volume behind an opening the eye sees the masonry BEHIND the window
        # and the whole facade collapses back into a slab.
        "interior": painted("interior", 0x14171B, rough=0.94, wear=0.0),
            "hiviz": painted("hiviz", 0xCBE034, rough=0.62, wear=0.1),
            "workwear": painted("workwear", 0x2C3540, rough=0.85, wear=0.1),
            "hat": painted("hat", 0xE8E4DC, rough=0.42, wear=0.1),
            "skin": painted("skin", 0x8A6A52, rough=0.78, wear=0.05),
        }
    return {
        "conc": concrete("conc", 0x9AA0A6, wear=wear),
        # Fresh concrete: darker, bluer, and much smoother because it is wet.
        "wet": concrete("wet", 0x6F757C, wear=0.15, wet=0.85),
        "ply": plywood("ply"),
        # Blockwork: laid clean, so lighter and flatter than the cast frame.
        "block": concrete("block", 0xCFCCC3, pour_step=0.0, wear=0.12),
        "galv": galvanised("galv"),
        "paint": painted("paint", 0x8A9096, rough=0.5),
        "crane": painted("crane", 0xC8611A, rough=0.44, wear=0.4),
        "screen": painted("screen", 0x2F6F8C, rough=0.62, wear=0.25),
        "asphalt": painted("asphalt", 0x33383D, rough=0.62, wear=0.2),
        "kerb": concrete("kerb", 0xC6C3BA, wear=0.3),
        "footpath": concrete("footpath", 0xB4B2AA, wear=0.45),
        "median_top": earth("median_top"),
        "haul": earth("haul", damp=0.05),
        "roadline": painted("roadline", 0xC9C3B6, rough=0.74, wear=0.55),
        "spandrel": painted("spandrel", 0x3A4149, rough=0.4, wear=0.15),
        "glass": glass("glass"),
        # An unlit room seen through glazing. Not decoration: without a dark
        # volume behind an opening the eye sees the masonry BEHIND the window
        # and the whole facade collapses back into a slab.
        "interior": painted("interior", 0x14171B, rough=0.94, wear=0.0),
        "city_warm": city_facade("city_warm", 0xA89684, lit=lit),
        "city_cool": city_facade("city_cool", 0x93A0AD, lit=lit),
        "ctx_warm": city_facade("ctx_warm", 0xA89684, lit=lit),
        "ctx_cool": city_facade("ctx_cool", 0x93A0AD, lit=lit),
        "earth": earth("earth"),
        "hiviz": painted("hiviz", 0xCBE034, rough=0.62, wear=0.1),
        "workwear": painted("workwear", 0x2C3540, rough=0.85, wear=0.1),
        "hat": painted("hat", 0xE8E4DC, rough=0.42, wear=0.1),
        "skin": painted("skin", 0x8A6A52, rough=0.78, wear=0.05),
    }


# ---------------------------------------------------------------------------
# CC0 photographic PBR materials
# ---------------------------------------------------------------------------
#
# Procedural noise varies a COLOUR. It does not make a surface BE something.
# The reset diagnosis found the procedural brick running at ~3 m per course --
# invisible as brick, reading as flat cream -- and that is the general failure,
# not a tuning error.
#
# These are photographic CC0 sets from ambientCG, licence verified from their
# own licence page (Creative Commons CC0 1.0 Universal). Provenance is recorded
# in docs/world-material-plan.md.

# NOT under frontend/public. These are AUTHORING sources for Blender; the
# runtime does not reference them yet, and 15 MB of unused images in the
# public directory would ship in the bundle for nothing. When production
# consumes them they will be re-exported at runtime resolution, not copied.
CC0_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "tools", "textures", "cc0")


def cc0(name, base, tile=(2.0, 2.0), rough_boost=0.0, tint=None,
        wear_mask=0.0):
    """
    A photographic PBR material, box-projected at a REAL WORLD SCALE.

    `tile` is the physical size the texture represents, in metres, as
    (horizontal, vertical). It is the single most important number here: the
    brick set is 1024x512 showing about twelve courses, and a course with its
    mortar is ~86 mm, so its tile is 2.06 x 1.03 m. Measured off the image, not
    guessed -- guessing is what produced a three-metre brick last time.

    BOX projection is Blender's own triplanar. It means these materials need no
    UVs and cannot stretch, which matters because the production meshes join a
    34 m party wall to a 600 mm column and no unwrap serves both.
    """
    mat, nt, bsdf = _new_material(name)

    geo = nt.nodes.new("ShaderNodeNewGeometry")
    geo.location = (-1500, 0)
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.location = (-1300, 0)
    # Scale is the RECIPROCAL of the tile: a 2 m tile repeats every 2 m.
    mp.inputs["Scale"].default_value = (1.0 / tile[0], 1.0 / tile[0], 1.0 / tile[1])
    nt.links.new(geo.outputs["Position"], mp.inputs["Vector"])

    def image(slot, filename, non_color):
        path = os.path.join(CC0_DIR, filename)
        if not os.path.exists(path):
            return None
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(path, check_existing=True)
        tex.projection = "BOX"
        tex.projection_blend = 0.35
        tex.extension = "REPEAT"
        if non_color:
            tex.image.colorspace_settings.name = "Non-Color"
        tex.location = (-1050, slot * 300)
        nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
        return tex

    color = image(1, f"{base}-color.jpg", False)
    rough = image(0, f"{base}-roughness.jpg", True)
    norm = image(-1, f"{base}-normal.jpg", True)

    # ---- WEAR, AS A MASK -------------------------------------------------
    #
    # Splashback near the ground and run-off below openings, driven by world
    # height and a stretched noise. This is where dirt ACTUALLY collects:
    # rain kicks grit up the first half-metre of any wall, and water runs
    # DOWN. A uniform grunge overlay reads as a dirty texture; a height-driven
    # one reads as weather.
    if wear_mask:
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        sep.location = (-1050, -650)
        nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])
        # Splash: strongest at 0 m, gone by ~0.6 m.
        splash = nt.nodes.new("ShaderNodeMapRange")
        splash.location = (-860, -650)
        splash.inputs["From Min"].default_value = 0.0
        splash.inputs["From Max"].default_value = 0.62
        splash.inputs["To Min"].default_value = 1.0
        splash.inputs["To Max"].default_value = 0.0
        splash.clamp = True
        nt.links.new(sep.outputs["Z"], splash.inputs["Value"])
        # Break the band up so it is not a clean gradient ring.
        grit = nt.nodes.new("ShaderNodeTexNoise")
        grit.location = (-860, -880)
        grit.inputs["Scale"].default_value = 5.5
        grit.inputs["Detail"].default_value = 6.0
        nt.links.new(mp.outputs["Vector"], grit.inputs["Vector"])
        gmix = nt.nodes.new("ShaderNodeMath")
        gmix.location = (-660, -760)
        gmix.operation = "MULTIPLY"
        nt.links.new(splash.outputs["Result"], gmix.inputs[0])
        nt.links.new(grit.outputs["Fac"], gmix.inputs[1])
        dirt = nt.nodes.new("ShaderNodeMath")
        dirt.location = (-480, -760)
        dirt.operation = "MULTIPLY"
        dirt.inputs[1].default_value = wear_mask
        nt.links.new(gmix.outputs["Value"], dirt.inputs[0])

    if color:
        if tint:
            mix = nt.nodes.new("ShaderNodeMixRGB")
            mix.location = (-700, 300)
            mix.blend_type = "MULTIPLY"
            mix.inputs["Fac"].default_value = 1.0
            mix.inputs["Color2"].default_value = srgb(tint)
            nt.links.new(color.outputs["Color"], mix.inputs["Color1"])
            nt.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
        else:
            nt.links.new(color.outputs["Color"], bsdf.inputs["Base Color"])

        if wear_mask:
            grime = nt.nodes.new("ShaderNodeMixRGB")
            grime.location = (-300, 300)
            grime.blend_type = "MULTIPLY"
            grime.inputs["Color2"].default_value = srgb(0x6B6055)
            src = bsdf.inputs["Base Color"].links[0].from_socket
            nt.links.new(src, grime.inputs["Color1"])
            nt.links.new(dirt.outputs["Value"], grime.inputs["Fac"])
            nt.links.new(grime.outputs["Color"], bsdf.inputs["Base Color"])

    if rough:
        if rough_boost:
            rr = nt.nodes.new("ShaderNodeMapRange")
            rr.location = (-700, 0)
            rr.inputs["To Min"].default_value = min(1.0, rough_boost)
            rr.inputs["To Max"].default_value = 1.0
            nt.links.new(rough.outputs["Color"], rr.inputs["Value"])
            nt.links.new(rr.outputs["Result"], bsdf.inputs["Roughness"])
        else:
            nt.links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])

    if norm:
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.location = (-700, -300)
        # Shallow. A strong normal turns concrete into rock and asphalt into
        # lava; this is micro relief, not geology.
        nm.inputs["Strength"].default_value = 0.7
        nt.links.new(norm.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])

    return mat


def cc0_available():
    """Whether the CC0 sets are actually on disk, so a build can fall back to
    the procedural materials rather than exporting untextured geometry."""
    return os.path.exists(os.path.join(CC0_DIR, "brick-color.jpg"))


def atmosphere_box(size=1400.0, height=320.0, density=2.2e-5,
                   tint=0x9FB4D4):
    """
    Atmospheric perspective as a BOUNDED volume, not an infinite medium.

    The infinite world volume rendered every frame black even at a density
    whose optical depth over 300 m is under 0.01, so the world-volume path
    itself is unusable here. A finite box the camera sits inside behaves
    normally.

    What this buys is the single relationship that communicates distance:
    contrast loss with range. Foreground scaffold keeps its darkest darks,
    the city 300 m away lifts and desaturates. The viewer should never think
    "there is fog" -- only "that is far away" -- so the density is set so a
    surface at 20 m is essentially untouched.

    Cube normals point outward; a volume needs the camera INSIDE it, and
    Cycles handles that as long as the mesh is closed, which a default cube is.
    """
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, height / 2 - 20))
    ob = bpy.context.active_object
    ob.name = "atmosphere"
    ob.scale = (size, size, height)
    # It must not block the sun or cast anything.
    ob.visible_shadow = False

    mat = bpy.data.materials.new("atmosphere")
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    vol = nt.nodes.new("ShaderNodeVolumeScatter")
    vol.inputs["Density"].default_value = density
    vol.inputs["Anisotropy"].default_value = 0.3
    vol.inputs["Color"].default_value = srgb(tint)
    nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])
    ob.data.materials.append(mat)
    return ob


def site_ground(name="site_ground", base="ground", tile=(2.4, 2.4)):
    """
    Site ground whose condition is derived from WHAT HAPPENS ON IT.

    The pad rendered as one uniform grey field in every gate view, which is a
    strong CG tell: real site ground is a record of activity. But the fix is
    not a mud texture or scattered stains -- that produces a game terrain.

    The rule is CAUSE -> MASK -> MATERIAL RESPONSE. Four zones, each with a
    physical reason, each blended with a metre-scale noise so no boundary is a
    clean edge:

        haul route    vehicles drive from the gate to the core, so a band down
                      the middle is COMPACTED: darker, smoother, less rough
        gate apron    the street/site transition, where soil is tracked out and
                      road dirt tracked in -- the busiest ground on any site
        staging       around the delivered material: dust, aggregate and
                      concrete residue, so lighter and rougher
        quiet edges   nobody walks there, so it stays as delivered

    Every mask is expressed in METRES against world position, because the
    commonest CG tell in ground is procedural variation at the wrong scale.
    """
    mat, nt, bsdf = _new_material(name)

    geo = nt.nodes.new("ShaderNodeNewGeometry")
    geo.location = (-1700, 0)
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.location = (-1500, 0)
    mp.inputs["Scale"].default_value = (1.0 / tile[0], 1.0 / tile[0], 1.0 / tile[1])
    nt.links.new(geo.outputs["Position"], mp.inputs["Vector"])

    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    sep.location = (-1500, -400)
    nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])

    def image(slot, filename, non_color):
        path = os.path.join(CC0_DIR, filename)
        if not os.path.exists(path):
            return None
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(path, check_existing=True)
        tex.projection = "BOX"
        tex.projection_blend = 0.35
        if non_color:
            tex.image.colorspace_settings.name = "Non-Color"
        tex.location = (-1250, slot * 300)
        nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
        return tex

    color = image(1, f"{base}-color.jpg", False)
    rough = image(0, f"{base}-roughness.jpg", True)
    norm = image(-1, f"{base}-normal.jpg", True)

    # ---- Edge-breaking noise, at a ~1.5 m feature size -------------------
    edge = nt.nodes.new("ShaderNodeTexNoise")
    edge.location = (-1250, -520)
    edge.inputs["Scale"].default_value = 0.7
    edge.inputs["Detail"].default_value = 6.0
    nt.links.new(mp.outputs["Vector"], edge.inputs["Vector"])

    def band(node_x, value_socket, lo, hi, invert=False):
        """1 inside [lo, hi] metres, falling off over ~1.2 m at each side."""
        r = nt.nodes.new("ShaderNodeMapRange")
        r.location = (node_x, -400)
        r.inputs["From Min"].default_value = lo
        r.inputs["From Max"].default_value = hi
        r.inputs["To Min"].default_value = 1.0 if invert else 0.0
        r.inputs["To Max"].default_value = 0.0 if invert else 1.0
        r.clamp = True
        nt.links.new(value_socket, r.inputs["Value"])
        return r

    # HAUL ROUTE: |x| under about 3.5 m, running the depth of the pad.
    haul = band(-1050, sep.outputs["X"], 5.2, 2.6)     # 1 at centre
    haul_abs = nt.nodes.new("ShaderNodeMath")
    haul_abs.location = (-1250, -400)
    haul_abs.operation = "ABSOLUTE"
    nt.links.new(sep.outputs["X"], haul_abs.inputs[0])
    nt.links.new(haul_abs.outputs["Value"], haul.inputs["Value"])

    # GATE APRON: the street transition, y under about -14 m.
    apron = band(-1050, sep.outputs["Y"], -12.0, -20.0)

    # Combine, then break both edges with the noise so nothing is a clean line.
    zones = nt.nodes.new("ShaderNodeMath")
    zones.location = (-850, -400)
    zones.operation = "MAXIMUM"
    nt.links.new(haul.outputs["Result"], zones.inputs[0])
    nt.links.new(apron.outputs["Result"], zones.inputs[1])

    broken = nt.nodes.new("ShaderNodeMath")
    broken.location = (-680, -400)
    broken.operation = "MULTIPLY"
    nt.links.new(zones.outputs["Value"], broken.inputs[0])
    nt.links.new(edge.outputs["Fac"], broken.inputs[1])

    # ---- Response: compacted ground is DARKER and SMOOTHER ---------------
    if color:
        dark = nt.nodes.new("ShaderNodeMixRGB")
        dark.location = (-420, 300)
        dark.blend_type = "MULTIPLY"
        dark.inputs["Color2"].default_value = srgb(0x6E6455)
        nt.links.new(color.outputs["Color"], dark.inputs["Color1"])
        nt.links.new(broken.outputs["Value"], dark.inputs["Fac"])
        nt.links.new(dark.outputs["Color"], bsdf.inputs["Base Color"])

    if rough:
        smooth = nt.nodes.new("ShaderNodeMixRGB")
        smooth.location = (-420, 0)
        smooth.blend_type = "MIX"
        smooth.inputs["Color2"].default_value = (0.62, 0.62, 0.62, 1.0)
        nt.links.new(rough.outputs["Color"], smooth.inputs["Color1"])
        nt.links.new(broken.outputs["Value"], smooth.inputs["Fac"])
        nt.links.new(smooth.outputs["Color"], bsdf.inputs["Roughness"])

    if norm:
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.location = (-420, -260)
        # Traffic flattens relief as well as roughness.
        st = nt.nodes.new("ShaderNodeMath")
        st.location = (-600, -160)
        st.operation = "SUBTRACT"
        st.inputs[0].default_value = 0.85
        nt.links.new(broken.outputs["Value"], st.inputs[1])
        nt.links.new(st.outputs["Value"], nm.inputs["Strength"])
        nt.links.new(norm.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])

    return mat


def in_situ_concrete(name="conc", base="concrete", tile=(2.4, 2.4),
                     lift=3.3, wear_mask=0.85, tint=None):
    """
    In-situ concrete that was poured in LIFTS, one storey at a time.

    The photographic CC0 set gave the surface real identity, and it is still
    the weakest material in the frame -- because a 34 m party wall carries ONE
    continuous texture. Real concrete of that height is not one surface. It is
    a stack of pours, each cast weeks apart against different formwork, each
    curing to a slightly different tone, with a visible joint where one meets
    the next.

    That is the difference between "concrete texture" and "concrete building",
    and it is a MESO-scale property -- the scale the eye reads at 40 m, which
    is exactly the range these gate cameras sit at. Micro roughness and macro
    silhouette were already right; this is the band between them.

    Three additions, all keyed to the real 3.3 m storey:

      pour tone       each lift gets a small deterministic tonal offset, so
                      adjacent pours differ by a few percent -- never enough
                      to read as stripes, always enough to break the monolith
      joint line      a darkened band a few centimetres deep where two pours
                      meet, which is where laitance and dirt actually collect
      quiet regions   the variation is LOW frequency by construction, so most
                      of every wall stays calm; noise everywhere is its own
                      tell and is what "grunge" gets wrong
    """
    mat, nt, bsdf = _new_material(name)

    geo = nt.nodes.new("ShaderNodeNewGeometry")
    geo.location = (-1900, 0)
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.location = (-1700, 0)
    mp.inputs["Scale"].default_value = (1.0 / tile[0], 1.0 / tile[0], 1.0 / tile[1])
    nt.links.new(geo.outputs["Position"], mp.inputs["Vector"])

    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    sep.location = (-1700, -560)
    nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])

    def image(slot, filename, non_color):
        path = os.path.join(CC0_DIR, filename)
        if not os.path.exists(path):
            return None
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(path, check_existing=True)
        tex.projection = "BOX"
        tex.projection_blend = 0.35
        if non_color:
            tex.image.colorspace_settings.name = "Non-Color"
        tex.location = (-1450, slot * 300)
        nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
        return tex

    color = image(1, f"{base}-color.jpg", False)
    rough = image(0, f"{base}-roughness.jpg", True)
    norm = image(-1, f"{base}-normal.jpg", True)

    # ---- WHICH POUR IS THIS? --------------------------------------------
    # Height divided by the lift, floored: an integer that changes once per
    # storey and is constant across a whole pour.
    div = nt.nodes.new("ShaderNodeMath")
    div.location = (-1450, -560)
    div.operation = "DIVIDE"
    div.inputs[1].default_value = lift
    nt.links.new(sep.outputs["Z"], div.inputs[0])

    idx = nt.nodes.new("ShaderNodeMath")
    idx.location = (-1280, -480)
    idx.operation = "FLOOR"
    nt.links.new(div.outputs["Value"], idx.inputs[0])

    # A cheap deterministic hash of the pour index -> tone in 0..1.
    hashed = nt.nodes.new("ShaderNodeMath")
    hashed.location = (-1110, -480)
    hashed.operation = "MULTIPLY"
    hashed.inputs[1].default_value = 12.9898
    nt.links.new(idx.outputs["Value"], hashed.inputs[0])
    sine = nt.nodes.new("ShaderNodeMath")
    sine.location = (-950, -480)
    sine.operation = "SINE"
    nt.links.new(hashed.outputs["Value"], sine.inputs[0])
    frac = nt.nodes.new("ShaderNodeMath")
    frac.location = (-800, -480)
    frac.operation = "FRACT"
    scale43758 = nt.nodes.new("ShaderNodeMath")
    scale43758.location = (-880, -560)
    scale43758.operation = "MULTIPLY"
    scale43758.inputs[1].default_value = 43758.5453
    nt.links.new(sine.outputs["Value"], scale43758.inputs[0])
    nt.links.new(scale43758.outputs["Value"], frac.inputs[0])

    # Map the hash to a NARROW tonal range. Adjacent pours differ by a few
    # percent; anything wider reads as painted stripes.
    tone = nt.nodes.new("ShaderNodeMapRange")
    tone.location = (-640, -480)
    # 0.88-1.06 measured as invisible at the 40 m the gate cameras stand at.
    # Widened, still narrow enough that no two adjacent pours read as stripes.
    tone.inputs["To Min"].default_value = 0.78
    tone.inputs["To Max"].default_value = 1.12
    nt.links.new(frac.outputs["Value"], tone.inputs["Value"])

    # ---- THE JOINT between two pours -------------------------------------
    # Distance from the nearest lift boundary, in metres.
    within = nt.nodes.new("ShaderNodeMath")
    within.location = (-1280, -700)
    within.operation = "FRACT"
    nt.links.new(div.outputs["Value"], within.inputs[0])
    metres = nt.nodes.new("ShaderNodeMath")
    metres.location = (-1110, -700)
    metres.operation = "MULTIPLY"
    metres.inputs[1].default_value = lift
    nt.links.new(within.outputs["Value"], metres.inputs[0])
    joint = nt.nodes.new("ShaderNodeMapRange")
    joint.location = (-950, -700)
    joint.inputs["From Min"].default_value = 0.0
    joint.inputs["From Max"].default_value = 0.13      # ~130 mm, so it reads
    joint.inputs["To Min"].default_value = 1.0
    joint.inputs["To Max"].default_value = 0.0
    joint.clamp = True
    nt.links.new(metres.outputs["Value"], joint.inputs["Value"])

    # ---- Splashback, as before -------------------------------------------
    splash = nt.nodes.new("ShaderNodeMapRange")
    splash.location = (-950, -860)
    splash.inputs["From Min"].default_value = 0.0
    splash.inputs["From Max"].default_value = 0.62
    splash.inputs["To Min"].default_value = 1.0
    splash.inputs["To Max"].default_value = 0.0
    splash.clamp = True
    nt.links.new(sep.outputs["Z"], splash.inputs["Value"])
    grit = nt.nodes.new("ShaderNodeTexNoise")
    grit.location = (-1110, -1000)
    grit.inputs["Scale"].default_value = 5.5
    grit.inputs["Detail"].default_value = 6.0
    nt.links.new(mp.outputs["Vector"], grit.inputs["Vector"])
    dirt = nt.nodes.new("ShaderNodeMath")
    dirt.location = (-760, -900)
    dirt.operation = "MULTIPLY"
    nt.links.new(splash.outputs["Result"], dirt.inputs[0])
    nt.links.new(grit.outputs["Fac"], dirt.inputs[1])
    dirt_amt = nt.nodes.new("ShaderNodeMath")
    dirt_amt.location = (-600, -900)
    dirt_amt.operation = "MULTIPLY"
    dirt_amt.inputs[1].default_value = wear_mask
    nt.links.new(dirt.outputs["Value"], dirt_amt.inputs[0])

    # ---- Compose ---------------------------------------------------------
    if color:
        pour = nt.nodes.new("ShaderNodeMixRGB")
        pour.location = (-420, 320)
        pour.blend_type = "MULTIPLY"
        pour.inputs["Fac"].default_value = 1.0
        nt.links.new(color.outputs["Color"], pour.inputs["Color1"])
        tone_rgb = nt.nodes.new("ShaderNodeCombineColor")
        tone_rgb.location = (-560, 180)
        for ch in ("Red", "Green", "Blue"):
            nt.links.new(tone.outputs["Result"], tone_rgb.inputs[ch])
        nt.links.new(tone_rgb.outputs["Color"], pour.inputs["Color2"])

        jointed = nt.nodes.new("ShaderNodeMixRGB")
        jointed.location = (-260, 320)
        jointed.blend_type = "MULTIPLY"
        jointed.inputs["Color2"].default_value = srgb(0x4E4E4C)
        nt.links.new(pour.outputs["Color"], jointed.inputs["Color1"])
        nt.links.new(joint.outputs["Result"], jointed.inputs["Fac"])

        grimed = nt.nodes.new("ShaderNodeMixRGB")
        grimed.location = (-110, 320)
        grimed.blend_type = "MULTIPLY"
        grimed.inputs["Color2"].default_value = srgb(0x6B6055)
        nt.links.new(jointed.outputs["Color"], grimed.inputs["Color1"])
        nt.links.new(dirt_amt.outputs["Value"], grimed.inputs["Fac"])
        out_color = grimed
        if tint:
            tinted = nt.nodes.new("ShaderNodeMixRGB")
            tinted.location = (40, 320)
            tinted.blend_type = "MULTIPLY"
            tinted.inputs["Fac"].default_value = 1.0
            tinted.inputs["Color2"].default_value = srgb(tint)
            nt.links.new(grimed.outputs["Color"], tinted.inputs["Color1"])
            out_color = tinted
        nt.links.new(out_color.outputs["Color"], bsdf.inputs["Base Color"])

    if rough:
        # The joint is rougher: laitance and trapped dirt, not smooth concrete.
        jr = nt.nodes.new("ShaderNodeMixRGB")
        jr.location = (-420, 0)
        jr.inputs["Color2"].default_value = (1.0, 1.0, 1.0, 1.0)
        nt.links.new(rough.outputs["Color"], jr.inputs["Color1"])
        nt.links.new(joint.outputs["Result"], jr.inputs["Fac"])
        nt.links.new(jr.outputs["Color"], bsdf.inputs["Roughness"])

    if norm:
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.location = (-420, -280)
        nm.inputs["Strength"].default_value = 0.7
        nt.links.new(norm.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])

    return mat


# ---------------------------------------------------------------------------
# EXPORT-TIME UV PROJECTION
# ---------------------------------------------------------------------------
#
# THE PIPELINE GAP THIS CLOSES
#
# The CC0 materials sample their images with BOX projection driven by world
# Position. That is correct for Blender and inexpressible in glTF: the format
# carries a texture plus a UV set, not a projection mode. So the production
# export had to flatten every material to a constant colour, and the runtime
# substituted its own baked swatches through a triplanar shader patch.
#
# The consequence is that the photographic CC0 maps -- the thing that gave the
# world material identity in the first place -- stopped at the Blender boundary
# and never reached the browser.
#
# Cube projection at the material's REAL WORLD TILE produces UVs that are
# equivalent to what box projection was doing, and glTF exports them natively.
# One texture set, authored once, delivered intact.

# The world tile each material was authored at, in metres. Must match the
# `tile` argument used when the material was built, or the texture will be the
# right image at the wrong size -- which is the failure this whole effort keeps
# rediscovering.
EXPORT_UV_TILE = {
    "conc": 2.4, "wet": 2.4, "city_warm": 2.06, "city_cool": 2.4,
    "spandrel": 2.0, "earth": 2.4, "ply": 2.0,
}
DEFAULT_UV_TILE = 2.4


def uv_project_for_export(ob, tile=DEFAULT_UV_TILE):
    """
    Give an object UVs equivalent to box projection at a real metre scale.

    Cube projection rather than Smart UV Project on purpose: smart unwrap
    optimises for packing, which gives every face a different texel density.
    These meshes join a 34 m party wall to a 600 mm column, so consistent
    world-scale density matters far more than atlas efficiency -- and it is
    precisely the stretching this project has failed on before.
    """
    if ob is None or ob.type != "MESH":
        return None
    if not ob.data.uv_layers:
        ob.data.uv_layers.new(name="UVMap")
    with bpy.context.temp_override(object=ob, active_object=ob,
                                   selected_objects=[ob],
                                   selected_editable_objects=[ob]):
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        # cube_size is the world size mapped to one UV unit.
        bpy.ops.uv.cube_project(cube_size=tile, correct_aspect=False)
        bpy.ops.object.mode_set(mode="OBJECT")
    return ob


def to_uv_materials():
    """
    Retarget every CC0 material from BOX/world projection to the UV set.

    Names and slots are preserved exactly, so the runtime's material-name
    lookup keeps working and nothing downstream has to know this happened.
    """
    retargeted = []
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        images = [n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"]
        if not images:
            continue
        for tex in images:
            tex.projection = "FLAT"
            # Drop the world-position input; an unconnected Vector makes the
            # node fall back to the active UV set, which is what we want.
            for link in list(tex.inputs["Vector"].links):
                mat.node_tree.links.remove(link)
        retargeted.append(mat.name)
    return retargeted


# Two reproducible source conditions. Not art direction -- the architecture
# has to hold under both, and a cover that improves the render by hiding
# geometry is a failure, not a feature.
#
# Every length below is METRES. "body 900" means a cloud mass about 900 m
# across, which is an ordinary fair-weather cumulus. The previous version
# expressed this as "Noise scale = 14" against a normalised domain, which is
# a number with no physical meaning and could not be reasoned about or
# checked against the sky.
# cover 0.52 put so little cloud in the sky that the production sightline
# came back indistinguishable from CLEAR -- correct as weather, useless as a
# test condition. 0.455 keeps the forms separate and the sky mostly open
# while actually putting cloud in the frame.
CLOUD_LIGHT = dict(body=780.0, brk=240.0, erode=0.34, cover=0.455, span=0.09,
                   density=0.0060)
CLOUD_MODERATE = dict(body=1150.0, brk=300.0, erode=0.26, cover=0.40, span=0.13,
                      density=0.0085)


def clouds(name="clouds", preset=None, base=680.0, top=1240.0, extent=14000.0,
           debug_emit=False):
    """
    A real volumetric cloud layer, at real altitude, in real metres.

    WHY THE FIRST VERSION MADE FOG INSTEAD OF WEATHER
    -------------------------------------------------
    It drove the noise from `Texture Coordinate > Generated` through a Mapping
    node. Generated is the object's bounding box normalised 0..1, so every
    feature size was expressed as a fraction of a domain that was itself
    arbitrary -- and a camera looking up through the layer crosses only a few
    percent of that box. The field was varying, but the visible slice sampled
    barely a fraction of one cycle of it, so it resolved to a single smooth
    value: a veil. Changing the noise scale moved the cycle count a little and
    never changed that, which is exactly the invariance the bracket tests kept
    reporting.

    The field now comes from `Geometry > Position` in WORLD METRES, divided by
    an explicit feature size. `body=780` means a mass about 780 m across. That
    is checkable against a photograph of the sky; "scale 14" was not.

    Structure is deliberately only two fields -- one body, one breakup that
    ERODES it -- because a subtractive breakup is what opens holes in a cover.
    Density multiplied by a mask only ever makes thin fog.
    """
    cfg = dict(CLOUD_LIGHT if preset is None else preset)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, (base + top) / 2))
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (extent, extent, top - base)
    ob.display_type = "WIRE"

    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")

    def M(op, x=-600, y=0, b=None):
        n = nt.nodes.new("ShaderNodeMath")
        n.operation = op
        n.location = (x, y)
        if b is not None:
            n.inputs[1].default_value = b
        return n

    # ---- WORLD-METRE COORDINATES -----------------------------------------
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    geo.location = (-1700, 0)

    def field(metres, detail, squash, ypos):
        """One noise field whose feature size is `metres` across."""
        d = nt.nodes.new("ShaderNodeVectorMath")
        d.operation = "DIVIDE"
        d.location = (-1480, ypos)
        d.inputs[1].default_value = (metres, metres, metres * squash)
        nt.links.new(geo.outputs["Position"], d.inputs[0])
        n = nt.nodes.new("ShaderNodeTexNoise")
        n.location = (-1280, ypos)
        n.inputs["Scale"].default_value = 1.0
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = 0.52
        nt.links.new(d.outputs["Vector"], n.inputs["Vector"])
        return n

    body = field(cfg["body"], 2.5, 0.55, 160)
    brk = field(cfg["brk"], 3.5, 0.75, -160)

    # Breakup SUBTRACTS. Multiplying a mask only thins a sheet; subtracting a
    # second field cuts holes right through it, which is what makes sky.
    bs = M("MULTIPLY", -1060, -160, cfg["erode"])
    nt.links.new(brk.outputs["Fac"], bs.inputs[0])
    cut = M("SUBTRACT", -880, 60)
    nt.links.new(body.outputs["Fac"], cut.inputs[0])
    nt.links.new(bs.outputs["Value"], cut.inputs[1])

    # Occupancy: hard threshold, clamped. Below `cover` there is simply no
    # cloud, which is what leaves open sky between forms.
    occ = nt.nodes.new("ShaderNodeMapRange")
    occ.location = (-680, 60)
    occ.clamp = True
    occ.inputs["From Min"].default_value = cfg["cover"]
    occ.inputs["From Max"].default_value = cfg["cover"] + cfg["span"]
    nt.links.new(cut.outputs["Value"], occ.inputs["Value"])

    # ---- VERTICAL PROFILE, in metres of altitude -------------------------
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    sep.location = (-1480, -420)
    nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])
    rise = nt.nodes.new("ShaderNodeMapRange")
    rise.location = (-1180, -420)
    rise.clamp = True
    rise.inputs["From Min"].default_value = base
    rise.inputs["From Max"].default_value = base + (top - base) * 0.30
    nt.links.new(sep.outputs["Z"], rise.inputs["Value"])
    fall = nt.nodes.new("ShaderNodeMapRange")
    fall.location = (-1180, -620)
    fall.clamp = True
    fall.inputs["From Min"].default_value = top - (top - base) * 0.45
    fall.inputs["From Max"].default_value = top
    fall.inputs["To Min"].default_value = 1.0
    fall.inputs["To Max"].default_value = 0.0
    nt.links.new(sep.outputs["Z"], fall.inputs["Value"])
    prof = M("MULTIPLY", -940, -520)
    nt.links.new(rise.outputs["Result"], prof.inputs[0])
    nt.links.new(fall.outputs["Result"], prof.inputs[1])

    shaped = M("MULTIPLY", -440, -60)
    nt.links.new(occ.outputs["Result"], shaped.inputs[0])
    nt.links.new(prof.outputs["Value"], shaped.inputs[1])
    dens = M("MULTIPLY", -260, -60, cfg["density"])
    nt.links.new(shaped.outputs["Value"], dens.inputs[0])

    if debug_emit:
        # DEBUG ONLY: show the occupancy field as flat emission so the field
        # can be seen directly rather than inferred from a beauty render.
        em = nt.nodes.new("ShaderNodeEmission")
        em.location = (0, 200)
        nt.links.new(shaped.outputs["Value"], em.inputs["Strength"])
        nt.links.new(em.outputs["Emission"], out.inputs["Volume"])
    else:
        vol = nt.nodes.new("ShaderNodeVolumePrincipled")
        vol.location = (0, 0)
        vol.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
        vol.inputs["Anisotropy"].default_value = 0.30
        nt.links.new(dens.outputs["Value"], vol.inputs["Density"])
        nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])

    ob.data.materials.append(mat)
    return ob
