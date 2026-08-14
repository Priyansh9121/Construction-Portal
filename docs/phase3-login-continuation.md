# Phase 3+ Login world — continuation state

**Status: CHECKPOINT. The concept phase is NOT complete.**

---

## CHECKPOINT — HERO STAGING IMPLEMENTED; STILL NOT SUFFICIENT AT 70 m

**CURRENT COMMIT** `67f07a4` · gate still **FAIL** · nothing exported ·
runtime untouched since `ab3e471`.

**IMPLEMENTED** The stage map is now code, not a plan: `STAGE_OF` names each
level's state and `build_infill` / `build_backprops` / `build_staging` realise
it. Prop spacing widens 1.8 → 2.6 → 4.2 m downward and then stops — the
spacing *is* the age gradient. Infill runs 66% / 33% / none upward. Material
lands only where its work is. Edge protection comes down once blockwork is up,
so enclosed floors carry no guard rail.

**VERIFIED** `hero-stack-staged.png` (65 mm) — infill panels, piers and
differentiated edge protection all read at close range.

**THE PROBLEM, HONESTLY** `establishing-staged.png` (70 m) — the staging does
**not** carry the production frame. The hero still reads as a dark scaffolded
lattice. Two causes, and neither is "more detail":

1. **The scaffold occludes the storey it is meant to reveal.** Full-height
   scaffold with debris mesh across the whole street elevation hides exactly
   the floors the staging differentiates. A real site at this stage would have
   the scaffold *struck back* below the working lifts, or the mesh only where
   work is live.
2. **The interiors are unlit voids at this distance.** Close up the columns
   and props read; at 70 m they collapse to black. The fix is not interior
   lights (forbidden, and fake) — it is that the *silhouette* must carry the
   story: falsework and formwork projecting at the top, a visibly open pour
   edge, material stacks breaking the slab lines.

**NEXT EXACT ACTION**
1. Strike the debris mesh / scaffold boarding back to the top three lifts so
   the differentiated floors are actually visible from the street. This is
   both correct construction practice and the thing blocking the read.
2. Push the top two levels' temporary works ABOVE the slab line so the
   silhouette shows falsework and a pour edge against the sky.
3. Re-render `stack` + `establishing`, then the luffing-jib validation
   (measure the generated world first — scaffold envelope, hoist position,
   footprint, road edge — before any crane geometry exists).
4. Then far-left context, sky, road material, multi-angle gate at
   morning/midday/afternoon.

---

## HERO STAGE MAP — authored next, implementation ready

**CURRENT COMMIT** `2ec81a7` (source) · gate still FAIL · nothing exported.

**EVIDENCE** `.screenshots/concepts/hero-stack-before.png` — a 65 mm frame
through the scaffold showing several floors at once. The 70 m establishing
camera is too far away to show this fault.

**WHAT THE CLOSE FRAME PROVES**

Every level is the same three things: a slab edge, a black void, a boarded
scaffold lift. And the void is the key finding — **it is empty**. No columns,
no soffit, no props, no formwork, no staged material. It is the neighbour
window failure again one scale up: a dark hole with nothing in it reads as a
hole in a slab, not as a floor of a building. The only differentiation in the
whole stack is one patch of blockwork at the lower left.

So the fix is two things, not one: **give the floors different states**, and
**put something inside them**.

### Per-level stage map (LEVELS = 7, GROUND_H 4.6, STOREY_H 3.3)

| Level | Current | Target state | Visible change | Construction reason |
|---|---|---|---|---|
| G | empty void | logistics + hoist base | gate opening, temp fence, loading interface, service risers | ground is the delivery and access floor |
| 1 | empty void | fully struck, infill underway | blockwork to ~60% of bays, defined openings, no props | oldest concrete; props long removed |
| 2 | empty void | struck, infill starting | blockwork ~25%, columns visible, some staged pallets | envelope follows the frame upward |
| 3 | empty void | frame complete, selective back-props | a partial row of back-props at slab centre, bare columns | back-propping stays several floors below the pour |
| 4 | empty void | recently struck | denser back-props, temporary edge protection, no infill | concrete young; props not yet released |
| 5 | empty void | falsework standing | full prop grid, soffit formwork panels still up | slab struck within days, not yet stripped |
| 6 | empty void | formwork deck | ply soffit, edge forms, column starter cages, rebar bundles | next pour being prepared |
| 7 / top | empty void | ACTIVE DECK | partial slab, rebar mats, pour edge, edge protection, staged ply, workers, crane landing zone | the pour actually happening today |

