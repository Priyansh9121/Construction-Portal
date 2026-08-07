# Fresh UI Master Audit — Authentication

Research and concept for the auth route group. **No implementation code was
written in the session that produced this document.**

Branch `redesign/ui-foundation`, from commit `4ee8ddf`.

---

## 1. Design sources used

### Taste Skill (`design-taste-frontend`)

Working parameters: `DESIGN_VARIANCE 8` · `MOTION_INTENSITY 9` ·
`VISUAL_DENSITY 7`.

**Adopted.** Anti-centre bias above variance 4, which rules out the centred
card. Cards used only where elevation communicates real hierarchy, otherwise
group with space and hairlines. Full interactive state cycles, never the happy
path alone. Tactile `:active` feedback. Button and form contrast audits as
hard gates. Zero em-dashes in any UI copy. One radius system. One accent, used
identically everywhere. Motion must be justifiable in one sentence.

**Rejected, with reason.**
- *Tailwind v4 as the styling default* — the project bans Tailwind. Brief wins.
- *Routing dashboards to Fluent / Carbon / Atlassian packages* — new runtime
  dependencies, frozen.
- *Its own Section 13 scope note* ("not for dashboards, dense product UI,
  multi-step forms") — auth is genuinely the marketing-adjacent surface of this
  product, so its composition guidance legitimately applies **here** even
  though it will not apply to the registers.
- *The hand-rolled-SVG ban and mandatory icon library* — the project has an
  authored sprite and a dependency freeze. Conflict recorded rather than
  hidden; the sprite is extended in one grammar.
- *`VISUAL_DENSITY 7` as written* — density 7 is right for the registers and
  wrong for auth. Auth carries at most six fields. Held at **4** for auth
  specifically, and recorded as a deliberate local deviation rather than a
  change to the global dial.

### Impeccable

Direction contract from `FRESH_UI_DESIGN_SYSTEM.md` (roll `51c046ef`, mode
`operate`, wayfinding IA + premium product surface). Mode for auth is
**Persuade-adjacent Operate**: the visitor is completing a task, but it is the
first surface they ever see, so it must also earn confidence.

**Applied.** "The first viewport is a thesis, not a header." "Prove, don't
claim." Colour strategy chosen before colours: **Restrained** — neutrals plus
one accent — because the visitor came to operate. Light or dark forced by one
sentence of physical scene, which PRODUCT.md already settles: a supervisor
outdoors in glare, so light.

**Rejected.** Impeccable's world mechanism previously dealt catalog worlds
including split-flap boards, cassette-deck fascias and instrument faces. All
are rejected for auth under the standing directive banning signage,
machinery, industrial and engineering-instrument visuals. The wayfinding
assignment survives **only as information architecture**, which is exactly the
constraint the user set.

### Motion guidance (Emil Kowalski principles)

Applied from the motion foundation already committed in
`styles/system/core/motion.css`, which was authored from these principles:
exits faster than entrances, everything interruptible, transform and opacity
only, no overshoot on dense data, no permanent loops, hover never moves the
target, reduced motion designed rather than disabled.

### UI/UX Pro Max

Consulted for enterprise auth patterns, mobile form hierarchy and password
reset UX. **Landing-page patterns explicitly rejected**: hero headlines,
conversion CTAs, social proof, marketing copy. None belong on a sign-in
surface for an operational tool.

*Disclosure: this source was applied as principle rather than through a fresh
database query in this session, because the session's context budget was spent
on the source read and the 21st.dev survey. It should be queried directly
during implementation for dense-form and mobile-form specifics.*

### 21st.dev

Searches run: `premium login authentication form sign in`,
`password input reveal toggle field validation`,
`animated auth loading success state transition onboarding`.

| ID | Name | Author | Useful principle | Classification |
|---|---|---|---|---|
| 1504 | Password Input | kokonutd | Requirement checklist with live per-rule status, not one lumped error | **ADAPT** — fits Reset's 8-char rule |
| 6920 | Password Field | ruixen.ui | Strength meter + checklist in one control | **VISUAL REFERENCE** — strength meter rejected, see below |
| 10260 | Label Input | tom_ui | Floating label with integrated visibility toggle | **REJECT** — floating labels conflict with the visible-label contract |
| 21491 | Login with SSO | ephraimduncan | Toggle placed inside the field, not beside it | **ADAPT** — matches existing `password-input-wrapper` |
| 2677 | Auth Form | bankkroll | One family covering sign-in, sign-up, forgot and reset-success | **ADAPT** — validates treating all four as one system |
| 21494 | Login with Email and Password | ephraimduncan | Minimal field set, reset link near the password | **VISUAL REFERENCE** |
| 20035 / 20036 / 20037 | Auth Section 1/2/3 | solaceui | Split-screen with grain-gradient, AI imagery, testimonial | **REJECT** — split-screen, stock imagery and testimonials are all banned |
| 2464 | Sign up Form | axelwesselgren | — | **REJECT** — generic card on gradient |
| 2429 | login | ephraimduncan | — | **REJECT** — generic |
| 3754 / 2528 / 19097 | Onboarding cards / stages / carousel | various | Staged progress with completion indicators | **VISUAL REFERENCE** for Reset's completion state only; multi-step onboarding is not our flow |
| 10480 | Onboarding Dialog | patrick-xin | Cross-fading content between steps | **VISUAL REFERENCE** |

**No code retrieved.** Free tier allows two retrievals per day; every idea
above is expressible from metadata, preview and video. All candidates assume
Tailwind + shadcn, which the project bans, so retrieval would have produced
unusable source regardless.

**Password strength meter rejected outright.** The backend enforces exactly
one rule: minimum 8 characters. A strength meter would imply requirements that
do not exist, and inventing security theatre on a reset screen misleads the
user about what actually protects the account.

---

## 2. Auth product thesis

> **Signing in to this product is an act of routing, not an act of passing a
> gate.**

This is a product truth, not a metaphor. Four roles resolve to three different
destinations. `getHomePath` exists because `/` means something different per
role. `?next=` already preserves where an expired session was working. The
auth surface is the only place the product decides *where you are going*, and
today it says nothing about that at all.

So the auth world answers the wayfinding questions literally:

| Question | Answered by |
|---|---|
| Where am I? | The product name and the route's own heading, at real scale |
| What am I doing? | One heading verb per route: Sign in, Create account, Reset access, Create new password |
| What happens next? | The submit label states the outcome, not the mechanism |
| Where will this take me? | The destination cue, when `?next=` supplies a known route |
| What state am I in? | Field readiness, submit state, and one resolved status region |

---

## 3. Supporting visual concept — "Approach"

**A quiet directional field that resolves on success.**

Sparse, thin vector paths occupy the open area of the surface. At rest they
run near-parallel with slight divergence, drawn once, then still. They are not
a map, not a diagram, not signage, and carry no labels, no nodes, no grid, no
measurement marks and no scale.

On a successful submit the paths **converge to a single vector** oriented
toward the destination side of the layout, and that convergence *is* the
transition into the application.

**Why this and not the alternatives.** It is the only candidate that visualises
a fact the product actually has — that authentication resolves to a
destination — rather than decorating the surface. It is abstract movement, so
it carries none of the banned vocabulary. It has a genuine resting state and a
genuine resolved state, so it earns its motion instead of looping.

**Constraints it inherits from `StructuralFrame`**, which were correct and are
kept verbatim: draws once with `both` fill and no iteration count; pure SVG
geometry, no image request, no canvas, no WebGL; inside an `aria-hidden`
container with `focusable="false"`; under reduced motion the resolved state
renders immediately with no draw.

**Contrast constraint.** It never sits behind text. It occupies open area
only, at low contrast against the canvas, and no field, label or message ever
overlaps it.

---

## 4. Login — flagship concept

**Two decisions kill the four banned clichés at once.**

1. **No card.** The form sits directly on the canvas. That removes "white
   rectangle on a gradient" structurally rather than by restraint.
2. **No split.** The layout is asymmetric, not bisected. The form column sits
   left of centre at roughly a third of the width; "Approach" occupies the
   remaining open area and bleeds off-canvas rather than living in a bounded
   panel. There is no seam, so there is no split screen.

**Hierarchy, in reading order.** Product name, small and quiet. The route
heading at real display scale, which is the largest text on screen. One line
of orientation copy. The destination cue when present. Status region. Fields.
Submit. Footer links.

**Form width** 384 px at desktop, which holds an email address at 16 px
without wrapping and keeps the eye on one column.

**Forgot-password placement.** Moves from the footer row to sit **beside the
password label**, right-aligned on the same line. That is where the user
realises they have forgotten it, and it removes one of two competing footer
links. `Create account` remains the single footer action.

**Error placement is unchanged.** Above the fields. This is already correct and
already tested; the reasoning in the existing comment is sound and survives.

**Destination cue.** When `?next=` resolves against a fixed allow-list of known
routes, one quiet line renders: `Continuing to Payments`. Never the raw path,
never a query string, no cue at all for an unrecognised value. Presentational
only. See AUTH-009.

---

## 5. Register — concept

Densest auth surface: five inputs plus a select.

**Progressive disclosure is rejected.** Staging five fields across steps adds
navigation to a form that fits on one screen at every width above 320 px, and
hiding fields to look minimal is explicitly not the goal. It would also break
password-manager autofill, which reads a whole form at once.

**Grouping instead of staging.** Three labelled groups separated by space and
one hairline, not by cards: *Who you are* (full name, email) · *Your password*
(password, confirm) · *Your role* (select). Grouping gives the same cognitive
relief as staging with none of the navigation cost.

**Role selection stays a native `<select>`.** Two options do not justify a
custom control, and native select gives correct mobile behaviour, keyboard
support and screen-reader semantics for free. The visible options remain
**worker** and **subcontractor** exactly as implemented. No owner or admin
signup UX is designed; see AUTH-001.

**Confirm-password validation** moves from submit-time to blur-time on the
confirm field, matching the existing message text exactly. Fewer round trips
to the same outcome; the submit-time check remains as the authority.

**Register gains `auth-field` wrappers** to match its siblings (AUTH-008).

---

## 6. Forgot Password — concept

**The invariant response is the design problem, not an inconvenience.**

The screen must feel complete and reassuring while telling the user nothing
about whether the account exists. The failure mode to avoid is a confirmation
so vague it reads as an error.

**Success state.** The form is *replaced* by the confirmation rather than
stacked above it, so there is no lingering field inviting a second submission.
The confirmation states what was done, what to expect, and what to do if
nothing arrives, without ever implying existence:

> **Check your email.** If an account is eligible, password reset instructions
> are on their way. They expire shortly, so use the link soon.

Plus a quiet secondary line offering to try a different address, which returns
the form. **No "account not found" wording exists anywhere in this route.**

**DEV token treatment.** The development reset-token block is visually
quarantined: a distinct bounded region, explicitly labelled as development
only, styled so it can never be mistaken for production UI. It remains behind
`import.meta.env.DEV` exactly as now.

---

## 7. Reset Password — concept

**The 1500 ms redirect is a real designed moment**, and the completion state is
designed to fit inside it rather than extending it.

**Token field.** Pre-filled from `?token=` and still editable, preserving the
`typedToken ?? linkToken` behaviour. When the token arrives from the link it
renders in a **resolved** state: filled, quiet, with a short "from your reset
link" hint, so the user is not asked to think about a field that is already
correct. Focus lands on the new-password field instead. Editing it is always
possible and never gated behind a disclosure.

**Password requirements.** One rule, stated once, up front: at least 8
characters. It resolves from pending to met as the user types. No strength
meter, because the backend has no strength rule.

**Completion state.** On success the three fields are replaced by a single
confirmation with the existing `role="status"`. The redirect timer is
untouched at 1500 ms. Motion budget for the completion state is capped at
**320 ms**, so it finishes well inside the window and the redirect is never
delayed.

---

## 8. Password reveal — recommendation

**Adopt the button pattern on all three routes. Move Reset from checkbox to
button.**

| Criterion | Button (Login, Register) | Checkbox (Reset) |
|---|---|---|
| State semantics | `aria-pressed`, correct for a toggle | Checkbox implies a form value that gets submitted |
| Position | Inside the field it controls | Detached below both fields |
| Scope | One control, one field | One control, two fields |
| Consistency | 2 of 3 routes | 1 of 3 routes |

`aria-pressed` on a button is the correct semantic for a UI state toggle;
a checkbox implies data that will be submitted, which this is not. Reset's
single control also currently governs two fields at once, so the user cannot
reveal only the field they are unsure about.

**Recommendation.** Each password field gets its own in-field toggle button
with `aria-label` and `aria-pressed`, matching Login and Register exactly.
Behaviour is identical: local state, `type` swaps between `password` and
`text`. Presentation and semantics change; nothing else. See AUTH-004.

---

## 9. Motion storyboard

All values reference tokens already committed in
`styles/system/core/motion.css`. Nothing below is implemented yet.

### Login load

| Step | Mechanism | Duration | Easing | Interruptible | Reduced motion |
|---|---|---|---|---|---|
| Canvas | none; paints immediately | 0 | — | n/a | identical |
| "Approach" draw | `stroke-dashoffset`, `both` fill, no iteration | 900 ms | `--ui-ease-enter` | yes, non-blocking | resolved state, no draw |
| Heading | opacity + `translate3d(0,8px,0)` | `--ui-duration-enter` 240 ms | `--ui-ease-enter` | yes | opacity only, 120 ms |
| Fields | staggered rise, capped | 240 ms, `--ui-stagger` 28 ms | `--ui-ease-enter` | yes | opacity only, no stagger |
| Submit | arrives with the last field | 240 ms | `--ui-ease-enter` | yes | opacity only |

The form is **interactive from first paint**. Entrance motion never gates
input; a user who starts typing immediately interrupts nothing.

### Field interaction

| Event | Mechanism | Duration | Easing | Notes |
|---|---|---|---|---|
| Focus | border colour + focus ring opacity | `--ui-duration-fast` 140 ms | `--ui-ease-move` | no size change, so the target never moves |
| Blur | same, reversed | `--ui-duration-exit` 160 ms | `--ui-ease-exit` | |
| Password reveal | icon crossfade only | `--ui-duration-instant` 80 ms | `--ui-ease-move` | the field itself does not move or resize |
| Validation in | height from 0 + opacity | `--ui-duration-enter` 240 ms | `--ui-ease-enter` | reserves space so nothing below jumps |
| Validation out | opacity then height | `--ui-duration-exit` 160 ms | `--ui-ease-exit` | exit faster than entrance |
| Error recovery | message clears on first keystroke | 160 ms | `--ui-ease-exit` | existing behaviour, now animated |

### Submit

| Step | Mechanism | Duration | Notes |
|---|---|---|---|
| Press | `scale3d(0.98)` | 80 ms | tactile, reverses on release |
| Pending | label crossfade to "Signing in…" plus an indeterminate track | 140 ms in | **no spinner-blocking overlay** |
| Failure | error region enters above the fields, focus moves to it | 240 ms | no shake, no bounce |
| Success | "Approach" paths converge to a single vector | 320 ms | runs *concurrently* with navigation, never before it |

**Navigation is never awaited on motion.** The convergence begins and the route
change is dispatched in the same frame.

### Forgot / Reset

| Step | Mechanism | Duration | Notes |
|---|---|---|---|
| Form → confirmation | crossfade with height settle | 240 ms in, 160 ms out | `--ui-ease-settle`, no overshoot |
| Reset completion | fields out, confirmation in | 320 ms total | fits inside the 1500 ms window with 1180 ms spare |
| Reset redirect | none | 0 | timer untouched |

### Auth to app

**Transitions:** the "Approach" convergence, and the canvas, which is shared
between auth and the app shell.

**Stays stable:** the product name position, so the eye has a fixed anchor
across the boundary.

**Never delayed:** authentication success, permission redirects, and every
`axiosClient` 401 redirect. Those are dispatched immediately and are not
allowed to await any animation.

### Reduced motion

Every transform collapses to its opacity component. Durations drop to 1 ms
except entrances, which hold 120 ms because a fade still communicates arrival
and costs no vestibular load. Stagger is 0. The "Approach" field renders
resolved. Validation regions appear and disappear instantly but keep their
reserved space, so nothing jumps.

---

## 10. Responsive strategy

Structural changes, not breakpoint declarations.

| Width | Composition |
|---|---|
| **320** | Single column, 16 px gutters. "Approach" becomes a single resolved hairline beneath the heading, roughly 32 px tall. Heading drops one step. Submit full width. Footer links stack, each meeting 44 px. |
| **375 / 390 / 414** | As 320 with 20 px gutters and the heading restored. Register's three groups are separated by space alone; no hairline, which would add visual noise at this width. |
| **768** | Form column caps at 384 px and centres. "Approach" returns as a contained field above the heading, roughly 120 px tall. Register groups gain their hairlines. |
| **1024** | Asymmetric layout begins. Form column moves left of centre; "Approach" occupies the open right area and begins to bleed off-canvas. |
| **1280 / 1440** | Reference composition. Form at 384 px, positioned at roughly one third. "Approach" at full presence. |
| **1920** | Layout does **not** re-centre and does **not** stretch. The whole composition anchors to a max container; "Approach" gains more open area, which is the point rather than a side effect. |

**Mobile is composed, not stacked.** The current design deletes the supporting
panel below 900 px, which is why mobile reads as desktop-minus. The resolved
hairline gives the phone its own deliberate treatment at a cost of ~32 px
rather than the ~33% of viewport a panel would take.

---

## 11. Accessibility strategy

Every existing contract is preserved, and the ones below are the ones a
redesign most easily breaks.

- **Exactly one `<h1>` per route**, and it remains the *form* heading, not the
  product name. Brand title stays `<h2>` following it in reading order. axe
  asserts heading order, so this is verified rather than assumed.
- **All supporting visuals `aria-hidden`**, SVG `focusable="false"`.
- **Visible labels on every field.** No floating labels, no
  placeholder-as-label. This is why 21st candidate 10260 was rejected.
- **`autocomplete` preserved exactly**: `email`, `current-password`,
  `new-password`, `name`.
- **Errors `role="alert"`, successes `role="status"`**, both above the fields.
- **Password toggles** `aria-label` + `aria-pressed` on all three routes.
- **44 px control floor**, 16 px input text floor to prevent iOS zoom.
- **Focus** via `:focus-visible` only, from the system layer. Focus must never
  be conveyed by colour alone; the ring carries it.
- **Focus moves to the error region** on a failed submit, so a screen reader
  user is not left at the submit button.
- **Reduced motion** fully designed, per section 9.
- **Contrast**: every gated pair passes the token audit. The "Approach" field
  never sits behind text, so it cannot degrade any ratio.

---

## 12. Gujarati layout strategy

Typography is implemented and runtime-verified; metrics are not revisited.
What the layout must absorb:

- **Longer strings.** Gujarati equivalents of short Latin labels commonly run
  1.3 to 1.6 times longer. No label may rely on a fixed width, and buttons size
  to content with the 44 px floor as a minimum, never a maximum.
- **Mixed-script headings.** Latin product name beside Gujarati route heading is
  the common case. Metrics are already overridden to a 0.0000 px line-box
  delta, so the remaining risk is wrapping, not baseline drift.
- **Glyph density.** Gujarati carries more ink per line. Body line-height goes
  to `--ui-leading-relaxed` on auth text rather than `--ui-leading-normal`.
- **Error and success messages** are the highest-risk strings: longest, and
  they sit above the fields where growth pushes content down. Their region
  reserves space for two lines at mobile widths.
- **No `text-overflow: ellipsis`** on any auth label. Truncating a label in a
  script the user reads and the developer does not is how it ships broken.

Verification during implementation: render every auth route with Gujarati
strings at 320, 375 and 414 and confirm zero overflow and zero clipping.

---

## 13. Rejected concepts

| Concept | Why rejected |
|---|---|
| Split-screen with brand panel | Explicitly banned; also what the product already does |
| White card on a gradient | Explicitly banned; the no-card decision removes it structurally |
| Retaining `StructuralFrame` | Literal construction blueprint; banned as visual identity (AUTH-003) |
| Instrument face / split-flap / cassette fascia | Machinery, signage and engineering-instrument vocabularies, all banned |
| Coordinate grid or lattice | Reads as blueprint or graph paper, which lands back on the banned vocabulary |
| Literal route map with nodes and labels | Airport-graphics cliché; also implies navigation the user cannot perform yet |
| WebGL or canvas ambient background | Banned as spectacle; a permanent compositing cost on the priority persona's phone |
| Multi-step Register | Adds navigation to a form that already fits; breaks password-manager autofill |
| Password strength meter | Backend enforces only a length minimum; a meter would invent requirements that do not exist |
| Floating labels | Conflicts with the visible-label contract |
| Social / SSO buttons | No such backend capability exists; would be a fabricated affordance |
| "Account not found" on Forgot | Would break the deliberate anti-enumeration contract |
| Marketing copy, testimonials, logo wall | Landing-page patterns on an operational sign-in surface |
| Dark auth surface | Contradicts the confirmed outdoor-legibility rule |

---

## 14. Technical classification

Full detail in `FRESH_UI_ISSUES.md`.

| Finding | Class | Handling |
|---|---|---|
| RegisterPage owner/admin comment contradicts code | **C + D** | Security review. Behaviour untouched (AUTH-001) |
| Login state ownership in `App.jsx` | **B** | Intentionally retained through auth; cleanup after (AUTH-005) |
| Duplicated `getHomePath` | **B** | Cleanup after auth; touches routing (AUTH-006) |
| Inconsistent password reveal | **A** | Fixed during auth; presentation and semantics only (AUTH-004) |
| Inline `route-guard-loading` styling | **A** | Fixed during auth; ARIA semantics preserved (AUTH-007) |
| Duplicate auth CSS systems | **A** | Both removed at the end of the auth group (AUTH-002) |
| Register missing `auth-field` wrappers | **A** | Fixed during auth (AUTH-008) |

---

## 15. Risks

1. **`AuthShell` is shared by four routes.** Any change is a four-route change.
   Mitigation: migrate the shell and all four routes as one unit, never
   partially.
2. **Six tests read `--v2-*` token values directly.** Auth does not appear to
   be among them, but this must be confirmed before removing v2 auth CSS.
3. **Removing `styles/pages/auth.css` may affect non-auth routes** if any
   selector is shared. Must be proven, not assumed.
4. **`.error` is a generic class name** likely used outside auth. It cannot be
   removed with the auth sheets without a consumer check.
5. **The destination cue (AUTH-009) touches a security-adjacent surface.**
   Allow-list only, no raw paths, no redirect change. If the allow-list cannot
   be built cleanly, drop the feature rather than weaken the rule.
6. **Login's props come from `App.jsx`.** A visual rewrite that accidentally
   changes the prop contract breaks sign-in. The contract is the first thing to
   verify after the rewrite.

---

## 16. Implementation order for the next session

1. **Foundation primitives**, built only for what auth consumes: surface,
   field, label, hint, error, button, icon button, status message, inline link,
   divider, focus treatment, loading indicator. No speculative components.
   Gate: lint, build, `git diff --check`.
2. **`AuthShell` replacement**, including retiring `StructuralFrame` and
   introducing "Approach". Shell plus all four routes move together.
3. **Login**, the flagship. Preserve the `App.jsx` prop contract exactly.
   Gate: targeted Playwright, axe, nine widths, both motion modes, screenshots.
4. **Register**, with grouping, `auth-field` wrappers and the blur-time confirm
   check.
5. **Forgot Password**, with the designed invariant success state and the
   quarantined DEV token block.
6. **Reset Password**, with the resolved-token treatment, per-field reveal
   buttons and the completion state inside 1500 ms.
7. **Password-reveal consolidation** across all three password routes.
8. **`route-guard-loading`** moved off inline styles onto tokens.
9. **CSS cleanup**: prove zero consumers, account for tests, remove both auth
   stylesheets, remove obsolete classes. No compatibility layer left behind.
10. **Full gate**, then update `FRESH_UI_DESIGN_SYSTEM.md` with auth-specific
    direction and mark the auth group Complete in `FRESH_UI_ROUTE_MATRIX.md`.

`DESIGN.md` is **not** written yet. Impeccable's contract is that it documents
a built world, and the auth surface does not exist yet.


---

## Boundary D outcome — Forgot Password

Implemented as designed in section 6. The form is replaced by the confirmation
on success, so no editable field invites a second submission. Wording stays
conditional and never distinguishes a registered address from an unregistered
one.

**Enumeration invariance is asserted, not assumed.** The suite submits a real
registered address and a guaranteed-unregistered one against the local backend
and requires the confirmation text to be byte-identical.

One correction to the research: the phrase "If an account exists for this
email…" was initially treated as enumeration wording by the test's own regex.
It is not. Conditional phrasing is the canonical safe form and is what the
backend itself returns. The regex was wrong and was corrected.

**The DEV reset-token block shipped its CSS to production** until
`verify_dev_token_absent.mjs` caught it. Vite eliminates DEV-gated JSX but does
not tree-shake CSS, so the rules moved to `dev-only.css` behind a dynamic
import guarded by `import.meta.env.DEV`. Production CSS fell 130.87 to
130.07 kB and all three markers are now absent from the built bundle.

Verification of this route also required a narrowly authorised backend change;
see AUTH-017.
