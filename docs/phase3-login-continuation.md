# Phase 3+ Login world — continuation state

**Status: CHECKPOINT. The concept phase is NOT complete.**

---

## CHECKPOINT — FORMWORK SEAMS ADDED; ENTRANCE ONLY, GATE NOT RUN

**START HEAD** `08944ae` · **END HEAD** this commit. Daylight 46 / 18 manual,
sun 1, clouds off. Context, neighbours, crane, blockwork all untouched.

### PROVENANCE — TWO SEPARATE THINGS, NOT CONFLATED

| claim | status |
|---|---|
| texture pixel aspect **1024 × 512 (2:1)** | **VERIFIED** — read from the JPEG header |
| tile set to **2.4 × 1.2 m** | **IMAGE-ASPECT CORRECTION ONLY** — stops a 2:1 stretch |
| that the photo depicts exactly 2.4 × 1.2 m of real concrete | **UNKNOWN** — no source metadata |
| sheet module **1.2 × 2.4 m** | **REPRESENTATIVE / CONCEPTUAL** — not a sourced or standard figure |
| seam width **30 mm** | **CONCEPTUAL** |

### SEAMS — THREE FIELDS, ONE PER SURFACE PLANE

Per-sheet *tone* alone was too quiet (soffit std moved 0.002 — nothing). A
formwork assembly is not defined by panels being slightly different colours;
it is defined by the **joints between them**, which survive because a joint is
a hard local discontinuity rather than a broad wash.

- **XY** field → soffits and slab tops
- **YZ** field → X-facing walls
- **XZ** field → Y-facing walls
- selection from the **geometry normal only** (`|Nx|` vs `|Ny|`, then `|Nz|`
  blend 0.45→0.85). No camera, no object names.

Projecting one grid onto everything is the orientation bug this milestone
already fixed once, and it was not reintroduced in a new form. Columns and
slab edges/beam webs correctly take the **vertical** field; beam soffits take
the horizontal one.

Effect: base colour multiply **0xD2CFC9** at the seam only, plus a small
**roughness** lift. **No bump, no displacement, no dirt, no cracks, no noise
overlay, no new texture downloaded.**

### WIDTH — MEASURED, THEN CORRECTED

12 mm produced **no visible change**: at the entrance camera's 48.5 px/m that
is **0.58 px**, and a 0.89 multiply over half a pixel integrates to nothing.

Widened to **30 mm**, which is still physical — what you see at a formwork
joint is not the 2 mm gap but the band of grout loss and tonal change either
side, and that band is centimetres.

| camera | 30 mm seam |
|---|---|
| entrance | 1.46 px |
| stack | 1.25 px |
| deck | 2.03 px |
| ground | 0.68 px |
| establishing | 0.18 px — collapses, correctly |

### ENTRANCE — THREE STATES

`mx-entrance.png` (original) → `conc1-entrance.png` (orientation + tone) →
`conc3-entrance.png` (+ seams). `conc2-entrance.png` is the 12 mm attempt,
kept as the negative result.

**Verdict: improved, still subtle.** Faint panel divisions now read on the
near columns and the soffit, and the concrete has formwork history rather than
a flat field. It is quiet, not loud — which is the right direction, but it is
not yet emphatic.

### CONCRETE GATE — **NOT RUN**

`ground`, `stack`, `deck` **not rendered**. No establishing regression.
**Concrete is NOT closed and remains #1.** Entrance proof only.

Tie marks **NO** · pour joints **NO** · age variation **NO** — all correctly
left as fallbacks, none needed yet.

### STRONGEST REMAINING CONCRETE WEAKNESS

The seams read on surfaces facing the light and disappear on surfaces in
shadow, which is most of this interior. Whether that is acceptable or needs a
roughness-led rather than colour-led cue is the open question, and it can only
be answered on `stack` and `deck` where the concrete is lit.

### SOURCE RENDER COST

Still **>10 min/frame**, and it is now the binding constraint on this work: a
four-view gate plus one iteration is roughly an hour of pure rendering. Still
logged as a **browser delivery / export optimisation risk**.

### NEXT EXACT ACTION

Render **`stack`** — the concrete there is lit and side-on, so it is the frame
that will actually answer whether seams carry. Then `ground` and `deck`, then
the gate.

---

## CHECKPOINT — CONCRETE ROOT CAUSE FOUND; FIRST FIX MODEST, GATE NOT RUN

**START HEAD** `01df24b` · **END HEAD** this commit. Daylight 46 / 18 manual,
sun 1, clouds off. Context, neighbours and crane all untouched.

### INVENTORY

| | |
|---|---|
| material | `conc` → `in_situ_concrete("conc", "concrete", tile)` |
| object families | columns, slabs, downstand beams, edge beams, party walls, cores, stair, infill piers |
| base / normal / roughness | `concrete-color/normal/roughness.jpg`, verified CC0, already present |
| resolution | **1024 × 512** (2:1) |
| coordinate source | `Geometry > Position`, **BOX projection**, world-space metres |
| declared tile (before) | **2.4 × 2.4 m** |
| declared tile (after) | **2.4 × 1.2 m** |

### MEASURED: MICRO DETAIL CANNOT WORK AT THESE CAMERAS

At 2.4 m across 1024 px a texel is **2.34 mm**:

| camera | px/m | 2.4 m tile | one texel |
|---|---|---|---|
| entrance | 48.5 | 116 px | **0.11 px** |
| ground | 22.5 | 54 px | **0.05 px** |
| stack | 41.6 | 100 px | **0.10 px** |
| deck | 67.8 | 163 px | **0.16 px** |

So the photographic micro detail is physically invisible in every gate view.
Only meso structure can carry them — and meso was broken.

### ROOT CAUSE — ORIENTATION, NOT SCALE

`in_situ_concrete` keys its pour-lift tone to **world Z**, floored by the
3.3 m storey. On a column that is correct. On a **soffit or slab edge, which
sits at constant Z, the lift index never changes** — so the whole surface
receives ONE tone, and with micro detail at 0.11 px nothing else remains.

That is the broad even grey field: **one global Z pattern was describing every
cast surface in the building.**

Second, independent defect: the map is 1024 × 512 but the tile was square, so
the texture was **stretched 2:1 vertically**. Corrected to (2.4, 1.2).

### FIRST INTERVENTION

Horizontal faces now get **plywood formwork sheets — real 1.2 × 2.4 m** — as a
deterministic per-sheet tone in the horizontal plane, because a soffit is
formed on ply and its sheet joints are what the eye reads on a ceiling.
Vertical faces keep their lifts. **`|normal.z|` blends between them** (0.45 →
0.85), so a beam soffit turning up into a web transitions rather than snapping.

Tone range 0.93–1.05 — restrained; this is ply, not paint. **No dirt, no
cracks, no noise overlay, no new texture downloaded.**

### RESULT — HONEST

`mx-entrance.png` → `conc1-entrance.png`. Columns now differ in tone and the
soffit shows panel-scale variation rather than one flat field. **The change is
modest.**

Supporting numbers do **not** confirm a strong gain — soffit band std
0.1747 → 0.1723, column zone 0.1675 → 0.1666. Those regions are dominated by
scaffold tubes and festoon lighting rather than the concrete, so std is a poor
metric here; recorded rather than spun.

### CONCRETE GATE — **NOT RUN**

Only `entrance` was rendered. `ground`, `stack` and `deck` were **not**, and no
establishing regression was run. **Concrete is NOT closed and remains #1.**
A frame exceeds 10 minutes; the brief's own rule is that a completed first
intervention beats a half-run four-view gate.

### STRONGEST REMAINING CONCRETE WEAKNESS

The meso cues are still too quiet at 8–20 m. Formwork **panel seams**, **tie
marks** and **pour joints** are all still absent — only per-sheet *tone* was
added, and tone alone is weak when the surface is in shadow. Seams are
probably worth more than tone.

### NOT DONE

Tie marks NO · pour joints NO · age/level variation NO · blockwork dot issue
NO (not this milestone) · context NO · neighbours NO · crane NO · morning NO ·
afternoon NO · festoon NO · anti-GTA NO · source gate NO · GLBs NO ·
runtime NO.

### NEXT EXACT ACTION

1. Add **formwork panel seams** — a thin darker line at sheet boundaries on
   both orientations. A seam reads where a tone shift does not.
2. Re-render `entrance`, then run the four-view gate.

---

## CHECKPOINT — CONTEXT CLOSED 5/5 (deck with reservation)

**START HEAD** `035502d` · **END HEAD** this commit. Daylight 46 / 18 manual,
sun 1, clouds off. `CTX_NEAR 125` / `CTX_MID 175` **unchanged**.

> The prompt for this milestone targeted `834e729` and attributed the deck
> failure to MID uniformity. That work was already committed at `035502d`,
> and the render had **falsified** the premise: the MID service core was
> added, deck was re-rendered, and it did not change. Re-running the prompt
> would have rebuilt existing work to re-test a dead hypothesis.

### THE BLOCK, IDENTIFIED BY MEASUREMENT NOT INFERENCE

I had already mis-attributed this failure twice, so I back-projected the
offending image region through the deck camera before touching anything:

| | |
|---|---|
| bearing | 138–147° |
| elevation | +6.5° to +18.8° |
| **visible base** | **z 37–75 m** |

The base being that high means we see only the upper part of something tall
whose footing is hidden behind the hero. Only a **~96 m block at ~190 m** fits;
the across-the-road row tops out near 38 m and cannot reach it. It is the
**tall FAR block already logged from `road_truth`** — the same building from a
second camera. **Cause E, confirmed.**

### LARGE_FAR — AN ANGULAR RULE, NOT A COORDINATE HACK

```
LARGE_FAR_RATIO = 0.35
large_far = r > CTX_MID and (h / r) >= LARGE_FAR_RATIO
```

A large building far away is not a far building. A 66 m block at 190 m
qualifies; a 40 m one at the same distance does not. **~2.5 of 34 ring blocks
(7%)** — selective by construction, so no skyline noise. Qualifying blocks take
the MID path: podium material break, roof overrun, service core. **No NEAR
reveals. `CTX_NEAR` not widened. FAR not loosened globally. No coordinates in
the rule.**

### GATE

| frame | verdict |
|---|---|
| road_truth | PASS |
| lift | PASS |
| **deck** | **PASS with reservation** — `ctx6` → `ctx7`, service core now breaks the grid |
| rear (context) | PASS by absence |
| establishing | PASS — `ctx7-establishing.png`, no regression, no skyline noise |

**DISTANCE-TIER GATE: YES — 5/5.**

**The reservation, stated plainly:** the core interrupts the uniform grid and
ends the procedural read, but a residual window grid remains either side of it
on that block. Context is no longer the dominant cue in any frame and is
subordinate to the lift operation — enough to close, not enough to call
perfect.

### SOURCE RENDER COST