**Rules for implementation** — every difference answers "why is this floor
different?". No random variation. Props thin out downward because concrete
ages downward; infill climbs upward because the envelope follows the frame;
the hoist landing repeats at every level because it must. A floor that differs
for no reason is still procedural CG.

**NEXT EXACT ACTION** Implement the table above in `concept_c.py` as a
per-level state function (not a repeated `plate()`), then re-render `stack`
and `establishing`, then the luffing-jib validation (measure before modelling:
plot 22 × 34 m, scaffold envelope, hoist position, neighbour walls at x = ±11,
road edge at y = −25.4), then far-left context block, sky, road material, and
finally the multi-angle gate at morning/midday/afternoon.

**LIFTING DECISION RECEIVED** Luffing-jib tower crane, *only if the geometry
proves it fits*. Mast climber/hoist retained — crane lifts structure and
material, hoist carries personnel and selected material. No hammerhead.

---

## CHECKPOINT — NEIGHBOUR FACADES PASS; HERO STAGING IS NEXT

**CURRENT COMMIT** `2ec81a7`

**THE FINDING** The neighbour openings were a 250 mm boolean cut and nothing
else — no glass, no frame, no interior. The back face of the cut was the
**same wall material lit by the same sun**, which is exactly why every opening
read as a rectangle pressed into a slab. No material or lighting change could
have fixed that; it was geometry.

**COMPLETED** Each opening is now built the way one is built:
opening → 420 mm reveal → frame (head, jambs, sill) → glazing set 300 mm
behind the face → **unlit interior volume**. The interior does the work: a
room is darker than any sunlit facade, so the dark box behind the glass is
what tells the eye there is a building in there. Without it you see masonry
through the window. The projecting sill throws a shadow line under every
opening — the detail that reads as BUILT rather than CUT.

Verified at both distances before propagating: a 50 mm lens on one bay
(`bay-after.png`) proves the assembly, and the production establishing camera
(`establishing-facades.png`) proves it survives 70 m. Both neighbours now read
as architecture.

**ANTI-GTA GATE — STILL FAILS. NOT EXPORTED.** Ranked, from the new render:

1. **Hero floors are still identical** — now the dominant CG cue by a clear
   margin. A stack of matching slabs behind scaffold. Needs the vertical
   construction-stage gradient: struck → back-propped → formwork → active
   deck with rebar and a pour edge.
2. **Sky is still a flat gradient**, cloudless.
3. Far-left context block is still blank massing (mid-tier, cheap to fix by
   giving it the same opening system at lower density).
4. Road still needs the material/contact pass — kerb tonal separation, gutter
   grime, tracked dirt at the gate. **Geometry is done; do not add more.**

**NOT REGRESSED** Runtime untouched since `ab3e471`. Station contract 8/8,
world runtime 6/6, a11y 44/44, responsive 314/314, 60 fps / p95 17.4 ms at
DPR 2 all stand. Production still ships the pre-street GLBs deliberately.

**NEXT EXACT ACTION** Hero construction staging in `concept_c.py` — per-level
state rather than a repeated plate, every difference with a construction
reason. Then sky. Then the road material pass. Then the multi-angle Cycles
gate at morning/midday/afternoon, and export only on a YES.

**STILL OPEN — needs your decision** Lifting strategy: luffing-jib tower crane
(the only plausible tower option on a plot this tight) versus periodic
mobile-crane operations with the mast climber retained. I will not add a
hammerhead for spectacle.

---

## CHECKPOINT — STREET CORRIDOR AUTHORED, NOT PROMOTED

