# Phase F — the login world

Branch `phase-f/world`. Build, render, look, iterate. No vision document.

---

## Done

### 1. Sun and moon (`b8ef67a`)

The headline is a defect, not a feature: **the sky's sun direction had been
`NaN` since the day it was wired to SunCalc.** `applyGrade` called
`uSun.value.copy(dir)` where `dir` is the plain array `worldEnvironment`
returns; `Vector3.copy` reads `.x/.y/.z`, an array has none, so the uniform went
`undefined` then `NaN` through `normalize()`. Nothing threw. The sun disk and
Mie glow this shader has always contained therefore never rendered once.

Found by bisecting in the renderer: a 23°-wide sun drew nothing, a red marker
drew nothing, an unconditional red drew everything — so the block ran and its
input was wrong.

Added on top: limb-darkened sun with an aureole; a moon whose terminator is the
ellipse it should be, lit side facing the sun because the tangent basis is built
from the sun direction; earthshine on the dark limb; a star field fading in with
`nightness`. Both bodies draw **after** the cloud layer and are attenuated by it
— drawn before, the sun vanished at exactly the golden hour it matters most.

`sky-preview.html` renders the sky alone at any instant. Dev-only, never
imported by the app.

**The NaN was a single instance.** Checked as asked: `authWorld.js:851`
(`key.position.copy(sunDir)`) receives `sky.sun`, a real `Vector3` — correct.
Everything else that consumes a direction spreads it (`set(...env.sun.dir)` at
1157, `set(...env.moon.dir)` at 1160, `set(...l.p)` at 891/892). Fog and light
colours take hex numbers through `setHex`. One sharp edge worth knowing:
`sky.sun` **aliases** `uniforms.uSun.value`, so anything reading that handle
after init reads whatever `applyGrade` last wrote. Only `buildLights` reads it,
and it reads it before the first `applyGrade`, which is why the key light was
correct all along while the sky was not.

### 2. Camera (`2d88805`)

Assessed before building. **Orbit already existed and is good** — unclamped
azimuth so a full turn keeps going, elevation clamped by a dynamic minimum eye
height rather than a fixed angle, damped harder while dragging than after,
ambient drift yielding to manual control, and `turnedDeg` already proving 776°.
None of it was rebuilt.

**Dolly was the one thing missing.** Radius came only from the station. It is
now a multiplier on the station's radius (0.45–2.4, damped), so authored
framings stay themselves and the zoom rides on top.

Deliberately **not** on the bare wheel: `camera_probe.mjs` asserts the wheel
walks the journey, and the obvious way to add a zoom would have silently retired
that. Pinch on touch, modifier-wheel on mouse. The probe gained a fourth claim
next to the third because the two are easy to break together. 12/12 pass.

---

## Instancing — verified end to end before building on it (2026-08-19)

Three checks, measured, because an instanced GLB the loader silently flattens
buys nothing.

**1. The runtime already supports it.** `GLTFMeshGpuInstancing` is registered in
the `GLTFLoader` constructor immediately after the meshopt plugin, so the plain
`new GLTFLoader()` at `assets.js:43` handles it. **No wiring change.**

**2. Blender 4.5 emits it.** `export_gpu_instances` produces the extension
rather than duplicating geometry — 200 linked duplicates went from 201 nodes to
**one** node carrying TRANSLATION, ROTATION and SCALE for 200 instances. The
tooltip warns "multiple materials might be omitted"; it did not bite, both
materials survived as two primitives instanced 200× each. The constraint that
IS real: instances must be **children of an Empty**.

**3. The shipped `meshopt` command preserves it.** `EXT_mesh_gpu_instancing`,
`EXT_meshopt_compression` and `KHR_mesh_quantization` coexist with the instanced
node intact.

Loaded end to end in three, with the exact wiring `assets.js` uses:

    instanced     0 meshes   2 InstancedMesh    2 draw calls   60k tris   19.4 kB
    plain       400 meshes   0 InstancedMesh  400 draw calls   60k tris   48.3 kB

**The `gltf-transform optimize` question does not arise.** Its instancing pass
exists to *find* repeated nodes and convert them; Blender emits the extension
directly, so the pass is redundant and the 19 kB rejection recorded in
`build_assets.sh` stands unchallenged rather than overturned.

Worth carrying forward: **glTF already shares a mesh datablock across nodes**,
so instancing is only a modest byte saving. The prize is draw calls — 200× here.

## The hero — built (`concept_d.py`)

A2's massing in C's export pipeline, grown to **30 floors / 106.4 m**: podium
4 x 4.5 m, transfer level, tower 26 x 3.4 m offset to the street corner,
setback at 21, core slipformed past the top slab as the lift overrun, and a
**tower crane** with the hook at 118.4 m. The crane is what A2's 64 x 52 m plot
buys — the rejection recorded in C was about C's 22 x 34 m infill site, not
about tower cranes.

**The three zones, instanced where they repeat:**

    completed  tower levels 1-17    clad and glazed     1 mesh, 17 instances
    fitout     tower levels 18-22   frame, no skin      1 mesh,  5 instances
    frontier   tower levels 23-26   unique, every one   authored geometry

**Measured, compressed, like for like against what ships today:**

    login-site-architecture   500.6 KB   7 floors,  27.7 m   (today)
    login-site-architecture   198.9 KB   30 floors, 106.4 m  (concept D)

**4.3x taller and 60% smaller.** Twenty-two floors of unique geometry would
have breached the 2.0 MB per-layer limit on its own; twenty-two floors that are
two meshes and twenty-two transforms cost almost nothing, and the bytes go to
the frontier where the eye is.

**The byte gate has not been touched and does not yet need to be.** The set
cannot be totalled honestly until street, scaffold, people and the city are
rebuilt for the new plot — but the layer that was supposed to blow the budget
came in at 40% of its old size, so the number to ask for is not yet a number.

### One thing found while building it

`concept_c.py` ended with a bare `main()`, so **importing it ran it**. Concept D
imports `layer_of()` and `bake_production_materials()`, and the first export
found three of C's layers sitting in D's output directory, written before D had
run a line. Now guarded with `if __name__ == "__main__"`. Blender's `-P` sets
`__name__` to `"__main__"`, so `build_assets.sh` is unaffected.

## The city — first pass (instanced)

