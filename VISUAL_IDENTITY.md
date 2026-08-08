# Visual identity — what makes this product look like itself

Companion to `DESIGN_DIRECTION.md`. That document set the *feeling*. This one
answers the harder question:

> If someone saw one screenshot with the logo removed, how would they know this
> product belongs to us?

No CSS is written until this is answered. Research → decision → implementation →
verification.

---

## 1. What the artifact says about itself

Before importing any taste, I measured how the five surviving sections actually
build structure.

| section | hairline rules | card-like surfaces |
|---|---|---|
| Attention | 0 | 6 |
| Business Health | 4 | 4 |
| Pipeline | 2 | 1 |
| Activity | 1 | 1 |

### A hypothesis I had, and the measurement killed it

I expected to find that the sections which read best (Pipeline, Activity) were
rule-based and the generic-feeling ones were card-based — a tidy "rules good,
boxes bad" story.

**That is false.** Attention is the strongest section on the page and it is the
*most* card-based of all five. The measurement does not support the tidy story,
so the tidy story is discarded.

### What the measurement does show

Two findings, both evidenced:

**1. The page speaks three structural languages with no rule governing which.**
Attention and Business Health are surfaces; Pipeline and Activity are rules; the
chart is a third thing (inherited panel chrome). Nothing decides when something
becomes a surface. That — not cards themselves — is why the page reads assembled
rather than designed.

**2. Elevation currently carries no meaning.** `--ui-elevation-1` appears
exactly twice in the entire Dashboard, both times on `:hover`. The product has a
four-step elevation system and uses it as a hover effect. Depth is spent on
feedback, never on hierarchy.

That second finding is the opening. An elevation system nobody is using
semantically is a whole expressive channel sitting unused.

---

## 2. The identity

Three signatures. Each is defensible, none is borrowed.

### Signature 1 — The Indian numeral as display type

Confirmed in code, not just inferred from a screenshot: `utils/currency.js`
formats with `locale: "en-IN"`.

That means every figure in this product groups as **`₹2,55,000.00`** — a
2-2-3 rhythm — where every Western SaaS shows `₹255,000.00`, a 3-3-3 rhythm.

This is the single most distinctive thing on the screen and it is free, honest
and already correct. Nobody in the reference set — Stripe, Linear, Vercel,
Raycast — displays a lakh-grouped figure, because none of them is built for this
market. Set at display scale with tabular figures and a properly handled `₹`,
that numeral is recognisable at a glance and impossible to mistake for a
US-market dashboard.

**The identity is not a colour or a shape. It is a number system.**

Treatment: display optical size, tabular figures, tracking tightened as size
grows, `₹` optically reduced and baseline-raised so the digits carry the mass,
and the decimal pair de-emphasised so `2,55,000` reads before `.00`.

### Signature 2 — Elevation as a claim, not a decoration

One rule, applied everywhere, no exceptions:

> **A surface is raised if, and only if, it holds something the user can act on
> right now.**

- Attention rows — raised. Each *is* an action.
- Business Health — raised. It is the one diagnostic the page exists to deliver.
- Pipeline rows — flat, rule-separated. A scannable list of things that are fine.
- Activity — flat. History cannot be acted on.
- Finance Trend — flat, rule-bounded. It is context, not a decision.
- Empty states — inset. A well, not a card.

This *explains the page's existing good instincts* rather than overriding them,
and it converts an unused elevation ramp into the mechanism that tells a user
where to look. It also means a screenshot has visible depth structure:
two raised objects near the top, quiet rule-work below. That silhouette is
recognisable.

### Signature 3 — Warm light on warm ground

The existing neutral ramp is warm (`#5f6461`, `#f6f6f4` — measurably warm-grey,
not slate). Every product in the reference set runs cool: Vercel's pure
neutrals, Linear's blue-greys, Stripe's cool slate.

Keeping the warmth and then lighting *consistently with it* is the third
signature:

- shadows carry a trace of the indigo accent, never neutral black
- raised surfaces take a 1px top edge highlight — the edge catching the light
- two shadow layers: a tight contact shadow and a wide ambient one

A cool product with black shadows is the default. A warm product with
accent-tinted shadows is a decision, and it is visible in a screenshot even
when you cannot name what you are seeing.

---

## 3. Skills consulted — adopted and rejected

