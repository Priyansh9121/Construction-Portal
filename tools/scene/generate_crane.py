"""
A tower crane as real lattice steelwork.

WHY THIS EXISTS
---------------
The crane was four boxes: a mast, a jib, a counter-jib and a counterweight. A
real tower crane is a LATTICE — four corner chords tied by horizontal members
and cross-braced on every face — and that lattice is most of what the eye uses
to identify one. A solid rectangular mast reads as a model of a crane, which is
why it was the single strongest reason the scene looked cheap.

Everything here is emitted as MEMBERS: short boxes with a position, a size and
a rotation, which the runtime draws as one InstancedMesh per section. A full
lattice crane costs a few hundred instances and two draw calls.

Proportions follow a real mid-size flat-top tower crane, in metres:

    mast section        1.9 m square, 3.0 m per section
    chord              160 mm square hollow
    jib                1.6 m deep, 2.0 m wide, bays of 2.5 m
    counter-jib        roughly a third of the jib
    hook block         1.1 m

Usage:
    python3 tools/scene/generate_crane.py > frontend/src/world/craneGeometry.json
"""

import json
import math
import sys

CHORD = 0.16          # corner chord section, metres
BRACE = 0.10          # diagonal bracing section
MAST_W = 1.9          # mast is square in plan
SECTION = 3.0         # one mast section
JIB_W, JIB_D = 2.0, 1.6
BAY = 2.5             # jib bay length


def member(p, s, rot=None, kind="steel"):
    m = {"p": [round(v, 3) for v in p], "s": [round(v, 3) for v in s], "k": kind}
    if rot:
        m["r"] = [round(v, 4) for v in rot]
    return m


def strut(a, b, thick, kind="steel"):
    """
    A member spanning two points, as a box rotated onto the line between them.

    This is what makes lattice work possible without a mesh per diagonal: the
    runtime instances one unit cube and this supplies the transform. Yaw then
    pitch, which is enough for any strut that is not also rolled — and none here
    are.
    """
    dx, dy, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    length = math.sqrt(dx * dx + dy * dy + dz * dz)
    if length < 1e-6:
        return None
    mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
    yaw = math.atan2(dx, dz)
    pitch = math.asin(max(-1.0, min(1.0, dy / length)))
    # The unit box is scaled along Z and then rotated so +Z lies on the span.
    return member(mid, [thick, thick, length], [pitch, yaw, 0], kind)


def lattice_tower(height):
    """
    The mast: four chords, a horizontal tie at every section, and K-bracing on
    all four faces. K-bracing rather than simple diagonals because that is what
    a tower crane actually uses, and its silhouette is distinctive.
    """
    out = []
    h = MAST_W / 2
    corners = [(-h, -h), (h, -h), (h, h), (-h, h)]

    for cx, cz in corners:
        out.append(member([cx, height / 2, cz], [CHORD, height, CHORD]))

    sections = max(2, int(height / SECTION))
    for i in range(sections + 1):
        y = i * height / sections
        for j in range(4):
            a = corners[j]
            b = corners[(j + 1) % 4]
            s = strut([a[0], y, a[1]], [b[0], y, b[1]], CHORD * 0.85)
            if s:
                out.append(s)

    for i in range(sections):
        y0 = i * height / sections
        y1 = (i + 1) * height / sections
        ym = (y0 + y1) / 2
        for j in range(4):
            a = corners[j]
            b = corners[(j + 1) % 4]
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            # K: both chords up to the mid-span of the tie above.
            for c in (a, b):
                s = strut([c[0], y0, c[1]], [mid[0], y1, mid[1]], BRACE)
                if s:
                    out.append(s)
    return out