A single frame still exceeds **10 minutes**. LARGE_FAR adds ~2–3 boxes to ~2.5
blocks; negligible. Still flagged as a **browser delivery / export
optimisation risk** for the GLB stage.

### TOP THREE AFTER CONTEXT — from the current images

1. **Flat close-range concrete, 8–20 m.** The hero's core and stair masses in
   `ctx7-deck` are broad even grey fields. Unchanged and now the loudest cue.
2. **Immediate neighbour rear elevations.** Blank slabs with boolean holes,
   dominating `rear`. Untouched by instruction.
3. **Residual mid/far window grid** where no service core interrupts it —
   the LARGE_FAR fix breaks uniformity on qualifying blocks but the grid
   itself is still a painted rhythm.

### NEXT EXACT ACTION

**In-situ concrete source identity at 8–20 m**, its own milestone: check the
2.4 m tile against `entrance` / `ground` / `stack`, and express pour lifts and
form-tie marks at real spacing.

---

## CHECKPOINT — MID SERVICE CORE ADDED; DECK **STILL FAILS**, CAUSE = FAR

**START HEAD** `834e729` · **END HEAD** this commit. Daylight 46 / 18 manual,
sun 1, clouds off. Thresholds unchanged: `CTX_NEAR 125`, `CTX_MID 175`.

### MID SERVICE CORE — IMPLEMENTED

| property | value |
|---|---|
| geometry | one box per MID block, full shaft height + 1.5 m past the parapet |
| width | `clamp(frontage × 0.16, 2.0, 4.0)` m — derived from frontage, not fixed |
| placement | three deterministic variants by block index — 0.30 / 0.68 / 0.19 of frontage (third point, far third, offset from corner) |
| orientation | across the block's **long** axis, proud on the two long faces |
| material | **plain** `city_cool` / `city_warm` (alternating by era) — no shader rhythm |
| depth | **0.18 m proud** |

Plain material is the load-bearing choice: the shaft carries its window rhythm
**in its material**, so a coplanar band in another rhythm-bearing material
would simply continue the grid. Standing it proud in a material that has no
windows makes it **own** that strip of wall and cast a real shadow. It runs
past the parapet because that is what a stair core does, which strengthens the
roofline for free.

### DECK — STILL FAILS, AND THE RENDER IDENTIFIED THE CAUSE

`ctx5-deck.png` → `ctx6-deck.png`: **essentially unchanged.**

That null result is the diagnosis. The service core is applied to every MID
block, and the offending block did not change — **so it was never MID.** This
is cause **E** from the failure list: *the remaining visible block is actually
FAR* (r > 175 m).

**The MID fix is not wasted and is not wrong** — MID genuinely lacked an
in-facade interruption and now has one. It simply was not the thing failing in
this frame, and the previous session's attribution of the deck failure to MID
uniformity was incorrect. The render corrected it.

### DISTANCE-TIER GATE: STILL **NO** — 4 / 5

road_truth PASS · lift PASS · establishing PASS · rear PASS · **deck FAIL**.

### TALL / LARGE FAR

**Not re-examined and no rule added** — but the deck result now points
directly at it. The exception must be physical, not a coordinate hack:

> `if r > CTX_MID and the block's height/frontage is large enough that its
> openings still resolve from site viewpoints → give it MID-LITE hierarchy`
> (service core + material break + roof interruption; **no NEAR reveals**).

`CTX_NEAR` was **not** widened and `FAR` was **not** loosened globally.

### SOURCE RENDER COST

Unchanged from the previous note and still significant: a single `deck` frame
exceeds **10 minutes**. The MID core adds one box per block and is negligible
against that. Still flagged as a **browser delivery / export optimisation
risk**, not addressed here.

### TOP THREE — UNCHANGED

1. **Context distance tier** — one frame short, cause now precisely located.
2. Flat close-range concrete.
3. Immediate neighbour rear elevations.

### NEXT EXACT ACTION

1. Add the **LARGE_FAR / MID-LITE** rule above.
2. Re-render **`deck` only**. If it passes, context closes 5/5.
3. Confirm `establishing` skyline does not gain noise.
4. Then concrete, in its own session.

---

## CHECKPOINT — CONTEXT GATE 4/5; **DECK STILL FAILS**, NOT CLOSED

**START HEAD** `ad87f92` · **END HEAD** this commit. Daylight unchanged
46 / 18 manual, sun count 1, clouds off. Concrete, crane and neighbours all
verified untouched by diff before rendering.

### THE TWO MISSING FRAMES

| frame | before | after | verdict |
|---|---|---|---|
| **deck** | `mx-deck.png` | `ctx5-deck.png` | **FAIL** — background blocks still read as a uniform punched grid |
| **rear** | `mx-rear.png` | `ctx5-rear.png` | **PASS (by absence)** — no `context_city` object contributes a grid cue |

**`rear` is a pass on a technicality worth stating plainly:** the frame is
filled by the two immediate NEIGHBOUR rear elevations (`nb`/`nw`) and the
hero. Those blank slabs with boolean-hole windows are the separate known #3
and were correctly **not** judged as a context failure — and **not fixed**.

### THE FIVE-FRAME GATE

| frame | verdict |
|---|---|
| road_truth | PASS |
| lift | PASS |
| establishing | PASS — no regression |
| rear (context only) | PASS |
| **deck** | **FAIL** |

**DISTANCE-TIER GATE: NO. Context is NOT closed.**

### THE SINGLE REMAINING CONTEXT CAUSE

The blocks visible behind the site from `deck` sit at **r > 125 m**, so they
are MID tier and keep the shader rhythm. From that camera they subtend roughly
**170 px wide**, and at that size a painted-on grid still reads as procedural.

MID currently receives a podium material break and a roof overrun but **no
anti-uniformity cue within the facade itself** — the NEAR tier gets that from
its blank service bay, which is created by *omitting* geometry openings, and
MID has no geometry openings to omit.

**This is not an argument for widening `CTX_NEAR`.** The 125 m threshold was
derived from where the offending near/mid blocks actually are and should
stay. The missing piece is a cheap in-facade interruption for MID.

**Proposed minimum fix (NOT implemented):** give MID a full-height service
strip in the podium material — a stair/wet stack expressed as a material
band rather than as openings. It costs one box per block, reads at 170 px,
and is architecture rather than randomness.

### TALL FAR BLOCK

Not re-examined this session — `road_truth` was not re-rendered because no
FAR rule was added. **Still recorded as open.** No `TALL_FAR` rule was
created; `CTX_NEAR` and `CTX_MID` are unchanged at 125 / 175.

### SOURCE RENDER COST

The NEAR tier roughly **doubled** Blender build+render time: a single frame
now exceeds 10 minutes at 720×450 / matrix samples, against roughly 4–5
minutes before. Not optimised — this is source truth.

**Flagged as a BROWSER DELIVERY / EXPORT OPTIMISATION RISK** for the GLB
stage: instancing, shared geometry, mesh merging, LOD and visibility
management are all candidates *then*, not now.

### TOP THREE — UNCHANGED, BECAUSE CONTEXT DID NOT CLOSE

1. **Context distance tier** — still #1, one frame short.
2. Flat close-range concrete.
3. Immediate neighbour rear elevations.

### NEXT EXACT ACTION

1. Add the MID service strip described above.
2. Re-render **`deck` only**. If it passes, context closes at 5/5.
3. Then re-check the tall FAR block, then concrete in its own session.

---

## CHECKPOINT — CONTEXT DETAIL TIERS BUILT; GATE PROVEN ON 3 OF 4 FRAMES

**START HEAD** `2346d37` · **END HEAD** this commit. Reference daylight
unchanged **46 / 18 manual**. Sun count 1. Nothing exported, runtime untouched.

### OWNERSHIP AUDIT (before editing)

- **context_city** → `podium / shaft / cap / plant / parapet`, joined as `city`,
  materials `ctx_warm` / `ctx_cool`. **58 blocks.**
- **Neighbours** → `nb / np / nw`, authored separately in `concept_c.py` with
  real modelled window assemblies (recess, room, glass, frame).

They are cleanly separate. **No neighbour object was touched.**

### TIERS — BY DISTANCE FROM THE SITE ORIGIN, NOT FROM A CAMERA

This is source truth: a building has depth because it is near the site, not
because a Cycles camera asked. Runtime LOD stays a separate problem.

| tier | range | treatment |
|---|---|---|
| NEAR | ≤ 125 m | real recessed openings, service bay, ground condition, material break, roof overrun |
| MID | 125–175 m | shader rhythm + material break + roof overrun |
| FAR | > 175 m | **untouched** — silhouette, roofline, height variation |

**The threshold was wrong first time.** 85 m was chosen as a round number and
the frames did not change at all, because the blocks that actually fail in
`road_truth` and `lift` are the across-the-road terrace and first rear row at
**r = 97–120 m** — they sat in MID and kept the shader grid. The audit had
already measured this; I had not used it. 125 m comes from where the offending
buildings are.

### STRONGEST OFFENDERS (measured, screen width at 720 px)

| block | nearest cam | dist | screen width |
|---|---|---|---|
| (−34.2, −93.2) | road_truth | 87 m | **277 px** |
| (−9.4, −98.6) | road_truth | 80 m | 269 px |
| (23.4, −100.9) | establishing | 67 m | 262 px |

Over a third of the frame each.

### IMPLEMENTATION

- **Opening depth 150 mm** — a dark plane set *behind* the facade, so the
  wall's own thickness casts the reveal shadow. Not a decal, and no booleans.
- **Service bay** — one full-height bay with no windows per face. Stair and
  wet stacks are why real facades are not uniform. **No windows were randomly
  deleted**; absence is architectural.
- **Ground condition** — a taller, wider street-level opening.
- **Material break** — podium in the other material.
- **Roof overrun** — a stair overrun so blocks stop terminating as rectangles.

**A defect I introduced and then fixed:** NEAR blocks initially kept
`ctx_warm`/`ctx_cool`, which paint a window grid *into the surface* — so they
carried **two window systems at once**, at different spacings that cannot
align. NEAR now uses the plain photographic masonry and lets geometry do the
windows. MID and FAR keep the shader.

### GATE

| frame | before | after | verdict |
|---|---|---|---|
| road_truth | `mx-road_truth.png` | `ctx4-road_truth.png` | **IMPROVED** — recessed openings, reveal shadow, service bay, stepped roofline |
| lift | `mx-lift.png` | `ctx4-lift.png` | **IMPROVED strongly** — pale punched-grid boxes gone |
| establishing | `ctx-before.png` | `ctx4-establishing.png` | **NO REGRESSION** |
| deck | — | — | **NOT RE-RENDERED** |
| rear | — | — | **NOT RE-RENDERED** |

**First intervention gate: PASS.**
**DISTANCE-TIER GATE: NOT FORMALLY CLOSED** — closure requires `deck` and the
`rear` context verdict, and those were not re-rendered. Render times roughly
doubled with the NEAR geometry, and I would rather leave this honestly open
than claim four frames from three.