| source | adopted | rejected, and why |
|---|---|---|
| **Taste** | Anti-default discipline; colour-consistency lock; shape as a *system* not a constant; no serif by default; contrast check on every control state | Its warning against purple as a default — **does not apply here**. Our indigo was chosen by elimination against measured status hues in F-01/F-02 and is protected by a build-gated check. Documented rather than silently ignored. |
| **Impeccable** | Mode is **Operate**: scanability and the real usage scene outrank expression; brand lives in precise details | Its implication that expression should be minimal. Resolved rather than obeyed — see the disagreement below. |
| **UI/UX Pro Max** | Direct-label chart series instead of a legend; keep chart chrome subordinate | — |
| **Emil Kowalski** | 150–300ms; ease-out entrances; no springs on chrome; transform/opacity only; focus never animates | Spring physics for section entry. Springs describe direct manipulation; nothing here is dragged. |
| **21st.dev** | Nothing | Eight results at 0.50–0.54 confidence, rationales that were keyword matches, corpus dominated by stat-card grids and gradient area charts. Recorded in `DESIGN_DIRECTION.md` as a negative result. |

### The disagreement, resolved explicitly

**Impeccable (Operate mode) says expression must not outrank scanability. The
brief asks for premium, substantial, expensive.**

These genuinely conflict, and averaging them produces a timid page — which is
exactly what exists today.

**Resolution:** expression is permitted *only* in channels that do not cost
scanability, and is forbidden in channels that do.

- **Permitted:** material, light, shadow, typographic scale, numeral treatment,
  rhythm of negative space, motion timing.
- **Forbidden:** layout novelty, asymmetric composition, decorative elements,
  colour used non-semantically, anything that adds a lookup step.

That is why the identity above is a *number system*, an *elevation rule* and a
*lighting temperature*. Not one of the three costs a millisecond of scanning,
and all three are visible in a screenshot. Impeccable's constraint is honoured
in full; the brief is satisfied through the channels it leaves open.

---

## 4. External research

Reasoning from published principles, not from fetched pages. Where I am relying
on general knowledge rather than a verified source, I say so.

- **Apple HIG** — clarity, deference, depth; content over chrome; depth
  communicates hierarchy rather than decorating. Directly supports Signature 2.
- **Material 3** — elevation is tied to surface *role*, and tonal elevation can
  substitute for shadow. Adopted in principle; its tonal-elevation mechanism is
  **rejected**, because a warm ramp tinted by elevation drifts toward the status
  hues the F-02 gate protects.
- **IBM Carbon / Atlassian** — token discipline, one meaning per token, no
  ad-hoc values. Already this project's practice.
- **Stripe / Linear / Raycast / Vercel / Arc** — studied as *anti-references*
  for the specific purpose of not resembling them. All five run cool neutrals;
  four of five are box-composed; none displays a lakh-grouped figure. The
  differentiation strategy above is derived from where they collectively are
  not.

**Negative research, stated:** I did not find an external source that resolves
the Impeccable-versus-brief tension. That resolution is my own judgement,
recorded above as such, at the bottom of the source-of-truth order.

---

## 5. Material system

Five materials. Every surface belongs to exactly one.

| material | when | lighting | edge | radius | shadow |
|---|---|---|---|---|---|
| **Canvas** | the page ground | faint vertical luminance shift | none | — | none |
| **Raised** | holds an action or the diagnostic | 1px top edge highlight | hairline | 16px | contact + ambient, indigo-tinted |
| **Inset** | empty states, grouped controls | none | none | 12px | inner, very low alpha |
| **Interactive** | rows, controls | inherits parent | hairline on hover | 10px | none at rest |
| **Overlay** | tooltips, menus | edge highlight | hairline | 12px | ambient only, stronger |

No glass, no blur, nothing translucent — this surface is read in daylight and
sometimes outdoors, and the product's own trade-off rules put legibility first.

---

## 6. Type system

Ten roles, each with an optical purpose. Sizes are settled in V2 against both
scripts.

`Display` · `Hero Numeral` · `Section` · `Title` · `Body` · `Supporting` ·
`Caption` · `Micro` · `Label` · `Metric`

Two constraints carried from existing work:

- **Gujarati parity.** The metric-matched face and its `unicode-range` loading
  are untouched. Every new step is verified in both scripts before it ships —
  tracking tuned on Latin can wreck Gujarati conjuncts.
- **`Metric` and `Hero Numeral` are tabular**, always. A figure that shifts
  width as it animates is a figure the eye cannot compare.

---

## 7. Verification contract

No visual unit ships without: lint · build · Playwright + axe ≥370 · detector ·
token audit including the finance/status gate · shell diff · leak probe with
**zero descendant change on unmigrated routes** · the four Dashboard probes ·
responsive matrix · both motion modes · screenshot review · `git diff --check`.

Any new colour is measured for contrast and hue-collision before it ships. Any
new elevation is checked against the material table above.

---

## 8. Status

Identity defined. `DESIGN_DIRECTION.md` V1–V6 remains the implementation order,
now grounded in the three signatures above.

**V1 — Material foundation** is next: the five materials, the elevation rule,
the lighting temperature and the radius system as tokens, applied without any
layout change.

Not started in this session. Remaining context could not complete V1 *and* its
verification, and the stopping rule is explicit: never partially migrate.