Four archetypes — tower, slab, podium block, low shed — placed as **216
instances** on a ring from 96 m to 620 m, weighted outward, with kind chosen by
distance so the skyline rises AWAY from the site and the hero stays the tallest
thing near it. All variety is transform-and-seed: rotation, uniform scale
0.72-1.5 and height scale 0.55-1.9, from `random.Random(1907)`.

    login-site-neighbours   762.7 KB   3 meshes of tight infill   (before)
    login-site-neighbours    33.6 KB   216 buildings, 620 m ring  (after)

**96% smaller while covering roughly a hundred times the area.** The archetypes
are right.

**The first city put a block on top of the establishing camera** and the hero
render came back as the inside of a wall. The stations sit at 47-159 m and the
ring starts at 96 m, so they overlap by design — a city that stopped beyond the
furthest station would be too far away to read. So the blocks are kept off the
camera rather than the camera kept out of the city, which is also what a street
does: `CAMERA_KEEPOUT` carries the four station eyes in Blender coordinates.

Set so far, compressed:

    architecture   192.6 KB      neighbours   33.6 KB
    scaffold        14.2 KB      street        5.8 KB
    ----------------------------------------------
    total          246.2 KB      against 2.01 MB today, gate 2.5 MB

Street dressing and people are not yet rebuilt for the new plot, so that total
will grow — but the two layers that were meant to break the budget now cost
226 KB between them where they used to cost 1.26 MB.

## Still to do





**Read `concept_a2.py` as instructed. It holds the right form and cannot be
dropped in.**

What it has: a genuine podium-and-tower — 4 podium levels at 4.5 m over a
64 × 52 m plot, a **transfer level** where the 10.5 m retail grid hands off to
the 7 m office grid, a tower offset to the street corner, a setback at the top,
an offset core running past the top slab as the lift overrun. 72.4 m over 20
levels, and every dimension is a named constant. Reaching ~100 m over 30 floors
is `TOWER_LEVELS = 26`.

What it does not have: **any export path at all.** It renders frames. The
shipping layers come from `concept_c.py` — `LAYER_RULES` at 1308, writing
`login-site-{layer}.glb` at 1461.

**And the hero's height is not a constant.** `concept_c.py` is a 22 × 34 m
infill plot whose entire construction method is derived from a 27.7 m building:
`HOIST_TIES` land on slab edges at levels 1/3/5/6, `HOIST_LANDINGS` follow the
work gangs, and the mobile crane's standing position was measured against a
25.6 m scaffold ("a street-side boom would have to stand 75 m back"). A 100 m
tower cannot be served by a mobile crane from a rear laneway. Raising `LEVELS`
does not produce a taller building; it produces an incoherent site.

So this is a port of A2's massing into C's export pipeline plus a rebuilt
logistics story, not a constant change. That is why it is one job with the city,
and why it is a session of its own.

## The budget, measured

Shipped today, per layer:

    login-site-neighbours     0.74 MB     <- the layer the city replaces
    login-site-architecture   0.49 MB     <- the hero, 7 levels, 27.7 m
    login-site-street         0.32 MB
    login-site-people         0.28 MB
    login-site-scaffold       0.18 MB
    ----------------------------------
    set                       2.01 MB     gate: 2.0 per layer, 2.5 set, 1.2 warn

**The number to bring is not yet earned.** The instruction was a measurement,
not an estimate, and the honest position is that the measurement depends on a
decision not yet made:

- **The city should cost almost nothing.** Four to six building archetypes
  instanced a couple of hundred times is a handful of meshes plus a transform
  buffer — 200 instances is 12.8 KB of matrices, or zero if they are generated
  from a seeded PRNG at runtime. A bigger city than today's should *shrink*
  the 0.74 MB neighbours layer.
- **The same applies to the hero.** Floors 5 to 26 of a tower are the same slab,
  the same column ring and the same facade bay. Exported as unique geometry, 30
  floors is roughly 4× the current 0.49 MB and breaches the per-layer limit on
  its own. Exported as one floor plus an instanced stack, it need not grow much
  at all.

So the first question for that session is whether the tower is instanced, and
the number follows from the answer. Building it the naive way and then asking
for 4 MB would be asking for the wrong thing.

## Reading the world

    /sky-preview.html?at=2026-08-19T15:00:00Z     the sky alone, any instant
    window.__AUTH_AT = "<iso>"                    drive the login world to an instant
    node tools/fresh_ui/camera_probe.mjs <outDir> 12 claims about the rig

Headless cannot render it: `CAPABLE()` rejects software renderers and headless
Chromium is SwiftShader. Use `channel: "chrome"`, headed, and wait on
`canvas.__perf` rather than a timeout.

---

## TRAP 8 — verifying a pipeline is not verifying the product

Before building the tower, instancing was checked end to end: Blender emitted
`EXT_mesh_gpu_instancing`, `meshopt` preserved it, and three's `GLTFLoader`
built an `InstancedMesh` — 2 draw calls against 400 for the same geometry.
Every one of those claims was true, and the check was worthless where it
mattered.

It used a **raw `GLTFLoader`**. The product does not. `assets.js` runs
`extract()`, which bakes `o.matrixWorld` into geometry — and an `InstancedMesh`
IS an `isMesh` whose `matrixWorld` is the Empty's, identity, with every real
placement in `instanceMatrix`. So the world shipped with **17 clad floors
collapsed into one at z = 0 inside the podium**, and the tower had no floors at
all. The GLB was right, the loader was right, the byte gate was delighted, and
nothing threw.

**The end that was never in the loop is the end that broke.**

So: any claim of the form *"I verified X end to end"* has to **name which end**.
The useful question is not "does the format work" but "does the code that will
actually consume this, consume it". If the check does not run the product's own
entry point, it is a check of the library, and it should say so.

Sibling of trap 2 (a green suite is not evidence a path is exercised) and of
trap 6 (a guard that watches one container is not a guard). The family
resemblance: all three verify something adjacent to the thing that matters.

---

## Shadow cost, measured

**The frustum was wrong first, and a number measured against it would have
been meaningless.** `key.shadow.camera` was ±85 with the light 140 m out and
far at 320 — sized for a 27.7 m building on a 22 x 34 m plot. Against a 106.4 m
tower with a 118 m crane the light sits *inside* the height the tower occupies
and the ortho box clips the caster, which does not read as a missing shadow but
as one cut off partway down the facade.