### STRONGEST REMAINING CONTEXT WEAKNESS

A **tall FAR-ring block** still shows the uniform shader grid in `road_truth`
at centre-right. FAR was left untouched by instruction and it is working for
most of the ring, but a 96 m block at 190 m subtends enough frame to matter.
That is a candidate for a FAR height-aware sub-rule, not a blanket change.

**Neighbour rear elevations remain OPEN as a separate item.** Not touched.

### NOT RUN / NOT TOUCHED

Crane **NOT modified**. Concrete **NOT modified**. Neighbours **NOT modified**.
Morning NO · afternoon NO · festoon NO · anti-GTA NO · source gate NO ·
GLBs NO · runtime NO.

### NEXT EXACT ACTION

1. Render **`deck` and `rear`** to finish the distance-tier gate.
2. Then the tall FAR-ring block, if it still reads.
3. Then **#2 close-range concrete**, in its own session.

---

## CHECKPOINT — CRANE CLOSED (#1); CONTEXT BECOMES THE NEW #1

**START HEAD** `6cc506b` · **END HEAD** this commit · nothing exported · no
runtime change. Reference daylight unchanged at **46 / 18, manual,
non-astronomical**. Sun count 1, Nishita aligned, clouds off.

**Reference role unchanged:** CONCEPTUAL / REPRESENTATIVE, proportioned on the
Liebherr LTM 1055-3.2 family. No invented figure is claimed as a manufacturer
value. **Telescopic — no lattice was added.**

### WHAT CHANGED

| part | before | after |
|---|---|---|
| chassis | one 11.90 × 2.70 × 0.95 box | two deep rails, belly plate, deck plate, engine body, grille |
| wheels | 6 plain cylinders | tyre + recessed rim + hub, 24-seg tyre |
| wheel/body | none | fender over each axle + side skirts + access steps |
| axles | −4.30 / 2.05 / 3.75 | unchanged — 1 steer + tandem rear |
| outrigger | beam + 1 jack cyl | housing → sleeve → beam → barrel → rod → foot → pad → mat |
| slew | one cylinder | base ring → slew ring → turntable deck (3 steps) |
| upper | one box | machinery house + rear cowl + grille (stepped shoulder) |
| boom pivot | **none** | two pivot cheeks + pin + boom heel |
| luff cylinder | floating box at a hard-coded 52° | barrel + rod anchored turntable → boom underside |
| cabs | glass patched on | raked windscreen, side lights, roof cap, mirrors |
| counterweight | slabs | slabs + carrying brackets |

Wheels: diameter **1.24 m**, width **0.42 m** (rim 0.80 m, hub 0.30 m).

### LOCAL GEOMETRY CHECK — 134 crane objects

**Nothing below ground.** Load path continuous, every joint overlapping:

`mat 0.05–0.14 → pad 0.14–0.30 → foot 0.24–0.40 → rod 0.36–0.42 →
barrel 0.35–0.97 → beam 0.63–1.25 → rails 0.74–1.46`

Slew stack continuous 1.49 → 3.51. Luff cylinder anchored at both ends
(2.05 turntable → 10.01 boom underside) — its angle is now a **consequence**
of boom position rather than a typed number.

### CRANE GATE

| frame | before | after |
|---|---|---|
| **lift** | FAIL — low-poly vehicle | **PASS** — componentised upper, glazed cab, turntable, boom step and ribs |
| **rear** | FAIL — toy truck | **PASS** — carrier anatomy, axle rhythm, outriggers visibly carrying the machine |
| **deck** | reservation — boom intruded a low-poly cue | **PASS WITH RESERVATION** — no longer a low-poly cue; head cheeks clunky at close range |

**ANTI-TOY TEST:** stripped of colour, material and lighting the silhouette
alone shows carrier, fenders, stepped upper, cab, counterweight, boom collar
and outriggers to pads, with a followable load path. **It does not work only
because it is orange.**

**CRANE GATE = YES. TOP FAILURE #1 = CLOSED.**

**Strongest remaining crane weakness:** the boom's broad faces still read soft
rather than sharply fabricated box-section, and the head cheeks are clunky at
`deck` range. Not enough to hold the gate — and the crane is no longer among
the top three failures in any of these three frames.

Evidence: BEFORE `mx-rear.png`, `mx-lift-after.png`, `mx-deck.png` (preserved);
AFTER `crane2-rear.png`, `crane2-lift.png`, `crane2-deck.png`.

### TOP THREE AFTER THE CRANE

- **NEW #1 — context city distance-tier failure** (was #2). Now the weakest
  element in `lift`, `deck` and `road_truth`.
- **NEW #2 — flat close-range concrete** (was #3).
- **NEW #3 — neighbour REAR elevations are blank slabs with boolean holes**,
  no frames, no reveals, visible in `rear`. Related to but distinct from the
  context ring: these are the neighbours' own rear faces.

**Neither was touched. Context: NOT MODIFIED. Concrete: NOT MODIFIED.**

### NOT RUN

Morning NO · afternoon NO · festoon three-state NO · cloud revalidation NO ·
anti-GTA NO · source gate NO · GLBs NO · runtime NO.

### NEXT EXACT ACTION

**#2 as a distance tier**, in its own session: audit the context generator,
establish near/mid/far ownership, give blocks inside ~60 m real recessed
openings (150 mm is enough), parapet variation and a material break, and leave
the far ring untouched. Prove with `road_truth` + `lift` improving while
`establishing` does not regress.

---

## CHECKPOINT — FIRST TEN-VIEW REFERENCE MATRIX; TOP THREE DERIVED FROM IMAGES

**START HEAD** `37ddb46` · **END HEAD** this commit · nothing exported · no
runtime change.

### REFERENCE DAYLIGHT — **MANUAL, NON-ASTRONOMICAL**

Elevation **46°**, azimuth **18°**. These are **manual constants** in
`concept_c.py`. There is no astronomical calculation in the Blender source.
They must not be called "solar noon", "astronomically correct", "site sun" or
"midday for the site". The correct name is **REFERENCE DAYLIGHT**.

The runtime has SunCalc 2.x, timezone `Asia/Kolkata`, latitude **23.0**,
longitude **82.5** — with **`coordinatesConfigured: false`**. Those are an
explicit placeholder, not the site. Blender was **deliberately not connected**
to them: a technically astronomical result for a location that is not the site
is worse than an honestly labelled deterministic reference.

**FINAL ASTRONOMICAL GATE PENDING REAL SITE LATITUDE, LONGITUDE AND DATE.**

Invariants held: **Sun lamp count 1**, Nishita aligned 46/18, `sun_disc` False,
`sun_intensity` 0, no HDRI, clouds off (`--clouds none`).

### THE TEN FRAMES (`mx-*.png`)

`side` does not exist and was not invented: the plot is hemmed by party walls
at x ±10.85 with neighbours on both flanks, so a true side elevation stands on
someone else's land. `hero` (street oblique) was used in its place.
`opposite` → `ground`, `crane` → `lift`.

| frame | verdict |
|---|---|
| establishing | **PASS** — hierarchy holds; street reads; ground floor legible |
| entrance | **PASS with reservation** — content strong; large flat grey concrete at 10 m; blockwork reads as a regular dot grid |
| road_truth | **PASS** — footpath, kerb, gutter, asphalt, markings all separate |
| hero (for side) | **PASS** — best architecture in the project; brick reveals and sills read |
| rear | **FAIL** — crane reads as a toy; neighbour rear elevations are blank slabs with boolean holes |
| ground (opposite) | **PASS** — festoon reads as site lighting, not fairy lights |
| stack | **PASS** — beams, props, OSB decking read; concrete is a broad even field |
| hoist | **PASS** — mast, rack and boarded lifts convincing |
| lift (crane) | **FAIL** — crane dominates and reads as a low-poly vehicle |
| deck | **PASS with reservation** — bundle and receiver read; boom and context grid intrude |

### TOP THREE — DERIVED FROM THESE IMAGES

**#1 — THE MOBILE CRANE READS AS A TOY.**
*Symptom:* smooth tapered orange tube for a boom, two rounded boxes for the
superstructure, plain cylinder wheels, a striped counterweight block, no cab
glazing. *Frames:* `rear`, `lift`, `deck` — largest object in two of them.
*Distance:* 25–45 m. *Why game:* a manufactured machine carries section
changes, joints, ribs and glazing; this had none. It was the only object in the
world with **zero surface hierarchy at its own scale**, and it is big,
saturated and central. *Minimum fix:* manufactured hierarchy — telescopic
section steps, ribs, a real boom head, glazing.

**#2 — CONTEXT CITY IS ONE DETAIL TIER SERVING 25 m AND 400 m.**
*Symptom:* pale boxes with a perfectly uniform punched-window grid, identical
floor spacing, no reveal depth, no parapet or plant variation, no material
break. *Frames:* `deck`, `lift`, `road_truth`, `rear`. *Distance:* 25–120 m —
the **near/mid ring fails, the far ring is fine**. *Why LEGO/BIM:* `a942922`'s
shader rhythm is correct at 70 m where a window is under a pixel, and at 25 m
the eye wants reveal depth and bay variation and gets a flat decal grid.
**This is a DISTANCE-TIER failure, not "the context fix failed."**
*Minimum fix:* a MID tier inside ~60 m with real recessed openings (150 mm is
enough), parapet variation, one service element, a material break. Leave the
FAR ring exactly as it is.

**#3 — LARGE FLAT UNTEXTURED CONCRETE AT CLOSE RANGE.**
*Symptom:* columns, soffits, core and stair walls and slab edges are broad even
grey fields with almost no variation. *Frames:* `entrance`, `ground`, `stack`,
`deck`. *Distance:* 8–20 m. *Why CG:* in-situ concrete at that range shows pour
lifts, form-tie marks, board marks, edge chipping and differential staining.
The material exists but its 2.4 m tile is not landing at this scale.
*Minimum fix:* re-scale `in_situ_concrete` against these cameras and express
tie/lift lines at real spacing.

### #1 FIX — PERFORMED, **PARTIAL**

Telescopic section **collars** at each mouth, longitudinal flank **ribs**, a
real **boom head** with cheeks and three sheaves, **glazed** operator and
carrier cabs, and the counterweight rebuilt as **separated slabs** with gaps.

**BEFORE** `mx-lift.png` · **AFTER** `mx-lift-after.png`.

**Verdict: improved, not closed.** The section step and the counterweight stack
now read. The boom flanks are still broad flat orange and the machine still
lacks the density of a real all-terrain crane. **#1 stays on the list.**

### NOT RUN

**MORNING: NO. AFTERNOON: NO. FESTOON THREE-STATE: NO. CLOUD VALIDATION: NO.
ANTI-GTA: NO. SOURCE-WORLD FINAL GATE: NO. GLBs: NO. RUNTIME: NO.**

