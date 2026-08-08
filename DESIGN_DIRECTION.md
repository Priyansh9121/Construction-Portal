# Design direction — visual art direction for the Dashboard

Written before any code, as required.

Scope: **visual only.** The information architecture settled by D1–D6 is not
reopened. Attention, Business Health, Finance Trend, Pipeline and Activity stay,
in that order, answering the same five questions. Calculations, routing,
contracts, accessibility guarantees, reduced-motion behaviour and empty-state
logic are all preserved. What changes is how the product *looks and feels*.

---

## 1. Visual thesis

### The problem with what exists

The Dashboard is architecturally right and visually anonymous.

Five sections currently share one treatment: a white rectangle or no rectangle,
a hairline border, a 19px semibold heading, grey supporting text, 32px of space,
repeat. It is *correct*. It is also indistinguishable from every competent admin
template, and it makes no argument for itself. The restraint that was the right
instinct while fixing the information model has become the thing holding the
product back.

Nothing here is broken. It simply does not look like anyone decided anything.

### The feeling to design for

Not delight. Not playfulness. Not "enterprise trust".

> **The confidence of arriving somewhere that has already done the thinking for
> you.**

A user opens this at 7am on a phone in a site office, or at a desk with a
contractor waiting on the line. The emotional target is the small, specific
relief of *knowing where you stand within one second* — and then the sense that
the thing telling you is well made.

Concretely, in priority order:

1. **Certain** — the page states things; it does not hedge or decorate.
2. **Calm** — calm because it is resolved, not because it is empty.
3. **Precise** — every edge, gap and figure looks deliberately placed.
4. **Substantial** — surfaces feel like material, not like divs.
5. **Alive** — responds to the cursor and the keyboard within a frame.

**Explicitly not:** luxurious-as-in-ornamental. This is a working surface used
daily under time pressure. "Expensive" must be earned through precision, not
through gloss.

### The one identity move

This product's subject is **money**. Not projects, not sites — rupees, in lakhs,
belonging to a business that needs to know whether it can pay wages this week.

So the identity is carried by **numerals**. Currency becomes display typography:
optically sized, tabular, tightly tracked, with the ₹ mark handled as a real
typographic problem rather than a character that happens to precede digits.

That is the honest differentiator available here. It requires no imagery, no
metaphor, and no construction theming — which the product direction rules out —
and it is the one element every user looks at every single time.

---

## 2. What the research actually yielded

### 21st.dev — a negative result, reported as such

Searched for premium operational dashboards with an attention list, a single
hero metric, an area chart and an activity timeline.

Eight results, confidence **0.50–0.54**, and the rationales were keyword matches
("Matches dashboard, for, cards") rather than semantic fits. The returned corpus
was marketing heroes, *stat-card* sections, *gradient area charts*, and
*scroll-triggered timeline reveals*.

**The useful finding is what it says about the category.** The available
inspiration for "dashboard" is dominated by exactly the template language this
programme spent six units removing: KPI card grids, decorative gradient fills,
animated stat counters. Nothing in the result set was adopted. It is recorded
here because "we searched and deliberately took nothing" is a real outcome, and
the alternative — reaching for a card grid because the corpus is full of them —
is the failure mode.

### Taste — anti-default discipline

Directly applicable rules, and one trap worth naming:

- **The lila trap.** Taste bans AI-purple as a *default reach*. Our accent is
  indigo `#5d28c8`. It survives that rule specifically because it was **not** a
  default: F-01/F-02 chose it by elimination after measuring every status hue,
  and a gated audit check now fails the build if any identity colour drifts into
  a status hue family. Executed with intent, not reached for.
- **Colour consistency lock** — one accent, whole page, no section inventing its
  own.
- **Shape consistency lock** — one radius *system* with a documented rule, not
  one radius value everywhere and not ad-hoc mixing.
- **No serif by default.** The current sans stack stays.
- **Button contrast check** on every control, both states.

### Impeccable — and the tension it exposes

Impeccable classifies this surface as **Operate**: the visitor completes a task,
so "scanability, consistency, native expectations and the real usage scene
outrank expression. Brand lives in precise details."

That sits in direct tension with a brief asking for "expensive" and "luxurious".

