# Phase 3+ Login world — continuation state

**Status: CHECKPOINT. The concept phase is NOT complete.**

## Current commit

See `git log -1`. Production Login is untouched by all concept work; the last
production commit is `089664f` (real Indian time, real sun and moon).

## Canonical dev server

`http://localhost:5173`, `strictPort: true`. If it is occupied the run fails
and names the PID — that is intended. Do not let it drift to 5174/5175.

## Where the renders are

`.screenshots/concepts/`

| File | Verdict |
|---|---|
| `A-urban-tower-day-hero.png` | FAIL — reads as BIM |
| `A-urban-tower-day-ground.png` | FAIL — camera behind a cabin, marble-like materials |
| `B-commercial-day-hero.png` | PASS — cantilever fixed, perimeter structure reads |
| `B-commercial-day-ground.png` | PASS — foreground stacks, workers, crane, frame above |
| `B-commercial-day-rear.png` | PASS for 360 viability |
| `C-infill-day-hero.png` | **STRONGEST FRAME SO FAR** — reads as a real site |
| `C-infill-day-ground.png` | PASS — opposite footpath, worker at hoarding, scale reads |
| `C-infill-day-rear.png` | PASS — plot reads as a gap in a terrace |
| `A2-highrise-day-hero.png` | PASS — podium/tower/transfer reads, but presented not seen-through |
| `A2-highrise-day-ground.png` | Rendered; not individually reviewed |
| `A2-highrise-day-rear.png` | PASS — offset tower and podium terrace read from behind |
| `C-infill-day-hero-cycles.png` | Cycles diagnostic |

## What has been settled

**The renderer was never the bottleneck.** Concept A used EEVEE Next with
ray-traced shadows, procedural PBR and a physical Nishita sky, and still read
as BIM. Better rendering of box-assembly is better-rendered box-assembly.

**The modelling language was the bottleneck.** `concept_mesh.py` replaced
`box()` for hero architecture: plan outlines extruded into solids, voids cut
with booleans, edges inset and bevelled. Concept B, built that way, is
dramatically better than Concept A in one pass.

**Three bugs found only by looking at renders:**

1. Texture coordinates were Object-space. Every concept joins hundreds of parts
   into a few meshes, and after a join the frame is the *joined* object's — so
   formwork marks and window rhythm had no scale. Now world-space Position.
2. Stage banding was "more than 4 floors from the top", which glazed 17 of 21
   storeys and completed the building. Now fractions of height.
3. A Nishita sky at strength 1.0 is an enormous ambient wash that flattened
   every surface. Now 0.42 with a harder sun and −0.55 exposure.

## Open defects in Concept B

- FIXED: the 4 m cantilever. The upper grid now runs to +/-44 x +/-28 against a
  plate at +/-46 x +/-30, an ordinary 2 m slab overhang with visible structure
  under every plate.
- FIXED: the ground camera stood under the podium photographing an empty
  car-park underside. It now stands inside the hoarding among staged material.
- **Workers are box figures and are visibly crude at ground range.** Needs a
  properly licensed rigged human, per the directive.
- Facade panels read as pale cards, not glazing.
- Concrete still reads flat; procedural node texture may not be enough.
- No site clutter or people visible in the hero frame.

## Concept C — built, and it is the front-runner

The hero frame is the first image in this whole effort that reads as a real
construction site rather than a model of one. What did it:

- **Neighbours with real cut window reveals.** Boolean recesses on the party
  buildings mean the sun puts a shadow in every opening. This is doing more
  work than anything else in the frame.
- **Scaffold read THROUGH.** The street elevation is fully scaffolded, so the
  building is seen behind steelwork instead of presented in front of it.
- **The plot is a GAP IN A TERRACE.** Most of the frame is other people's
  buildings, which is what an infill site actually looks like.

## Open defects in Concept C

- **The ground frame fails.** At 24 mm pressed against the scaffold it becomes
  an abstract lattice: no person, no ground plane, no context. Dramatic and
  meaningless -- the same failure the production Login had at its tight
  station. Fix: back off to ~12 m on the opposite footpath at 35 mm, with a
  worker and the site gate in frame.
- Neighbour rear elevations facing the laneway are blank; the window reveals
  are only on the street side.