Re-derived: the plot's corner is ~41 m out and the crane stands at 118 m, so
±150 holds the pair; the light moved to 300 m so the whole tower is in front of
the near plane; far reaches 620 m. It deliberately does not reach the city,
which starts at 96 m — distant blocks would spend the same 2048 texels on
shadows the fog has already eaten. Both places that position the key light now
share `KEY_DISTANCE`; the second one re-places it on every environment update
and would otherwise have undone the frustum on the first sun move.

Then measured, A/B on the same loaded scene, `info.autoReset` off and
`gl.finish()` for the timing:

    DESKTOP   main pass only     40 calls   102,406 tris   0.10 ms
              with shadow pass   78 calls   204,800 tris   0.22 ms
              SHADOW PASS        38 calls   102,394 tris   0.12 ms

    MOBILE    shadow pass         0 calls         0 tris   0.00 ms

**38 draw calls for 493 instances.** The shadow pass roughly doubles submitted
geometry, which is what a second pass over every caster costs — but it is 38
calls rather than 500 because the casters are 14 `InstancedMesh`, and that is
the instancing payoff showing up twice.

The timing is honest but small: at 0.1-0.2 ms both passes are near the floor of
what `performance.now()` around a `finish()` can resolve, so the **call and
triangle counts are the solid figures** and the millisecond is indicative.

Mobile pays nothing, now confirmed rather than assumed: `castShadow = !portrait`
holds, and the phone tier reports 0 calls and 0 triangles for the pass.

---

## Refinement — tone, grid, clipping (2026-08-20)

### Tone: material beat geometry, measured both ways

    baseline   4 archetypes, one tone                       33.7 KB
    MATERIAL   4 archetypes x 3 materials                   52.0 KB
    geometry   12 distinct archetypes, one tone             70.5 KB

**The material route is 26% cheaper and keeps four archetypes**, so it is the
one that shipped. Two of the three tones cost nothing at all to add: concept_lib
already builds `city_warm` (brick) and `city_cool` (concrete), and both were
already in `SITE_SURFACES` and `EXPORT_UV_TILE` from an older city.

The mechanism is that the tone groups **share geometry**: the exported city has
12 meshes referencing **8 distinct POSITION accessors, 20 times over**, because
each tone is one object carrying the same mesh datablock with the material
overridden at object level. Twelve real archetypes cannot share anything.

Worth recording that the gap narrows under compression — raw it is 38 KB against
79 KB, better than 2:1, and meshopt claws most of that back by compressing the
twelve distinct geometries well. The decision holds either way, but the raw
figure would have oversold it.

**Varied by distance**, per the fog measurement: tone splits three ways inside
`CITY_TONE_BAND` (260 m) and collapses to one beyond it, where day fog is
already past 35% and night is total. That also keeps the instanced-node count
down where the variation would not be seen.

### The street grid

Placement was random polar, which is what made blocks read as scattered objects
rather than a built city. It now walks a **grid**: one building per 62 m cell,
jittered inside it, with the 16 m gap between cells being the street. Roads are
a few long slabs on the cell lines in the street layer — a road is the one thing
here with no repetition worth instancing.

First attempt used an 86 m pitch and placed **56 buildings where 205 had stood**:
the grid, not the rejection test, was the limiter. At 62 m with footprints and
max scale brought down to match the cell, it places **132**.

### The clipping block

Rejection sampling against a running list of placed centres and footprint radii,
as prescribed. One condition, and no block grows through another.

### Byte gate after all three

    architecture  277,620      neighbours  49,704      people  79,584
    scaffold       23,120      street      45,232      TOTAL  475,260

**Passed, 475 KB against the 2.5 MB limit** — up 21 KB on 454 KB, which is the
tone materials and the roads. Nothing doubled.

### Not solved

Tone variation is in the data — the shipped city carries `city_warm` and
`city_cool` across 12 instanced nodes — but it **reads weakly in the browser**
at midday, where the grade's exposure washes the blocks toward white. The next
move is the tint factors on those two materials rather than more archetypes.

### Tone, answered: the data was broken, not the noon grade (2026-08-20)

Checked golden hour first, as instructed, and then stopped squinting at renders
and read the materials out of the running world:

    conc        #ffffff  rough 1  map concrete
    city_warm   #ffffff  rough 1  map brick
    city_cool   #ffffff  rough 1  map concrete

**All three white, and `conc` and `city_cool` identical in every respect.** Two
of the three "tones" were the same surface. Nothing was flattening them at
noon — they were never different, and no exposure change would have helped.

The cause is one deliberate line in `dressSurface`: *"the albedo map already
carries the colour, so the factor must go white or it multiplies the texture
down and the surface reads muddy."* That rule is right for concrete and wrong
for a city that varies BY material, so `SITE_SURFACES` entries may now declare
a `tint` and dressSurface treats it as the documented exception. Kept gentle for
exactly the reason the white rule exists.

    city_warm   #d8b9a0   brick
    city_cool   #9db2c6   concrete
    conc        #ffffff   concrete  (untinted, the third tone)

Confirmed in the browser at the lane station: warm blocks right of frame, cool
blue-grey behind them, white ones between. **No asset rebuild — this is runtime
only, so the byte gate is untouched at 475 KB.**

### The near ring has presence

`lane` (124 m) is the strongest frame the world has produced: the tones read,
the near blocks have mass, and the tower is plainly in a city rather than in a
field. `entry` (47 m) is now the weak one — at 106 m the building fills the
frame completely and neither the site nor the city is visible, so it reads as a
facade study rather than as a place. It was framed for a 27.7 m building and
survived the re-derivation by being mathematically correct rather than right.

---

## TRAP 9 — when the question is whether two values differ, read the values

The city's tones were judged across two renders — noon, then golden hour —
before anyone dumped the materials. One `console.log` of colour, roughness and
map answered in seconds what a second render was never going to settle: all
three were `#ffffff` and two shared a texture. They had never differed.

Renders answer *how does this look*. They cannot answer *are these two things
the same*, because every difference in a render is confounded with light,
distance, exposure and fog. **If the question is an equality, read the values.**

Same family as trap 8: both spend effort on something adjacent to the question.

## The crowd — baked, measured, and not finished

### The byte number

    walk-vat.png       37.3 KB    1662 vertices x 24 frames, RGB8
    crowd-figure.glb   74.1 KB    the base mesh, UNCOMPRESSED (see below)
    walk-vat.json       0.4 KB    decode bounds
    -------------------------------------------------------------
    TOTAL             111.8 KB    the same for ten figures or ten thousand

Against `login-site-people.glb` at 79.6 KB for **five static figures** today.