**The resolution, and it governs everything below:** express through **material
and typography**, never through layout novelty. No asymmetric hero, no
break-the-grid composition, no decorative motion. The page keeps its plain,
scannable structure, and every gram of expression goes into how the surfaces are
lit and how the numbers are set. That is also how Stripe and Linear read premium
while remaining boring to *use*, which is the goal.

### Emil Kowalski — motion

- Most UI motion belongs in **150–300ms**. Longer reads as lag.
- **Ease-out for entrances** (things arrive and settle), ease-in for exits.
- **No springs on chrome.** Springs suit direct manipulation; a section arriving
  is not being dragged.
- **Transform and opacity only.**
- **The best animation is the one you don't notice.**
- **Focus must never animate in.** A keyboard user needs it on the frame.

Already largely honoured by D6. What is added is *response* timing: hover should
resolve in ~120ms so it feels attached to the cursor, not narrated.

### UI/UX Pro Max — charts

The applicable principle: **reduce chart chrome and direct-label series instead
of using a legend.** A legend forces a colour→name lookup on every read. Direct
labels at the end of each series remove an entire UI element and a cognitive
step, and they make the chart legible in a screenshot.

This is the one concrete component-level change the research produced, and it is
adopted.

---

## 3. Moodboard

### Lighting

A single implied ambient source, high and slightly left. This is the mechanism
that replaces boxes.

- Raised surfaces get a **1px inner top edge highlight** (white at low alpha) —
  the edge catching the light.
- Shadows are **hue-tinted, never neutral black**: a very low-alpha indigo,
  because a shadow on a warm-white ground picks up the accent in the
  environment. Neutral-black shadows are what make a UI feel like paper cutouts.
- Two-layer shadow: a tight contact shadow plus a wide soft ambient one. One
  shadow reads as a sticker; two read as an object above a surface.

### Materials

Three, and only three:

1. **Canvas** — the page ground. Not flat white: a barely-perceptible vertical
   luminance shift, lightest where Attention lives and settling below. Gives the
   page a top without drawing a line.
2. **Raised** — surfaces that hold a decision (Business Health, the chart).
   Lit edge, tinted shadow.
3. **Recessed** — wells for empty states and grouped controls. Slightly darker
   than canvas, no shadow, no border.

No glass. No blur. Nothing translucent. This is a working surface read in
daylight, sometimes outdoors — legibility outranks the effect, and the product's
own trade-off rules say so.

### Typography

The largest change, and where identity lives.

- **Currency as display type.** The primary figure is set large, tabular,
  tracking tightened, with the ₹ mark optically smaller and baseline-raised so
  the digits — not the symbol — form the visual mass. Indian digit grouping
  (`2,55,000`) is preserved; it is already correct and it is part of the
  product's voice.
- **A real scale, not a ramp of similar sizes.** The current page runs
  32 / 19 / 19 / 19 / 19. That is one display size and one heading size wearing
  five hats. Introduce genuine steps and let the *smallest* text do more work.
- **Micro-labels** ("CASH POSITION") stay small, uppercase, tracked — but gain a
  measured optical size so they read as a considered layer rather than shrunken
  body text.
- **Measure control.** Prose capped near 60–65ch. Rows never stretch a
  three-word fact across 1600px.
- **Gujarati parity.** The existing metric-matched font stack and its
  `unicode-range` loading are untouched. Any new type step must be verified in
  both scripts — a tracking value tuned on Latin can wreck Gujarati conjuncts.

### Colour

- **Neutrals stay warm.** The existing warm-grey ramp is a real asset and is
  kept; it is what stops the page reading as cold-blue admin chrome.
- **Indigo becomes atmosphere, not just link colour.** Permitted as: a faint
  wash behind the attention region, the tint inside shadows, the income series,
  and selection. Still never on a neutral fact.
- **Status stays sacred.** Red, amber and green mean overdue, needs-attention
  and resolved. The F-02 audit gate enforces this and is not weakened.
- **Gradients are allowed but must be atmospheric, not decorative** — a 2–4%
  luminance shift across a surface, never a visible colour ramp. If you can see
  where a gradient starts, it is decoration.

### Spacing and negative space

Rhythm, not grid.

