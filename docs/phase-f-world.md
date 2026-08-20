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