### The performance number is NOT yet established

Measured 100 / 2,000 / 10,000 figures on both tiers, with `gl.finish()`:
**2 draw calls at every size**, and frame time flat at 0.3–0.5 ms.

**Flat is the tell, and it was right to distrust it.** The preview builds the
crowd from the FIRST primitive of the figure only — the GLB has four, one per
material (374 + 862 + 264 + 162 = 1662) — so it was measuring a quarter of a
body. The draw-call figure stands; the per-figure vertex cost is understated by
roughly 4.4x and the crowd-size question is still open.

### Two findings worth keeping

**Vertex order is not stable across the pipeline, twice over.**

1. Blender's 456 vertices become 1662 in the GLB — the exporter applies
   modifiers and splits by normal and UV. A VAT indexed by Blender's order
   poses every figure with somebody else's vertices, and it still looks
   human, because it is the same cloud of points. The baker now exports,
   re-imports, and resamples through the order the runtime will see.
2. **`meshopt` welds vertices**, taking that 1662 back to 374 — so compressing
   the figure silently invalidates the texture baked against it. The figure
   therefore ships UNCOMPRESSED, at a cost of 46 KB, and that is a deliberate
   trade rather than an oversight.

The next step is a VAT per primitive, or a single-material figure so there is
only one.

### Mobile

`SITE_LAYERS` skips `login-site-people` on phones, so today a crowd would be
desktop-only by inheritance. The measurement says the phone tier renders 10,000
figures in the same 2 draw calls, so the reason to exclude them would be
fill-rate and memory, not draw calls — **a decision to make, not to inherit.**

---

## The crowd, single-material — measured (2026-08-20)

### One material, and the 46 KB comes back

A worker is forty pixels tall in the frame this crowd exists for, and four
material slots on a body that size cost four glTF primitives, four sets of
accessors, four draw calls and four textures to keep in step. Each material's
base colour is now baked into the mesh's colour attribute and every slot
replaced by one.

**Vertex colours beat an atlas, measured:**

    vertex colours   GLB 69.4 KB   COLOR_0, no UVs, no second file
    atlas            GLB 73.1 KB   TEXCOORD_0, no colour, PLUS an atlas PNG

**And the weld hypothesis was right.** With one material there is nothing left
to weld, and meshopt now preserves the count exactly — verified by reading the
accessor, not assumed:

    crowd-figure.glb    1 prim   1596 verts   71.0 KB
    crowd-mo.glb        1 prim   1596 verts   22.4 KB

So the figure ships compressed again and the 46 KB penalty is recovered.

    crowd-figure.glb   22.4 KB   meshopt, count preserved
    walk-vat.png       36.6 KB   1596 vertices x 24 frames
    walk-vat.json       0.4 KB
    ----------------------------------------------------
    TOTAL              59.4 KB   against 79.6 KB for five static figures today

Getting `COLOR_0` out of Blender took three attempts, all silent:
`export_vertex_color="MATERIAL"` exports only colours the material graph is
*seen* to consume and declined even with a Vertex Color node wired into Base
Color. `"ACTIVE"` writes the mesh's active colour attribute and does not depend
on inferring intent from a node tree.

### The baker now asserts the count

Both of this pipeline's bugs were silent and both would have been caught by one
number. The baker reads the **shipped GLB's own accessor** back out and fails
loudly if it disagrees with the texture width, and refuses more than one
primitive. It is deliberately a check against the file that ships rather than
against the exporter's report.

### Where it stops being free

Frame interval, median over 100 frames — `gl.finish()` did **not** force a real
sync here (15.6M triangles came back at 0.35 ms, which would be 44 billion a
second), so this measures what the browser can actually sustain.

    figures   desktop        mobile viewport   triangles   draw calls
        200   60 fps         60 fps              0.62 M        2
      1,000   60 fps         60 fps              3.12 M        2
      5,000   60 fps         60 fps             15.60 M        2
     20,000   23 fps         26 fps             62.40 M        2
     60,000   6.5 fps        9 fps             187.20 M        2

**Free to 5,000 on both tiers. The knee is between 5,000 and 20,000.** Two draw
calls at every size, all the way to sixty thousand figures — the cost is vertex
throughput, exactly as predicted, and nothing else.

**One honesty about the mobile column: a 390x844 viewport on this machine is
not a phone.** It is the same GPU rendering fewer pixels, so it under-states a
real device by an unknown factor. What it does establish is that the work is
vertex-bound rather than fill-bound, which is the part that transfers.

### The mobile decision

`SITE_LAYERS` skips `login-site-people` on phones, so a crowd would be
desktop-only by inheritance. With 1,000 figures sitting five times inside the
budget even before allowing for the viewport caveat, **the measurement supports
putting people on phones** — and the field roles are the ones who see this
screen most. A construction site with nobody on it is the least convincing
version of this product.

---

## The crowd, wired in (2026-08-20)

**400 desktop / 150 mobile**, well below the measured knee on purpose: the
constraint is composition, not frame time. A city block with five thousand
people on it reads as an evacuation. The measurement's value was establishing
that the number is an art-direction choice rather than a budget one.

**Phones get people.** `login-site-people` was `mobile: false` — inherited, not
decided. It is now `true`, at 150 rather than 400 because a 390x844 viewport on
a development machine is not a phone GPU and that caveat deserves respecting
until someone measures a real device.

### Placement follows the street grid

Figures are placed against the same grid `concept_d.py` builds the city on —
duplicated constants, stated as a dependency rather than hidden in a shared file
only one side reads:

    58%   footpath beside a road, heading ALONG it
    18%   crossing at a junction, heading across one of the two roads
    17%   the hoarding line, the boundary of this project
     7%   the apron inside the site gate

Rejected if inside the podium footprint or past 250 m, where fog has them
anyway. Each figure carries a heading that matches where it stands, its own
phase and its own gait speed — a crowd in step is a parade, and phase is free.

Byte gate passed unchanged at 474,444 bytes: the crowd adds nothing to the
gated layers, because the figure and its texture ship as their own files.
**Note that `crowd-figure.glb` (22.4 KB) is NOT covered by the gate**, which
only walks `login-site-*.glb`. Worth extending.

### Outstanding: the figures render white