The page currently uses a uniform 32px between all five sections. Uniform
spacing is *even*, but even is not *composed*. Introduce deliberate variation:
generous air above Attention so the page breathes at the top, tight coupling
between a section's heading and its content, and a larger chapter break before
Activity, which is a different kind of information.

Everything from the token scale. One-off values only where a measurement
justifies them, and the measurement recorded.

### Depth and layering

Strictly three z-levels: canvas, raised, overlay. A fourth is how dashboards
turn into stacks of floating rectangles. Elevation must always mean *this holds
a decision*, never *this is a section*.

### Shape language

A rule, not a constant. Currently everything is 12px.

- containers **16px** — larger surfaces need a larger radius to look
  intentionally rounded rather than softened
- controls **10px**
- pills / avatars **full**
- markers (the attention rail) **square** — a marker is not a shape

### Micro-interaction

- Hover resolves in ~120ms, and changes *ink and elevation*, never position.
  **No hover lift** — a row that moves under the cursor is a moving target.
- Focus appears **instantly**, on-frame, and is never clipped by an ancestor's
  overflow.
- Active/pressed gets a 1px optical settle, no scale.
- The timeframe control's selected state moves as a **shared element** between
  options rather than fading — the selection travels, which is what makes a
  segmented control feel physical.

### Charts

- Legend **removed**, replaced by direct end-of-series labels.
- Grid subordinate: fewer lines, lighter, horizontal only.
- Axes lose their spines; ticks carry the structure.
- Area fills become atmospheric (a low-alpha vertical fade), never a saturated
  gradient.
- Curve weight expresses hierarchy: income heaviest, expense lighter, profit a
  hairline dash.
- Tooltip is a real surface with the product's own material, not the library
  default.

### Empty states

First-class, and the rule from D5 holds and tightens: **an empty section must
never occupy more space or more visual weight than a populated one.** Recessed
material, one sentence, one action, no illustration. Nothing is faked — no ghost
charts, no placeholder trends.

---

## 4. Why this is better than what exists

| today | direction |
|---|---|
| Depth from borders | Depth from light — edges and tinted shadow |
| One card treatment repeated | Three materials, each meaning something |
| 32px everywhere | Composed rhythm; space carries hierarchy |
| One display size, one heading size | A real scale with the numeral as hero |
| Accent used only as link colour | Accent as atmosphere, status untouched |
| Chart with a library legend | Direct-labelled series, subordinate chrome |
| Correct but anonymous | Identifiable within one screenshot |

The architecture already answers the five questions. What it does not yet do is
make the user *feel* the answer is trustworthy. Light, material and typographic
authority are how that feeling is produced — and none of them require adding a
single element to the page, which is the constraint that keeps this a visual
pass rather than a redesign.

---

## 5. Constraints this direction accepts

- No new information, no new section, no restored card.
- Accessibility floors hold: 4.5:1 text, 3.0:1 non-text, 44px targets, visible
  focus, semantic structure. Any new colour is measured before it ships.
- Reduced motion stays first-class: no travel, no stagger, content immediate.
- The finance/status separation gate stays green and is not weakened.
- No unmigrated route changes. `FinanceTrendChart` is shared with Payments, so
  every chart change rides the existing `palette` opt-in (F-03, DASH-008).
- No backend, contract, calculation or routing change.

---

## 6. Implementation order

Each unit independently verifiable, gated and committed.

- **V1 — Material foundation.** Elevation, lit edges, tinted shadow, canvas
  gradient, radius scale. Tokens plus the three materials. No layout change.
- **V2 — Typographic identity.** The numeric scale, currency treatment, micro
  labels, measure control. Verified in Latin and Gujarati.
- **V3 — Section composition.** Applying materials and rhythm across the five
  sections; spacing variation.
- **V4 — Controls and micro-interaction.** Hover/focus/active/selected across
  every Dashboard control; the travelling segmented selection.
- **V5 — Chart.** Direct labels, chrome reduction, atmospheric fill, custom
  tooltip. Behind the `palette` opt-in.
- **V6 — Final review.** Full-page at every width, both motion modes, populated
  and empty, screenshot review against the "would this ship" bar.

No code is written until this document is committed.