- Skip, cabin and stacks in the laneway are still boxes.

## THE CONCEPT GATE IS CLOSED. WINNER: CONCEPT C.

Scored from the nine EEVEE frames, not from code. 5 = best.

| | B | C | A2 |
|---|---|---|---|
| architectural realism | 4 | 5 | 4 |
| structural credibility | 4 | 4 | 5 |
| construction authenticity | 4 | 5 | 4 |
| human scale | 4 | 5 | 2 |
| site context | 3 | 5 | 3 |
| material realism | 3 | 3 | 3 |
| silhouette | 3 | 4 | 4 |
| foreground depth | 3 | 5 | 2 |
| midground depth | 4 | 5 | 3 |
| background depth | 3 | 5 | 4 |
| lighting | 3 | 4 | 3 |
| 360 viability | 4 | 4 | 4 |
| city integration | 2 | 5 | 3 |
| memorability | 3 | 5 | 3 |
| Login suitability | 3 | 5 | 3 |
| browser translatability | 4 | 4 | 3 |
| **total** | **54** | **73** | **53** |

**C wins on the three things that were always the problem**: foreground depth,
city integration and Login suitability. Its hero frame is the only one where
the project is seen THROUGH something, and the only one where most of the
frame is a real city rather than a hero object on a plane.

A2 is the better *building* -- the transfer level is the most legible piece of
structural engineering in the set -- but it is PRESENTED rather than inhabited,
and its ground frame has no human scale. B sits between them.

## Cycles diagnostic — the answer is BOTH, and geometry is still the larger half

`C-infill-day-hero-cycles.png` against `C-infill-day-hero.png`:

Cycles is clearly better -- softer shadow falloff, warmer bounce into the ply
boards, genuine shading inside the window reveals. But it is NOT a
transformation. The composition, the blank stucco flanks, the box mast-climber
car and the absence of clutter are identical, because those are not lighting
problems.

Conclusion: real-time lighting is a REAL part of the remaining gap and Three.js
will lose more of it again -- but the larger remaining half is still material
detail, prop quality and clutter. Do not expect a renderer change to fix it.

## M2 COMPLETE — commit d96b093

Concept C IS the production world. Four GLBs from the same scene that made the
winning renders.

| layer | tris | raw | meshopt |
|---|---|---|---|
| architecture | 17,500 | 700 KB | 266 KB |
| neighbours | 3,340 | 153 KB | 44 KB |
| scaffold | 3,936 | 210 KB | 83 KB |
| street | 264 | 23 KB | 14 KB |
| **total** | **25,040** | 1.39 MB | **405 KB** (65%) |

Runtime: `frontend/src/world/loginSite.js` holds the layer list, the four
camera stations converted from the concept's own cameras, and the scale check.
`authWorld.js` loads the layers progressively; the old procedural path is
behind `opts.procedural` for bisection only.

Verified: scale 22.0 x 31.1 x 34.2 m (authored 22 x 34). All nine camera
claims pass — 776 deg drag, eye moved 69 m X / 70 m Z, opposing sides, four
stations, 187 deg bearing change. Rear lane credible, no fake backside.
60.1-60.4 fps at 1440/390/320/reduced, p95 17.0-17.3 ms, zero overflow.
101 a11y + responsive passing.

### The finding that shapes M4

**glTF cannot export Blender node trees.** Every procedural material — formwork
lift lines, pour steps, run-off staining — exists only inside Blender. The
format carries base colour, roughness and metallic as numbers or textures, and
a node chain driving base colour exports as nothing: the first import rendered
the site near-white.

Production materials are baked to constants with names and slots preserved.
M4 must restore the detail as REAL TEXTURE MAPS (albedo/roughness/normal),
either baked from these node trees in Blender or sourced CC0. This is now the
single largest visual gap.

## M3 COMPLETE — commit 180507e

Terrain, rear elevations and world continuity.

- **Street corridor is one graded ribbon** from a real cross-section: crown,
  gutter each side, 140 mm kerb upstand, footpath falling back to the gutter.
  No seams between road/gutter/kerb/pavement.
- **Site pad sits proud of the footpath** with a graded ramp to the gate, so
  the road physically connects into the site and the site sits INTO the ground.
