# Architecture

Operational reference for the frontend. Backend architecture, deployment and
environment setup live in `DEPLOYMENT.md`.

---

## Stack

React + Vite. Plain CSS with native cascade layers — no CSS-in-JS, no Tailwind.
Framer Motion for component motion, Recharts for the finance chart, Playwright
+ axe for the test suite.

---

## CSS generations — the current state

The stylesheet tree contains **four generations, all live**:

| tree | generation | status |
|---|---|---|
| `styles/core/` | original | legacy; still serving unmigrated routes |
| `styles/components/`, `styles/pages/` | original | legacy; per-page styling |
| `styles/v2/` | second system | live; page-level consumers remain |
| `styles/system/` | current | the design system |

Ordered by `@layer legacy, v2-*, system-*` in `src/index.css`, so the current
system wins without `!important`.

**Deleting a legacy stylesheet is only safe once its consumers are rebuilt.**
`styles/pages/tenders.css` cannot be removed before Tenders is migrated, or the
route loses its styling. The CSS reset therefore happens per route group, as
each is rebuilt — not as a single up-front deletion.

---

## Behavioural contracts

Class names and attributes that JavaScript, tests or the browser depend on.
**Renaming any of these breaks behaviour, not just appearance.** Each is
documented at its definition site; this is the index.

| contract | owner | why it is load-bearing |
|---|---|---|
| `.command-backdrop`, `.modal-backdrop` | `hooks/useDismissableOverlay.js` | queried to arbitrate Escape precedence — the palette outranks any open dropdown, so one Escape closes the palette and leaves the dropdown open |
| `.command-modal` | `components/CommandPalette.jsx` | focus-trap boundary |
| `.sidebar-scrim` | `components/Sidebar.jsx` | drawer dismissal |
| `.app-sidebar` | queried in JS | drawer measurement |
| `inert` on the sidebar wrapper | `layouts/AppLayout.jsx` | removes the off-canvas drawer from the accessibility tree below 1024px; must be a JS attribute because `inert` is not media-queryable |
| `view-transition-name` on `.page-content` | `styles/system/shell/page-content.css` | route transitions; its keyframes still live in `styles/v2/core/motion.css` |
| `data-material` | `styles/system/core/material.css` | elevation is applied from **state**, so it can be revoked when an object stops needing judgement |
| `data-scheme="dark"` | `components/auth/AuthScene.jsx` | the scene declares its own environment; `auth/scene.css` answers it by re-pointing the semantic tokens, which is what makes `.ctl`, `.field`, focus and status correct on dark with no auth-specific copy of any of them |
| `.auth-shell`, `.auth-card`, `.auth-brand`, `.auth-submit`, `.password-input-wrapper`, `.password-toggle-btn`, `.auth-success`, `.auth-confirm__body` | `components/auth/AuthShell.jsx` and the four auth pages | 22 Playwright assertions. `.auth-card` has not described a card since 2025 and does not now — it names the form column |

### Authentication — scene and transition

Authentication is the only cinematic surface. `styles/system/auth/scene.css`
owns a five-layer architecture — sky, distance, structure, rig, veil — each
with one responsibility. The **veil** is the legibility guarantee: it darkens
toward the content side so form contrast is measured against a known value
rather than against whatever pixel sits behind it, which means changing the
artwork is not a fresh accessibility audit.

Inline SVG, not video/GIF/canvas/WebGL. **The scene must never be a
precondition for signing in** — canvas needs JS to paint, video needs a request
and a decode, WebGL needs a context and a shader compile. SVG paints with the
first frame of HTML.

Ambient motion is one element: the crane, 48s per sweep, `transform` only. The
rig layer sits **behind** the structure layer, which is the opposite of the
list's reading order and the physically true arrangement: a tower crane stands
among the buildings it is raising. Drawn over them, the mast read as a bright
scratch ruled down a silhouette.

**The scene's geometry is arithmetic, not composition by eye.**
`preserveAspectRatio="slice"` crops, and what it crops is derivable:
`scale = max(cw/1600, ch/900)`. The tightest real case is the 768px band at
ratio 2.74, which sees only the bottom 583 units, so nothing essential sits
above `y = 340` or outside `x = 200..1400`. The first version was composed
without that arithmetic and cut the crane's apex off the screen at 1440x900.

**Two properties, not one.** `--auth-artwork` is how tall the drawing is;
`--auth-band` is how much vertical room the layout must yield to it. They are
equal on a phone and deliberately unequal on a short one, where the sky covers
the viewport while the band is zero. Collapsing them into a single number
pushes the form a full screen down.

