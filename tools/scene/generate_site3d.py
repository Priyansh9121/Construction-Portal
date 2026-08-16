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

    A SINGLE BOX PER BUILDING IS NOT ENOUGH. That was the previous version and
    it was the strongest remaining game/demo tell in the frame: 26 identical
    cuboids of one tone, every roofline flat and at the same angle, every
    silhouette a rectangle. Distance forgives detail; it does not forgive every
    building in a city being the same shape.

    So each block is COMPOSED rather than extruded:

        podium      a wider base, because streets have shops and car parks
        shaft       the tower, sometimes stepped back from the podium
        cap         a setback upper section on the taller ones
        plant       lift overrun and rooftop machinery, off-centre

    That is four boxes instead of one, and it buys the two things that actually
    read at 150 m: a varied roofline and a silhouette that steps. The camera
    can now orbit a full circle, so nothing may be left out of the far half of
    the arc either -- the previous exclusion wedge assumed the camera never
    went round the back.
    """
    out = []
    placed = 0
    guard = 0
    # A near ring and a far ring, so the city has depth rather than sitting on
    # one circle at one distance.
    while placed < 34 and guard < 600:
        guard += 1
        a = r.f(0, math.tau)
        d = r.f(115, 300)
        cx, cz = math.cos(a) * d, math.sin(a) * d - 30

        # Nothing may stand inside the site itself.
        if abs(cx) < 70 and abs(cz) < 70:
            continue

        h = r.f(16, 78)
        w, dp = r.f(12, 30), r.f(12, 30)
        tall = h > 44

        # Podium: wider and short, which is what gives a block a base.
        ph = r.f(4, 9)
        out.append(box(cx, ph / 2, cz, w * r.f(1.08, 1.3), ph,
                       dp * r.f(1.08, 1.3), "mass"))
        # Shaft, offset slightly off the podium's centre.
        ox, oz = r.f(-1.5, 1.5), r.f(-1.5, 1.5)
        sh = h * (r.f(0.62, 0.8) if tall else 1.0)
        out.append(box(cx + ox, ph + sh / 2, cz + oz, w, sh, dp, "mass"))
        # Cap: a setback upper section, on the taller blocks only.
        if tall:
            ch = h - sh
            out.append(box(cx + ox + r.f(-1, 1), ph + sh + ch / 2, cz + oz + r.f(-1, 1),
                           w * r.f(0.6, 0.82), ch, dp * r.f(0.6, 0.82), "mass"))
        # Roof plant: the lift overrun. Small, off-centre, and the single
        # cheapest thing that stops a roofline reading as a cut.
        top = ph + h
        if r.next() < 0.75:
            out.append(box(cx + ox + r.f(-w * 0.25, w * 0.25), top + r.f(1.2, 2.6) / 2,
                           cz + oz + r.f(-dp * 0.25, dp * 0.25),
                           r.f(3, 7), r.f(1.2, 2.6), r.f(3, 7), "mass"))
        placed += 1

    heights = [b["p"][1] * 2 for b in out]
    assert placed >= 24, "massing band too sparse"
    assert len(out) > placed * 2, "blocks are still single extrusions"
    assert max(heights) - min(heights) > 30, "the skyline has no variation"
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

    # ---- Temporary services: the welfare compound by the gate ----------
    #
    # Sizes match the AUTHORED cabin exactly (tools/blender/asset_cabin.py):
    # 6.22 x 2.62 x 2.44 m over a 20 ft chassis. The runtime replaces these
    # boxes with the GLB, so a box that disagreed with the asset would make the
    # site shuffle the moment the asset loaded.
    #
    # A row rather than a stack. Stacking is what a real compound does for
    # space, but the authored unit carries its own access steps, and a stacked
    # unit would stand its stair on the roof below it.
    for i in range(3):
        out.append(box(g["ox"] - 19 + i * 7.4, 1.31, near + 19,
                       6.22, 2.62, 2.44, "cabin"))
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

    Each is five boxes: legs, torso, head, hard hat. That is the FALLBACK. The
    runtime replaces it with the authored figure (tools/blender/asset_worker.py)
    whenever the GLB is available, so this emits both the boxes and the
    per-figure anchors the asset needs.

    The anchors carry a yaw. Three figures all facing the same way read as
    props; the same three turned to face the work they are doing read as
    people, and rotation is the cheapest variety there is.
    """
    D = g["bays_z"] * g["bay"]
    near = g["oz"] + D
    out = []
    at = []

    def figure(x, z, base=0.0, facing=0.0):
        # 1.78 m: legs 0.86, torso 0.62, head 0.22, hat on top.
        out.append(box(x - 0.09, base + 0.43, z, 0.15, 0.86, 0.18, "hiviz-dark"))
        out.append(box(x + 0.09, base + 0.43, z, 0.15, 0.86, 0.18, "hiviz-dark"))
        out.append(box(x, base + 1.17, z, 0.42, 0.62, 0.24, "hiviz"))
        out.append(box(x, base + 1.58, z, 0.19, 0.21, 0.19, "skin"))
        out.append(box(x, base + 1.72, z, 0.27, 0.09, 0.27, "hat"))
        # The anchor is a GROUND position, because the authored asset's origin
        # is its ground contact.
        at.append({"p": [r3(x), r3(base), r3(z)], "ry": round(facing, 4)})

    # One at the material staging, one at the gate, one on the boarded lift.
    figure(g["ox"] + 8.5, near + 8.2, 0.0, -0.6)
    figure(g["ox"] - 6.0, near + 21.4, 0.0, 2.5)
    figure(g["ox"] - 9.0, 16.3 + 0.9, 6.0, 1.2)   # on the scaffold platform run

    assert len(out) == 15, "three figures, five members each"
    assert len(at) == 3, "one anchor per figure"
    return out, at


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
    worker_boxes, worker_at = workers(r, g)
    return {
        "seed": seed,
        "units": "metres",
        "ground": 520,
        "frame": f,
        "crane": crane(r, g),
        "scaffold": scaffold(r, g),
        "massing": massing(r),
        "works": works(r, g),
        "workers": worker_boxes,
        "workerAt": worker_at,
        "lights": lights(r, g),
        "cameras": cameras(g),
        "journey": journey(g),
        "camerasPortrait": cameras_portrait(g),
    }


