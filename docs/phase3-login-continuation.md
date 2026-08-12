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
| `C-infill-day-ground.png` | FAIL — abstract scaffold wall, no human, no ground |
| `C-infill-day-rear.png` | PASS — plot reads as a gap in a terrace |

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

## Next exact actions, in order

1. Fix the C ground camera (above) and re-render.
2. Build **A2** replacing the failed Concept A, using `concept_mesh.py`:
   podium + tower, offset core, transfer level, setback, screens at the
   working levels.
3. Run ONE Cycles diagnostic on the strongest concept
   (`--cycles`, already wired in `concept_b.py`) to separate a modelling
   failure from a real-time-lighting failure.
4. Build the contact sheet, score all concepts, choose the winner.
5. Only then begin production migration.

## Commands

```bash
BL=/Applications/Blender.app/Contents/MacOS/Blender
$BL -b -P tools/blender/concept_b.py -- --frames hero,ground,rear
$BL -b -P tools/blender/concept_b.py -- --frames hero --cycles
$BL -b -P tools/blender/concept_c.py -- --frames hero,ground,rear
```

## Locked

Production Three.js migration, Rapier, post-processing, Login → Dashboard.
