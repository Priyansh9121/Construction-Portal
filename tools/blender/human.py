"""
A worker with actual human anatomy.

WHY THIS IS AUTHORED RATHER THAN DOWNLOADED
-------------------------------------------
No free rigged human is reachable from this machine without an account:
BlenderKit is not bundled with Blender 4.5, and Poly Haven carries 521 models
of which none are people. Mixamo needs an Adobe login and Sketchfab needs an
API token. Verified, not assumed.

So the choice was between keeping box figures -- which the gate rejects
outright -- and authoring real geometry. This authors it.

HOW: LOFTED CROSS-SECTIONS
--------------------------
A body is described as a stack of ellipses up its height, each with a real
width, depth and offset, and the surface is lofted between them. That is how
organic form is built cheaply, and it is why this reads as a person where a
stack of cubes never can: the silhouette TAPERS. Shoulders are wider than the
waist, the waist is narrower than the hips, calves swell and ankles do not.

Proportions are canonical: total height 1.75 m, head about one seventh of it,
shoulder width about two head-heights, elbow at the waist, fingertips at
mid-thigh. Getting those ratios right matters far more at 40 px than any
amount of surface detail.

A subdivision modifier then smooths the loft, so the cost is a low-poly cage
and the read is a smooth body.
"""

import math

import bpy

import concept_lib as L


def _loft(name, sections, mat=None, close_ends=True, smooth=True):
    """
    Build a surface through a list of cross-sections.

    Each section is (z, half_width, half_depth, x_off, y_off). Sections are
    sampled as ellipses, so the mesh is a tube whose profile changes up its
    length -- the whole point being that a limb can be thick at the thigh and
    thin at the ankle without a seam.
    """
    ring = 8
    verts, faces = [], []
    for (z, hw, hd, ox, oy) in sections:
        for i in range(ring):
            a = (i / ring) * math.tau
            verts.append((ox + math.cos(a) * hw, oy + math.sin(a) * hd, z))
    for s in range(len(sections) - 1):
        for i in range(ring):
            a = s * ring + i
            b = s * ring + (i + 1) % ring
            faces.append((a, b, b + ring, a + ring))
    if close_ends:
        faces.append(tuple(range(ring - 1, -1, -1)))
        base = (len(sections) - 1) * ring
        faces.append(tuple(range(base, base + ring)))

    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    if mat:
        ob.data.materials.append(mat)
    if smooth:
        for p in ob.data.polygons:
            p.use_smooth = True
        sub = ob.modifiers.new("sub", "SUBSURF")
        sub.levels = 1
        sub.render_levels = 1
    return ob


def _limb(name, a, b, r0, r1, mat, bulge=1.0):
    """A tapered limb between two points, with a mid-length swell so a thigh
    is not a cone."""
    import mathutils
    va, vb = mathutils.Vector(a), mathutils.Vector(b)
    length = (vb - va).length
    secs = []
    for t in (0.0, 0.35, 0.7, 1.0):
        r = r0 + (r1 - r0) * t
        if t in (0.35,):
            r *= bulge
        secs.append((t * length, r, r * 0.88, 0.0, 0.0))
    ob = _loft(name, secs, mat)
    ob.location = va
    ob.rotation_euler = (vb - va).to_track_quat("Z", "Y").to_euler()
    return ob