- **Rear/laneway neighbour elevations** now carry smaller irregular openings,
  a service door, an external fire stair with landings and handrails,
  condensers and a downpipe. Deliberately meaner than the street front.
- **Far tier: 34 blocks on a 190-430 m ring**, so no bearing of a 360 orbit
  finds the edge of the world.

| | M2 | M3 |
|---|---|---|
| site triangles | 25,040 | 29,168 |
| site payload (meshopt) | 405 KB | 465 KB |
| scene draw calls | 50 | 55 |
| scene triangles | 50,092 | 58,336 |
| fps 1440 / 390 / 320 / reduced | 60.2 | 60.0-60.2 |
| p95 | 17.3 ms | 17.2-17.4 ms |

All nine camera claims still pass; opening eye lands exactly on the concept
station at (-19.00, 1.64, 37.03). 101 a11y + responsive passing.

## M4 COMPLETE — commit e7d1e1c

Baked PBR surfaces from Blender, projected triplanar. See
`docs/world-material-plan.md` for the full map inventory and the KTX2 decision.

- 7 material families baked to albedo/roughness/normal at a 4 m world tile.
- Triplanar at runtime, so no UVs, no seams, no stretching.
- **No external assets downloaded** — everything baked from the concept's own
  procedural materials, so no third-party licence to track.
- **No maps for metal or glass**: they read from the PMREM environment, and an
  albedo texture would flatten the reflection that makes them metallic.
- **KTX2 rejected this milestone**: toktx/basisu/ktx/gltfpack all verified
  ABSENT; 2.5 MB does not justify installing system software.

| | M3 | M4 |
|---|---|---|
| texture payload | 0 | 2.5 MB |
| site GLB | 465 KB | 454 KB |
| fps 1440/390/320/reduced | 60.0-60.2 | 60.2-60.3 |
| p95 | 17.2-17.4 ms | 16.8-17.7 ms |

Two defects the renders caught: the masonry field/joint were inverted, baking a
whole neighbour near-black; and `painted()`/`city_facade()` had no bump, which
showed up as 4 KB blank normal maps.

## R1D PARTIAL — commit d6ea684. LIGHTING ROOT CAUSE FIXED.

**The flatness was a DOUBLE SUN, not the sun's elevation.**

Nishita's `sun_disc` defaults to True, so the sky carried a sun *and* a
separate sun lamp was added on top. The sky's disc is sampled as part of the
world hemisphere, so it arrived as broad soft fill rather than a hard key —
shadows filled in, every surface collapsed into one value band. Equally flat at
any elevation.

Fix: `sun_disc = False`, `sun_intensity = 0` (sky = atmosphere + ambient only);
lamp supplies the key at the sun's real 0.545° angular diameter; sun:sky
rebalanced 3.2:0.32 → 5.0:0.16. Exposure −1.05 → −0.35.

**Midday now reads at 46°** — the fix did NOT require golden hour.

Second defect it exposed: azimuth 196 put the sun *behind* the building, so the
street elevation was entirely in shade — the fake sky disc had been hiding it.
Azimuth now 18. Sun is overridable: `--sun <elev> --az <azimuth>`.

Result: sunlit brick with legible mortar, a real cast shadow in every window
reveal (they were flat dark squares because nothing directional was catching a
jamb), scaffold separating from the facade, dark interior.

### STILL TO DO IN R1D

1. **Ground is still one uniform value** — masks for haul line, damp/dry,
   staging spill, gate transition. Untouched this session.
2. **Deepen rear reveals** (street reveals now work; rear not re-checked).
3. **Four-view Cycles gate** at the new lighting — only `hero` re-rendered.
4. **Daylight robustness**: render one camera at `--sun 20`, `--sun 46`,
   `--sun 68` and confirm all three hold. The whole point of the ratio fix is
   that it should.

### NEXT EXACT ACTION

```bash
BL=/Applications/Blender.app/Contents/MacOS/Blender
$BL -b -P tools/blender/concept_c.py -- --frames hero --ref --sun 20
$BL -b -P tools/blender/concept_c.py -- --frames hero --ref --sun 68
```
Then ground masks, then the four-view gate.