def journey(g):
    """
    The wheel journey: authored places in the site, not distances from a model.

    THE PROBLEM THIS SOLVES
    -----------------------
    The wheel used to scale the orbit radius. That is a zoom, and a zoom is the
    single clearest statement a scene can make that it is a MODEL being
    inspected rather than a place being moved through: the whole image scales
    together, nothing passes anything else, and no relationship between objects
    changes.

    A journey between authored stations changes the camera's POSITION IN THE
    WORLD. Foreground scaffold sweeps across the frame while distant massing
    barely moves, objects occlude each other in a different order at every
    station, and the crane lines up differently against the building. That
    parallax is the evidence that this is a world.

    STATIONS ARE SPHERICAL, NOT CARTESIAN
    -------------------------------------
    Each is a target to look at, a distance to stand back, a compass bearing
    and an EYE HEIGHT. Elevation is solved from the eye height rather than
    guessed, because "1.8 m off the ground" is a fact about standing on a site
    and "-0.141 radians" is not. Getting that wrong is what produced the
    earlier stations that floated above the building looking down.

    Focal lengths are photographic. 24 mm only where the camera is genuinely
    close and the wide angle is the point; 35 mm for the architectural views;
    nothing wider than 24, because the game-camera 60-plus FOV is itself a
    strong tell.
    """
    span_x = g["bays_x"] * g["bay"]
    depth = g["bays_z"] * g["bay"]
    top = g["storeys"] * g["storey"]
    near = g["oz"] + depth

    def fov(mm):
        # Vertical FOV of a 36x24 frame, which is what "35 mm" means.
        return round(math.degrees(2 * math.atan(12.0 / mm)), 2)

    # name, target, radius, azimuth (rad, 0 = due +z / the near face), eye (m), mm
    plan = [
        # The ESTABLISHING shot, and the one the page opens on. It has to say
        # "construction site" before it says anything else, which means the
        # frame must contain the building, the crane above it and sky -- from
        # a position a person could stand in, with the hoarding and compound
        # crossing the foreground to carry depth. 72 m at 28 mm covers 62 m of
        # vertical at the subject, which fits a 36 m frame plus its crane.
        ("entrance", [-2, 17, 8], 72, 0.46, 2.3, 28),
        ("hoarding", [-4, 11, 12], 44, 0.24, 2.0, 28),
        ("scaffold", [-12, 11, 13], 19, -0.35, 2.2, 28),
        ("lift", [-20, 16, 4], 30, -1.05, 3.0, 35),
        ("deck", [-6, 27, 2], 26, -0.55, 22.0, 35),
        ("hoist", [12, 19, 16], 20, 0.30, 17.0, 28),
        ("overview", [-2, 14, 2], 80, 0.75, 30.0, 35),
    ]

    out = []
    for name, target, radius, az, eye, mm in plan:
        # Solve the elevation that puts the eye at the intended height.
        sin_el = max(-0.95, min(0.95, (eye - target[1]) / radius))
        el = math.asin(sin_el)
        cos_el = math.cos(el)
        pos = [target[0] + math.sin(az) * cos_el * radius,
               eye,
               target[2] + math.cos(az) * cos_el * radius]

        # The camera must never end up inside the frame it is photographing.
        inside_plan = (abs(pos[0]) < span_x / 2 + 1 and abs(pos[2]) < depth / 2 + 1)
        assert not inside_plan or pos[1] > top + 2, \
            f"station {name} stands inside the structure at {pos}"
        assert pos[1] > 1.2, f"station {name} has the camera underground at {pos}"
        assert pos[2] < near + 70, f"station {name} is off the site at {pos}"

        out.append({
            "name": name,
            "target": [r3(v) for v in target],
            "radius": r3(radius),
            "azimuth": round(az, 4),
            "elevation": round(el, 4),
            "fov": fov(mm),
            "mm": mm,
            "eye": r3(eye),
            "pos": [r3(v) for v in pos],     # recorded for verification only
        })

    assert len(out) >= 5, "a journey needs somewhere to go"
    return out


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