### Authentication — the working surface

Two materials, and the reason they are drawn the way they are is a measurement:
**on a dark ground, fill cannot carry elevation.** Every plane colour that still
reads as dark measures 1.08–1.23:1 against the veiled scene. So `--auth-plane`
(raised, holds the action) and `--auth-well` (recessed, receives input) are
separated by an **edge** — `VISUAL_IDENTITY` Signature 3 arriving where a dark
surface finally makes the lit top edge structural rather than decorative.

The form is raised, and that is the elevation rule applied rather than
suspended: it is the only thing on the screen that can be acted on. The
previous direction's ban on "a card on a gradient" was right about the cliché
and wrong about the mechanism.

The controls are `foundation/interaction.css`, not auth copies of it. Being its
first real consumer is what surfaced three foundation defects: `.field`
inherited its font size and so missed the 16px iOS-zoom floor; `.field` was not
in the focus-ring selector; and both `.ctl` and `.field` inherited margin from
the legacy bare-element rules, which put a 44px gutter between every label and
its control.

**`utils/authTransition.js` makes "authentication never waits for animation"
structural rather than a discipline.** `runAuthTransition(commit)` calls
`commit` synchronously, before a frame is scheduled — token storage, role
resolution and navigation all happen there. Every failure path (no View
Transitions support, a thrown transition, a missing callback) has already
committed. The module never sees a role or a route, so the grammar is identical
for Admin, Manager, Worker and Subcontractor and there is no branch to add one
to.

**The dark→light moment resolves through continuity, not a cross-fade.** The
scene's structural lines and the shell's hairlines are the same visual
language, so the veil lifts, the ground lightens from `--auth-sky-deep` to
`--ui-canvas`, silhouettes fade — and the linework is deliberately given no
transition at all. The light comes up on structure that was already there. The
sky is not pure black and the canvas is not pure white, precisely so neither
end is a flash.

`tools/fresh_ui/auth_transition_probe.mjs` asserts all of it in both motion
modes. `tools/fresh_ui/auth_screenshots.mjs` captures all four routes at nine
widths in both modes, because assertions on this surface have repeatedly passed
while it was visually wrong.

### Motion — the spring rule

**Springs are permitted only where the pointer is *continuously* driving the
object when motion begins.**

A spring models momentum, and momentum comes from the user's own input — a
finger that was moving when it let go. A selection indicator has none: it moves
because a click *ended*. Overshoot there invents physics that never happened,
which on an instrument reads as imprecision.

Nothing in the product qualifies today — no drag, no swipe-to-dismiss, no
pull-to-refresh — so **no spring token exists**. One is added when a draggable
surface ships, not before.

Everything else is timed easing, in `foundation/interaction.css`:
`--t-instant` (focus, 0ms) · `--t-grip` (90ms) · `--t-attach` (140ms) ·
`--t-place` (200ms) · `--t-deliberate` (260ms). Nothing in the operational
application exceeds 260ms; auth owns its own timings.

Curves are directional: `--e-place` decelerates on arrival, `--e-dismiss`
accelerates away, `--e-state` for changes with no travel.

### Focus — one treatment, every material

Two rings. The accent carries it on light surfaces; a contrast companion
separates it from whatever is beneath, so it survives canvas, raised, inset,
overlay and the dark auth scene **with no route-specific override**
(`[data-scheme="dark"]` inverts the companion).

`outline`, never `box-shadow` — outline is not clipped by an ancestor's
`overflow: hidden`, which dense rows and attention cards both use. Inside a
clipping row the offset turns inward rather than disappearing.

**Focus is never animated.** `tools/fresh_ui/interaction_probe.mjs` asserts all
of this across four materials in both motion modes.

### Structure — the hairline rule

**Hairlines belong to zones, not to rows.**

`styles/system/foundation/structure.css` owns the grammar. Three weights, not
interchangeable:

- `--rule-frame` — a compartment's outer boundary. One per compartment.
- `--rule-zone` — between two *different kinds* of thing.
- `--rule-row` — between repeated instances of the *same* kind. The quietest,
  and the only one permitted to repeat.

`.zone + .zone` collapses the shared border so adjacent compartments never
render a 2px seam. `.rows--dense` drops the row line entirely above roughly
forty records, where a repeated line becomes static.

Below 48rem compartments lose their frame and keep only a top rule: the
reasoning is unchanged — one line still separates one kind of thing from the
next — but an enclosure inside an enclosure leaves no content width at 390px.