## SUPERSEDED — R1C verdict

All four gate views rendered (`.screenshots/concepts/C-infill-day-*-cycles.png`:
hero / entrance / rear / ground).

**Solved this unit:**
- Grey artefact = the ladder, modelled as one flat box. Rebuilt with stiles
  and rungs.
- Atmosphere = **bounded volume box** (1400x1400x320 m, density 2.2e-5,
  shadow visibility off). The infinite world volume is unusable here; a finite
  box the camera sits inside works. Verified low-sample first.
- Orange cube = replaced by a rack-and-pinion mast climbing platform: rack,
  drive housing, guide rollers, ties to slab, floor with kick rail and guard
  rails at 500/1100, mesh, gate.

### THE HONEST VERDICT

Shown only a render, an uninformed viewer could **still** plausibly say "3D
visualisation" rather than "photograph". So R1 fails. What now separates it is
no longer geometry, assets or content — it is **LIGHT**.

### TOP 3 REMAINING FAILURES, ranked by how fast they say "CG"

1. **LIGHTING IS FLAT AND OVER-BRIGHT.** Midday sun at 46 deg with a low-
   contrast sky gives almost no shadow drama, and every surface sits in the
   same narrow value band. Real construction photography has deep shadow under
   slabs and hot sun on the facade. **Try a low sun (15-25 deg) and let the
   scene go contrasty.** This is the single highest-value remaining change.
2. **THE GROUND IS ONE UNIFORM VALUE.** The pad reads as a flat grey field in
   every view. It needs damp/dry patches, a darker compacted haul line, and
   spill around the material staging — as MASKS, like the wall splashback.
3. **REAR OPENINGS READ AS FLAT DARK SQUARES.** The cut reveals are too
   shallow to catch a shadow; deepen them and add a sill.

### NEXT EXACT ACTION — R1D

1. Drop the sun to ~18 deg and re-render the four views. Judge contrast.
2. Ground masks (damp/dry, haul line, spill).
3. Deepen rear reveals.
4. Re-run the four-view gate and re-decide.

## SUPERSEDED — R1B notes

**People are real.** `tools/blender/human.py` lofts anatomy from cross-sections
(tapering silhouette, canonical proportions, PPE, hard hat with peak). Four
workers, each with a reason to stand where it does. Box figures are gone.

**Verified, not assumed:** no free rigged human is reachable here — BlenderKit
is not bundled with Blender 4.5, Poly Haven has 521 models and none are people,
Mixamo needs an Adobe login, Sketchfab an API token.

**The hoarding had no gate.** It ran across the vehicle ramp, so the ramp led to
a solid fence. Cut an opening, hung two leaves open.

### Atmosphere: attempted, reverted, RECORDED

A world `Volume Scatter` rendered the entire frame **black** at density 3e-5,
where optical depth over 300 m is under 0.01. Bisected by removal — frame
returned immediately, so it is the world-volume path, not the density.
**Next thing to try: a bounded volume BOX around the scene, not an infinite
world medium.**

## R1 REMAINING — in order

1. **ATMOSPHERE** (cause 5, still unsolved). Bounded volume box, or Cycles mist
   via the compositor. Far city must lose contrast against foreground scaffold.
2. **MAST-CLIMBER CUBE** — still a plain orange box; a hard-fail item for the
   gate. Needs mast, cage, guard rails, drive housing, ties to the structure.
3. **Grey cylinder artefact** near the material staging in the entrance frame —
   identify (likely the cable reel core at wrong scale) and fix.
4. **FOUR-VIEW CYCLES GATE**: street / entrance / side / 180°, against
   `.screenshots/REJECTED-gamelike-baseline-1440.png`.

## SUPERSEDED — R1A notes

Content, wear and tolerance done. See `tools/blender/site_dressing.py`.

- **Content by work zone**: delivery / facade / waste / services / deck. Real
  forms — plank stacks of actual boards, banded rebar, curve-bevel hoses.
- **Wear as a height-driven mask**: splashback strongest at ground, gone by
  620 mm. On concrete and brick, not the road.
- **Tolerance**: yaw and offset on every hand-placed item; structure untouched.

