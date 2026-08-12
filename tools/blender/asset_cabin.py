"""
Site cabin -- a jackleg / anti-vandal welfare unit.

WHY THIS IS AUTHORED RATHER THAN GENERATED
------------------------------------------
It was the cheapest-looking object in the frame: a 6.1 x 2.7 x 2.5 m box with a
chamfer. A cabin is not a box. It is a folded and welded steel shell on a
chassis, and four specific things carry that read:

  1. The wall is PROFILED sheet. Its ribs catch the sun as a row of hard
     vertical lines and self-shadow at grazing angles. A flat wall under any
     lighting is a flat wall.
  2. The openings are RECESSED. A door painted onto a surface reads as a
     decal; a door set 60 mm back into a frame reads as a door, because the
     reveal casts a shadow that moves with the sun.
  3. The roof OVERHANGS and returns downward as a drip edge. That line is the
     single strongest silhouette cue that this is a manufactured product.
  4. It stands on a CHASSIS with jack legs. It is a building that arrived on a
     lorry, and the gap of daylight underneath is what says so.

None of the four can be expressed by scaling a chamfered cube, which is why
this crosses the procedural/authored boundary.

Dimensions are a real 20 ft unit: 6.1 m long, 2.44 m wide, 2.7 m to the top of
the roof cap including the chassis.

    /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/asset_cabin.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_build as B

# Overall envelope. X is the long axis, Y is depth, Z is up (Blender's axes;
# the exporter converts to Y-up).
LEN = 6.10
DEP = 2.44
CHASSIS = 0.26          # ground to underside of floor
BODY = 2.30             # floor to underside of roof cap
CAP = 0.14              # roof cap including its drip return
WALL = 0.045            # sheet + liner thickness
POST = 0.10             # corner post section
# Profiled sheet: 190 mm pitch, 30 mm deep. The first pass used 300 x 22 and
# the front elevation read as a flat wall -- at that pitch the ribs are too far
# apart to register as a texture and too shallow to self-shadow.
PITCH = 0.19
RIB = 0.030
FR = 0.055              # frame section around openings

FLOOR = CHASSIS         # z of the floor line
EAVE = CHASSIS + BODY   # z of the underside of the roof cap


def materials():
    return {
        # Coated sheet: painted, not bare. Metallic 0 with a mid roughness is
        # what a powder-coated panel actually is; making it metallic makes it
        # read as raw aluminium and kills the colour.
        "shell": B.material("cabin-shell", B.srgb(0xD8DBDD), 0.0, 0.44),
        # Corner posts, door and roof cap in a darker coat, so the unit has
        # frame and infill rather than being one colour.
        "trim": B.material("cabin-trim", B.srgb(0x3E464C), 0.0, 0.38),
        # The chassis is bare galvanised steel and lives in shadow.
        "chassis": B.material("cabin-chassis", B.srgb(0x6E767C), 0.85, 0.52),
        # Dark, smooth and opaque. Opaque on purpose: the world already has a
        # PMREM environment, so glazing reads through REFLECTION rather than
        # transparency, and this avoids sorting a transparent surface against
        # the scaffold behind it.
        "glass": B.material("cabin-glass", B.srgb(0x141A20), 0.0, 0.06),
        "seal": B.material("cabin-seal", B.srgb(0x1A1C1E), 0.0, 0.9),
    }


def chassis(M):
    """Base frame on jack legs: the gap of daylight that says 'delivered'."""
    parts = []
    rail = 0.16
    z = CHASSIS - rail / 2
    parts.append(B.box("ch-l", (LEN, 0.08, rail), (0, -DEP / 2 + 0.04, z), M["chassis"]))
    parts.append(B.box("ch-r", (LEN, 0.08, rail), (0, DEP / 2 - 0.04, z), M["chassis"]))
    parts.append(B.box("ch-a", (0.08, DEP, rail), (-LEN / 2 + 0.04, 0, z), M["chassis"]))
    parts.append(B.box("ch-b", (0.08, DEP, rail), (LEN / 2 - 0.04, 0, z), M["chassis"]))
    # Cross bearers, visible in the gap under the unit at a low camera.
    for i in range(4):
        x = -LEN / 2 + LEN * (i + 1) / 5
        parts.append(B.box(f"ch-x{i}", (0.06, DEP - 0.1, 0.12), (x, 0, z), M["chassis"]))
    # Jack legs at the corners, on their base plates.
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (LEN / 2 - 0.34), sy * (DEP / 2 - 0.16)
            parts.append(B.box(f"jl{sx}{sy}", (0.09, 0.09, CHASSIS - rail),
                               (x, y, (CHASSIS - rail) / 2), M["chassis"]))
            parts.append(B.box(f"jp{sx}{sy}", (0.26, 0.26, 0.03), (x, y, 0.015),
                               M["chassis"], bevel=0.006))
    return parts


def shell(M):
    """Profiled walls between corner posts, plus the roof cap and drip edge."""
    parts = []
    inner_len = LEN - POST * 2
    inner_dep = DEP - POST * 2

    # Corner posts, standing slightly proud of the sheet so the wall reads as
    # infill inside a frame rather than as a single folded tube.
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(B.box(
                f"post{sx}{sy}", (POST, POST, BODY),
                (sx * (LEN - POST) / 2, sy * (DEP - POST) / 2, FLOOR + BODY / 2),
                M["trim"], bevel=0.008))

    # Back wall and both ends: full-width profiled sheet.
    back = B.corrugated_panel("w-back", inner_len, BODY, PITCH, RIB, WALL, M["shell"])
    back.location = (0, DEP / 2 - WALL / 2, FLOOR + BODY / 2)
    parts.append(back)
    for sy, name in ((-1, "w-e0"), (1, "w-e1")):
        end = B.corrugated_panel(name, inner_dep, BODY, PITCH, RIB, WALL, M["shell"])
        end.rotation_euler = (0, 0, 1.5707963)
        end.location = (sy * (LEN / 2 - WALL / 2), 0, FLOOR + BODY / 2)
        parts.append(end)

    # Roof cap: overhangs on every side and returns DOWNWARD as a drip edge.
    # The overhang plus the return is the strongest single silhouette cue that
    # this object was manufactured rather than modelled.
    over = 0.06
    parts.append(B.box("roof", (LEN + over * 2, DEP + over * 2, 0.06),
                       (0, 0, EAVE + 0.03), M["trim"], bevel=0.012))
    drip = 0.075
    for sx in (-1, 1):
        parts.append(B.box(f"drip-x{sx}", (0.035, DEP + over * 2, drip),
                           (sx * (LEN / 2 + over - 0.017), 0, EAVE - drip / 2 + 0.005),
                           M["trim"]))
        parts.append(B.box(f"drip-y{sx}", (LEN + over * 2, 0.035, drip),
                           (0, sx * (DEP / 2 + over - 0.017), EAVE - drip / 2 + 0.005),
                           M["trim"]))
    return parts


def front_wall(M):
    """
    The face the camera sees: profiled sheet interrupted by a recessed door and
    two recessed windows.

    Openings are built by SEGMENTING the wall around them rather than by
    boolean subtraction. A boolean through a profiled panel produces ragged
    n-gons along the ribs that shade badly and are not reproducible between
    Blender versions; segmenting is exact and survives any change to the rib
    pitch.
    """
    parts = []
    y = -DEP / 2 + WALL / 2
    x0, x1 = -(LEN - POST * 2) / 2, (LEN - POST * 2) / 2

    door_w, door_h = 0.90, 2.02
    door_x = x0 + 0.86
    win_w, win_h = 1.15, 0.86
    win_z = FLOOR + 1.32
    win_xs = [x0 + 2.62, x0 + 4.20]

    # Each opening's reserved span must reach the OUTER edge of its frame,
    # which is half the opening plus a full frame section. The first pass
    # reserved 50 mm against a 55 mm frame, leaving a 5 mm slot beside the door
    # that showed daylight straight through to the back wall.
    spans = []          # (from, to) of full-height profiled sheet
    cursor = x0
    stops = sorted([(door_x - door_w / 2 - FR, door_x + door_w / 2 + FR)] +
                   [(wx - win_w / 2 - FR, wx + win_w / 2 + FR) for wx in win_xs])
    for (a, b) in stops:
        if a > cursor:
            spans.append((cursor, a))
        cursor = b
    if cursor < x1:
        spans.append((cursor, x1))

    for i, (a, b) in enumerate(spans):
        w = b - a
        if w < 0.05:
            continue
        p = B.corrugated_panel(f"fw{i}", w, BODY, PITCH, RIB, WALL, M["shell"])
        p.location = ((a + b) / 2, y, FLOOR + BODY / 2)
        parts.append(p)

    # Sheet above and below each window, so the openings sit in the wall
    # rather than running from floor to eave.
    for i, wx in enumerate(win_xs):
        below = win_z - win_h / 2
        above = win_z + win_h / 2
        w = win_w + FR * 2
        p = B.corrugated_panel(f"wb{i}", w, below - FLOOR, PITCH, RIB, WALL, M["shell"])
        p.location = (wx, y, FLOOR + (below - FLOOR) / 2)
        parts.append(p)
        p = B.corrugated_panel(f"wa{i}", w, FLOOR + BODY - above, PITCH, RIB, WALL,
                               M["shell"])
        p.location = (wx, y, above + (FLOOR + BODY - above) / 2)
        parts.append(p)

    # Sheet over the door head.
    head = FLOOR + door_h
    p = B.corrugated_panel("dh", door_w + FR * 2, FLOOR + BODY - head, PITCH, RIB,
                           WALL, M["shell"])
    p.location = (door_x, y, head + (FLOOR + BODY - head) / 2)
    parts.append(p)

    # ---- Door: frame, recessed leaf, handle, small canopy ------------------
    fr = FR
    reveal = 0.075                       # how far the leaf sits back
    for (sx, w, h, cx, cz) in (
            (0, door_w + fr * 2, fr, door_x, head + fr / 2),
            (-1, fr, door_h, door_x - (door_w + fr) / 2, FLOOR + door_h / 2),
            (1, fr, door_h, door_x + (door_w + fr) / 2, FLOOR + door_h / 2)):
        parts.append(B.box(f"dfr{sx}{cz:.2f}", (w, 0.09, h), (cx, y - 0.02, cz),
                           M["trim"], bevel=0.006))
    parts.append(B.box("dleaf", (door_w, 0.045, door_h),
                       (door_x, y + reveal, FLOOR + door_h / 2), M["trim"], bevel=0.008))
    # Lever handle and a lock escutcheon: small, but they sit at 1.05 m, which
    # is exactly the height the eye uses to judge a door's scale.
    parts.append(B.box("dhandle", (0.03, 0.11, 0.026),
                       (door_x + door_w / 2 - 0.11, y + reveal - 0.055, FLOOR + 1.05),
                       M["chassis"], bevel=0.008))
    parts.append(B.box("dlock", (0.05, 0.03, 0.10),
                       (door_x + door_w / 2 - 0.11, y + reveal - 0.02, FLOOR + 1.05),
                       M["chassis"], bevel=0.006))
    parts.append(B.box("dcanopy", (door_w + 0.36, 0.30, 0.04),
                       (door_x, y - 0.14, head + 0.14), M["trim"], bevel=0.01))

    # ---- Windows: frame, glazing set back, sill ---------------------------
    for i, wx in enumerate(win_xs):
        parts.append(B.box(f"wfrt{i}", (win_w + fr * 2, 0.08, fr),
                           (wx, y - 0.015, win_z + (win_h + fr) / 2), M["trim"], bevel=0.005))
        parts.append(B.box(f"wfrb{i}", (win_w + fr * 2, 0.10, fr),
                           (wx, y - 0.025, win_z - (win_h + fr) / 2), M["trim"], bevel=0.005))
        for sx in (-1, 1):
            parts.append(B.box(f"wfrs{i}{sx}", (fr, 0.08, win_h),
                               (wx + sx * (win_w + fr) / 2, y - 0.015, win_z),
                               M["trim"], bevel=0.005))
        parts.append(B.box(f"wseal{i}", (win_w, 0.02, win_h), (wx, y + 0.035, win_z),
                           M["seal"]))
        parts.append(B.box(f"wglass{i}", (win_w - 0.03, 0.012, win_h - 0.03),
                           (wx, y + 0.05, win_z), M["glass"]))
        # A centre transom: site windows are two panes, and the bar is what
        # stops the glazing reading as a dark rectangle.
        parts.append(B.box(f"wmul{i}", (0.03, 0.05, win_h), (wx, y + 0.02, win_z),
                           M["trim"]))

    # ---- Access steps -----------------------------------------------------
    # A unit on a chassis has its floor 260 mm up; a door with no way to reach
    # it is the sort of detail that reads as wrong without being identified.
    # A bolted-together step unit: treads, the risers under them, side
    # stringers and legs. The first pass was two floating plates -- a tread
    # with no riser beneath it reads as a shelf, because the eye looks for the
    # dark band that a real step casts under its nosing.
    tread, rise = 0.30, CHASSIS / 2
    width = door_w + 0.24
    for i in range(2):
        top = CHASSIS - i * rise
        yy = y - 0.17 - i * tread
        parts.append(B.box(f"step{i}", (width, tread, 0.035),
                           (door_x, yy, top - 0.018), M["chassis"], bevel=0.005))
        parts.append(B.box(f"riser{i}", (width, 0.025, rise),
                           (door_x, yy + tread / 2 - 0.012, top - rise / 2),
                           M["chassis"]))
    for sx in (-1, 1):
        sx_x = door_x + sx * (width / 2 - 0.015)
        parts.append(B.box(f"string{sx}", (0.03, tread * 2, 0.10),
                           (sx_x, y - 0.17 - tread / 2, CHASSIS - 0.09),
                           M["chassis"]))
        parts.append(B.box(f"stepleg{sx}", (0.04, 0.04, CHASSIS - 0.10),
                           (sx_x, y - 0.17 - tread * 1.4, (CHASSIS - 0.10) / 2),
                           M["chassis"]))
    return parts


def main():
    B.reset_scene()
    M = materials()
    parts = chassis(M) + shell(M) + front_wall(M)
    ob = B.join("cabin", parts)
    B.set_origin_to_ground(ob)

    stats = B.export_glb(ob, os.path.join(B.ASSET_DIR, "cabin.glb"))
    B.validate(stats, max_triangles=9000,
               expect_size=(LEN + 0.2, CHASSIS + BODY + CAP, DEP + 0.6), tol=0.2)
    print(f"OK  {stats['file']}  {stats['triangles']} tris  "
          f"{stats['bytes'] / 1024:.1f} KB  size {stats['size_m']}  "
          f"{len(stats['materials'])} materials")


main()
