"""
Independent tied scaffold, to real tube-and-fitting dimensions.

WHY THIS IS ITS OWN GENERATOR
-----------------------------
The scaffold sits in the FOREGROUND of every camera station, which makes it the
most closely inspected object in the scene — closer to the lens than the
building it serves. Standards and ledgers alone were enough to establish depth
and nothing more; at this distance the eye reads the absence of transoms,
braces, boards and guard rails immediately.

REAL DIMENSIONS
---------------
A working scaffold is a highly standardised object, so getting the numbers
right is most of the work:

    tube            48.3 mm outside diameter
    bay length      2.4 m between standards along the face
    scaffold width  1.2 m (two rows of standards)
    inner standard  300 mm off the facade
    lift height     2.0 m
    guard rail      1.0 m above the platform
    mid rail        0.5 m above the platform
    toe board       150 mm
    board           225 mm wide, five to a 1.2 m bay

Braces follow real practice: facade (longitudinal) braces run across the full
height in a zig-zag every fourth bay, and ledger braces run across the width at
alternate standards. A scaffold without braces reads as a shelving unit.

Everything is emitted as a member with a position, a size and a rotation, drawn
by the runtime as one InstancedMesh per material.

Usage:
    python3 tools/scene/generate_scaffold.py > frontend/src/world/scaffoldGeometry.json
"""

import json
import math
import sys

TUBE = 0.0483
BAY = 2.4
WIDTH = 1.2
GAP = 0.3          # inner standard to facade
LIFT = 2.0
BOARD_W = 0.225
BOARD_T = 0.038
TOE_H = 0.15


def member(p, s, rot=None, kind="tube"):
    m = {"p": [round(v, 3) for v in p], "s": [round(v, 4) for v in s], "k": kind}
    if rot:
        m["r"] = [round(v, 4) for v in rot]
    return m


def strut(a, b, thick, kind="tube"):
    """A tube spanning two points, as a rotated box. Yaw then pitch is enough
    for any scaffold member; none of them are rolled."""
    dx, dy, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    length = math.sqrt(dx * dx + dy * dy + dz * dz)
    if length < 1e-6:
        return None
    mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
    yaw = math.atan2(dx, dz)
    pitch = math.asin(max(-1.0, min(1.0, dy / length)))
    return member(mid, [thick, thick, length], [pitch, yaw, 0], kind)


def scaffold(length, lifts, z_face, x0, boarded_lifts):
    """
    A run of independent tied scaffold along +x, standing off a facade at
    `z_face`. `boarded_lifts` are the lifts that carry working platforms —
    a real scaffold does not board every lift, only the ones being worked.
    """
    bays = max(2, int(round(length / BAY)))
    height = lifts * LIFT

    z_inner = z_face + GAP
    z_outer = z_inner + WIDTH
    rows = [z_inner, z_outer]

    out = []

    # ---- Standards, on base plates -------------------------------------
    for i in range(bays + 1):
        x = x0 + i * BAY
        for z in rows:
            out.append(member([x, height / 2, z], [TUBE, height, TUBE]))
            # Base plate and sole board: a standard never bears directly on
            # the ground, and the plate is the detail that grounds it.
            out.append(member([x, 0.012, z], [0.15, 0.024, 0.15], None, "plate"))
            out.append(member([x, 0.04, z], [0.25, 0.035, 0.6], None, "board"))

    # ---- Ledgers: longitudinal, at every lift --------------------------
    for l in range(1, lifts + 1):
        y = l * LIFT
        for z in rows:
            out.append(member([x0 + bays * BAY / 2, y, z],
                              [bays * BAY, TUBE, TUBE]))

    # ---- Transoms: across the width, at every standard -----------------
    for l in range(1, lifts + 1):
        y = l * LIFT
        for i in range(bays + 1):
            x = x0 + i * BAY
            out.append(member([x, y + TUBE, (z_inner + z_outer) / 2],
                              [TUBE, TUBE, WIDTH]))

    # ---- Working platforms ---------------------------------------------
    boards = 0
    for l in boarded_lifts:
        if l > lifts:
            continue
        y = l * LIFT + TUBE + BOARD_T / 2
        n = int(WIDTH / BOARD_W)
        for b in range(n):
            z = z_inner + BOARD_W / 2 + b * BOARD_W
            out.append(member([x0 + bays * BAY / 2, y, z],
                              [bays * BAY, BOARD_T, BOARD_W - 0.01], None, "board"))
            boards += 1

        # Guard rail and mid rail, outer row only — the inner side is closed
        # by the building.
        for h in (1.0, 0.5):
            out.append(member([x0 + bays * BAY / 2, y + h, z_outer],
                              [bays * BAY, TUBE, TUBE]))
        # Toe board
        out.append(member([x0 + bays * BAY / 2, y + TOE_H / 2, z_outer - 0.02],
                          [bays * BAY, TOE_H, 0.032], None, "board"))

    # ---- Facade bracing: a zig-zag over full height, every fourth bay ---
    braces = 0
    for i in range(0, bays, 4):
        x_a = x0 + i * BAY
        x_b = x0 + min(i + 1, bays) * BAY
        up = True
        for l in range(lifts):
            y0 = l * LIFT
            y1 = (l + 1) * LIFT
            a = [x_a if up else x_b, y0, z_outer]
            b = [x_b if up else x_a, y1, z_outer]
            s = strut(a, b, TUBE)
            if s:
                out.append(s)
                braces += 1
            up = not up

    # ---- Ledger bracing: across the width, alternate standards ---------
    for i in range(0, bays + 1, 2):
        x = x0 + i * BAY
        for l in range(0, lifts, 2):
            s = strut([x, l * LIFT, z_inner], [x, (l + 1) * LIFT, z_outer], TUBE)
            if s:
                out.append(s)
                braces += 1

    # ---- Ties back to the structure ------------------------------------
    for i in range(0, bays + 1, 3):
        x = x0 + i * BAY
        for l in range(2, lifts, 2):
            out.append(member([x, l * LIFT, (z_face + z_inner) / 2],
                              [TUBE, TUBE, GAP]))

    assert braces > 8, "scaffold has too little bracing to stand up"
    assert boards > 0, "scaffold has no working platform"
    return out


if __name__ == "__main__":
    # Two runs: a long face run, and a short return around the corner, which is
    # what stops the scaffold reading as a flat billboard.
    face = scaffold(length=33.6, lifts=9, z_face=16.3, x0=-24.0,
                    boarded_lifts=(3, 6, 8))
    ret = scaffold(length=9.6, lifts=9, z_face=16.3, x0=-24.0,
                   boarded_lifts=(3, 6, 8))
    # Rotate the return run 90 degrees about the corner.
    turned = []
    for m in ret:
        x, y, z = m["p"]
        nx = -24.0 - (z - 16.3)
        nz = 16.3 + (x + 24.0)
        r = m.get("r", [0, 0, 0])
        turned.append({**m, "p": [round(nx, 3), y, round(nz, 3)],
                       "r": [r[0], round(r[1] + math.pi / 2, 4), r[2]]})

    out = {"members": face + turned}
    kinds = {}
    for m in out["members"]:
        kinds[m["k"]] = kinds.get(m["k"], 0) + 1
    print(f"scaffold members {len(out['members'])}  {kinds}", file=sys.stderr)
    print(json.dumps(out, separators=(",", ":")))