### NEXT EXACT ACTION

1. Finish **#1** — the crane still reads under-built at 25 m.
2. Then **#2**, as a distance tier, not as more detail everywhere.
3. Then **#3**, as a texture-scale question.
4. Temporal matrix (morning/afternoon + the overdue festoon three-state) only
   after the top three are closed.

---

## CHECKPOINT — ROAD PROVEN AND MARKED; SOLAR AUDITED; MIDDAY MATRIX NOT RUN

**START HEAD** `ddca9f6` · **END HEAD** this commit · source gate not run ·
nothing exported · no runtime change.

### A — ROAD_TRUTH CAMERA (source verification only)

`"road_truth": ((18.0, -23.4, 1.60), (-16.0, -31.0, 0.35), 42)`

Position **(18.0, −23.4, 1.60)** · target **(−16.0, −31.0, 0.35)** · **42 mm**.
Eye height 1.60 m, standing on the near footpath just east of the gate looking
WSW **along** the kerb line. Not a runtime station, not a Login camera, not a
replacement for establishing.

First attempt stood on the median aiming across the street; the road came back
as a narrow band with the building taking the frame. Along the kerb the
footpath, upstand, gutter and carriageway each get real depth and the markings
recede on the crossfall instead of sitting side-on.

### B — LANE MARKINGS (were MISSING)

Derived from the authored profile, not placed by eye. Carriageways measured
between gutter inverts: **far 14.2 m** (crown −61.5), **near 18.7 m**
(crown −35.0). Three **3.50 m** lanes centred on each crown, leaving the outer
margin unmarked as the parking/shoulder it is.

| property | value |
|---|---|
| type | dashed lane separators only |
| width | **0.10 m** |
| dash | **3.00 m** |
| gap | **6.00 m** (period 9.00 m) |
| proud of surface | **0.004 m** (base 0.003 m *below*, 0.007 m tall) |
| material | `roadline` — `0xC9C3B6`, rough 0.74, wear 0.55, **non-emissive** |
| separators at y | −63.25, −59.75, −36.75, −33.25 |

No crosswalks, arrows, bus lanes or box junctions — those would invent a
traffic scheme this street does not describe.

Each dash sits on the **crossfall**: z is interpolated from the section at that
y, so paint follows the camber. First version based the dash 6 mm *proud*,
leaving an air gap under every line — corrected to embedded.

**A correction to my own reading:** I first blamed floating markings for the
raised bars in the foreground of the initial `road_truth` frame. Wrong — the
edit had applied. Those bars are the **median kerb upstand 1.5 m from the
lens**, which is correct, and is positive evidence that the kerb reads.

### C — ROAD VISUAL GATE (`road-truth.png`)

| check | verdict |
|---|---|
| asphalt reads as asphalt | **YES** |
| kerb reads as concrete upstand | **YES** — strongest single gain |
| footpath distinct pedestrian concrete | **YES** |
| gutter reads as drainage edge | **YES**, weaker |
| lane markings plausible and scaled | **YES** |
| public road ordinary / maintained | **YES** |
| game road | **NO** |
| flat grey plane | **NO** |
| median / haul / gate fines | **NOT PROVABLE FROM THIS FRAME** |

**ROAD GATE = YES for the near-side hierarchy.** Median, haul transition and
gate fines are outside this frame; they are authored and measured but remain
unproven by eye.

**Production regression** (`road-est-regression.png`): street hierarchy still
plausible, markings small and correctly scaled, no over-bright paint, no
material discontinuity, no new game cue.

### D — SOLAR AUDIT: SOURCE AND RUNTIME DO NOT SHARE A SUN

**SOURCE (Blender) is MANUAL CONSTANTS.** `SUN_ELEV = 46.0`, `SUN_AZ = 18.0`
in `concept_c.py`, overridable by `--sun` / `--az`. There is **no astronomy in
the source pipeline at all**. These are plausible for latitude 23 and they are
not computed — they must not be described as astronomical.

**RUNTIME already has real astronomy**, in `frontend/src/world/environment.js`:
`suncalc` 2.x, and:

| input | value |
|---|---|
| timezone | **Asia/Kolkata** (backend `DEFAULT_TIMEZONE`) |
| latitude | **23.0** |
| longitude | **82.5** |
| `coordinatesConfigured` | **false** |
| date/time | real current IST |

The coordinates are an explicit **PLACEHOLDER** — the IST standard meridian at
a mid-country latitude. The `sites` table has latitude/longitude columns and
**every row is NULL**. The file itself says `coordinatesConfigured: false` is
load-bearing and anything reporting on it must call the state approximate.

**TARGET CONTRACT** (lat/lon/date/local time/Asia-Kolkata) therefore exists in
the runtime and **does not exist in the source**. They are not connected.

**MORNING / MIDDAY / AFTERNOON: NOT DERIVED.** Deriving true azimuths for the
source would move the sun off the deliberately chosen `SUN_AZ = 18`, picked so
the south-facing street elevation is lit at all (Blender +Y is north, so the
street face looks south). That is a change to sun direction, which this brief
lists as closed — **it needs an explicit decision, not a silent edit.**

Invariants confirmed unchanged: **Sun lamp count 1**, Nishita aligned at
elevation 46 / rotation 18, `sun_disc` False, `sun_intensity` 0, no HDRI.

### NEW FINDING FROM THE NEW RENDER

`road-truth.png` is the first street-level frame this project has had, and it
exposes something the establishing camera never showed: **the context city
reads as pale boxes with a uniform punched-window grid — a LEGO/BIM cue at
street level.** The a942922 rhythm fix is correct at 70 m and does not survive
25 m. This is a genuine top-three candidate and it came from a new image, not
from old documentation.

### NOT RUN

**MIDDAY MATRIX: NOT RUN** (10 frames). **MORNING: NOT RUN.**
**AFTERNOON: NOT RUN.** **FESTOON THREE-STATE: NOT RUN.**
**MIDDAY TOP THREE: NOT DERIVED.** **ANTI-GTA: NOT RUN.**
**SOURCE GATE: NOT RUN.** **GLBs: NO. RUNTIME: NO.**

Ten frames plus per-image review and three root-cause fixes did not fit the
remaining budget, and the brief rates a completed road above a half-run gate.

### NEXT EXACT ACTION

1. **Decide the solar question** — either accept `46/18` as a documented
   deterministic source state, or connect the source to the runtime's
   suncalc/lat/lon and accept that the sun direction moves.
2. **Midday ten-frame matrix**, CLEAR sky, 480–720 px. Look at every image.
3. Derive the **midday top three**. The context-city street-level read above is
   a standing candidate.

---

## CHECKPOINT — E ROAD MATERIAL DONE; F NOT STARTED (deliberately)

**CURRENT COMMIT** this one · source gate **not run** · nothing exported · no
runtime change.

### E1 — INVENTORY, AND THE ANSWER WAS IN IT

| surface | object | material | source | CC0 |
|---|---|---|---|---|
| road asphalt | `road` ribbon | `spandrel` | asphalt | ✓ |
| **gutter** | *same mesh* | **`spandrel`** | asphalt | *same* |
| **kerb** | *same mesh* | **`spandrel`** | asphalt | *same* |
| **footpath** | *same mesh* | **`spandrel`** | asphalt | *same* |
| **median** | *same mesh* | **`spandrel`** | asphalt | *same* |
| rear lane | `lane` ribbon | `spandrel` | asphalt | ✓ |
| site pad / ramp | `pad`, `ramp` | `conc` | concrete | ✓ |
| haul route | `haul` prism | `earth` | site_ground | ✓ |
| site ground | `ground` box | `earth` | site_ground | ✓ |
| drain | `drain` prism | `galv` | procedural | n/a |
| **lane markings** | — | — | **MISSING** | — |

**CC0 families verified present on disk:** asphalt, brick, concrete, ground,
ply. Nothing was substituted and nothing new was downloaded.

**Root cause:** the entire street cross-section was ONE mesh with ONE
material. The profile described a kerb upstand, a gutter invert, a planted
median and two footpaths — correctly — and then rendered all of them as the
same asphalt. The foreground read as one grey plane because it *was* one
material.

### THE FIX — NO VERTEX MOVED

`M.ribbon()` now takes `segment_mats`, one material per cross-section segment.
Faces are emitted in section order, so segment *i* is face *i*: only the
material index changes. Road geometry is untouched, as required.

Five identities where there was one: **asphalt · kerb · footpath ·
median_top · haul**. Tiles measured against real surfaces — 1.6 m asphalt,
1.1 m kerb, 2.9 m footpath.

### CAUSAL CONTACT, NOT PAINTED DIRT

- **Gutter grime is keyed to the profile's own low point.** Z 0.02 (invert) →
  0.22 (crown). Fines collect at the low point *because it is the low point*,
  so the darkening lands in the gutter line by itself, follows the crossfall,
  and fades toward the crown. It cannot become a cartoon stripe — it is a
  gradient over 200 mm of real fall, not a band of chosen width.
- **Gate contact LIGHTENS the asphalt.** Site dirt always wants to be painted
  dark, but what comes out of a gate on tyres is dry pale fines off a
  compacted haul route. Darkening would read as oil, which no process here
  produces. Keyed to real distance from the gate mouth at (0, −24), peaking
  at the crossing and decaying over 17 m.
- **Haul route is the same ground, trafficked** — tighter tile (broken down by
  wheels), flatter roughness (rolled), drier tint. Unused soil keeps its own
  coarser identity.

### MEASURED

| band | before | after |
|---|---|---|
| near footpath + kerb | 0.2939 | **0.3345** |
| far kerb / footpath | 0.1666 | **0.2083** |
| near carriageway | 0.0674 | 0.0702 |
| far carriageway | 0.0782 | 0.0991 |
| **band-to-band spread** | 0.2669 | **0.3064** |

Carriageways barely moved — correct, they were already asphalt. The
separation came from the surfaces that had been wrongly wearing it.

### ROAD GATE — **NOT FAIRLY JUDGEABLE FROM THE EXISTING CAMERAS**

Projecting the cross-section through the production camera: **the whole 52 m
of street compresses into 49 pixels**, and the near footpath, kerb and gutter
together occupy about **5 px**. Every other camera in the set —
`entrance`, `ground`, `hero` — looks *up* at the building; the road is at or
below the bottom of frame.

So the honest verdict is not PASS or FAIL: **no camera in this project sees
the street surface at an angle that could resolve it.** The materials are
verifiably different (measured above), and that difference cannot be judged
by eye from any frame that currently exists. Recorded rather than claimed.

### NOT DONE IN E

**Lane markings — MISSING.** Identified in the inventory, not authored.

### F — NOT STARTED, DELIBERATELY

The matrix is 10 midday + 5 morning + 5 afternoon + 3 cloud ≈ **23 renders at
4–5.5 min each**, plus per-frame assessment and three root-cause fixes.
Starting it here would have produced a half-run gate, which the brief
explicitly rates as worse than a completed E.

