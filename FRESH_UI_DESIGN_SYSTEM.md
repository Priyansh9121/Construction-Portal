# Fresh UI Design System — Construction Portal V3

> **Status:** direction locked, foundation in progress.
> **Programme:** the fresh design programme begun 2026-08-07 from checkpoint
> `839b67b`. This supersedes the archived UI v2 experiment, which is reference
> material and explicitly not the design reference for this work.
> `DESIGN_SYSTEM.md` documents the V1 system and is retained as history.

---

## 1. The direction contract

Recorded before implementation, per Impeccable's new-work flow. Roll key
`51c046ef`, mode `operate`, assigned index 6 of the re-derived grounded list.
The user selected the assigned direction and then constrained it further; both
the assignment and the constraint are binding.

**THESIS**
You always know where you are, whose work this is, what needs attention, and
what happens next. It refuses the arrangement this category always ships:
sidebar, page header with one primary button, a row of stat cards, a chart,
then the table.

**OWN-WORLD**
The information architecture of an environmental wayfinding programme, wearing
the visual personality of a modern premium product. Wayfinding supplies
orientation, zoning, hierarchy and the pictogram grammar. It supplies **no
colour and no signage styling**. Personality comes from a light content canvas,
near-black ink, one non-semantic accent, depth built from elevation and layered
light rather than heavy shadow, and confident typography carrying the hierarchy.

**STORY**
A supervisor opens the product outdoors, in glare, mid-task, and knows within
one glance which site is theirs and what is unresolved. An owner opens the same
product at a desk and sees the money and the exceptions without hunting.

**FIRST VIEWPORT**
Where-am-I is answered by type and position, never by a coloured band. The live
figures that matter are the largest thing on screen. The register runs edge to
edge. The primary action sits where the thumb already rests on a phone, and
where the eye lands on a desktop.

**FORM**
Wayfinding IA + premium product surface. Candidate 6 of the grounded list.
Seed key `51c046ef`.

**FINISH**
unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, and DESIGN.md

---

## 2. What wayfinding does and does not decide

This split is the whole point of the direction and must not blur.

| Wayfinding decides | Wayfinding does NOT decide |
|---|---|
| Orientation: where am I, in what zone, at what depth | Colour of anything |
| Zoning: which routes belong together and read as one place | Textures or materials |
| Hierarchy of what to read first, second, third | Iconography style beyond "one consistent grammar" |
| Progressive disclosure: what is deferred until asked for | Surface treatment or elevation |
| Pictogram consistency | Type personality |
| Directional logic of transitions | Motion easing or duration |

Zone identity is expressed through **typography, spacing, grouping, composition
and motion**. Never through coloured boxes. A zone that needs a colour band to
be recognisable has failed its typography.

---

## 3. Colour

### 3.1 The reserved-hue problem, and why the accent is what it is

The status scale already owns five hue families, and the user's directive bans
three of them as branding outright:

| Hue | Owned by | Available as brand? |
|---|---|---|
| Red | `status-danger` | **No** — banned by directive |
| Amber | `status-warning` | **No** — banned by directive |
| Green | `status-success` | **No** — banned by directive |
| Blue | `status-info` (running / active) | **No** — already semantic |
| Slate | `status-neutral` (draft / archived) | **No** — already semantic |

**Defect inherited from V1:** `--accent` is `blue-600` while `--status-info-*`
is `blue-500/700`. The primary action and the "running" status are the same hue
family, so a primary button and an active badge read as the same signal. V1's
token file carries a comment about a related collision that was only partly
resolved. V3 separates them.

The brand accent is therefore chosen **by elimination, not by preference**:
indigo, the one family not carrying semantic load. This is the justification
standard the taste guidance demands — a reason no other hue could satisfy. It is
executed as a deep, desaturated indigo, not a glowing AI-purple, and it is used
under a **Restrained** strategy: neutrals plus one accent, on the primary action,
the focus ring, and identity. Not on surfaces, not on cards, not scattered.

### 3.2 Roles