**CURRENT COMMIT** `35d3242`

**THE FINDING** The flat foreground was never a material or shader problem.
`surface_probe.mjs` raycast the frame and returned **`earth`, not
`spandrel`** — the camera stands at Blender y ≈ −70 and the authored street
corridor ended at y = −46. It has been standing **24 m beyond the end of the
world**, on the bare 900 m earth box. The street already had a kerb, gutter,
crossfall and drainage logic. It was missing its *extent*.

**COMPLETED**

- Street rebuilt as a **divided arterial** — two carriageways, planted median,
  footpath both sides, reaching y = −84. A 70 m sightline to a 22 m frontage
  does not happen across a side street; it happens across a main road. The
  camera distance is now explained by the world rather than imposed on it.
- **Corrected my own first pass.** It was correct engineering the frame could
  not see: at 70 m with a 1.7 m eye the road is ~2° off grazing, where a
  150 mm kerb is ≈3 px. Added what reads at that angle — median planting,
  street lighting at real pole spacing, lane markings carrying perspective to
  the vanishing point, gullies at the gutter low points, bollards on the site
  footpath. Level changes stay because they are right, not because they carry
  the image.
- **The Cycles gate now includes the production establishing camera**,
  converted straight through the exporter mapping. Until now the gate had
  never judged the frame the Login actually opens on.
- City terrace added across the road — the one bearing with no city in it was
  the one this camera looks along.

**VISUAL EVIDENCE** `.screenshots/concepts/street-after.png` (Cycles, 720×450,
establishing camera, sun 46°/az 18°).

**ANTI-GTA GATE — FAILED. NOT PROMOTED.**
Form removed, this still reads as a massing model, so per the rule it is not
exported. **The blocker has moved: the ground is no longer the top failure.**

1. **Neighbour facades are flat slabs with recessed rectangles.** No jamb, no
   head, no sill, no glass plane behind the wall, no interior depth. Both
   flanks. This is now the single strongest fake cue in the frame.
2. **Every hero floor is identical** — no struck/formed distinction, no
   back-propping, no active pour deck.
3. **Sky is a flat gradient**, cloudless.
4. Foreground road still a plain band in the bottom ~15%; needs kerb-line
   tonal separation and gutter grime, not more geometry.

**NOT REGRESSED** Runtime untouched this round (`git diff HEAD -- frontend/`
empty), so station contract 8/8, world runtime 6/6, a11y 44/44, responsive
314/314 and the 60 fps / p95 17.4 ms DPR-2 gate all stand.

**KNOWN CONSEQUENCE** Production still ships the *old* street, so the live
camera stands on bare earth. That defect is authored-and-fixed but deliberately
unexported until the world passes.

**NEXT EXACT ACTION** Task 4 then Task 2, in that order — the render says
facades outrank floors:
1. Give neighbour openings real depth in `city_facade()` / the neighbour
   builder: reveal, jamb, head, sill, glass recessed ~200 mm behind the wall
   face. A window must read as HOLE + FRAME + GLASS + DEPTH.
2. Per-floor construction state on the hero (struck → back-propped → formwork
   → active deck).
3. Re-render the establishing + gate/side/rear cameras, re-judge, and only
   then export through the proven pipeline.

**STILL OPEN — needs your decision** The lifting strategy. Concept C was chosen
*because* the plot is too tight for a tower crane. Real options: a luffing-jib
crane (designed for constrained urban airspace, and the only plausible tower
option here), or periodic mobile-crane operations with the mast climber
retained for personnel and material. I will not add a hammerhead for spectacle.

---

## CHECKPOINT — RUNTIME STABILITY + ESTABLISHING CAMERA

**CURRENT COMMIT** `9174d88`

**COMPLETED**

1. **Readiness contract.** The world publishes `INITIALISING / LOADING / READY
   / DEGRADED / FAILED` on `canvas.dataset.worldState`, and **only `READY` may
   hide the fallback**. `READY` requires the essential layers *and* a completed
   authored frame. Previously `live` was set the moment `createAuthWorld`
   resolved — whose only await is the three.js import — so a failed world
   showed an empty sky with the fallback already faded out. That is precisely
   what production displayed during the CSP incident.