Anti-GTA **NOT RUN** · source-world daylight gate **NOT RUN**.

### NEXT EXACT ACTION

1. **Add a street-surface camera** before judging the road — something at
   ~1.6 m eye looking *along* the kerb line, not up at the building. Without
   it the road gate cannot be answered at all.
2. **Lane markings** — the one inventory item still missing.
3. **F0 solar audit** — find how `SUN_ELEV` / `SUN_AZ` are authored before
   inventing morning/afternoon angles.
4. **F** — full matrix. The festoon audit is still overdue at all three sun
   states; it has only ever been seen at 46°.

---

## CHECKPOINT — D4 CLOUDS CONVERGED; E AND F NOT STARTED

**CURRENT COMMIT** this one · source gate **not run** · nothing exported · no
runtime change.

### THE CAUSE WAS THE COORDINATE, AND THE HYPOTHESIS WAS RIGHT

The field was driven by `Texture Coordinate > Generated` through a Mapping
node. Generated is the object's bounding box normalised 0..1, so every feature
size was a fraction of an arbitrary domain — and a camera looking up through
the layer crosses only a few percent of that box. **The field was varying; the
visible slice sampled a fraction of one cycle of it and resolved to a single
smooth value.** That is why nine bracket renders were invariant to both
density and scale: changing the cycle count over a slice narrower than one
cycle changes nothing.

Now driven by `Geometry > Position` in **world metres**, divided by an explicit
feature size. `body = 780` means a mass about 780 m across — checkable against
a photograph of the sky. `scale = 14` was not.

Second change that mattered as much: the breakup field now **SUBTRACTS** from
the body rather than multiplying it. A multiplicative mask only ever thins a
sheet into fog; a subtractive field cuts holes right through it, and the holes
are what make sky.

### PROOF, NOT INFERENCE

Rendered the whole 14 km domain from outside, where nothing can hide in a
small sampled patch:

- `cloud-field-light.png` — discrete scattered masses with open sky between
- `cloud-field-moderate.png` — connected broken cover, irregular edges,
  readable depth

The two presets differ in **spatial occupancy**, not opacity: different
`body`, `brk`, `erode` and `cover`. LIGHT is scattered puffs; MODERATE is a
broken field. That satisfies the preset rule explicitly.

### CLOUD GATE

| criterion | verdict |
|---|---|
| CLEAR — architecture works | **YES** (`cloud-est-clear.png`) |
| LIGHT — architecture works | **YES** (`cloud-est-light.png`) |
| MODERATE — architecture works | **YES** (`cloud-est-moderate.png`) |
| open sky between structures | **YES** |
| world-scale perspective / depth | **YES** |
| irregular edges | **YES** |
| one apparent sun | **YES** — sun untouched, still 1 lamp |
| game / fantasy cloud read | **NO** |
| LIGHT vs MODERATE distinct | **partial — see below** |

**The one honest shortfall:** at the *establishing* camera, LIGHT reads as
near-clear. The visible sky there is a narrow 15–26° band in the gaps between
buildings, and scattered cloud simply misses that sightline. Raising `cover`
from 0.52 to 0.455 did not change it. The distinction is fully proven in the
domain overview and at MODERATE in the production frame, but **LIGHT vs CLEAR
is not separable from this one camera**. That is a property of the camera, not
a defect in the field — recorded rather than tuned away, because forcing cloud
into that band would stop LIGHT being light.

Cost: establishing with volume is **~5.5 min** vs ~4 min clear. Acceptable for
three gate frames; it would be expensive across a full 20-frame matrix.

### STATE

C closed · D1–D3 already correct (audited) · **D4 converged** ·
**E untouched** · **F untouched** · anti-GTA **NOT RUN** · source gate
**NOT RUN** · nothing exported · runtime untouched.

### NEXT EXACT ACTION

1. **E** — road material. Inventory first (surface / material / texture source
   / scale / CC0 status) for road, gutter, kerb, footpath, median, ramp, haul
   route, soil, markings. Existing CC0 sets are asphalt, brick, concrete,
   ground, ply — state plainly if something is genuinely missing.
2. **F** — the matrix. Note the festoon has still only ever been judged at 46°.
3. Keep cloud renders to the three gate frames; do not put volume on all 20.

---

## ADDENDUM — CAMERA FAR-CLIP BUG FIXED; CLOUDS BUILT BUT **NOT CONVERGED**

### A REAL BUG, FOUND BY THE CLOUD WORK

**`L.camera()` never set `clip_end`, so every camera in this project has been
running Blender's default 1000 m far clip.** The far context ring tops out
near 430 m so it survived, and nothing in any previous render was affected —
verified: an establishing render before and after the fix is identical to four
decimal places on all three measured zones. But a cloud layer at 680–1240 m
altitude lies 1400–2600 m out along the sightline, i.e. **entirely beyond the
plane**. It was being built correctly and then clipped away, which renders as
a perfectly clean empty sky and looks exactly like "clouds don't work".

Now `clip_start 0.05 / clip_end 40000`.

### CLOUDS — BUILT, WIRED, REACHING THE CAMERA, NOT YET CONVINCING

`L.clouds()` exists with `CLOUD_LIGHT` / `CLOUD_MODERATE`, opt-in behind
`--clouds light|moderate` and **defaulting to none**, so no existing render is
affected and the clear sky remains the baseline.

Verified working: object, material, `Volume` link, density chain, and the
layer is inside the clip range. Density and threshold demonstrably control it
— at `cover 0.34 / density 0.25` it produces a solid overcast slab.

**What it does NOT yet do is produce discrete cloud forms with open sky
between them.** Across nine test renders spanning three brackets:

| bracket | result |
|---|---|
| density 0.15 → 0.25 | solid opaque sheet / black slab from beneath |
| density 0.08 | uniform grey veil |
| scale 9 / 14 / 22 | still uniform veil — feature size did not change the read |
| density 0.002 / 0.005 / 0.010 at scale 14 | still a smooth veil |

The symptom is invariant to both density and feature scale, which is the
useful clue: if it were a tuning problem, scale would have changed the
structure and it did not. **The prime suspect is the texture coordinate**
— `Texture Coordinate > Generated` through a Mapping node may not be varying
per-sample inside the volume, leaving the noise near-constant over the sampled
region. Next attempt should drive the noise from **`Geometry > Position`
(world space, metres) instead of Generated**, which removes the object-space
assumption entirely and makes the noise scale directly readable in metres.

**D4 is NOT closed. Do not report clouds as done.**

### STATE

C closed · D1–D3 satisfied (audited, already existed) · **D4 open** ·
**E untouched** · **F untouched** · anti-GTA **NOT RUN** · source gate
**NOT RUN** · nothing exported · runtime untouched.

---

## CHECKPOINT — CONTEXT CLOSED; SKY AUDITED AND HALF OF IT ALREADY EXISTED

**CURRENT COMMIT** this one · source gate **not run** · nothing exported · no
runtime change. Delivered: **Part C**, and **Part D1–D3 by audit**.

### C1 — THE WORST CONTEXT OBJECT, AND ITS ACTUAL CAUSE

**OBJECT** the `context_city` street-terrace blocks — the mid-tier mass at
`x = -52` filling the left edge, and its mirror at the right.
**SCREEN** cols 0–95 and 690–720, rows ~150–345. **TIER** mid (52–72 m).
**WHY IT LOOKED FAKE** a flat evenly-lit ochre plane: no openings, no
parapet shadow, no material break. At 70 m the eye reads a building by its
opening rhythm; with none, a mass has neither scale nor function.

**ROOT CAUSE — not "needs more detail".** `context_city`'s docstring promises
*"its facade carries a WINDOW RHYTHM from the brick shader"*, and
`city_facade()` does build exactly that — but it was only ever called in the
**procedural fallback branch** of `standard_materials()`. The moment the CC0
sets landed, `city_warm` / `city_cool` became plain brick and concrete
photographs. **The city silently lost its windows the day CC0 was switched
on**, and no amount of photographic grain supplies rhythm.

Two further defects surfaced while fixing it, both real:

1. **The brick node was fed raw world position.** It samples the `x,y` of its
   vector, so on a facade perpendicular to X, `x` is constant across the whole
   face and **height never enters the pattern**. The output was vertical
   stripes with no floor lines — a barcode, not a facade. It now receives
   `(x + y, z)`: along-face whichever way the block is turned, and storey
   height as the second axis.
2. **Cell/mortar polarity disagreed with the roughness map.** The roughness
   ramp has always assumed cell = glazing (smooth) and joint = wall (rough);
   only the colours said the opposite. An earlier attempt to invert this
   turned a neighbour black, but the cause was **proportion, not polarity**.
   Blender shrinks a brick by the mortar on *both* sides, so mortar over half
   the cell degenerates to solid mortar — which is what a 1.15 mortar against
   a 2.0 cell produced: a flat pale wall. Sized as a real facade — a
   **3.4 × 3.2 m bay less 2 × 0.9 m of pier and spandrel, leaving a
   1.6 × 1.4 m opening, ~21% dark** — it reads as punched windows.

Implemented as new `ctx_warm` / `ctx_cool` keys so the **near neighbours are
untouched** and keep their photographic sets and modelled openings.

| zone | before mean/std | after mean/std |
|---|---|---|
| far-right context block | 0.1247 / **0.0148** | 0.1524 / **0.0647** |
| far-left context block | 0.3152 / 0.1712 | 0.3409 / **0.2033** |
| brick neighbour (control) | 0.3784 / 0.1741 | 0.3803 / **0.1733** |

Far-right variation **×4.4**; the control is unchanged, which is the proof the
near tier was not touched.

**C2 — not performed.** One targeted intervention was budgeted and spent; the
second is a judgement to make against a fresh establishing frame.

### D1 — LIGHTING AUDIT: THE BRIEF'S PREMISE WAS HALF WRONG

The brief states "NO NISHITA, NO CLOUDS". Measured from the built scene:

| | measured |
|---|---|
| SUN lamps | **1** — energy 5.0, angle 0.545°, rot (44.0, 0.0, 18.0) |
| World | `TEX_SKY` **sky_type = NISHITA** |
| Nishita sun_disc | **False** |
| Nishita sun_intensity | **0.0** |
| Nishita elevation / rotation | 46.0° / 18.0° |
| Background strength | 0.16 |
| HDRI | **none** |
| Other lights | 9 POINT + 2 SPOT (festoon / task) — not solar |
| View transform | AgX, exposure 0.0 (−0.35 at render) |

**Nishita is already the sky basis.** The Sun lamp's `rot.x = 44°` is exactly
elevation 46°, and `rot.z = 18°` matches Nishita's rotation — they agree — and
with `sun_disc = False` and `sun_intensity = 0` Nishita contributes **no direct
sun at all**. There is exactly **one solar shadow source** and no possibility
of a double sun.

