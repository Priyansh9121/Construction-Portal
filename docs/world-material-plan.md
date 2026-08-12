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

---

# M4 RESULT — what was actually built

Commit: see `docs/phase3-login-continuation.md`.

## Route taken: BAKE, not CC0

**No external assets were downloaded.** Every map is baked from the Blender
procedural materials that were already authored for the concept. That means
there is no third-party licence to track and no provenance to record — the
"CC0" column in the plan above went unused this milestone.

Why baking won over sourcing: these are *authored* surfaces specific to this
project (formwork lift lines at real 600 mm spacing, pour-to-pour steps, the
staining pattern), and a photographic set would have replaced that with
somebody else's concrete.

## Swatches, not per-object bakes

Each material is baked once onto a flat plane of known world size — a 4 m
tile — and projected TRIPLANAR at runtime.

Per-object baking was rejected: it needs a good unwrap across meshes that join
a 34 m party wall to a 600 mm column, texel density would vary wildly between
them, and stretching is one of the failure modes this milestone is judged on.
Triplanar samples three times by world position and blends on the normal, so
scale is a property of the world rather than of the mesh, and there are no
seams to line up.

## Map inventory

| Slot | Albedo | Roughness | Normal | World tile |
|---|---|---|---|---|
| `conc` | 1024 JPEG | 1024 JPEG | 512 PNG | 4.0 m |
| `wet` | 512 JPEG | 512 JPEG | 512 PNG | 4.0 m |
| `earth` | 512 | 512 | 512 | 3.0 m |
| `ply` | 512 | 512 | 512 | 2.2 m |
| `city_warm` | 512 | 512 | 512 | 4.0 m |
| `city_cool` | 512 | 512 | 512 | 4.0 m |
| `spandrel` (asphalt) | 512 | 512 | 512 | 2.6 m |

Total texture payload **2.5 MB**.

Normals are capped at 512 everywhere: a 1024 concrete normal cost 1.8 MB for
micro relief no camera resolves. JPEG for colour and roughness, PNG for
normals — JPEG's chroma subsampling mangles the per-channel precision a normal
map depends on, and a bad normal reads as shimmering.

**No maps for metal or glass.** Galvanised steel and glazing are defined by how
they REFLECT, and they read from the PMREM environment. Painting an albedo
texture onto them would flatten exactly the response that makes them metallic.

## Colour space

Albedo is baked and loaded as sRGB; roughness and normal are `Non-Color` in
Blender and untagged in three. Tagging a roughness map sRGB silently lightens
it, and no amount of material tuning recovers the surface afterwards.

## Lighting is not baked in

Diffuse bake with direct and indirect passes OFF. The world has a real moving
sun and will have a moon, so any light baked into albedo would be wrong within
the hour.

## KTX2: EVALUATED, REJECTED THIS MILESTONE

`toktx`, `basisu`, `ktx` and `gltfpack` are all **absent** from this machine —
verified, not assumed. `KTX2Loader` exists in three, but that is the decode
side only; encoding needs KTX-Software installed.

At 2.5 MB of texture the payload does not yet justify asking to install system
software. Re-evaluate if a later milestone pushes textures past ~8 MB or if
mobile GPU memory becomes a measured problem.

---

# R1 — CC0 PROVENANCE

Verified at download time, not assumed.

**Source:** ambientCG (https://ambientcg.com)
**Licence:** Creative Commons CC0 1.0 Universal — confirmed by fetching
https://ambientcg.com/license and reading the declaration, not from memory.
CC0 requires no attribution; this record exists for our own traceability.
**Downloaded:** during the R1 session. **Resolution:** 1K-JPG.

| Local name | ambientCG asset | Maps used | Measured world tile |
|---|---|---|---|
| `concrete` | Concrete034 | Color, Roughness, NormalGL | 2.4 x 2.4 m |
| `brick` | Bricks097 | Color, Roughness, NormalGL | **2.06 x 1.03 m** |
| `asphalt` | Asphalt033 | Color, Roughness, NormalGL | 2.0 x 2.0 m |
| `ground` | Ground108 | Color, Roughness, NormalGL | 2.4 x 2.4 m |
| `ply` | Chipboard004 | Color, Roughness, NormalGL | 2.0 x 2.0 m |

**Modifications:** none to the image data. Only Color/Roughness/NormalGL were
kept; AO, Displacement and NormalDX were discarded. `wet` and `city_cool` reuse
the concrete set with a multiply tint rather than carrying their own images.

## How the brick tile was measured

The reset diagnosis found the procedural brick running at roughly 3 m per
course — invisible as brick. This one was measured rather than guessed: the
1024x512 image shows about twelve courses across its height, and a brick course
including mortar is ~86 mm, giving 12 x 86 = 1.03 m of height and, at 2:1,
2.06 m of width.

## Location

`tools/textures/cc0/` — authoring sources, deliberately NOT under
`frontend/public`. The runtime does not reference them yet and 15 MB of unused
images would otherwise ship in the bundle.
