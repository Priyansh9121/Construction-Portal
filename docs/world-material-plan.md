# World material plan — input to M4

Written during M3. Nothing here is downloaded yet, and no licence has been
verified yet: M4 must check availability and terms at the time it runs rather
than trusting this list.

## Why this document exists

glTF cannot carry Blender's procedural node trees. Every concept material —
formwork lift lines, pour-to-pour colour steps, run-off staining, worked
roughness — exists only inside Blender, and the production GLBs currently ship
flat constants in their place. Restoring that detail as real texture maps is
the single largest remaining visual gap.

Two routes, and the choice is per-surface:

- **BAKE** — render the existing Blender node tree to an image map. Keeps the
  authored look exactly, costs UV unwrapping and bake time, and produces maps
  nobody else has.
- **CC0** — a photographic PBR set. Higher fidelity for real-world surfaces
  where photography beats procedural, costs payload and provenance tracking.

## Surfaces, and the likely route for each

| Surface | Material slot | Maps needed | Likely route |
|---|---|---|---|
| Exposed RC frame | `conc` | albedo, rough, normal | **BAKE** — formwork lift lines are authored and specific |
| Fresh/wet pour | `wet` | albedo, rough | **BAKE** — it is a variant of the above |
| Party / cast walls | `conc` | shared with frame | BAKE |
| Warm neighbour masonry | `city_warm` | albedo, rough, normal | **CC0** — real brick beats procedural |
| Cool neighbour render | `city_cool` | albedo, rough, normal | **CC0** |
| Scaffold tube | `galv` | rough, normal (metal) | BAKE — mostly a roughness story |
| Hoarding / screens | `screen`, `paint` | albedo, rough | BAKE — flat coated sheet |
| Plywood formwork | `ply` | albedo, rough, normal | **CC0** — real grain beats a wave texture |
| Asphalt carriageway | `spandrel` (road) | albedo, rough, normal | **CC0** |
| Concrete footpath | `conc` (paving) | albedo, rough, normal | CC0 or BAKE |
| Compacted site earth | `earth` | albedo, rough, normal | **CC0** |
| Glass | `glass` | none — factors + env | neither |

## Candidate sources, to be verified at M4 time

- Poly Haven — CC0, no attribution required
- ambientCG — CC0
- BlenderKit — mixed licensing; each asset must be checked individually

Record for anything used: source, asset name, licence, URL, and what was
modified. Do not fabricate provenance.

## KTX2

Not yet justified: the current GLBs contain **no image textures at all**, so a
KTX2 step would report success and do nothing. Re-evaluate once real maps
exist and the texture payload is measurable.