The whole point of the single-material flatten was that hi-vis, workwear, skin
and hat travel as vertex colours. `COLOR_0` is in the GLB and
`mat.vertexColors` is set when the attribute is present, and the crowd still
renders near-white while the five original static workers beside them are
correctly hi-vis. So something between the Blender colour attribute and the
shader is dropping it — the likely candidates are the colour Blender wrote
(`base_colour()` reads Principled Base Color, which may be white on materials
whose colour comes from elsewhere in the graph) and a linear/sRGB mismatch.

**This is the next thing to fix, and trap 9 says how**: read the values. Dump
the COLOR_0 accessor's actual contents rather than looking at another render.

### The white crowd, diagnosed by dumping the accessor (2026-08-20)

**One line settled what two renders could not.** The COLOR_0 accessor held
**one distinct colour, `(0.8, 0.8, 0.8)`, 1596 times** — the baker's own
fallback. So the export was innocent, colour space was innocent, the shader was
innocent, and `base_colour()` had never read a colour at all.

`concept_lib` builds these materials procedurally: Base Color is **linked** to a
`MIX_RGB` that blends the material's own colour with a common grime, so the
socket's `default_value` is an untouched 0.8 grey — and so is `diffuse_color`,
which was the fallback. Both readings were of defaults nothing had set.

The reader now follows the link one level and takes the mix's own inputs:

    hi-vis      0.597, 0.745, 0.034      374 vertices
    workwear    0.025, 0.036, 0.051      818
    skin        0.254, 0.144, 0.084      264
    hat         0.807, 0.776, 0.716      140

Four distinct colours in the accessor, and hi-vis in the frame. **No colour
space work was needed**, which is the other half of what the dump established:
Blender's FLOAT_COLOR attribute, glTF COLOR_0 and three all agree on linear, so
the branch that would have been a day of end-to-end comparison never opened.

### The gate hole is closed

It globbed `login-site-*.glb` only, so `crowd-figure.glb` and the VAT — 59 KB a
user downloads — walked straight past it. It now covers every file the world
fetches, the PNG counted at full size because the meshopt step does not touch
it and never will.

    login-site-architecture  277,836     crowd-figure.glb   22,580
    login-site-people         79,584     walk-vat.png       37,484
    login-site-neighbours     49,576     walk-vat.json         402
    login-site-street         44,964
    login-site-scaffold       23,088     TOTAL             535,514

**Passed at 535 KB against the 2.5 MB limit**, with 59 KB of that newly visible
rather than newly spent.

### The crowd walks (2026-08-20)

**Ground speed is derived, not chosen.** The baker measures it off the baked
feet — the vertices in the bottom tenth of the figure, their full forward
excursion across the cycle, doubled because a gait cycle is two steps — and
writes `metresPerCycle` into `walk-vat.json` beside the bounds:

    86 foot vertices, step 0.655 m, 1.310 m per cycle

The shader multiplies that by each figure's own cycle rate, so the same number
that chose the pose decides how far it has travelled. Choosing the speed
separately is what makes a crowd ice-skate, and it is more noticeable than
walking in place because the error accumulates.

**Wrapping is per figure, at the distance its route allows**, not at a block
edge: 220 m for footpath walkers, so the pop happens where day fog is already
past a third; the width of the carriageway plus its footpaths for someone
crossing, so they do not stroll on through the block opposite; the podium's own
dimension along the hoarding; 14 m on the gate apron.

**Shares rebalanced** — the boundary was reading as a queue:

    footpath   58% -> 72%      hoarding line   17% -> 8%
    crossing   18% -> 14%      gate apron       7% -> 6%

Byte gate passed at 535,280 bytes.

**Still not right at entry.** The figures bunch in front of the hoarding rather
than distributing along it, and one walks close enough to the camera to read as
a giant. The share change helped and did not fix it: the cause is that every
figure starts at a placement and then walks a straight line, so the ones headed
toward the camera pile up at the near end of the frame while the far end
empties. Placement is a distribution over START positions, not over positions.
The fix is to spread the initial phase over the WRAP distance rather than over
the cycle, so a figure's starting offset is anywhere along its route — which
also removes the pop from being simultaneous for everyone sharing a wrap.

### The crowd spreads, and stays off the camera (2026-08-20)

Two changes, and the crowd is finished.

**`aPhase` widened to `r() * (wrap / metresPerCycle)`.** It already drove both
the pose and the travel offset, so widening it from one cycle to the number of
cycles that fills a figure's whole wrap starts each one anywhere along its
route rather than at its placement — no new attribute. Placement was only ever
distributing START positions, which is why entry bunched at the near edge while
the far end emptied, and why everyone sharing a wrap popped at the same instant.

Safe because the shader already guards both uses: `fract()` before indexing the
texture row, `mod()` before travelling. Confirmed by reading the shader rather
than by rendering — a phase of 168 cycles is a legal pose and a legal distance.

**A camera keep-out, 8 m, tested against the ROUTE.** The giant at entry was a
proximity bug, not a distribution one. The station eyes are derived from
`SITE_JOURNEY` in the rig's own spherical convention, so a station that moves
takes its keep-out with it — and the test is point-to-SEGMENT, because these
figures walk up to `wrap` metres from where they are placed and the placement
was never the problem. The giant had a perfectly innocent starting position.

Both stations confirmed in the browser. The giant is gone from entry, the
figures read as hi-vis at both distances, and lane's camera was verified
numerically rather than by eye: `eye [95.01, 3.00, -70.04]`, which is the lane
station exactly as `SITE_JOURNEY` derives it.

---

## 1. Ambient occlusion — baked, and why (2026-08-20)

### Both options measured

**Screen-space, measured in the product** with `EXT_disjoint_timer_query_webgl2`
— real GPU time, not `performance.now()` around a `render()` and not
`gl.finish()`, both of which have already lied in this phase:

    DESKTOP 1440x904   plain 5.963 ms   +SSAOPass 6.594 ms   SSAO = 0.631 ms
    MOBILE   390x844   plain 2.806 ms   +SSAOPass 3.728 ms   SSAO = 0.922 ms

**SSAO costs MORE at the smaller viewport**, which is the finding worth keeping:
its cost here is dominated by the second full geometry pass over 119k triangles
and 493 instances, not by the fullscreen AO. That part does not shrink with
resolution, so a real phone would pay it in full.

**Baked, measured in bytes:** 535,280 -> 615,392, **+80,112 bytes (+15%)**,
against a 2.5 MB gate. Nothing at runtime, and it survives on mobile.

**Baked wins**, and by more than the raw numbers suggest: this world is static
except the crowd, so screen-space AO would recompute an unchanging result sixty
times a second forever.