2. **Reduced motion.** Both redraw sites now go through `renderStill()`, which
   settles the rig *before* drawing. Rendering while the rig sits at its
   default pose frustum-culls the whole site: **12 triangles against the
   101,068** a composed frame draws. The still previously rendered before the
   GLBs arrived and never redrew.
3. **Camera station contract.** `SITE_INTENTS` in `loginSite.js` is the single
   mapping from intent to station; no station literal survives outside that
   file. `goTo()` now returns a boolean and warns loudly on a miss. Every
   focus/pending/failure response had been a silent no-op since M2 because the
   form named stations from the deleted procedural journey.
4. **Establishing camera** moved from 62 m to **70 m at 35 mm**, eye 1.7 m,
   target lifted to 13 m. Full frontage, both neighbours, hoarding, worker and
   sky above the parapet in one frame.

**FILES** `frontend/src/world/{loginSite,authWorld,camera}.js`,
`frontend/src/components/auth/AuthWorld.jsx`,
`frontend/src/world/stationContract.test.mjs`,
`frontend/tests/world-runtime.spec.js`, `tools/fresh_ui/compose_check.mjs`

**TESTS** station contract **8/8** (falsified: pointing `passwordFocus` back at
`"scaffold"` fails it), world runtime **6/6**, a11y **44/44**, responsive
**314/314**, build + eslint clean.

**PERFORMANCE** 1440 DPR 2 — 60.2 fps, p50 16.7 ms, p95 17.4 ms, p99 17.6 ms,
0 px overflow. P0 architecture untouched.

**VISUAL EVIDENCE** `.screenshots/camera/daylight.png`, captured through
`tools/fresh_ui/compose_check.mjs`, which pins the clock. **This matters:** the
world runs real Asia/Kolkata time, so an unpinned capture is a night frame
roughly half the time and no composition judgement is possible against it.
`world_capture.mjs` documents that it pins time-of-day and **does not** — a
tooling defect worth fixing.

**KNOWN FAILURE — ranked by how fast each says "not a photograph"**

1. **The ground is a flat featureless sheet.** The bottom third of the frame is
   a bare gradient: no kerb, gutter, gully, footpath edge, camber, markings or
   wear. The strongest fake cue in the frame by a wide margin — it reads as a
   model resting on paper.
2. **Every floor of the hero building is identical.** No struck-versus-formed
   distinction, no back-propping, no active pour deck, no varying envelope.
   The construction sequence is not communicated at all, so it reads as an
   extrusion.
3. **The right neighbour is a flat pale slab** — faint recessed rectangles read
   as embossed panels, not glazing. No reveals, no depth, no roof plant.
4. **No city beyond.** Behind the neighbours the world simply stops into sky.
5. **Cloudless gradient sky.**
6. **No crane.** Concept C is a tight infill plot deliberately chosen as *too
   tight for a tower crane* (hence the mast climber). The brief asks for a
   crane above the hero. **These conflict — a decision is needed**, either a
   plot revision or accepting the mast climber as the lifting story.

**NEXT EXACT ACTION** Author the street in `concept_c.py`: kerb upstand,
camber, gutter, gully, footpath, gate threshold — then wear via
CAUSE → MASK → MATERIAL RESPONSE, as already proven in `site_ground()`. Then
per-floor construction state on the hero. Both re-export through the proven
pipeline and are judged in Cycles before promotion.

---

## CHECKPOINT — PIPELINE RESET, vertical slice PASSED

**CURRENT COMMIT** `0f79fab`

**PIPELINE STAGE** Blender → Cycles → cube-projected UVs → Meshopt GLB →
CC0 maps shipped once → Three.js glTF PBR → Login. End to end, in production.

**COMPLETED**

- The real gap was found and it was not the one assumed. Production never built
  the hero world from Three.js boxes — `useProcedural` has defaulted to `false`
  since M2. The defect was that the production GLBs were six R1 milestones
  behind the Blender source, and that **no CC0 texture had ever crossed the
  Blender boundary**.
