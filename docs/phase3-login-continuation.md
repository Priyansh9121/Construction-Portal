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
| `B-commercial-day-hero.png` | Much better. Real architecture, still tray-like |
| `B-commercial-day-ground.png` | Rendered, not yet reviewed |
| `B-commercial-day-rear.png` | PASS for 360 viability |

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

- **Plates cantilever ~4 m past the perimeter columns**, so the building reads
  as a stack of trays. This is the single biggest remaining tell. Fix: run the
  upper column grid out to the plate edge (`range(-42, 43, 8)` stops short of
  `X1 = 46`), or pull the plate in to the column line.
- Facade panels read as pale cards, not glazing.
- Concrete still reads flat; procedural node texture may not be enough.
- No site clutter or people visible in the hero frame.

## Next exact actions, in order

1. Fix the cantilever in `tools/blender/concept_b.py` (column grid vs `X0/X1`).
2. Review `B-commercial-day-ground.png`.
3. Build **Concept C** — tight inner-city infill — using `concept_mesh.py`.
   Must NOT reuse B's composition: narrow parcel, masonry party walls, street
   frontage, scaffold dominating one elevation, city filling more of the frame.
   Render `C-HERO`, `C-GROUND`, `C-REAR`.
4. Build **A2** replacing the failed Concept A, using `concept_mesh.py`:
   podium + tower, offset core, transfer level, setback, screens at the
   working levels.
5. Run ONE Cycles diagnostic on the strongest concept
   (`--cycles`, already wired in `concept_b.py`) to separate a modelling
   failure from a real-time-lighting failure.
6. Build the contact sheet, score all concepts, choose the winner.
7. Only then begin production migration.

## Commands

```bash
BL=/Applications/Blender.app/Contents/MacOS/Blender
$BL -b -P tools/blender/concept_b.py -- --frames hero,ground,rear
$BL -b -P tools/blender/concept_b.py -- --frames hero --cycles
$BL -b -P tools/blender/concept_c.py -- --frames hero,ground,rear
```

## Locked

Production Three.js migration, Rapier, post-processing, Login → Dashboard.
