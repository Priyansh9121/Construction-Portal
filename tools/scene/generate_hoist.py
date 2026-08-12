"""
The mast-climbing hoist: mast, ties, base enclosure and landing gates.

WHY THIS EXISTS
---------------
The hoist was a single 2.3 x 2.7 x 2.1 m orange box sitting against the
facade. Two things were wrong with it, and the second is much worse than the
first:

  1. It was a box, where a hoist car is a fabricated mesh cage.
  2. IT HAD NO MAST. A rack-and-pinion hoist climbs a tied lattice mast. A car
     floating on a facade with nothing to climb is not a cheap-looking object,
     it is an impossible one, and the eye reads it as an error rather than as
     a detail it has not looked at closely.

This file fixes the second problem, which is the structural one. The mast is
REPEATED LATTICE — four chords, a horizontal frame per panel, diagonals, a
toothed rack up one face, and ties back to the slab edges. That is exactly the
kind of object procedural generation is good at, and it stays procedural.

The CAR is a single fabricated object and is authored in Blender instead; see
tools/blender/asset_hoist.py. The two meet at a documented interface: the car
runs on the mast's front face at the x/z this file reports, so neither can
drift from the other by accident.

Dimensions follow a real passenger/materials hoist, in metres:

    mast            0.65 m square, 1.5 m panels
    chord           90 mm
    rack            pitched bar up the mast's front face
    ties            to every third slab edge
    car             1.5 m wide x 3.0 m deep, running the mast's front face

Usage:
    python3 tools/scene/generate_hoist.py > frontend/src/world/hoistGeometry.json
"""

import json
import math
import sys

MAST_W = 0.65         # mast is square in plan
PANEL = 1.5           # one mast panel
CHORD = 0.09
BRACE = 0.055
CAR_W, CAR_D, CAR_H = 1.60, 3.00, 2.40


def member(p, s, rot=None, kind="steel"):
    m = {"p": [round(v, 3) for v in p], "s": [round(v, 3) for v in s], "k": kind}
    if rot:
        m["r"] = [round(v, 4) for v in rot]
    return m


def strut(a, b, thick, kind="steel"):
    """A member spanning two points: the same yaw-then-pitch transform the
    crane lattice uses, so both draw through one instanced unit cube."""
    dx, dy, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    length = math.sqrt(dx * dx + dy * dy + dz * dz)
    if length < 1e-6:
        return None
    mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
    yaw = math.atan2(dx, dz)
    pitch = math.asin(max(-1.0, min(1.0, dy / length)))
    return member(mid, [thick, thick, length], [pitch, yaw, 0], kind)


def mast(height, ox, oz):
    """
    Four chords, a horizontal frame at every panel, and a diagonal per panel
    per face, alternating hand so the bracing zig-zags rather than leaning one
    way all the way up.

    The rack runs up the FRONT face (+z), which is the face the car climbs and
    the one the camera sees.
    """
    out = []
    h = MAST_W / 2
    corners = [(-h, -h), (h, -h), (h, h), (-h, h)]

    for cx, cz in corners:
        out.append(member([ox + cx, height / 2, oz + cz], [CHORD, height, CHORD]))

    panels = max(2, int(round(height / PANEL)))
    step = height / panels
    for i in range(panels + 1):
        y = i * step
        for j in range(4):
            a, b = corners[j], corners[(j + 1) % 4]
            s = strut([ox + a[0], y, oz + a[1]], [ox + b[0], y, oz + b[1]], CHORD * 0.8)
            if s:
                out.append(s)

    for i in range(panels):
        y0, y1 = i * step, (i + 1) * step
        flip = i % 2 == 0
        for j in range(4):
            a, b = corners[j], corners[(j + 1) % 4]
            p0 = [ox + a[0], y0 if flip else y1, oz + a[1]]
            p1 = [ox + b[0], y1 if flip else y0, oz + b[1]]
            s = strut(p0, p1, BRACE)
            if s:
                out.append(s)

    # The rack: a toothed bar up the front face. Modelled as short segments
    # rather than one long box so it reads as pitched teeth in silhouette.
    teeth = int(height / 0.25)
    for i in range(teeth):
        out.append(member([ox, i * 0.25 + 0.125, oz + h + 0.05],
                          [0.10, 0.16, 0.055], None, "rack"))
    return out


def ties(height, ox, oz, storey, storeys, slab_z):
    """
    Ties back to the structure.

    A 30 m mast is not self-supporting; it is tied to the frame every few
    storeys. Without the ties the mast reads as a free-standing pole that
    happens to be near a building, which is the same category of error as the
    car with no mast.
    """
    out = []
    for level in range(2, storeys, 3):
        y = level * storey
        if y > height - 2:
            break
        for dx in (-0.32, 0.32):
            s = strut([ox + dx, y, oz], [ox + dx * 1.2, y, slab_z], 0.075, "tie")
            if s:
                out.append(s)
    return out