def lattice_boom(length, depth, width, taper=0.0):
    """
    The jib: two bottom chords, one or two top chords, verticals at every bay
    and diagonals between them. A flat-top jib tapers slightly toward the tip,
    which is most of its character in silhouette.
    """
    out = []
    bays = max(3, int(length / BAY))
    hw = width / 2

    def w_at(x):
        return hw * (1 - taper * (x / length))

    def d_at(x):
        return depth * (1 - taper * 0.7 * (x / length))

    for i in range(bays):
        x0 = i * length / bays
        x1 = (i + 1) * length / bays
        for sgn in (-1, 1):
            # bottom chord
            s = strut([x0, 0, sgn * w_at(x0)], [x1, 0, sgn * w_at(x1)], CHORD)
            if s:
                out.append(s)
            # top chord
            s = strut([x0, d_at(x0), 0], [x1, d_at(x1), 0], CHORD)
            if s and sgn == 1:
                out.append(s)
            # vertical and diagonal in the vertical plane
            s = strut([x0, 0, sgn * w_at(x0)], [x0, d_at(x0), 0], BRACE)
            if s:
                out.append(s)
            s = strut([x0, 0, sgn * w_at(x0)], [x1, d_at(x1), 0], BRACE)
            if s:
                out.append(s)
        # bottom lateral tie
        s = strut([x0, 0, -w_at(x0)], [x0, 0, w_at(x0)], BRACE)
        if s:
            out.append(s)
    return out


def crane(mast_h, jib_len, back_len):
    parts = {}

    parts["mast"] = lattice_tower(mast_h)

    jib = lattice_boom(jib_len, JIB_D, JIB_W, taper=0.42)
    for m in jib:
        m["p"][1] += mast_h + 1.2
    parts["jib"] = jib

    back = lattice_boom(back_len, JIB_D * 1.1, JIB_W, taper=0.1)
    for m in back:
        m["p"][0] = -m["p"][0]
        m["p"][1] += mast_h + 1.2
        if "r" in m:
            m["r"][1] = -m["r"][1]
    parts["back"] = back

    # Solid bodies: the things that genuinely are boxes on a real crane.
    parts["bodies"] = [
        # machinery deck / slewing ring
        member([0, mast_h + 0.55, 0], [MAST_W * 1.35, 1.1, MAST_W * 1.35], None, "deck"),
        # operator cab, hung off the mast head on the jib side
        member([MAST_W * 0.95, mast_h + 0.4, MAST_W * 0.62], [1.5, 1.8, 1.4], None, "cab"),
        # counterweight slabs
        member([-back_len * 0.86, mast_h + 0.9, 0], [2.2, 1.5, 3.0], None, "cwt"),
        member([-back_len * 0.72, mast_h + 0.9, 0], [1.4, 1.4, 2.8], None, "cwt"),
        # hoist winch on the counter-jib
        member([-back_len * 0.4, mast_h + 2.2, 0], [1.8, 1.2, 1.6], None, "deck"),
        # crane base: a concrete pad and the anchor block a mast actually needs
        member([0, 0.45, 0], [5.4, 0.9, 5.4], None, "pad"),
    ]

    parts["trolley"] = {
        "range": [round(jib_len * 0.22, 2), round(jib_len * 0.9, 2)],
        "y": round(mast_h + 1.2, 2),
        "body": [1.3, 0.55, 1.5],
    }
    parts["hook"] = {"block": [0.75, 1.1, 0.75], "drop": [round(mast_h * 0.25, 2),
                                                          round(mast_h * 0.74, 2)]}
    parts["mast_h"] = mast_h
    parts["jib_len"] = jib_len
    parts["back_len"] = back_len
    return parts


if __name__ == "__main__":
    c = crane(mast_h=42.0, jib_len=46.0, back_len=15.5)
    n = len(c["mast"]) + len(c["jib"]) + len(c["back"]) + len(c["bodies"])
    assert len(c["mast"]) > 60, "mast is not a lattice"
    assert len(c["jib"]) > 60, "jib is not a lattice"
    print(f"crane members {n}  mast {len(c['mast'])}  jib {len(c['jib'])}  "
          f"back {len(c['back'])}", file=sys.stderr)
    print(json.dumps(c, separators=(",", ":")))