**So D2 and D3 are already satisfied. D4 (clouds) is the only genuinely
missing part of Part D.** Anyone starting the sky work should not "add
Nishita" — it is there, correctly wired, and adding a second sun is the
specific mistake this audit exists to prevent.

### NOT DONE

**D4 clouds · E road material · F matrix, top-three, anti-GTA, source gate.**
Untouched, not half-built. Anti-GTA and source-world gates **NOT RUN**.

### NEXT EXACT ACTION

1. **D4 only** — clouds. Do not touch the sun or re-add Nishita. Add a
   volumetric layer driven off the existing world, author `CLOUD_LIGHT` and
   `CLOUD_MODERATE`, verify architecture holds under both.
2. **E** — road material inventory, then asphalt/kerb/gutter/footpath/haul
   identity with contact wear only where process causes it.
3. **F** — midday full matrix, morning/afternoon critical five, festoon audit
   at all three (still only ever judged at 46°), cloud matrix, top-three, then
   the anti-GTA call.

---

## CHECKPOINT — GROUND AND MOBILE-LIFT GATES CLOSED; C–F NOT REACHED

**CURRENT COMMIT** this one · source-world gate **not run** · nothing exported ·
no runtime/Three.js/Vercel change.

Scope delivered: **Parts A and B only.** Context ran out before context/sky/
road/pre-final gate. Those are untouched, not half-done — see NEXT ACTION.

### A1 — GROUND APERTURE DIAGNOSIS

Measured through the production camera, not guessed:

| zone | mean |
|---|---|
| hoarding band | **0.257 – 0.282** |
| **ground floor above hoarding** | **0.064** |
| gate reveal | 0.157 |

**Nothing was blocking the aperture.** The gate is already 12.8 m — **124 px**
of frame width — and the opening above the hoarding is clear. The cause is
light: the sun at 46° penetrates **4.4 m** of a 34 m deep floor, and from a
1.70 m eye at 70 m the sightline over a 2.4 m hoarding sits at **z 2.68 m at
the facade, 3.00 m at mid-plot**. The sunlit strip is *below* that line. So
every part of the ground floor the camera can see is unlit depth, and a lit
band with a hole 4× darker above it reads as sealed.

Contents could never have fixed this. At 70 m they do not resolve.

### A2 — GATE REVEAL: TESTED AND REJECTED

12.8 m already exceeds what the authored flows need (one vehicle, material,
pedestrians, hoist). Widening it would cut the hoarding run and the gate is
not the constraint — the *light* is. **Rejected on its own stated condition.**

### A STRUCTURAL DEFECT FOUND WHILE MEASURING

**Ground-floor columns stopped at z 5.00 against a level 1 soffit at 7.60 —
2.60 m short, floating.** `GROUND_H` is the storey's clear height, but the
level loop puts level 1 at `GROUND_H + STOREY_H`, so the ground storey is
actually 7.9 m floor to floor. Column height now derives from the slab.
Fixing it also puts 7.2 m of sunlit concrete in the visible zone.

### A3 — TEMPORARY SITE LIGHTING (a real luminaire WAS required)

A 34 m deep floor with a 7.2 m head and no facade cannot be worked on
daylight, and real sites hang festoon and stand task lights. Implemented as
**equipment, not fill**: a catenary of 9 caged lamps on a visible cable down
the haul route — the receding line of points is the depth cue — plus 2 tripod
floods at the unloading bay and hoist base. **Every luminaire has a visible
fixture. There is no invisible fill light in this world.**

### A4 — GROUND BAND BEFORE / AFTER

| zone | before | after | delta |
|---|---|---|---|
| **GF above hoarding** | 0.0638 | **0.1535** | **+141%** |
| GF whole (rows 260–344) | 0.1354 | **0.2009** | +48% |
| gate reveal | 0.1565 | 0.1955 | +25% |
| GF ÷ hoarding contrast | 0.25× | **0.59×** | — |
| **sky** | 0.6744 | **0.6744** | **+0.0001** |
| L1 | 0.2005 | 0.2100 | +0.009 |

Sky unchanged to four decimals and L1 essentially flat: the change is local to
the ground floor, which is the proof it is not a global brightening.

**GROUND GATE — PASS.** Sealed black stripe **NO**. Active entry/logistics
space legible **YES**.

### B — DECK RECEIVING, AND WHAT IT ACTUALLY WAS

Re-aimed off the boom axis, then closer, to a three-quarter view at deck
height. But re-aiming alone never closed it, and two real defects were behind
that:

1. **The bundle was 0.16 m BELOW the deck it was landing on.** A hook at
   30.5 m left only 3.0 m above a 27.46 m deck for rope, hook block, slings
   *and* load. Hook raised to 31.6 m; the chain is now built downward so each
   link lands where the one above ends — rope 30.55→31.60, hook block
   29.90→30.55, slings 29.10→29.90, bundle 28.40→29.10, **clearing the deck
   by 0.94 m**.
2. **The load was plywood on a plywood deck.** The same collapse as blockwork
   on concrete: one material, no separation, unreadable at any distance. It is
   now a **banded rebar bundle** — equally correct for a deck being formed,
   because bars are fixed before the pour, and dark steel against pale
   sheeting.

Rear lane → boom → hook → bundle → deck now reads without decoding, with the
receiver in hi-viz beside the landing point.

**MOBILE-CRANE GATE — PASS.** Stand there YES · outriggers YES · boom clears
YES · radius plausible YES · hook height plausible YES · load relevant YES ·
**landing relationship visually clear YES**.

### CYCLES EVIDENCE

`logistics2-establishing`, `-entrance`, `-hoist`, `-lift`, `-deck`. Ordinary
daylight, no bloom/DOF/fog/LUT/grain.

### NOT REACHED THIS MILESTONE

**C context massing · D sky/Nishita/clouds · E road material · F pre-final
Cycles gate and the morning/midday/afternoon matrix.** No work started on any
of them, so there is nothing half-finished to unpick. The anti-GTA and
source-world daylight gates were **not run** — running them without C–E would
have produced a verdict about a world that is not finished, which is worse
than no verdict.

### KNOWN WEAKNESS

1. Festoon is the first artificial light in the world; it has not been checked
   at morning or afternoon sun, only midday-ish 46°.
2. Boom remains a large near-field object in `deck`; the relationship reads
   but the frame is boom-dominant.
3. Crane carrier detail is coarse — fine at 35 m, would not hold at 10 m.
4. Context massing, flat sky and road material all still outstanding.

### NEXT EXACT ACTION

1. **Part C** — render `establishing`, name the single worst massing block,
   fix that one, re-render. Do not rebuild the city.
2. **Part D** — Nishita with the existing single sun, then restrained cloud;
   two covers (broken / moderate).
3. **Part E** — asphalt/kerb/gutter/footpath/haul identity with contact wear
   only where process causes it.
4. **Part F** — then the 10-frame gate at morning/midday/afternoon, top-three
   fixes, and only then the anti-GTA call.

---

## CHECKPOINT — SITE LOGISTICS: HOIST REBUILT, GROUND AUTHORED, LIFT FROM THE REAR

**CURRENT COMMIT** this one · source-world gate still FAIL · nothing exported ·
no runtime/Three.js/Vercel change.

### MAST SYSTEM TYPE — IT WAS THE WRONG MACHINE

**SYSTEM TYPE** rack-and-pinion **construction hoist** (was: mast-climbing
work platform). **PRIMARY FUNCTION** vertical transport. **CARRIES** people and
material to seven floors. **FLOOR INTERFACE** landing platform, gate and edge
protection at each served level.

Those are different machines. An MCWP runs a long deck along a facade so
trades work *on* that facade, and needs no landings because nobody gets off.
This site cannot use one — the street elevation is already fully scaffolded,
which is the exact face an MCWP would need. With no tower crane, what the site
needs is vertical transport. A hoist.

### ORIGINAL DEFECTS, AND ONE CORRECTION TO THE PREVIOUS AUDIT

| defect | measured |
|---|---|
| party-line oversail | **1.28 m** over the neighbour |
| site-boundary oversail | **1.53 m** onto the public footpath |
| scaffold overlap | 2.75 × 0.93 m over 25.41 m of height |
| wall standoff | 1.89 m, where a machine should be tight |
| landings | **none** — a car stopping in mid-air beside a slab edge |
| platform orientation | faced **away** from the building |

**Correction:** the previous checkpoint recorded "no ties". That was wrong.
Ties existed at z = 6, 12 and 18 m — but `run = 1.9 m` against a 3.09 m gap,
so they **stopped 1.89 m short of the facade and held nothing**. A tie that
reaches nothing is arguably worse than an absent one, because it looks solved.

### NEW POSITION AND CLEARANCES — ALL MEASURED FROM THE BUILT OBJECTS

Mast centreline **(7.6, −20.4)**, east of the gate so material lands beside
the machine that lifts it.

| check | result |
|---|---|
| party line 10.85 | **+1.35 m inside** |
| hoarding −21.40 | **+0.10 m inside** |
| bay standards 6.6 / 8.6 | 0.25 m each side |
| car travel clash, all systems | **0 — TOTALCLASH 0** |

Cleared: scaffold, ties, slabs, beams, columns, infill/blockwork, hoarding,
edge beam, base fence, staging. **This settles the bounding-box question the
audit left open** — it is now a swept-envelope test over the car's full
0.20 → 27.70 m travel, and it is clean.

**TIE LEVELS** slabs 1, 3, 5 and a head tie at 6 (≈6.6 m apart), landing on
slab edges with a bracket. The frame splays to **±0.95 m** against a 1.50 m
car: inboard, the ties sat *in the travel path*, which was the original defect
reproduced. **LANDING LEVELS** 1, 2, 4, 6 — following the work, not the floor
count. Gates stand open only at 2 (blockwork front) and 6 (forming deck);
3 and 5 are reached from the stair core. A gate that is always open is not a
gate.

**SCAFFOLD INTERFACE** one full bay between the standards at 6.6 and 8.6 is
left open. The standards stay because they frame the opening; ledgers, boards
and guard rails stop at the bay and return; both bay edges are guarded,
because an opening in a working platform is an edge. Blockwork also stops
clear of the bay — you cannot build the envelope across the opening the hoist
lands in.

### GROUND LOGISTICS — FOUR FLOWS, NOT A PROP CATALOGUE

**VEHICLE** ramp → gate → unloading bay on the existing haul strip.
**PEDESTRIAN** a barriered corridor held against the west party wall, which
never crosses the vehicle route. **MATERIAL** unloading bay → staging → hoist
base, west to east on one line — which is *why* the hoist sits east of the
gate. **WASTE** floors → hoist → skip beside the hoist → out the gate; the
rear-yard skip is a separate flow.

### MOBILE CRANE — THE STREET SETUP WAS NOT VIABLE