def worker(name, mats, pose="stand", facing=0.0, height=1.75, seed=0):
    """
    One worker, in PPE.

    `pose` shifts limb targets rather than driving a rig: at the distance these
    are seen, a changed silhouette is the whole of what a pose communicates,
    and a rig would cost an armature and skin weights to deliver the same
    forty pixels.
    """
    import random
    rng = random.Random(seed)
    s = height / 1.75          # everything below is authored at 1.75 m
    parts = []

    hv, wk = mats["hiviz"], mats["workwear"]
    boot, skin, hat = mats["workwear"], mats["skin"], mats["hat"]

    # ---- TORSO: real taper, shoulders wider than waist -------------------
    torso = _loft(f"{name}-torso", [
        (0.90 * s, 0.150 * s, 0.105 * s, 0, 0),     # hip
        (1.02 * s, 0.140 * s, 0.098 * s, 0, 0),     # waist, narrowest
        (1.18 * s, 0.168 * s, 0.112 * s, 0, 0),     # chest
        (1.35 * s, 0.196 * s, 0.115 * s, 0, 0),     # shoulder, widest
        (1.42 * s, 0.140 * s, 0.100 * s, 0, 0),     # trapezius
    ], hv)
    parts.append(torso)

    # Hips and seat, in workwear rather than hi-vis.
    parts.append(_loft(f"{name}-hips", [
        (0.78 * s, 0.150 * s, 0.112 * s, 0, 0),
        (0.92 * s, 0.158 * s, 0.118 * s, 0, 0),
        (1.00 * s, 0.146 * s, 0.104 * s, 0, 0),
    ], wk))

    # ---- HEAD AND NECK ---------------------------------------------------
    parts.append(_loft(f"{name}-neck", [
        (1.40 * s, 0.055 * s, 0.052 * s, 0, 0),
        (1.50 * s, 0.058 * s, 0.055 * s, 0, 0.004 * s),
    ], skin))
    parts.append(_loft(f"{name}-head", [
        (1.49 * s, 0.062 * s, 0.070 * s, 0, 0.004 * s),
        (1.56 * s, 0.086 * s, 0.098 * s, 0, 0.006 * s),
        (1.63 * s, 0.088 * s, 0.100 * s, 0, 0.004 * s),
        (1.69 * s, 0.070 * s, 0.080 * s, 0, 0),
    ], skin))

    # ---- HARD HAT: a real dome with a peak -------------------------------
    parts.append(_loft(f"{name}-hat", [
        (1.655 * s, 0.098 * s, 0.108 * s, 0, 0),
        (1.700 * s, 0.100 * s, 0.110 * s, 0, 0),
        (1.740 * s, 0.086 * s, 0.094 * s, 0, 0),
        (1.762 * s, 0.048 * s, 0.052 * s, 0, 0),
    ], hat))
    peak = L.box(f"{name}-peak", (0.19 * s, 0.10 * s, 0.012 * s),
                 (0, -0.10 * s, 1.664 * s), hat, bevel=0.006)
    peak.rotation_euler = (math.radians(-7), 0, 0)
    parts.append(peak)

    # ---- LEGS ------------------------------------------------------------
    stride = {"walk": 0.20, "stand": 0.05, "signal": 0.06}.get(pose, 0.05) * s
    for side, sx in (("l", -1), ("r", 1)):
        hipx = sx * 0.085 * s
        fwd = stride if sx > 0 else -stride
        knee = (hipx, fwd * 0.5, 0.46 * s)
        ankle = (hipx, fwd, 0.085 * s)
        parts.append(_limb(f"{name}-thigh{side}", (hipx, 0, 0.86 * s), knee,
                           0.085 * s, 0.060 * s, wk, bulge=1.12))
        parts.append(_limb(f"{name}-shin{side}", knee, ankle,
                           0.058 * s, 0.040 * s, wk, bulge=1.18))
        b = L.box(f"{name}-boot{side}", (0.098 * s, 0.255 * s, 0.095 * s),
                  (hipx, fwd + 0.035 * s, 0.048 * s), boot, bevel=0.02)
        parts.append(b)

    # ---- ARMS ------------------------------------------------------------
    for side, sx in (("l", -1), ("r", 1)):
        shx = sx * 0.185 * s
        if pose == "signal" and sx > 0:
            elbow = (shx + sx * 0.10 * s, -0.05 * s, 1.16 * s)
            wrist = (shx + sx * 0.14 * s, -0.18 * s, 1.44 * s)
        elif pose == "carry":
            elbow = (shx + sx * 0.03 * s, 0.02 * s, 1.08 * s)
            wrist = (shx - sx * 0.05 * s, -0.20 * s, 1.02 * s)
        else:
            swing = (stride * 0.6) * (-1 if sx > 0 else 1)
            elbow = (shx + sx * 0.02 * s, swing * 0.5, 1.08 * s)
            wrist = (shx + sx * 0.03 * s, swing, 0.86 * s)
        parts.append(_limb(f"{name}-uarm{side}", (shx, 0, 1.36 * s), elbow,
                           0.055 * s, 0.045 * s, hv))
        parts.append(_limb(f"{name}-farm{side}", elbow, wrist,
                           0.044 * s, 0.034 * s, wk))
        parts.append(_loft(f"{name}-hand{side}", [
            (0, 0.036 * s, 0.022 * s, 0, 0),
            (0.085 * s, 0.030 * s, 0.018 * s, 0, 0),
        ], skin))
        parts[-1].location = wrist

    ob = L.join_all(name, parts)
    ob.rotation_euler = (0, 0, facing + rng.uniform(-0.08, 0.08))
    return ob