### It needed geometry before it needed a bake

Read the values first, and they settled the approach: **a city tower body is
EIGHTEEN vertices.** Vertex AO across eight bottom corners and eight top ones is
not occlusion, it is a vertical ramp up a seventy-metre building.

So `ground_rings()` cuts horizontal rings at 0.6, 1.4, 2.6, 4.5, 7.5 and 12 m —
spaced geometrically, because AO from the ground falls off fast and the samples
have to be dense where the falloff is. Bodies go 18 -> 48 vertices.

The bake itself is analytic: a BVH plus a cosine-weighted hemisphere of 24 rays
per vertex, with a distance falloff so near occluders count for more. No Cycles,
deterministic, and the whole world bakes in seven seconds. For an INSTANCED
archetype it captures ground contact and self-occlusion, which is the whole
truth available — every instance shares one mesh, so occlusion between
neighbours cannot be represented and is not attempted.

Baked ranges, read back rather than assumed:

    tfclad    803 verts   0.15-1.00   mean 0.86
    nbtower   312 verts   0.06-1.00   mean 0.72
    nbslab    160 verts   0.08-1.00   mean 0.62

### One edit that silently did nothing

The first bake produced `COLOR_0` on the hero and **none on the city**, which a
render would not have shown. The insertion point I patched against no longer
existed — the archetype loop had gained a tone-group structure — and Python's
`str.replace` does not complain when it matches nothing. Caught by reading the
exported accessors, which is trap 9 pointed at my own edits rather than at the
world. **An edit that reports success is not an edit that landed.**

### The honest result

Confirmed in the browser: `colorAttr=true, vertexColors=true` on every
architecture and neighbours primitive, instanced and not.

The effect is **real but modest at noon**, and strongest at `lane` where the
near blocks show vertical falloff and the podium's slab edges finally have
undersides. At `street` the city is 100 m+ away through fog and the change is
subtle. That is not an AO failure — it is item 4 arriving early: a 3.4 key with
a strong hemisphere fill washes out a 0.7 multiplier, and the AO will not pay
off fully until the noon grade stops flattening everything it touches.

---

## 4. Noon was lit mostly by something with no direction (2026-08-20)

### The values, verified before touching them

    alt 25   keyI 3.0   fillI 3.4
    alt 65   keyI 3.4   fillI 3.8

Confirmed: **fill exceeded key at both daylight stops.** A hemisphere light
fills every crevice equally, so midday was a scene lit predominantly by a source
with no direction — which is precisely what flattens facades and washes out the
AO baked in item 1.

### Measuring it needed a mask before it needed a number

The first probe reported that killing every light in the scene barely changed
the frame: mean 88.9 lit, **65.0 with everything off**. The frame is mostly sky
— an emissive shader that ignores lights — plus the login card. A whole-frame
histogram could never have shown a lighting change.

So the sample is masked to the pixels that actually respond: capture once with
all lights off, and count only pixels that differ from it. Read from a
`WebGLRenderTarget` we own via `readRenderTargetPixels` — no
`preserveDrawingBuffer`, no `finish()`, and the app's canvas untouched. That is
the repeatable instrument the earlier pixel probe should have been.

Which reach of each source, at `street`:

    key only    57,595 px   mean 47.3
    fill only   87,184 px   mean 47.9
    env only   113,675 px   mean 42.4

**The indirect sources touch twice the frame the sun does, for the same
luminance.** That is the flattening, as a number.

### The ratio, not the exposure

    3.4 key / 3.8 fill / 1.0 env    p05 17.7   mean 70.6   p75/p25 2.03   range 125.1
    9.0 key / 0.0 fill / 1.2 env    p05 17.7   mean 70.9   p75/p25 2.28   range 153.1

Same overall brightness, **identical shadow floor**, +12% shadow-to-light
contrast and +22% dynamic range. The shadow floor is the number that had to
hold: the strong fill was there deliberately to stop north-facing concrete going
dead, and that risk was real — it simply was not the hemisphere that had to
carry it. `scene.environment` is already a PMREM of this same sky, so the bounce
now comes from the sky the viewer can see, horizon warmth included, instead of
from a flat two-colour lamp.

Intermediate settings were measured and rejected rather than guessed: dropping
fill without raising key darkened the image (mean 51.3 at 6.0/0.3/0.5), and
raising env in place of fill did nothing for contrast, because swapping one
omnidirectional source for another is not a gain in directionality.

**Exposure is untouched**, as instructed. It is already lowest at noon, which is
the fingerprint of the problem having been attacked from the wrong end before.

Grades now carry `envI`, interpolated with everything else, so the indirect term
moves with the sun. Twilight and night stops are unchanged — the strong cool
fill at dusk is doing real work there. Golden hour got a milder version of the
same move (3.6 key / 1.5 fill) and is confirmed not to have regressed.

---

## TRAP 10 — a tool reporting success is not the work having landed

Three instances, all in scripted edits, all reporting success:

1. `str.replace` matched **nothing** because the target string had moved — the
   city archetype loop had gained a tone-group structure since the patch was
   written. Python does not complain when a replace matches zero times. The AO
   bake shipped with `COLOR_0` on the hero and none on the city.
2. A failed `cd` **short-circuited an `&&` chain**, so the environment.js edit
   never ran while the next command in the same block did. The grade change
   reported clean and was half applied.
3. The same failed-`cd` shape once ran an edit against the wrong directory
   entirely.

None of these throws. All of them print what success prints.

**The mitigation is to grep for the new content and assert a count after every
scripted edit, never to trust the exit code.** In-script: `assert old in s`
before replacing, and assert the expected occurrence count after. Out of script:
`grep -c` the new token and compare. It costs one command and it has now caught
three defects that a render would not have shown.

Family: trap 8 (verify the product, not the pipeline) and trap 9 (read the
values). All three are the same instruction — check the thing itself, not a
proxy that reports on it.

---

## FOR THE WEATHER WORK — the overcast grade will need its fill back

`fillI` is **0.0 at high sun**, so the shadowed side is carried entirely by the
PMREM of the sky. That is correct under a bright sky and **wrong under an
overcast one**: a dim sky bakes a dim environment, and with no hemisphere behind
it the shadowed side will crush.

So the overcast grade cannot simply reuse the clear-sky ratio. It needs fill
back — plausibly a lot of it, since real overcast light IS omnidirectional, which
is the one condition where the old hemisphere-dominant lighting was right.
Measure it with the masked luminance probe against `p05`, which is the number
that catches crushing.