- Cause: the CC0 materials use `tex.projection = "BOX"` on world Position.
  glTF carries a texture and a UV set — it cannot carry a projection mode. So
  the exporter flattened every material to a constant and the runtime
  substituted baked swatches through a triplanar shader patch.
- Fix: `uv_project_for_export()` cube-projects each mesh at its material's real
  world tile (`EXPORT_UV_TILE`), so the GLB carries UVs whose scale IS the
  authored metre scale. Cube projection, not Smart UV Project: smart unwrap
  optimises for packing, which gives every face a different texel density.
- The maps ship once at 512 px (1169 KB total) rather than embedded. The first
  export embedded them and the set went from 0.5 MB to ~30 MB — the street
  layer alone was 14.9 MB, carrying its own copy of the same concrete image
  four times.
- `dressSurface()` no longer patches a triplanar shader. It is ordinary glTF
  PBR now.
- Opening camera moved from 40 m / 28 mm to 62 m / 35 mm. The camera moved; the
  lens did not widen.
- Anisotropy follows the hardware maximum, not 4.

**FILES** `tools/blender/concept_lib.py`, `tools/blender/concept_c.py`,
`tools/blender/prep_web_textures.py`, `frontend/src/world/loginSite.js`,
`frontend/src/world/authWorld.js`, `tools/fresh_ui/surface_probe.mjs`

**VISUAL EVIDENCE** `.screenshots/pipeline/1440.png`. Brick reads as brick,
plywood boards carry grain, concrete carries aggregate, the worker and the
hoarding line sit at the gate, and the full frontage reads against sky. This is
a category change from the previous production frame, and it is the acceptance
test the pipeline reset asked for.

**PERFORMANCE** Real DPR 2, 1440: 60.3 fps, p50 16.7 ms, p95 17.0 ms,
p99 17.6 ms, heap 38 MB, 0 px overflow. Geometry 970 KB / 50,528 tris over five
layers. The P0 gate holds.

**KNOWN FAILURE** The remaining defects are now **source-asset failures in
Blender, not pipeline failures** — which is the distinction the reset existed
to establish. Ranked:

1. **The carriageway has no features.** `spandrel` is a featureless CC0 tarmac
   field on a flat plane: no kerb, no camber, no gully, no patching, no tyre
   polish. Proven with `surface_probe.mjs` — the maps are bound at the correct
   2 m tile, so this is missing geometry and missing macro variation, not a
   missing texture.
2. **The right neighbour (`city_cool`) is a pale flat slab.** Samples
   182,187,195 across its whole face. No openings, no staining, no relief.
3. **The hoarding panels are flat saturated teal.** `screen` at `#2f6f8c` has
   no map at all and is not in `SITE_SURFACES`.
4. **The sky is a cloudless gradient.**

**NEXT EXACT ACTION** Author the street in Blender as a street: kerb upstand,
camber, gully, and a wear mask that follows the CAUSE → MASK → MATERIAL
RESPONSE rule already used for `site_ground()`. Then the right neighbour's
elevation. Both are `concept_c.py` work, re-exported through the now-proven
pipeline.

---

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

## P0 PERFORMANCE — **FIXED**, commit 4d0ed0d

### Root cause: a style write/read thrash, from two mistakes together

`publishLight()` wrote six `--auth-world-*` properties to **documentElement**,
while every consumer lives inside `.auth-scene` — so each publish invalidated
inherited custom properties for the whole document. `onPointer()` then ran
`e.target.closest(...)` on **every** pointermove against that freshly
invalidated tree.

Either alone was survivable; together they thrashed.

**Why drag was clean and hover was not:** during drag, `setPointerCapture`
retargets events to the scene root so `closest()` starts 1-2 hops from its
match. On hover, `e.target` is the deep node under the cursor -- and
`.auth-scene__content` is a **full-viewport layer**, so the selector matched
almost everywhere and always walked to the deepest match. That also meant
pointer authority was suppressed across the entire scene rather than only over
the controls -- a behavioural bug too, now fixed.