- **Canvas:** near-white, warm-neutral. Light is not a style choice here; it is
  an accessibility requirement recorded in PRODUCT.md, because a phone screen
  cannot out-emit the sun and must rely on reflectance contrast.
- **Ink:** near-black at three emphasis steps. Hierarchy comes from ink weight
  and scale before it comes from anything else.
- **Accent:** indigo. Primary action, focus, identity. Nothing else.
- **Status:** the five semantic families, unchanged in meaning from V1, and
  never reused decoratively. Every status keeps a text label; state is never
  signalled by colour alone.
- **Depth:** achieved with layered surfaces, hairlines and light, not with
  heavy drop shadows.

---

## 4. Typography

IBM Plex Sans variable is already self-hosted at 66 kB with zero network
requests, and it carries the Latin and Latin-Extended ranges the product needs
today. It stays for the foundation.

**Open item:** PRODUCT.md records a confirmed commitment to a bilingual
English + Gujarati interface. IBM Plex Sans does **not** cover the Gujarati
script. Gujarati coverage requires an additional face, which is an asset
decision with a real weight cost. This is recorded as an open decision rather
than silently ignored, and no bilingual claim is made in the UI until it is
resolved.

Hierarchy is carried by scale, weight and spacing. Numerals are tabular
everywhere a figure can change or be compared, so columns do not shift.

---

## 5. Motion

Motion is a design language here, not decoration, and every animation must be
justifiable in one sentence: hierarchy, storytelling, feedback, or state
transition. Motion that cannot be justified is removed.

**Non-negotiable rules**, drawn from the user's directive, PRODUCT.md and the
motion guidance:

- Exits resolve faster than entrances.
- Everything is interruptible. Motion never blocks input.
- Only `transform` and `opacity` animate. No layout-triggering properties.
- Financial figures never animate in place.
- No permanent loops: no ambient shimmer, no continuous pulse, no endless
  background motion, no `requestAnimationFrame` loop on an operational page.
- Hover feedback never moves the interaction target.
- Dense data does not overshoot or bounce.
- Reduced motion is a fully designed mode, not a disabled one. It preserves
  information and hierarchy, stays polished, and removes parallax, large
  transforms, non-essential stagger and all continuous motion.

---

## 6. Icons

The existing `public/icons.svg` sprite is extended, in one pictogram grammar.
No icon-library runtime dependency is introduced. This was an explicit conflict
with the taste guidance, which bans hand-rolled icons and mandates a library;
the user's dependency freeze wins, and the conflict is recorded rather than
hidden.

---

## 7. Migration strategy

Controlled, never destructive. No route may be left unstyled or half-migrated.

1. Build the V3 system alongside V1 under its own cascade layer.
2. Migrate the shell and shared primitives.
3. Migrate complete route groups, verifying each group before the next.
4. Prove old classes have zero consumers, using the inventory tooling.
5. Delete obsolete CSS only after that proof.

Tokens are namespaced `--v3-*`, parallel to the retired `--v2-*`, so both
systems can coexist during migration without a specificity fight and without
`!important`.

---

## 8. Baseline this programme must not regress

Measured at `839b67b` on 2026-08-07:

| Measure | Baseline |
|---|---|
| Lint | 0 problems |
| Build | passes |
| Playwright | 314 passed, 0 failed |
| axe | 44 passed, 0 failed |
| Contrast, gated pairs | 57 checked, 0 failing |
| CSS bundle | 115.77 kB / 19.76 kB gzip |
| JS entry | 464.68 kB / 149.59 kB gzip |
| Routes | 28 registered, 0 unregistered |

Every one of these is a gate, not a target. A phase that regresses any of them
is not complete.

---

## 9. Open decisions

Carried forward, unresolved, and not to be invented:

1. **Gujarati type coverage** — required by a confirmed product commitment, not
   satisfied by the current face. Needs an asset decision.
2. **Tenancy intent** — multi-tenant schema, but whether multiple firms will
   genuinely sign up is unestablished. Affects onboarding, empty states and
   whether the shell needs a company affordance at all.
3. **Product name and identity** — "Construction Portal" is a working name.
   No logo or wordmark exists.
