"""
The construction site as a real 3D scene description.

This emits WORLD GEOMETRY IN METRES, not screen coordinates. Nothing here
knows about a viewport, a projection or a renderer -- the runtime places a
camera in this world and looks at it. That is the difference between a 3D
scene and a drawing that looks three-dimensional.

Everything is deterministic from one seed, so a site is reproducible, diffable
and reviewable. The generator's job is layout and structure; lighting,
materials and camera work belong to the runtime.

Emits:
  ground      extent of the site
  massing     background city blocks, coarse
  frame       the building under construction: grid, columns, slabs, core
  scaffold    standards, ledgers and boards on the near face
  crane       tower crane: mast, jib, counter-jib, tie levels, trolley range
  hoist       a mast-climbing hoist on the frame's flank
  works       site cabins, material stacks, fencing
  lights      work-light positions and their aim
  cameras     named camera stations and the paths between them

Usage:
    python3 tools/scene/generate_site3d.py > frontend/src/world/siteGeometry.json
"""

import json
import math
import sys

M = 1.0  # one unit is one metre


class Rng:
    def __init__(self, seed):
        self.s = seed & 0xFFFFFFFF

    def next(self):
        self.s = (1664525 * self.s + 1013904223) & 0xFFFFFFFF
        return self.s / 0xFFFFFFFF

    def f(self, a, b):
        return a + (b - a) * self.next()

    def i(self, a, b):
        return int(self.f(a, b + 1))


def r3(v):
    return round(v, 3)


def box(x, y, z, w, h, d, kind):
    """A solid, positioned by its CENTRE in world metres -- which is how a
    scene graph wants it, and avoids an off-by-half at every call site."""
    return {"k": kind, "p": [r3(x), r3(y), r3(z)], "s": [r3(w), r3(h), r3(d)]}


# ---------------------------------------------------------------------------

def frame(r):
    """
    The building under construction.

    ARCHETYPE, encoded rather than implied: a mid-rise reinforced-concrete
    commercial frame during its structural cycle. Everything below follows from
    that one decision — 7.2 m bays, 3.6 m floor-to-floor, 600 mm columns, a
    300 mm flat slab with 600 mm perimeter downstands, a lift/stair core, and a
    three-level construction zone at the top where the work actually is.

    The floors are NOT identical, because a real frame under construction never
    is. Reading up the building:

        completed          struck, edge protection only
        recently struck    props still in place, back-propping the new pour
        formwork level     plywood deck, falsework beneath, no slab yet
        active pour        partial slab, starter bars, open perimeter

    That vertical story is most of what separates "a building being built" from
    "an empty structural model".
    """
    bays_x, bays_z = 6, 4
    bay, storey = 7.2, 3.6
    storeys = r.i(9, 11)
    col = 0.62
    slab_t = 0.3
    downstand = 0.62
    ox, oz = -bays_x * bay / 2, -bays_z * bay / 2
    W, D = bays_x * bay, bays_z * bay

    out = []
    for i in range(bays_x + 1):
        for j in range(bays_z + 1):
            h = storeys * storey
            out.append(box(ox + i * bay, h / 2, oz + j * bay, col, h, col, "column"))

    slabs = []
    beams = []
    for s_i in range(1, storeys + 1):
        y = s_i * storey
        full = s_i < storeys
        w = W if full else W * r.f(0.42, 0.64)
        slabs.append(box(ox + w / 2, y, 0, w, slab_t, D,
                         "slab" if full else "slab-pour"))

        # Perimeter downstand beams. These are what give a floor its visible
        # depth and the shadow line beneath it; a flat plate has neither.
        if full:
            beams.append(box(ox + w / 2, y - downstand / 2, oz, w, downstand, 0.42, "beam"))
            beams.append(box(ox + w / 2, y - downstand / 2, oz + D, w, downstand, 0.42, "beam"))
            beams.append(box(ox, y - downstand / 2, 0, 0.42, downstand, D, "beam"))
            beams.append(box(ox + W, y - downstand / 2, 0, 0.42, downstand, D, "beam"))

    core = box(ox + 2 * bay, storeys * storey / 2 + 2, oz + 2 * bay,
               bay * 1.05, storeys * storey + 4, bay * 1.05, "core")

    # ---- The construction zone -------------------------------------------
    #
    # Falsework beneath the two most recent pours, on a 1.8 m grid — the props
    # a slab is actually left standing on while it gains strength. Instanced,
    # so a few hundred cost one draw call.
    props = []
    for level in (storeys - 1, storeys):
        y0 = (level - 1) * storey
        x = ox + 1.2
        while x < ox + W - 1.2:
            z = oz + 1.2
            while z < oz + D - 1.2:
                props.append(box(x, y0 + (storey - slab_t) / 2, z,
                                 0.09, storey - slab_t, 0.09, "prop"))
                z += 1.8
            x += 1.8

    # Plywood deck formwork on the level currently being formed, with the
    # soldier beams that carry it.
    deck_y = storeys * storey - slab_t
    forms = [box(ox + W * 0.55 / 2, deck_y, 0, W * 0.55, 0.05, D, "ply")]
    for i in range(9):
        forms.append(box(ox + W * 0.55 / 2, deck_y - 0.16, oz + i * (D / 8),
                         W * 0.55, 0.22, 0.14, "ply"))

    # Column starter bars projecting through the active pour: the reinforcement
    # the next lift will be cast around. Four per column, restrained.
    rebar = []
    for i in range(bays_x + 1):
        for j in range(bays_z + 1):
            cx = ox + i * bay
            cz = oz + j * bay
            if cx > ox + W * 0.6:
                continue
            for dx, dz in ((-0.2, -0.2), (0.2, -0.2), (0.2, 0.2), (-0.2, 0.2)):
                rebar.append(box(cx + dx, storeys * storey + 0.55, cz + dz,
                                 0.028, 1.1, 0.028, "rebar"))

    # Edge protection on struck floors: the guard rail every open slab edge
    # legally carries, and a strong horizontal cue at every level.
    edge = []
    for s_i in range(1, storeys):
        y = s_i * storey
        for h_off in (0.5, 1.05):
            edge.append(box(ox + W / 2, y + h_off, oz + D, W, 0.05, 0.05, "rail"))
        for k in range(int(W / 2.4) + 1):
            edge.append(box(ox + k * 2.4, y + 0.55, oz + D, 0.06, 1.1, 0.06, "rail"))

    assert any(s["k"] == "slab-pour" for s in slabs), "no storey under construction"
    assert len(props) > 80, "falsework too sparse to read"
    assert len(beams) > 20, "no perimeter downstands"

    return {"columns": out, "slabs": slabs, "beams": beams, "core": core,
            "props": props, "forms": forms, "rebar": rebar, "edge": edge,
            "grid": {"bay": bay, "storey": storey, "storeys": storeys,
                     "bays_x": bays_x, "bays_z": bays_z, "ox": ox, "oz": oz}}