def base(ox, oz):
    """Ground enclosure: the fenced base a hoist is legally required to have,
    and the thing that stops the mast growing out of bare soil."""
    out = []
    w, d = 3.4, 4.2
    for i in range(8):
        x = ox - w / 2 + w * i / 7
        out.append(member([x, 1.0, oz + d / 2], [0.05, 2.0, 0.05], None, "cage"))
    for i in range(9):
        z = oz - d / 2 + d * i / 8
        out.append(member([ox - w / 2, 1.0, z], [0.05, 2.0, 0.05], None, "cage"))
        out.append(member([ox + w / 2, 1.0, z], [0.05, 2.0, 0.05], None, "cage"))
    for y in (0.4, 1.2, 2.0):
        out.append(member([ox, y, oz + d / 2], [w, 0.05, 0.05], None, "cage"))
    # A concrete base slab, which is what the mast actually stands on.
    out.append(member([ox, 0.09, oz], [w + 0.6, 0.18, d + 0.6], None, "pad"))
    return out


def landings(ox, oz, storey, storeys, slab_z):
    """A gate at every floor the car can stop at, plus the short bridge from
    the mast to the slab edge. This is what makes the car's stops MEAN
    something: it arrives at a landing, not at an altitude."""
    out = []
    car_front = oz - MAST_W / 2 - CAR_D - 0.06
    for level in range(1, storeys):
        y = level * storey
        # The gate stands ON the slab edge, facing the car.
        out.append(member([ox, y + 1.05, slab_z + 0.06], [1.7, 0.05, 0.05], None, "gate"))
        out.append(member([ox, y + 0.55, slab_z + 0.06], [1.7, 0.05, 0.05], None, "gate"))
        for dx in (-0.85, 0.85):
            out.append(member([ox + dx, y + 0.8, slab_z + 0.06],
                              [0.05, 1.6, 0.05], None, "gate"))
        # The bridge deck spanning slab edge to the car's threshold.
        gap = car_front - slab_z
        if gap > 0.1:
            out.append(member([ox, y + 0.03, slab_z + gap / 2],
                              [1.6, 0.06, gap], None, "deck"))
    return out


def build():
    grid = {"bay": 7.2, "storey": 3.6, "storeys": 10, "bays_x": 6, "bays_z": 4,
            "ox": -21.6, "oz": -14.4}
    storey, storeys = grid["storey"], grid["storeys"]
    span_x = grid["bays_x"] * grid["bay"]
    near_z = grid["oz"] + grid["bays_z"] * grid["bay"]

    # The hoist stands against the near facade, toward the right-hand end so it
    # is clear of the scaffold run and still inside the crane's radius.
    #
    # The stack front-to-back is: slab edge, then the car, then the mast. The
    # car rides the BUILDING side of its mast and opens onto the landing, which
    # is what fixes the handedness of the authored asset -- the drive housing
    # faces the mast (+z) and the gate faces the slab (-z).
    ox = grid["ox"] + span_x * 0.80
    slab_z = near_z
    oz = near_z + 3.3

    height = (storeys - 1) * storey + 4.5

    out = {
        "units": "metres",
        "mast": mast(height, ox, oz),
        "ties": ties(height, ox, oz, storey, storeys, slab_z),
        "base": base(ox, oz),
        "landings": landings(ox, oz, storey, storeys, slab_z),
        # The interface the authored car is placed on. The car's own origin is
        # its ground contact, so the runtime only needs x/z and a travel range.
        "car": {
            "at": [round(ox, 3), 0, round(oz - MAST_W / 2 - CAR_D / 2 - 0.06, 3)],
            "size": [CAR_W, CAR_H, CAR_D],
            "travel": [round(storey, 3), round((storeys - 1) * storey, 3)],
            "levels": [round(i * storey, 3) for i in range(1, storeys)],
        },
        "height": round(height, 3),
    }

    members = len(out["mast"]) + len(out["ties"]) + len(out["base"]) + len(out["landings"])
    assert out["car"]["travel"][1] < height, "the car must not run off the mast"
    assert members < 700, f"{members} members is more than this object is worth"
    print(f"hoist members {members}  mast {height:.1f} m  "
          f"car travel {out['car']['travel']}", file=sys.stderr)
    return out


if __name__ == "__main__":
    json.dump(build(), sys.stdout, separators=(",", ":"))
