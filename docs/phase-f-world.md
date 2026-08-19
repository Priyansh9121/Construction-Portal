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

## Next: the tall hero and the open city

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