**What the render showed:** the street camera looks UP from 1.65 m and never
sees the ground, so none of the content appears in the hero frame. The new
site-entrance camera (gate view B) does show it — rebar, hose and compacted
ground read in the foreground.

**Known defect, recorded not patched:** the entrance camera sits UNDER the slab
behind a column. It needs to stand at the gate line looking in, not inside the
ground floor.

## R1 REMAINING, in order

1. **Fix the entrance camera** — stand at the gate (about y = −21, z = 1.68)
   looking in and slightly up, so the frame reads as stepping onto the site
   rather than standing under it.
2. **ATMOSPHERE** (cause 5, still untouched). Blender mist/volumetric so the
   far city loses contrast and the foreground scaffold does not share a black
   level with buildings 300 m away.
3. **PEOPLE**. Verify licence FIRST — evaluate BlenderKit free assets and
   Mixamo terms. No box figures. Three or four, with PPE.
4. **MACHINERY**. The mast-climber car is still a plain orange cube in every
   frame; it is the most prominent placeholder left.
5. **FOUR-VIEW CYCLES GATE**: street / entrance / side / 180°. Compare against
   `.screenshots/REJECTED-gamelike-baseline-1440.png`. Only then export.

## SUPERSEDED — earlier R1 material notes

Real CC0 photographic PBR wired into the Blender scene (ambientCG, CC0 1.0
verified from their licence page). The 3 m brick failure is fixed — measured
from the image at ~12 courses over 512 px, 86 mm a course, giving a 2.06 x
1.03 m tile. Box projection, so no UVs and no stretching. Exposure retuned for
photographic albedos (the first CC0 render clipped every highlight).

**Judged against `.screenshots/REJECTED-gamelike-baseline-1440.png`: better on
materials, NOT yet passing.** The frame still reads brighter and cleaner than a
photograph, and causes 1, 2, 4 and 5 from the diagnosis below are untouched.

### R1 remaining, in order

1. **CONTENT** (cause 1, the largest). Hoses, leads, offcuts, bins, tool
   stacks, barriers, pallets — placed by logistics, near the work that uses
   them, not scattered.
2. **WEAR** (cause 2). Splashback at wall bases, dirt runs under openings,
   tyre tracks on the pad, chipped arrises. Material MASKS, not geometry.
3. **TOLERANCE** (cause 4). Nothing is out of true. Millimetres of error on
   scaffold members, props and stacks.
4. **ATMOSPHERE** (cause 5). No haze between camera and subject; everything
   equally sharp at 40 m.
5. Then people, then machinery.
6. Re-render Cycles at all four gate views (street / entrance / side / 180).
   Only export when it clearly beats the baseline.

### Still true from the reset diagnosis

## SUPERSEDED — the reset diagnosis (kept: causes 1-5 still drive R1)

`.screenshots/REJECTED-gamelike-baseline-1440.png` is the rejected browser
baseline. `.screenshots/concepts/C-infill-day-hero-cycles.png` is Cycles at the
IDENTICAL camera station.

**Cycles also looks game-like.** Cleaner and better lit, but still flat cream
walls, perfectly clean surfaces, uniform scaffold, an orange cube, no clutter,
no people, and every line perfectly straight.

By the rule set at the concept gate — if Cycles also looks fake, the problem is
geometry/assets/materials/composition, not the renderer — this is conclusive:

**The browser was never the ceiling. The runtime triplanar bake is not the
problem. The world itself has no content and no material identity.**

Four milestones of material and terrain work did not move this, because they
were all improving the wrong layer.

### The five causes of the game-like look, ranked

1. **NO CONTENT.** The site is empty. No people, no machinery, no vehicles, no
   clutter, no tools, no hoses, no offcuts, no bins. Real sites are dense with
   evidence of work. This is the single largest cause and no material fixes it.
2. **NO WEAR OR HISTORY.** Every surface is factory-new. No dirt runs, no
   splashback at the base of walls, no tyre marks, no chipped arrises, no
   staining under openings. Clean geometry reads as CAD regardless of texture.
3. **MATERIALS HAVE NO IDENTITY.** Procedural noise is not a material.
   `city_facade`'s "brick rhythm" is at ~3 m per course — invisible as brick,
   reads as flat cream. Noise varies a colour; it does not make a surface
   *be* something.