### Before -> after, real DPR 2, buffer 2880x1808

| scenario | p95 | p99 | max |
|---|---|---|---|
| idle | 17.4 -> 17.5 | 17.6 -> 17.7 | 17.6 -> 17.7 |
| **pointer** | **33.4 -> 17.3** | **183.3 -> 17.6** | **483.4 -> 49.9** |
| drag | 17.2 -> 18.1 | 17.7 -> 18.6 | 17.7 -> 18.6 |
| wheel | 17.1 -> 17.9 | 17.4 -> 18.5 | 17.5 -> 18.7 |

Zero frames over 50 ms in any scenario. Repeated sweeps: pass 1 max 49.9 ms,
passes 2-3 max 17.7 ms -- the residual is one-time first-interaction cost.

### The fix
- CSS vars scoped to `.auth-scene`; change-gated so unchanged values never
  re-invalidate style; reused `THREE.Color`.
- Region state from `pointerover`/`pointerout` on the card, read as a boolean.
- `compileAsync` + `initTexture` pre-warm after the site loads.

**DPR 2 kept. No shadows, materials, geometry or visual quality touched.**

### Harness correction that made this findable
`world_capture.mjs` still uses `deviceScaleFactor: 1` for *visual* captures,
which is fine. But **performance must be measured with
`tools/fresh_ui/perf_bisect.mjs`**, which runs at real DPR and reports frame
distribution per interaction. Averages hid this bug completely.

## FINAL LOGIN — CHECKPOINT

**CURRENT COMMIT:** 6e5b616

### COMPLETED this unit
Project concrete now reads as cast in lifts. `in_situ_concrete()` keys per-pour
tone, a ~130 mm construction joint (darker AND rougher) and splashback to the
real 3.3 m storey, with low-frequency variation so pours keep quiet areas.

**Tuned against the render, not the code:** the first pass used a 0.88-1.06
tone range and a 50 mm joint, both sub-pixel at the 40 m the gate cameras stand
at — the shader was right, the numbers were chosen for a viewing distance
nobody uses. Now 0.78-1.12 with a ~130 mm joint, tinted down from the pale
Concrete034 set to structural grey.

### VISUAL EVIDENCE
`.screenshots/concepts/C-infill-day-rear-s46a18-cycles.png` — party wall shows
storey-by-storey pour bands with joints. Concrete is now at least as convincing
as the neighbour brick, which was this item's acceptance test.

### PERFORMANCE
Untouched. P0 gate stands: pointer p95 ~17 ms, zero frames over 50 ms at real
DPR 2. No production Three.js change in this unit.

### NEXT EXACT ACTION — ranked from the current rear/hero renders

1. **Left neighbour (`city_cool`) is now the weakest surface** — a flat pale
   slab with shallow square windows, using a concrete texture where it should
   be render/painted masonry. Give it the same treatment the brick got, or a
   proper render material.
2. **Building interior is a black void** in the hero frame — you see through
   the scaffold into pure darkness. Real frames show floor plates receding with
   light falloff. Likely needs bounce/portal light or a lighter soffit.
3. **Laneway asphalt** — reads flat, but it is genuinely in shade at azimuth 18,
   so verify with a lit angle before changing the material.
4. **Sky is cloudless.**

Then: four-view Cycles gate + morning/midday/afternoon, and only then
production migration.

## SUPERSEDED — R1D resume notes (5ce6f30)

Visual work resumes at the ranked list below. Nothing in P0 touched Blender.

## SUPERSEDED — P0 investigation notes

`tools/fresh_ui/perf_bisect.mjs` measures the real page at REAL DPR, per
interaction, with full frame distribution.

### MY EARLIER NUMBERS WERE WRONG, AND HERE IS WHY

Every previous "60 fps" was measured with Playwright `deviceScaleFactor: 1`
while production caps the renderer at DPR 2. On Retina that is a QUARTER of the
real pixel load. The metric was fine; the resolution was not.

### MEASURED — real DPR 2, drawing buffer 2880x1808 = 5.21 Mpx