The previous checkpoint recorded a conceptual street-side setup at ~14 m
radius. **Re-measured, it is impossible.** The scaffold stands 25.6 m directly
between any street position and a deck set back 4.5 m:

| crane stands at | boom height at the scaffold line | verdict |
|---|---|---|
| y −22 | 8.6 m | through scaffold |
| y −30 | 18.1 m | through scaffold |
| y −60 | 25.5 m | through scaffold |
| **required** | — | **y −75, i.e. 75 m back** |

So it works from the **rear laneway**, which carries no scaffold.

**REFERENCE** proportioned on the **Liebherr LTM 1055-3.2** family: 3 axles,
55 t class, telescopic boom 10.2 → 40 m, 12 t ballast — those four from
published listings. The outrigger base (6.3 × 6.4 m) and transport envelope
are **CONCEPTUAL/REPRESENTATIVE**, not manufacturer figures.

**SETUP** (0.0, 26.4) — moved from 27.0 because at 27.0 the outrigger *mats*
reached 30.93 and overhung the far kerb at 30.40. **OUTRIGGER ENVELOPE**
footprint y 22.48…30.33, inside the carriageway 22.00…30.40. **RADIUS** 10.4 m.
**BOOM** 29.7 m at 70.7°. **HOOK** 30.5 m. **LOAD** a banded bundle of formwork
ply for the deck being formed at level 6, hanging ~1 m clear. **LANDING**
the L7 forming deck. Clearances: L6 slab edge **+3.4 m**, deck edge **+1.4 m**.

Two bugs found and fixed by render evidence, not by reading:
- **Boom sections were rotated `boom_deg − 90°`**, putting every section 20°
  *below* horizontal — three orange bars sticking sideways out of the
  building. Correct value is `atan2(dz, dy) = 109.3°`.
- **Open landing gates were flung 18 m east.** `M.prism` returns geometry
  already in world space, so setting `.location` translated it a second time.
  Gates are now built at the origin and hung.

### CYCLES EVIDENCE

`logistics-hoist`, `-entrance`, `-lift`, `-deck`, `-establishing`, `-ground`.
Ordinary daylight, no bloom/DOF/fog/LUT.

### GATE RESULTS

**MAST GATE — PASS.** Boundary trespass NO · neighbour oversail NO · footpath
oversail NO · scaffold collision NO · building ties YES · landing gates YES ·
clear travel path YES (0 clashes) · ground access YES · floor alignment YES.

**GROUND GATE — PASS on four, FAIL on the fifth.** How people enter YES · how
material enters YES · where material goes YES · how the hoist is served YES ·
how waste leaves YES. **Does it still look like a dark empty void at 70 m —
YES, it does.** GF moved only 0.1305 → **0.1335 (+2.3%)**. It reads as an
operating site at the gate camera and remains the darkest band in the
production frame. Recorded, not dressed up.

**MOBILE-CRANE GATE — PASS on six, one qualified.** Can it stand there YES
(footprint inside the carriageway) · outrigger space YES · boom clears
building/scaffold YES (+3.4 / +1.4 m) · pick radius plausible YES (10.4 m,
55 t class) · landing point plausible YES · load relevant YES. **Does it look
like a real urban lift — QUALIFIED:** the crane and boom read as machinery,
but the `deck` receiving frame puts the boom between lens and load, so the
landing itself is not legible in that view.

### KNOWN WEAKNESS

1. Ground floor still 0.13 at 70 m — authored, legible up close, invisible far.
2. `deck` camera framing: boom occludes the load it is landing.
3. Hoist landings exist at 1/2/4/6 but no access stair links 3 and 5 to them.
4. Crane carrier detail is coarse — reads at 35 m, would not at 10 m.

### NEXT EXACT ACTION

1. Re-aim `deck` so the load, the receiver and the deck edge read without the
   boom across them.
2. Ground floor at distance: the openings, not the contents, are what 70 m can
   see — test a taller/wider gate reveal and a lit unloading bay mouth before
   adding any more objects.
3. Then far-left context → sky → road material → multi-angle Cycles gate.

---

## CHECKPOINT — HERO GATE **YES**; LUFFING JIB **REJECTED BY SITE GEOMETRY**

**CURRENT COMMIT** this one · source-world gate still FAIL (that is the later
multi-angle/anti-GTA gate, not the hero gate) · nothing exported · no
runtime/Three.js/Vercel change.

Option C as directed: the setback was not touched, the scaffold was not
lowered further, and the construction story was carried by the real cues.

### EVERY NUMBER BELOW IS MEASURED, NOT ESTIMATED

Level bands were derived by projecting the street facade through the actual
production camera (`-35.9, -69.6, 1.70` → `1.0, -3.0, 13.0`, 35 mm, 720×450),
so "L1" means rows 224–260 and nothing is being eyeballed:

| level | z | screen rows |
|---|---|---|
| L7 | 27.7 | 20–52 |
| L6 | 24.4 | 52–86 |
| L5 | 21.1 | 86–120 |
| L4 | 17.8 | 120–154 |
| L3 | 14.5 | 154–189 |
| L2 | 11.2 | 189–224 |
| L1 | 7.9 | 224–260 |
| GF | 4.6 | 260–296 |

That projection also settles the crown argument exactly: **L7 deck lands at row
71.5, scaffold top at row 68.4 — 3 px of occlusion.** Not a judgement call.

### L1 — THE ROOT CAUSE WAS MATERIAL IDENTITY

`build_infill` was building blockwork out of `mats["conc"]`. **The envelope and
the frame carrying it were physically the same surface**, so no distance or
lighting could ever separate wall mass from structure. It was never a
brightness problem.

A `block` material now exists. First attempt used the **brick** CC0 set tinted
grey and made L1 *darker* — `tint` in `cc0()` is a MULTIPLY, so tinting a dark
red brick photo grey yields something darker than concrete. **Measured at
−0.019 mean, and reverted.** It now uses the concrete set at a genuinely
lighter albedo (`0xDCDAD2`, +0.20 roughness): dry-laid clean blockwork against
a frame that has stood through months of rain is a real ~1.5× albedo
difference. Coursing was not pursued — a 225 mm course subtends **0.6 px** at
this camera.

| band | before | after | delta |
|---|---|---|---|
| **L1** mean | 0.1530 | **0.1820** | **+19%** |
| **L1** p90 | 0.4381 | **0.5252** | **+20%** |
| L2 mean | 0.2152 | 0.2226 | +3.4% |
| GF mean | 0.1241 | 0.1305 | +5% |
| hero overall | 0.3168 | 0.3227 | +1.9% |

### L2 — RACKED LEADING BAY

A gang leaves the end of a run **racked back** so the next section toothes in.
Three stepped courses at the leading bay. A wall that stops in one clean
vertical line is a wall that was drawn, not built — and the rake is the only
cue at 70 m that says *which* level the envelope gang is standing on.

### L3 — UNCHANGED, DELIBERATELY

Reviewed and left alone. It already carries slab edges, the downstand
grillage, columns and the 4.2 m prop grid, and the boards are struck there.
Task 3 said not to add objects unless they improve the read; nothing did.

### L4 / L5 — FALSEWORK NOW MEANS SOMETHING

`build_soffit_forms`: **a falsework level still has its soffit formwork up.**
That is what "falsework standing" means — the props are holding the deck the
slab was cast on, not holding air. This closes the recorded weakness that L5,
L6 and L7 shared an identical 1.8 m prop grid: L5 now has ply against the
soffit and L4 does not. The props already terminate at exactly `z − 0.35`, so
they bear on it correctly with no adjustment.

Honest limit: at the establishing camera the forms sit behind the 0.7 m
edge beam and register **+0.0001**. They read in the stack and rear frames.
Kept because it is structurally correct and fixes a real weakness, not
because it moved the 70 m needle.

### L6 / L7 — GEOMETRY UNCHANGED

Not enlarged, not moved, not re-tuned. Per direction, the crown was not made
to carry work it cannot carry from one distant low camera.

### HERO GATE — **YES**

| criterion | verdict |
|---|---|
| LOWER: more enclosed / mature | **PASS** — was the weak one; blockwork now separates from frame |
| MID: open structural work | **PASS** |
| UPPER: temporary support / forming | **PASS** |
| TOP: active incomplete deck | **FAIL** — 3 px, explicitly deprioritised |

Whole image: it reads as a real structure at different stages of an active
process. Three of four criteria pass and the fourth is the 3-pixel crown the
brief said not to hold the hero hostage to. **Marginal pass, recorded as
marginal.**

### STRONGEST REMAINING HERO WEAKNESS

**The hero is still value-dark against its neighbours** — 0.32 against 0.35,
and L1–L4 sit in a flat 0.18–0.22 band. The ground floor at **0.13** is the
darkest thing in the frame and is the one band never authored: ground-floor
logistics remains the oldest outstanding item.

---

## LUFFING-JIB VALIDATION — **REJECTED BY SITE GEOMETRY**

No crane geometry was built. Measured from the generated world, not from notes.

### MEASURED WORLD

| element | x | y | z |
|---|---|---|---|
| party walls | −10.85 … 10.85 | −17.00 … 17.00 | 0.20 … 27.90 |
| slabs L1–L6 | −11.00 … 11.00 | −17.00 … 17.00 | 7.60 … 24.40 |
| set-back deck L7 | −10.60 … 10.60 | **−12.00** … 16.60 | 27.14 … 27.46 |
| street scaffold | −11.42 … 10.62 | −19.82 … −18.48 | 0.00 … **25.60** |
| mast climber | 7.87 … **12.13** | **−22.93** … −18.89 | 0.19 … 27.77 |
| hoarding (site boundary) | −12.20 … 11.00 | −21.60 … −21.40 | 0.20 … 2.60 |
| core | 3.88 … 10.12 | 7.88 … 16.12 | 0.20 … **31.30** |
| stair | −10.11 … −4.89 | 8.89 … 16.11 | 0.20 … 29.10 |
| road ribbon | −320 … 320 | −84.00 … −17.60 | −0.60 … 0.38 |
| cabin / skip (rear compound) | −3.05 … 8.10 | 18.36 … 23.30 | 0.20 … 2.80 |

Derived: **front strip 4.40 m** (1.34 m of it scaffold), **rear yard 6.30 m**,
plot width 21.70 m with slabs spanning the **full** width at every level.

### CANDIDATE A — REAR / REAR-CORNER MAST · **REJECTED**

The only real ground. Fails on reach, not on footprint. From a rear base the
crane must reach the far street corner of a 22 × 34 m plot:

| base | far plot corner | L7 deck centre |
|---|---|---|
| (−7, 20) rear corner | **41.1 m** | 32.8 m |
| (0, 20) rear centre | **38.6 m** | 32.0 m |

That demands a ~45–50 m luffing jib for a 22 m frontage — and a luffing jib's
minimum radius (~10–14 m, CONCEPTUAL/REPRESENTATIVE, no manufacturer figure
claimed) would blank out the rear third of the site *it is standing in*.
It would also sterilise the entire logistics compound: cabin, skip and
material stacks all measured inside that 6.30 m yard.