---

## 3. The city has facades (2026-08-20)

`facade_bay` says it in its own comment: *"glazing flush with the structure
reads as a coloured face; glazing 200 mm behind a mullion grid reads as a
facade, because the reveal casts a shadow that moves with the sun."* The city
never got it — its glazing was a flat stripe **120 mm PROUD** of the wall, which
is the opposite of a reveal.

Each archetype now gets, per floor: a **spandrel band standing 240 mm off the
face**, vision glass sitting back behind it, and full-height fins every 5.5 m.
The recess is achieved by pushing the spandrel forward rather than cutting the
glass back — identical from outside, and no boolean on a mesh that has to stay
cheap enough to instance two hundred times.

**Doing this after item 4 was the right order.** The reveal reads only because
something directional casts its shadow; under the old 3.4 key against 3.8
hemisphere fill there was barely a directional source to cast one.

    login-site-neighbours   49,576 -> 91,772 bytes   (+42 KB, four archetypes)
    TOTAL                  615,392 -> 649,604 bytes

Masked luminance at noon, after:

    street   p05 17.7   p25 33.4   mean 65.6   p75 84.8   p75/p25 2.54
    entry    p05  7.9   p25 10.1   mean 54.6   p75 79.0   p75/p25 7.82
    lane     p05 11.9   p25 27.4   mean 61.0   p75 75.9   p75/p25 2.77

`street` contrast went 2.28 -> **2.54** from facades alone. `entry` reads 7.82
because it is filled by one shadowed elevation against bright sky — a genuinely
high-contrast frame rather than a flat one.

**Tonal variation arrived as a byproduct, exactly as predicted.** Dark glass
against pale spandrel gives every block strong internal contrast that survives
distance and fog far better than a paint tint does. Item 2 should be judged
against this, and it plainly needs fewer tints than the six-to-eight planned.

---

## 2. Tone — measured first, and the first instrument was wrong (2026-08-20)

**The read that the facades had made tints redundant was WRONG, and the way it
was wrong is worth keeping.**

The masked luminance probe said tinting reached nothing: flattening all three
tone materials to white, and then exaggerating them to loud brick and slate,
moved `p25`, `p75` and the contrast ratio **not at all** at `street`
(91.5 / 107.2 / 1.17 in every case).

That was a luminance metric applied to a **hue** change. `0xd8b9a0` and
`0x9db2c6` differ from white and from each other mostly in chroma, and a
luminance histogram is blind to exactly that. Same family as trap 9 — not
"read the values" this time but **measure the quantity that actually varies**.

The right instrument was area. Marking one surface at a time emissive and
counting its pixels:

    STREET   glass 34.8%   city_cool 29.4%   spandrel 17.6%   conc 12.5%   city_warm 5.7%
    LANE     glass 41.0%   spandrel 18.9%    city_warm 16.1%  conc 12.3%   city_cool 11.7%

**The tintable body is 40-48% of the city — the largest surface after glass,**
not the least visible one. Tints reach plenty. They simply do not move a
luminance histogram, because that is not what they change.

### Neighbour-aware assignment, not more slots

Three slots stay three; the effort went into which block gets which. Tone is now
decided **globally at placement time** rather than randomly per archetype — a
block's nearest neighbour is usually a different archetype, so a per-kind roll
could never see it. Each block takes the tone least represented among blocks
already placed within 95 m, ties broken on the seeded PRNG.

    before   100 / 13 / 19     (random per kind, everything past 260 m forced to tone 0)
    after     46 / 40 / 46     (neighbour-aware, whole ring)

`CITY_TONE_BAND` went 260 m -> 420 m. The band existed to hold the instanced-node
count down, and measured, it was buying 8 nodes out of 12 in exchange for a
uniform far skyline — while fog at 300 m is only 35%, so two thirds of that
skyline is still visible.

    street   p05 17.7   p25 32.4   mean 65.8   p75 86.4   p75/p25 2.67
    lane     p05 11.9   p25 29.9   mean 62.6   p75 82.0   p75/p25 2.74
    TOTAL    655,568 bytes

### A latent bug the reshuffle exposed

Widening the tone band changed how much the PRNG consumed, which moved every
block — and put a block **on top of the street camera**. The camera keep-out
tested centre distance only, so a 26 m-wide block centred 63 m from a 62 m
keep-out passed it and swallowed the lens. It now tests `kr + footprint`.

The bug was always there; only the shuffle made it visible. Worth remembering
that a change which reorders a seeded sequence is a change to every result that
sequence produces, and it can expose defects far from what was edited.

---

## TRAP 9, sharpened — a null result is only evidence if the instrument can see the axis

The masked luminance probe reported that flattening the city's tints to white,
and then exaggerating them to loud brick and slate, changed **nothing**:
`p25 91.5`, `p75 107.2`, ratio `1.17`, identical in all three cases. It reported
that null as confidently as it would have reported a real one.

The tints differ from white and from each other **mostly in chroma**. A
luminance histogram is structurally blind to a hue change. The instrument could
not have detected the thing being varied, so its silence carried no information
at all — and it nearly ended the work on a false negative.

**When a measurement says nothing changed, check that it could have detected the
change before believing it.** The check is usually cheap: vary the input to an
absurd degree and confirm the number moves. If an exaggerated input still reads
null, the instrument is wrong, not the hypothesis.

The right instrument here was AREA — mark one surface emissive, count its
pixels — which showed the "invisible" body is 40-48% of the city.

---

## The build could report success while the export crashed

Found while adding the camera assert. `Blender -b` **exits 0 even when the
script raises**, so an `UnboundLocalError` printed a traceback, the export never
ran, and `build_assets.sh` went on to gate the **stale assets from the previous
run** and print "byte gate passed".

Every number in that run was real and described the wrong build.

`concept_d.py` now wraps `main()` and exits non-zero on any exception. This is
trap 10 one level up: the build script was the tool reporting success.

## The camera-intrusion assert

`assert_cameras_clear()` runs after placement and fails the export, naming the
block, the station and the distance. Proven by disabling the keep-out:

    EXIT: 1
    CAMERA INTRUSION — a building stands where a camera stands:
      nbslab at (-110.1, -115.9) is 21.4 m from the street camera and reaches 35.1 m
      nbslab at (-69.0, -127.3) is 27.4 m from the street camera and reaches 35.1 m