Shape is `--shape-sharp` for compartments, `--shape-control` for anything a
finger acts on, `--shape-pill` only for genuine compact state. Square corners
on touch targets were rejected: the priority user operates this outdoors,
one-handed.

### Script safety — the tracking rule

**Tracking belongs to chrome. It is never applied to content.**

Wide letter-spacing pulls Gujarati conjuncts apart; negative tracking
compresses them. Both break the script.

`:lang(gu)` cannot be the guard on its own: `index.html` declares `lang="en"`
and Gujarati arrives as **inline data** — a site name, a worker's name, a
material description typed on site — with no lang attribute, and the backend
that would supply per-field language metadata is frozen.

So the rule is enforced by *where* tracking is permitted, in
`styles/system/foundation/type.css`:

- `--type-track-chrome` — UI strings the application owns. `:lang(gu)` zeroes it.
- `--type-track-figures` — digits only, which are never Gujarati.
- Everything else, including display and section headings, is untracked.

`tools/fresh_ui/gujarati_type_probe.mjs` proves it at 390 / 768 / 1440,
including a measurement that tracking genuinely distorts Gujarati (+23px on a
146px string) so the rule is demonstrated rather than assumed.

Monospace is scoped to mechanical values — timestamps, identifiers, sheet
references — and never renders content: IBM Plex Mono has no Gujarati coverage,
so a Gujarati string inside a mono run falls back mid-line.

Roughly 93 distinct selectors are referenced by `tests/` and
`tools/fresh_ui/`. Run the suite before renaming anything in the shell.

---

## Navigation and role visibility

`src/config/navigation.js` is the single definition of which destinations each
role may see. The sidebar renders it; the command palette derives from the same
function, so the two cannot drift.

**This is visibility, not authorisation.** `RoleRoute` and the backend's
`roleMiddleware` remain authoritative and neither consults that file. Hiding a
destination does not protect it.

`/worker-portal` and `/subcontractor-portal` render **outside** `AppLayout`, so
portal roles never see the shell, sidebar or palette.

---

## Currency

`utils/currency.js` is the only source of formatted money.

- `formatCurrency` — the canonical string
- `formatCurrencyParts` — the same string, segmented for typographic treatment,
  with a guarantee: if the parts do not reassemble to the canonical string
  exactly, the split is abandoned and the whole string renders untreated

Locale is `en-IN`, so figures group **2,55,000**, not 255,000. That grouping is
product identity, not a formatting preference.

---

## Verification

Run from the repository root with the fixture credentials exported.

```
cd frontend && npm run lint && npm run build
cd frontend && npx playwright test        # 370 assertions, includes axe
python3 tools/fresh_ui/token_audit.py     # contrast, hue collision, finance/status separation
```

Runtime probes in `tools/fresh_ui/` (24 files). The load-bearing ones:

| probe | protects |
|---|---|
| `shell_leak_probe.mjs` | **route isolation** — a change to a shared component must not restyle unmigrated routes. Bucket B must stay empty. |
| `shell_style_diff.mjs` | shell surfaces, with every overlay open |
| `dashboard_composition_probe.mjs` | spacing *relationships*, not pixel values |
| `currency_typography_probe.mjs` | Indian grouping and complete values, including negatives |
| `finance_chart_probe.mjs` | Dashboard/Payments palette isolation |
| `navigation_consistency_probe.mjs` | sidebar and palette agree per role |

### Fixture safety — non-negotiable

Shared fixtures may be **read**. A test or probe that resets a password,
consumes a single-use token, changes a role or triggers lockout must **own a
disposable account**. Mutating a shared fixture once caused 128 failures across
unrelated suites.

Probes that need empty or seeded data stub the response **in the browser's
network layer** so no request reaches the API and no fixture is touched.

---

## Data honesty rules

These are product constraints, enforced in code:

- **Never claim a time the source cannot prove.** Workers and sites carry no
  timestamp, so they are excluded from the activity stream rather than sorted
  by row id and called recent.
- **Never imply precision the value lacks.** A date-only timestamp gets a day
  heading, never "42 minutes ago".
- **Money held is never shown as money owned.** Cash position nets off
  outstanding GST and company charge.
- **Status colour is reserved for operational state.** Income is not a success
  and expense is not a danger; `token_audit.py` fails the build if an identity
  colour drifts into a status hue.

---

## Frozen

Backend, APIs, payloads, authentication, authorisation, RBAC, tenant
isolation, schema, migrations, financial calculations and approval workflows.
Frontend presentation may be rewritten; business behaviour may not.