def crane(r, g):
    """
    A tower crane, sized against the building it serves.

    The jib must actually reach across the frame or the machine is decoration:
    that is asserted, not hoped for. The mast stands clear of the slab edge so
    it does not intersect the structure.
    """
    base_x = g["ox"] - 6.5
    base_z = g["oz"] + g["bays_z"] * g["bay"] * 0.5
    mast_h = g["storeys"] * g["storey"] + r.f(9, 13)
    jib = r.f(38, 46)
    back = jib * 0.34

    reach = base_x + jib
    assert reach > g["ox"] + g["bays_x"] * g["bay"] * 0.6, "jib cannot reach the frame"

    ties = [round(mast_h * f, 2) for f in (0.34, 0.58, 0.8)]
    return {"base": [r3(base_x), 0, r3(base_z)], "mast_h": r3(mast_h),
            "mast_w": 1.5, "jib": r3(jib), "back": r3(back), "ties": ties,
            "trolley": [r3(jib * 0.28), r3(jib * 0.9)],
            "hook_drop": [r3(mast_h * 0.28), r3(mast_h * 0.72)]}


def scaffold(r, g):
    """Standards, ledgers and boards on the near face -- the layer the camera
    passes closest to, and the reason the site has a foreground at all."""
    # The NEAR face — the side the camera stands on.
    #
    # The scaffold was on the far elevation, so from every camera station it
    # sat behind the building and contributed nothing. On the near face it
    # crosses the foreground, which is what gives the shot a depth reference
    # and makes pointer movement produce real parallax against the structure.
    z = g["oz"] + g["bays_z"] * g["bay"] + 1.9
    x0 = g["ox"] - 1.5
    span = g["bays_x"] * g["bay"] + 3
    lifts = 7
    standards = [box(x0 + i * 2.4, lifts * 2 / 2, z, 0.09, lifts * 2, 0.09, "tube")
                 for i in range(int(span / 2.4) + 1)]
    ledgers = [box(x0 + span / 2, 2 + l * 2, z, span, 0.08, 0.08, "tube")
               for l in range(lifts)]
    boards = [box(x0 + span / 2, 2 + l * 2 + 0.06, z + 0.35, span, 0.05, 0.7, "board")
              for l in range(1, lifts, 2)]
    assert len(standards) >= 6, "scaffold too sparse to read as scaffold"
    return {"standards": standards, "ledgers": ledgers, "boards": boards}