### CANDIDATE B — SIDE / RECESS MAST · **REJECTED — NO SUCH ZONE EXISTS**

Slabs span x −11.00 … 11.00 at every level and party walls sit at ±10.85, hard
against both boundaries. There is no side yard, no recess and no setback on
either flank. Not "tight" — **absent**.

### CANDIDATE C — INTERNAL / CORE-ADJACENT MAST · **REJECTED**

Requires a void through L1–L6 plus the L7 deck. The only two voids are CORE and
STAIR, and both are **already occupied by concrete walls built ahead of the
frame** to 31.30 m and 29.10 m. Creating a new void is a structural/
architectural change, explicitly out of scope.

### DECISION

**LUFFING-JIB REJECTED BY SITE GEOMETRY.** Retain **mast climber / hoist +
periodic mobile-crane operations**.

This does not overturn the concept — it *validates* it. `concept_c.py` has said
since line 19 that there is "no room for a crane pad." That was an assertion.
It is now measured.

**Mobile-crane setup** (recorded, not modelled): street side, on the ramp/gate
opening at x −6.4 … 6.4, y −19 … −23, lifting over the hoarding. Reach to the
L7 deck centre from a street stand at y ≈ −26 is ~14 m horizontal at 27.5 m
lift — within a city crane's chart for formwork tables and rebar bundles.
Road ribbon confirmed available from y −17.60 outward.

### MAST-CLIMBER AUDIT — THREE DEFECTS FOUND

Measured, not rebuilt, per instruction:

1. **Oversails the party line by 1.28 m** — extends to x 12.13 against a
   boundary at 10.85. It is over the neighbour's land.
2. **Oversails the site boundary by 1.53 m** — reaches y −22.93 against
   hoarding at −21.40. It stands on the public footpath.
3. **Bounding-box clash with the scaffold: 2.75 m (x) × 0.93 m (y) × 25.41 m
   (z).** Bounding boxes, so a mesh-level check is still owed before calling it
   a hard intersection — but an overlap over 25 m of height is not incidental.

Also: standoff to the nearest facade is **1.89 m**, where a mast climber is
normally tight to the wall it serves. It cannot be, because the scaffold
already owns that face. **No tie geometry and no landing gates exist at any
level.** Landings were listed as verified work in an earlier prompt; they were
never built.

### NEXT EXACT ACTION

1. Resolve the mast climber: pull it inside both boundaries, close the scaffold
   clash, and author ties + landing gates. It is the one piece of site
   machinery the hero depends on and it currently trespasses twice.
2. Author **ground-floor logistics** — the 0.13 band, the darkest thing in the
   production frame and the oldest outstanding item.
3. Then the mobile-crane setup zone as real geometry.
4. Only then far-left context → sky → road material → multi-angle Cycles gate.

---

## CHECKPOINT — SCAFFOLD STRUCK BACK; HERO GATE STILL **NO**, FOR A MEASURED REASON

**CURRENT COMMIT** this one · source-world gate still **FAIL** · nothing
exported · no runtime/Three.js/Vercel change · crane **NOT REACHED** (gate
said no, so the crane was not started — by the rule, not by running out of
room).

### THE PREVIOUS DIAGNOSIS WAS WRONG, AND THAT MATTERED

`f23f4ca` recorded the cause as *"full-height scaffold with debris mesh across
the entire street elevation."* **There is no debris mesh in this world and
there never was** — `mats["screen"]` appears exactly once, on the ground-level
hoarding. Had this session started by deleting mesh it would have deleted
nothing and reported a fix.

The real occluder was **boarding**, and the arithmetic is unambiguous:

| boarded lift | z | storey it cut |
|---|---|---|
| 2 | 4.0 m | (below L1) |
| 4 | 8.0 m | **L1** |
| 6 | 12.0 m | **L2** |
| 8 | 16.0 m | **L3** |
| 10 | 20.0 m | **L4** |
| 12 | 24.0 m | **L5** |

`lift % 2 == 0` put one full-width plywood band across *every single storey
from L1 to L5* — one per floor, at the exact spacing that erases the thing the
stage system had just built. It was also the source of the "identical floors"
read: six identical bands at a perfectly regular rhythm.

### SCAFFOLD CHANGE

Boards are not cladding. They are a consumable a site owns a finite number of
and they sit under a gang's feet. This job runs **two gangs**, so the platforms
now sit in two bands with struck scaffold between them:

```
L7  27.7   OPEN      set back — no scaffold, crown against sky
L6  24.4   OPEN      set back — no scaffold
L5  21.1   BOARDED   22, 24      frame gang: forming and pouring
L4  17.8   BOARDED   20
L3  14.5   OPEN                  struck — frame visible through the lattice
L2  11.2   BOARDED   12, 14      blockwork gang: the active infill front
L1   7.9   OPEN                  struck — the 66% blockwork now reads
```

Standards, ledgers and ties stay: they are structure. Three further
corrections, all of them construction logic rather than visibility:

- **Transoms carry boards.** A full set at every lift meant 156 tubes
  screening the elevation to hold up platforms that are not there. Struck with
  their boards, leaving the sparse set at tie lifts: **156 → 68 (56% struck)**.
- **Toe boards added** at boarded lifts; guard rails already followed the
  boards, so edge protection now exists only where there is an edge to fall off.
- **The scaffold was tied to nothing for its top 4.7 m.** It stood to 29.1 m
  against a street elevation that stops at 24.4 — levels 6 and 7 step back
  4.5 m. Now `street_top + 1.2 = 25.6 m`. A scaffold is tied to a building;
  where the building steps away, the scaffold stops.

### STRUCTURAL CHANGE

Chosen deliberately over soffit and core (the core already runs full height to
31.1 m; a bare soffit plane adds a surface, not a read):

- **Downstand beam grillage** — a 300 mm flat plate does not span a
  7.5 × 10 m grid. This frame always needed beams, and their absence is most
  of why each floor read as a slab edge with nothing behind it: there was
  genuinely nothing behind it. Three longitudinal on the column lines (stopped
  where they run into a core) plus two transverse. They are also what the
  back-props bear on.
- **The un-poured half of L6 is now a FORMED DECK, not a hole.** You form a
  deck before you pour onto it, so it carries ply on soldiers, a stop-end
  shutter standing proud of the slab it retained, and strongbacks. The L6
  starter bars used to float above the void; they now stand on that deck.
- **BUG: every staged pallet, block cube and rebar bundle in this world floated
  300 mm.** `M.slab(z)` puts the slab TOP at `z`, and `build_staging` used
  `z + 0.30`. Material now takes the surface it rests on, which for the top
  level is the formwork deck at `z − 0.24`.

### CROWN CHANGE — BUILT, VERIFIED, AND STILL NOT VISIBLE AT 70 m

`build_crown` puts real temporary works above the slab line on the top deck:
edge shutters standing proud, 16 mm starter cages, two already-boxed columns,
and a guard rail on the open edge. Nothing is oversized — **no fake scale**.

Verified physically correct in the **rear** frame (`crown-rear-verify.png`),
which is the one production camera whose elevation has no setback.

**It does not read in the establishing frame, and the reason is geometric, not
a modelling failure.** From a 1.70 m eye at 70 m:

| element | y | height | elevation angle |
|---|---|---|---|
| street facade head | −17.0 | 24.4 m | **23.3°** |
| L7 crown (set back 4.5 m) | −12.0 | 27.5 m | **24.1°** |
| scaffold top (nearest to camera) | −18.5 | 25.6 m | **25.1°** |

The crown clears the facade it stands behind by only **0.8° ≈ 10 px**, and the
scaffold — 6.5 m nearer the lens — still subtends a *higher* angle than the
crown does. Lowering the scaffold by 3.5 m was not enough and lowering it
further would cost the working-lift cluster that is currently doing the
narrative work.

**The blocker is now architectural: the 4.5 m setback at `SETBACK_FROM = 6`.**
That is settled design and was explicitly out of scope to redo, so it is
recorded rather than changed.

### STACK BEFORE / AFTER

`hero-stack-before.png` → `hero-stack-struck.png`. Three stack renders this
session (the process gap the recovery audit found is closed): pass 1 after the
stage/beam/crown work, pass 2 after the transom strike, pass 3 after the
scaffold height correction. **Props, downstand beams and slab depth now read;
the transom strike was near-invisible** (transoms are foreshortened at this
angle) — correct construction and cheaper geometry, but it was not the screen.

### ESTABLISHING BEFORE / AFTER

`establishing-staged.png` → `establishing-struck.png`. The before/after is
unambiguous at crop: **six evenly-spaced identical bands marching up the whole
elevation → an irregular three-band arrangement** with a live working cluster
at the top, an open middle where the frame and slab edges show through, and
the blockwork front lower down. The scaffold now narrates the sequence.

### HERO GATE — **NO**

Judged honestly against the stated criteria:

| criterion | verdict |
|---|---|
| LOWER: more enclosed / mature | **weak** — L1 blockwork is open now but still dark |
| MID: open structural work | **YES** — strongest single gain |
| UPPER: temporary support / forming | **YES** — boarded working cluster |
| TOP: active incomplete deck | **NO** — crown built but geometrically occluded |

The specific failure recorded at `f23f4ca` — *"a scaffolded stack of identical
floors"* — **is fixed and proven**. The gate is still NO because the crown does
not carry to the production camera. Narrower failure, measured cause.

**Gate NO ⇒ the crane was not started.** No measurement pass, no candidate
evaluation, no geometry. Task 6 deliberately untouched.

### KNOWN WEAKNESS

1. Per-level construction states remain illegible at 70 m; only the scaffold's
   two-gang narrative survives that distance.
2. Crown invisible at the establishing camera — the setback, measured above.
3. L1 blockwork is open to view but reads dark; "enclosed/mature" is not yet
   carried at 70 m.
4. Levels 5, 6 and 7 still share an identical 1.8 m prop grid (carried over).
5. L6 staged material straddles the pour front and takes the poured-side
   surface for both halves — up to 300 mm out on the formed side.

### NEXT EXACT ACTION

The next move is a **decision, not an implementation**, because the blocker is
now settled architecture:

- **(a)** Reduce or remove the top-two-level 4.5 m setback so the crown can
  silhouette — an architecture change to work that was ruled out of scope.
- **(b)** Drop the scaffold to ~23.6 m (top platform at lift 11) so the crown
  clears by ~1°. Small, honest gain; costs the top working-lift cluster.
- **(c)** Accept that at 70 m the hero narrates through the **scaffold**, and
  spend the remaining hero effort making the open bands read harder — starting
  with weakness 3, the L1 blockwork.

Recommendation: **(c)**, then re-gate. It is the only one that neither reopens
settled design nor weakens what this session proved works.

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