| scenario | fps | p95 | p99 | max | >20ms | >100ms |
|---|---|---|---|---|---|---|
| idle | 60.3 | 17.4 | 17.6 | 17.6 | 0 | 0 |
| **pointer** | **55.5** | 17.4 | **50** | **183.3** | 2 | **1** |
| drag | 60.1 | 17.2 | 17.7 | 17.7 | 0 | 0 |
| wheel | 60.2 | 17.1 | 17.4 | 17.5 | 0 | 0 |

### RULED OUT BY BISECTION — do not re-investigate

- **DPR is NOT the bottleneck.** DPR 2 / 1.5 / 1.25 / 1.0 are all identical.
- **Shadows are NOT the bottleneck.** Native DPR with shadows off: identical.
- **Raster/GPU is NOT the bottleneck.** 55 draw calls, 58k triangles.
- **NOT a periodic PMREM rebake.** 34 s of pure idle produced ZERO frames over
  30 ms. The 12 s bake is not stalling anything.

### THE ACTUAL DEFECT

A single ~183 ms MAIN-THREAD STALL that occurs only during `pointermove`.
Idle/drag/wheel are clean. That one freeze is the perceived lag.

### NEXT EXACT ACTION — prime suspects, in order

1. `onPointer` runs `e.target.closest(".auth-card, .auth-scene__content")` on
   EVERY pointermove — a DOM traversal at pointer frequency. Cache the hit test
   or gate it behind a coordinate check.
2. `publishLight()` writes ~6 CSS custom properties on `documentElement`; a
   style write at pointer frequency forces recalc across the whole page.
   Confirm its cadence and whether pointer activity triggers it.
3. Instrument with `performance.mark` inside the pointer path to attribute the
   183 ms directly rather than inferring it.

Do NOT start with DPR, shadows or materials — all three are measured and clear.

## R1D COMPLETE — commit f946b8c. GATE: **FAIL, narrowly.**

### Daylight robustness — PASSES
Hero camera at 20 / 46 / 68 degrees, no per-render exposure tuning, plus
adverse azimuth 200 (sun behind the street facade). All four hold. Sun
elevation and azimuth are now in the output filename.

### Ground — FIXED
`site_ground()` derives condition from activity: compacted haul route (darker,
smoother, reduced normal strength — traffic flattens relief too), gate apron,
quiet edges. Masks in METRES, blended with a 1.5 m noise so no boundary is a
clean line.

### Rear openings — resolved by the LIGHTING fix, not geometry
They now cast shadows at jamb and head. They were never too shallow; there was
no hard key to catch them. Deepening them would have fixed the wrong thing.

### THE HONEST VERDICT: still FAIL

Shown only a render, an uninformed viewer would now say "3D architectural
render" rather than "game" — the category HAS moved. But they would not say
"photograph". So the gate does not pass.

### TOP 3 REMAINING, ranked by how fast they say CG

1. **The project's own concrete is the weakest surface in frame.** Neighbour
   brick is photographic and convincing; the frame, slabs and party walls are
   noticeably flatter beside it. They use `Concrete034` at a 2.4 m tile with no
   pour-to-pour variation, no construction joints and no formwork tie marks —
   so a 34 m wall is one continuous surface. **Fix: per-pour tonal masks keyed
   to storey height, plus tie-hole/joint detail.**
2. **The laneway road reads as flat dark grey.** Asphalt is present but the
   lane may not be getting it, or it is unlit. Verify the material is applied
   and lit.
3. **Sky is a clean gradient with no cloud.** Nishita with no cloud layer gives
   a plausible but sterile sky; real skies have structure even when clear.

### NOT DONE
- The 8-bearing 360 EEVEE sweep (0/45/90/.../315) was not run.

### NEXT EXACT ACTION
1. Per-pour concrete variation on the project frame (failure #1).
2. Verify lane asphalt material and lighting.
3. Run the 8-bearing EEVEE sweep.
4. Re-render the four gate views and re-decide.

## SUPERSEDED — earlier R1D notes

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