def massing(r):
    """
    Background city. Coarse on purpose: it is silhouette and depth cue, and
    every polygon spent here is one not spent on the structure in focus.

    Placed on an arc that EXCLUDES the camera's own quadrant. The first version
    scattered blocks on a full circle and one landed between the camera and the
    site, filling the right of frame with a dark slab — background geometry in
    the foreground, which a render showed at once. The camera stations all sit
    toward +x/+z, so that wedge is kept clear and everything else reads as
    distance.
    """
    out = []
    # The camera looks from roughly 45 degrees; keep 110 degrees around it free.
    blocked = (math.radians(-10), math.radians(100))
    placed = 0
    guard = 0
    while placed < 26 and guard < 400:
        guard += 1
        a = r.f(0, math.tau)
        d = r.f(110, 250)
        norm = a % math.tau
        if blocked[0] % math.tau <= norm <= blocked[1] % math.tau and d < 200:
            continue
        h = r.f(14, 74)
        w, dp = r.f(10, 26), r.f(10, 26)
        out.append(box(math.cos(a) * d, h / 2, math.sin(a) * d - 30, w, h, dp, "mass"))
        placed += 1

    assert placed >= 18, "massing band too sparse after exclusion"
    return out


def works(r, g):
    """
    The site's operational clusters.

    A construction site is messy but ORGANISED: materials are stacked where the
    crane can reach them, cabins sit by the gate, and the haul road connects
    them. Scattering props at random reads as clutter; grouping them by
    function reads as a site that someone runs.

    Zones, all placed relative to the frame so they stay coherent if the
    building's grid changes:

        entry       hoarding, gate, signage, traffic barriers
        staging     formwork stacks, pallets, rebar bundles, blocks
        services    cabins, generator, light tower
        lift zone   the crane's pickup area, kept clear
    """
    out = []
    W = g["bays_x"] * g["bay"]
    D = g["bays_z"] * g["bay"]
    near = g["oz"] + D

    # ---- Temporary services: a cabin stack by the gate -----------------
    for i in range(3):
        out.append(box(g["ox"] - 19 + i * 6.6, 1.35, near + 19,
                       6.1, 2.7, 2.5, "cabin"))
    # A second cabin stacked, which is what a real compound does for space.
    out.append(box(g["ox"] - 12.4, 4.1, near + 19, 6.1, 2.7, 2.5, "cabin"))
    out.append(box(g["ox"] - 24.5, 1.1, near + 19, 2.2, 2.2, 2.0, "plant"))

    # ---- Material staging, inside the crane's radius --------------------
    #
    # Formwork panels stacked on bearers, pallets of block, and rebar bundles.
    # Stacks are irregular in height because a stack that is being worked from
    # never is uniform.
    for i in range(5):
        h = r.f(0.5, 1.15)
        out.append(box(g["ox"] + 3 + i * 3.1, h / 2, near + 7.5,
                       2.9, h, 1.35, "ply"))
    for i in range(6):
        out.append(box(g["ox"] + 16 + (i % 3) * 1.5, 0.42 + (i // 3) * 0.85,
                       near + 7.2 + (i % 2) * 1.3, 1.2, 0.8, 1.0, "pallet"))
    for i in range(4):
        out.append(box(g["ox"] + 22 + i * 1.1, 0.28, near + 10.5,
                       0.9, 0.5, 6.0, "rebar-stack"))

    # ---- Access and security -------------------------------------------
    #
    # Hoarding along the site boundary with a gate opening, plus traffic
    # barriers marking the vehicle route.
    hoard_len = W + 34
    seg = 2.4
    n = int(hoard_len / seg)
    gate_at = int(n * 0.34)
    for i in range(n):
        if gate_at <= i <= gate_at + 3:
            continue
        out.append(box(g["ox"] - 17 + i * seg + seg / 2, 1.1, near + 27,
                       seg - 0.06, 2.2, 0.12, "hoard"))
    # Gate leaves, standing open.
    out.append(box(g["ox"] - 17 + gate_at * seg + 1.2, 1.1, near + 26.2,
                   2.3, 2.2, 0.1, "gate"))
    out.append(box(g["ox"] - 17 + (gate_at + 4) * seg - 1.2, 1.1, near + 26.2,
                   2.3, 2.2, 0.1, "gate"))
    # Site sign beside the gate.
    out.append(box(g["ox"] - 17 + gate_at * seg - 1.4, 1.7, near + 26.9,
                   2.4, 1.6, 0.08, "sign"))

    for i in range(7):
        out.append(box(g["ox"] - 8 + i * 3.2, 0.42, near + 22,
                       1.9, 0.85, 0.5, "barrier"))

    # ---- Light towers, on the two working corners ----------------------
    for x in (g["ox"] - 4, g["ox"] + W + 3):
        out.append(box(x, 3.4, near + 4, 0.22, 6.8, 0.22, "mast"))
        out.append(box(x, 6.9, near + 4, 1.5, 0.4, 0.45, "lamp"))

    return out


def workers(r, g):
    """
    Three figures, for SCALE.

    Not population — scale. A 3.6 m storey height means nothing to the eye
    until something of known size stands beside it, and a construction site
    without a single person reads as abandoned.

    Each is five boxes: legs, torso, head, hard hat. At the distances these are
    seen that is enough to read as a person in hi-vis, and it avoids the
    uncanny result of a low-quality animated character.
    """
    D = g["bays_z"] * g["bay"]
    near = g["oz"] + D
    out = []

    def figure(x, z, facing=0.0, tag="worker"):
        # 1.78 m: legs 0.86, torso 0.62, head 0.22, hat on top.
        out.append(box(x - 0.09, 0.43, z, 0.15, 0.86, 0.18, "hiviz-dark", ))
        out.append(box(x + 0.09, 0.43, z, 0.15, 0.86, 0.18, "hiviz-dark"))
        out.append(box(x, 1.17, z, 0.42, 0.62, 0.24, "hiviz"))
        out.append(box(x, 1.58, z, 0.19, 0.21, 0.19, "skin"))
        out.append(box(x, 1.72, z, 0.27, 0.09, 0.27, "hat"))
        return facing

    # One at the material staging, one at the gate, one on the boarded lift.
    figure(g["ox"] + 8.5, near + 8.2)
    figure(g["ox"] - 6.0, near + 21.4)
    figure(g["ox"] - 9.0, 16.3 + 0.9)   # on the scaffold platform run
    out[-3]["p"][1] += 6.0              # lift the torso group to lift 3
    out[-2]["p"][1] += 6.0
    out[-1]["p"][1] += 6.0
    out[-5]["p"][1] += 6.0
    out[-4]["p"][1] += 6.0

    assert len(out) == 15, "three figures, five members each"
    return out


def lights(r, g):
    """Work lights: position and aim. Warm, low, and pointed at the work --
    which is what makes a night site read as being worked rather than lit."""
    out = []
    for i in range(4):
        x = g["ox"] + i * (g["bays_x"] * g["bay"] / 3)
        out.append({"p": [r3(x), r3(g["storeys"] * g["storey"] * r.f(0.35, 0.85)), r3(g["oz"] - 3)],
                    "aim": [r3(x + r.f(-6, 6)), r3(r.f(4, 14)), r3(g["oz"] + 8)],
                    "warm": True})
    out.append({"p": [r3(g["ox"] - 22), 26, r3(g["oz"] - 24)],
                "aim": [0, 8, 0], "warm": False})
    return out


def cameras(g):
    """
    Camera stations, composed as architectural photography rather than as views
    of a model.

    THE CAMERA STANDS ON THE SITE. Every station is at roughly eye height
    (1.6-2.4 m) looking UP at the structure. The previous stations sat at
    1.5x the building's height looking down, which is a position no person can
    occupy and the single strongest reason the scene read as a 3D viewer: a
    model is something you orbit, a place is somewhere you stand.

    Framing follows the same logic:

      - the frame is pushed off-centre, so the composition has a subject and a
        space rather than a centred object
      - the camera sits BEHIND the scaffold line, so foreground steel crosses
        the near frame and gives the eye something to measure depth against
      - verticals stay near-vertical: the look-at is only slightly above the
        camera, because a steeply tilted camera converges the columns and
        reads as a snapshot rather than as architecture

    Focal lengths are recorded as 35 mm-equivalent and converted, so the
    stations can be reasoned about in photographic terms.
    """
    top = g["storeys"] * g["storey"]
    span = g["bays_x"] * g["bay"]

    def fov(mm):
        # Vertical FOV for a 35mm-equivalent focal length on a 3:2 frame.
        return round(math.degrees(2 * math.atan(24.0 / (2 * mm))), 2)

    # The site's near edge, where the scaffold and fencing stand.
    near_z = g["oz"] + g["bays_z"] * g["bay"] + 26

    # The subject is not the building: it is the building AND the crane above
    # it, roughly 60 m of vertical. At a 35mm-equivalent half-angle of 18.9
    # degrees that needs about 90 m of stand-off, so the stations sit at the far
    # side of the site rather than on top of the structure. A first attempt put
    # them 40 m closer and the frame filled with slabs -- no crane, no sky, no
    # site, and no composition.
    subject_h = top + 26
    stand = (subject_h * 0.5) / math.tan(math.radians(fov(35) / 2))

    return {
        # Approach: the whole site from the boundary, crane included.
        "approach": {"pos": [span * 1.05, 2.3, near_z + stand * 0.75],
                     "look": [-span * 0.3, top * 0.52, 0], "fov": fov(28)},
        # Working station: the frame off to the right of the shot, the form
        # holding the left third, the crane crossing the sky above.
        "station": {"pos": [span * 0.92, 1.8, near_z + stand * 0.56],
                    "look": [-span * 0.34, top * 0.5, 0], "fov": fov(35)},
        # Focus: a small settle, not a re-frame.
        "focus": {"pos": [span * 0.86, 1.7, near_z + stand * 0.48],
                  "look": [-span * 0.36, top * 0.47, 0], "fov": fov(35)},
        # The sign-in flight ends inside the structure, at slab level.
        "through": {"pos": [span * 0.08, g["storey"] * 2.2, g["bays_z"] * g["bay"] * 0.5],
                    "look": [-span * 0.6, g["storey"] * 2.2, -g["bays_z"] * g["bay"] * 2],
                    "fov": fov(24)},
        "operational": {"pos": [0, g["storey"] * 2.4, near_z * 0.5],
                        "look": [0, g["storey"] * 2.2, -g["bays_z"] * g["bay"] * 2],
                        "fov": fov(35)},
    }


def cameras_portrait(g):
    """
    A phone gets its own shot, not the desktop one cropped.

    The previous portrait stations predated the human-height rework and looked
    down at the model. Portrait wants HEIGHT: the camera stands closer and
    lower so the frame rises through the tall side of the shot with the crane
    above it, and the form sits in the lower half against sky and scaffold
    rather than against a wall of slabs.

    Closer than desktop, deliberately. A phone cannot resolve the whole site,
    so it gets one corner of it at a scale where the scaffold's braces and the
    slab edges are still legible.
    """
    top = g["storeys"] * g["storey"]
    span = g["bays_x"] * g["bay"]
    near_z = g["oz"] + g["bays_z"] * g["bay"] + 26

    def fov(mm):
        # Portrait: the 24mm dimension is now the WIDTH, so the vertical field
        # comes from the 36mm side of the frame.
        return round(math.degrees(2 * math.atan(36.0 / (2 * mm))), 2)

    return {
        "approach": {"pos": [span * 0.62, 2.1, near_z + 26],
                     "look": [-span * 0.16, top * 0.58, 0], "fov": fov(32)},
        "station": {"pos": [span * 0.54, 1.7, near_z + 15],
                    "look": [-span * 0.18, top * 0.56, 0], "fov": fov(30)},
        "focus": {"pos": [span * 0.5, 1.6, near_z + 10],
                  "look": [-span * 0.2, top * 0.53, 0], "fov": fov(30)},
        "through": {"pos": [span * 0.06, g["storey"] * 2.2, g["bays_z"] * g["bay"] * 0.5],
                    "look": [-span * 0.6, g["storey"] * 2.2, -g["bays_z"] * g["bay"] * 2],
                    "fov": fov(22)},
        "operational": {"pos": [0, g["storey"] * 2.4, near_z * 0.45],
                        "look": [0, g["storey"] * 2.2, -g["bays_z"] * g["bay"] * 2],
                        "fov": fov(30)},
    }


def site(seed):
    r = Rng(seed)
    f = frame(r)
    g = f["grid"]
    return {
        "seed": seed,
        "units": "metres",
        "ground": 520,
        "frame": f,
        "crane": crane(r, g),
        "scaffold": scaffold(r, g),
        "massing": massing(r),
        "works": works(r, g),
        "workers": workers(r, g),
        "lights": lights(r, g),
        "cameras": cameras(g),
        "camerasPortrait": cameras_portrait(g),
    }


def counts(s):
    f = s["frame"]
    return (len(f["columns"]) + len(f["slabs"]) + len(f["beams"]) + len(f["props"])
            + len(f["forms"]) + len(f["rebar"]) + len(f["edge"]) + 1
            + len(s["massing"]) + len(s["works"])
            + sum(len(v) for v in s["scaffold"].values()))


if __name__ == "__main__":
    out = site(20260811)
    print(f"solids {counts(out)}  storeys {out['frame']['grid']['storeys']}  "
          f"lights {len(out['lights'])}  cameras {len(out['cameras'])}", file=sys.stderr)
    print(json.dumps(out, separators=(",", ":")))
