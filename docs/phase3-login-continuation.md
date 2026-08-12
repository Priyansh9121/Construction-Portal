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

## Next exact actions, in order — PRODUCTION MIGRATION MAY NOW BEGIN

M2 (next): export the Concept C architecture as production GLB.
   - `tools/blender/concept_c.py` gains an `--export` path writing
     `frontend/public/world/assets/` via the existing lib_build export.
   - Split by layer: hero frame, neighbours, scaffold, street.
   - Meshopt via the existing pipeline; PRESERVE the dequantisation fix.
   - Do NOT rebuild C from JavaScript boxes.

Then M3 city/terrain, M4 materials, M5 people/machinery.

## Commands

```bash
BL=/Applications/Blender.app/Contents/MacOS/Blender
$BL -b -P tools/blender/concept_b.py -- --frames hero,ground,rear
$BL -b -P tools/blender/concept_b.py -- --frames hero --cycles
$BL -b -P tools/blender/concept_c.py -- --frames hero,ground,rear
```

## Locked

Production Three.js migration, Rapier, post-processing, Login → Dashboard.