Every future change to placement, count or ordering reshuffles the entire city,
so a keep-out that holds today holds by luck tomorrow. Same reasoning as the
vertex-count assert in the VAT baker: the cheap invariant that speaks when the
expensive silent one breaks.

---

## 1. The roads were buried, not fighting (2026-08-20)

The offered diagnosis was z-fighting or poor contrast. **It was neither.**

    roads   z 0.02 -> 0.12
    ground  z -0.70 -> +0.30

The ground's top is at **+0.30** and the roads topped out at **0.12**: the entire
city road grid sat **180 mm underground** and had never once been rendered.

The arithmetic that suggested z-fighting — `L.box((900, 900, 0.4), (0, 0, -0.2))`
giving a top at 0.00 — was reading `L.box`'s size argument wrong. The measured
box is 1.0 m tall, not 0.4. **Trap 9 in its plainest form: the values were
available and the derivation was not.**

Confirmed empirically before and after, with the street layer's surfaces marked
emissive one at a time and counted off a render target:

               street        lane
    before    7,193 px    10,886 px      (the site's own street strip only)
    after     8,444 px    13,285 px      (+17%, +22%)
    earth     3,129 px    13,790 px      (down correspondingly — roads now cover it)

The saved mask image is what settled it: before the fix the lit pixels formed a
band in the immediate foreground and **nothing at all across the city**, which a
count alone could not have distinguished from "roads are dim".

Anything that sits on the ground now references `GROUND_TOP`, measured out of
the built scene rather than derived from constructor arguments.

## 2. The ground is a street section now, not a plane (2026-08-20)

**No new surface slots.** Checked before adding any: Phase C already wired
`asphalt`, `kerb`, `footpath`, `median_top` and `haul` end to end — maps and
tints in `SITE_SURFACES`, tile sizes in `EXPORT_UV_TILE`, and every one already
present in `standard_materials()`. The city grid needed none of its own, and
reusing them inherits the correct tiles and a texture set already on the wire.

The carriageway moved **off `spandrel`**, which is the facade band the city
blocks wear — a road and a spandrel must not be tintable together. `asphalt`
was already the right home.

The section, summing to `CITY_ROAD` exactly:

    carriageway  8.4 m   asphalt      top +0.10
    kerb         0.25    kerb         top +0.26   (proud of the road)
    footpath     2.0     footpath     top +0.22
    verge        1.55    median_top   top +0.18

The verge is **sized and placed deliberately, not left over**: it is where item
3's street trees stand, so `VERGE_CENTRE` (7.225 m from each road centreline) is
already a planting line and the trees cost no second pass over the layout.

Area split, street-layer surfaces at `lane`:

    before   spandrel 13,285   earth 13,790
    after    earth 15,498   spandrel 3,332   footpath 2,512
             median_top 2,195   asphalt 1,825   kerb 1,439

    TOTAL 709,332 bytes

### But at dusk none of it is visible, and that is the real finding

Masked luminance of the lit geometry, dusk (sun -9.4°) against noon:

              p05   p25   mean   p75    p95
    street    3.1   3.4    7.6   8.4   20.6      (noon mean 65.7)
    lane      3.1   5.1   11.2  12.6   33.3      (noon mean 69.6)
    entry     2.1   4.1    8.3  10.9   18.9

**Dusk renders the world at roughly an eighth of noon, with p25 at 3.4/255 —
the lit geometry is crushed into the bottom 3% of the range.** The AO, the
facades, the tone assignment and this street section are all invisible there.

The cause is not the grade being wrong for the hour. It is that **the city has
no artificial light.** At sun -9.4° the interpolated key is 0.146 and the fill
0.655; a real city at that hour is carrying itself on lit windows and street
lamps, and this one has neither, so it goes to black cardboard. The site has
work lamps (`work` reaches 1.0 by -6°); the city beyond the hoarding has
nothing.

Recorded rather than acted on: it reorders what matters, and that is not mine
to decide.

---

## Night: windows first, and the measurement that redirected it (2026-08-20)

### Lit windows, built as instructed

`glass_lit` is a separate material slot, assigned to whole blocks at placement
alongside the tone groups — instancing carries transforms and nothing else, so a
state that varies per building has to be a group. Two states, and the archetype
alternates the slot every other floor so a lit block shows a scatter up its face
rather than reading as a lightbox. The runtime drives its emissive from
`nightness`, continuous, so windows come up through dusk instead of snapping on.

### The probe was blind to it, exactly as trap 9 warns

After lighting them the masked luminance went **down**: street mean 7.6 -> 6.5.
The probe masks on "differs from all-lights-off", and **an emissive surface
looks identical with the lights off** — so lit windows were excluded from the
sample entirely. The instrument could not see the axis being varied and
confidently reported the opposite of the truth.

The fix was to compare the frame against itself with the window emissive at
zero, and to vary it absurdly to prove the instrument could see anything:

    emissiveIntensity 1.27  ->   720 px changed (0.32% of frame)
    emissiveIntensity   80  ->  1,148 px changed (0.50% of frame)

### Which said windows can never carry it

Doubling the lit floors moved the count from 720 to 721 pixels. The ceiling is
the surface itself: `glass_lit` is **5.7-7.2% of the city, about 1% of the
frame**. Meanwhile the tintable BODY is **70% of the city's pixels** and at dusk
it had no light on it at all.

So windows are worth having and cannot be the answer. The answer is that the
sky shader models a **rural** night — its PMREM is nearly black — while a city
at night is lit by itself. **Skyglow was the missing term.**

    lane, sun -9.4      p05   p25   mean
    env 1.0 / fill 0.66  3.1   5.1    9.1     (before)
    env 4.0 / fill 2.0   3.0   6.1   24.3
    env 6.0 / fill 3.0   3.1   7.1   33.7
    env 9.0 / fill 4.0   4.9   9.4   48.9     (too close to noon)

The night stops now interpolate to **env 4.85 / fill 2.60** at -9.4:

    street   p05 3.1   p25 4.4   mean 16.5   (was 7.6)
    lane     p05 3.0   p25 6.1   mean 27.8   (was 9.1)

Roughly 40% of noon's mean at `lane` — night that reads as night rather than as
the lights being off. The key stays low: after dark the only direct source is
the moon, which is what `keyI` already said.

Street lamps along `VERGE_CENTRE` remain to do, and will share the placement
pass with the trees.

    TOTAL 736,724 bytes