4. **EVERYTHING IS PERFECTLY STRAIGHT AND ALIGNED.** No settlement, no
   tolerance, no member out of true, no sag. Real construction has millimetres
   of error everywhere and the eye reads its absence.
5. **NO ATMOSPHERE BETWEEN CAMERA AND SUBJECT.** No haze, no dust in the air,
   no depth falloff at 40 m. Everything is equally sharp, which never happens.

### DELETE, do not improve

- The `city_facade` brick shader — wrong scale, no identity. Replace with
  real CC0 masonry PBR.
- The procedural `earth`, `spandrel` (asphalt) and `painted` swatches —
  noise-based, no material identity. Replace with CC0 sets.
- The placeholder props: mast-climber cube, skip, stacks, cabin boxes.
- The box workers.

### KEEP

Concrete's baked formwork/pour/staining maps are the one genuinely authored
surface and are worth keeping. Triplanar projection is worth keeping — it
solved UV stretching and seams and is not the cause of anything above.
Everything in the engineering column: camera, GLB pipeline, meshopt, clock,
sun/moon, fallbacks, accessibility.

## Open defects after M4

**Ranked by how strongly each still says "computer-generated":**

1. **Site content is placeholder boxes.** The mast-climber car is a flat orange
   cube, the skip and stacks are boxes, workers are box figures, and there is
   no crane or hoist at all. This is now the single loudest tell. (M5)
2. **Nothing moves.** The site is completely static — no machinery cycle, no
   people, no dust. A still frame hides this; interaction does not. (M6)
3. Concrete variation is honest but subtle; it may want stronger meso-scale
   pour-to-pour tonal steps to read at distance.
4. Rear window openings are cut but read shallow.
5. Contact shadows are soft; objects could sit into the ground more firmly.
   (M9 evaluates AO/GTAO — do NOT pre-empt it.)

## Next exact actions — RESET R1: CONTENT AND WEAR, IN BLENDER

Do NOT return to production until the BLENDER frame looks substantially more
real. Judge in Cycles, at the street station, against the baseline above.

1. **CC0 materials first.** Verify licence and availability at the time, then
   source from Poly Haven / ambientCG: masonry, asphalt, compacted earth,
   plywood. Wire them into `concept_lib` replacing the procedural swatches.
   Keep the authored concrete.
2. **Wear pass.** Splashback at wall bases, dirt runs under openings, tyre
   tracks on the pad, chipped arrises. This is a MATERIAL-MASK problem, not a
   geometry one.
3. **Content pass.** Clutter is the largest single cause: hoses, offcuts,
   bins, tool stacks, barriers, pallets scattered as a working site is, not as
   a tidy diagram.
4. **Then** people and machinery.
5. Re-render Cycles. Compare against
   `.screenshots/REJECTED-gamelike-baseline-1440.png`. Only export when the
   Blender frame is clearly better.

## SUPERSEDED — the old M5 plan

The world now has real architecture, real ground and real surfaces, and
nothing living in it. Site content is the loudest remaining tell.

1. **Mast-climber car** — authored GLB replacing the orange cube. It is the
   most prominent placeholder in the hero frame.
2. **Workers** — properly licensed rigged humans, NOT box figures. Verify
   licence at the time (Mixamo terms, or a CC0 source). Three convincing
   figures beat twenty.
3. **Skip, stacks, cabin** — authored props, placed against the M3 terrain.
4. **Hoist/crane** — this plot is too tight for a tower crane, which is why it
   has the mast climber. Do NOT reintroduce a tower crane; upgrade the climber
   and its mast instead.
5. Re-export via `build_assets.sh`, capture, compare against M4 frames.

Then M6 animation/activity, M7 environment, M8 physics, M9 post, M10 handover.

## Commands

```bash
BL=/Applications/Blender.app/Contents/MacOS/Blender
$BL -b -P tools/blender/concept_b.py -- --frames hero,ground,rear
$BL -b -P tools/blender/concept_b.py -- --frames hero --cycles
$BL -b -P tools/blender/concept_c.py -- --frames hero,ground,rear
```

## Locked

Production Three.js migration, Rapier, post-processing, Login → Dashboard.
