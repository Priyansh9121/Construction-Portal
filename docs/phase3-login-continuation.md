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

## Next exact actions — M5: AUTHORED SITE CONTENT

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
