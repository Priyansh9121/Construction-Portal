# Design

<!-- impeccable:design-system 1 -->

> **This describes what is BUILT, not what was planned.** It was written after
> the authentication group shipped and was verified, from the code that exists.
> Where the built world diverged from the concept, the built world wins and the
> concept documents were corrected to match.
>
> **Coverage:** the four authentication routes and the shared design
> foundation. The application shell and every other route group still run on
> the previous system and are NOT described here. Nothing in this file should
> be read as covering them.

---

## 1. Direction

**Signing in is an act of routing, not passing a gate.**

That is a product fact rather than a metaphor: four roles resolve to three
destinations, `getHomePath` exists because `/` means something different per
role, and `?next=` already preserves where an expired session was working.

Wayfinding supplies the **information architecture** — orientation,
progression, hierarchy, what happens next. It supplies **no colour and no
styling**. The visual personality is a light, quiet, modern product surface.

Explicitly not built, and not to be reintroduced: signage graphics, transit
maps, blueprints, machinery or instrument faces, industrial texture, the
generic split-screen auth layout, and a white card floating on a gradient.

---

## 2. Surface strategy

**Light-first, and not as a style preference.** PRODUCT.md records that the
priority persona is a site supervisor outdoors in glare. A phone screen cannot
out-emit the sun, so legibility there depends on reflectance contrast, which
needs a bright ground.

Depth comes from layered surfaces, hairlines and elevation, never from heavy
shadow and never from a dark chrome plane.

| Role | Token | Built value |
|---|---|---|
| Canvas | `--ui-canvas` | `#fbfbfa` |
| Surface | `--ui-surface` | `#ffffff` |
| Sunken | `--ui-surface-sunken` | `#f6f6f4` |
| Inset | `--ui-surface-inset` | `#eeeeec` |

---

## 3. Colour

### Ink

| Token | Value | Contrast on canvas |
|---|---|---|
| `--ui-ink-strong` | `#1a1917` | 17.49:1 |
| `--ui-ink` | `#2f2e2a` | 12.98:1 |
| `--ui-ink-muted` | `#5f6461` | 5.82:1 |
| `--ui-ink-faint` | `#868a87` | 3.50:1 — large or non-essential text ONLY |

`--ui-ink-faint` is gated at 3.0 and must not carry normal-size text. It was
used for 12px group labels once and axe rejected it; that is recorded as
AUTH-015.

The neutral ramp is warm-cast throughout and verified monotonic by luminance.

### Accent

`--ui-accent` is `#5d28c8`, an indigo. **Chosen by elimination, not
preference,** and this reasoning is load-bearing:

| Hue | Owned by | Available as brand |
|---|---|---|
| Red | `status-danger` | No, banned as branding |
| Amber | `status-warning` | No, banned as branding |
| Green | `status-success` | No, banned as branding |
| Blue | `status-info` | No, already semantic |
| Slate | `status-neutral` | No, already semantic |

Indigo is the one family carrying no semantic load. The first value tried
computed to hue 244°, still the `blue` family and therefore still colliding
with `status-info`; the audit failed it and it was replaced with a value near
260°. `tools/fresh_ui/token_audit.py` asserts this mechanically on every run.

Used only on the primary action, the focus ring and identity. Never on
surfaces, never on cards, never scattered.

### Status

Five semantic families duplicated **by value** rather than aliased, so the
system carries no dependency on the previous one. Every `-fg` on its `-bg`
clears 4.5:1. Status is never signalled by colour alone: the message text
carries the meaning, and it is announced through `role="alert"` or
`role="status"`.

A coloured left bar was tried on status messages and removed. It was drawn in
the same hue family as its background, so it conveyed nothing additional to a
colour-blind reader while reading as a generated-UI tell. See AUTH-011.

---

## 4. Typography

**IBM Plex Sans**, variable, self-hosted, Latin and Latin-Extended, 66 kB, zero
network requests.

**Noto Sans Gujarati**, variable, self-hosted, loaded under
`unicode-range: U+0A80-0AFF`. The payload is therefore conditional: an
English-only session downloads **zero** bytes of it, which is what makes a
110 kB face acceptable on a phone with weak signal. Verified at runtime by
`tools/fresh_ui/verify_conditional_font.mjs`.

No Gujarati face is purpose-drawn to pair with Plex, so the metrics were
**measured in Chromium, not guessed**:

```
size-adjust 87.6%   ascent-override 116.5%
descent-override 30.8%   line-gap-override 0%
-> line-box delta 0.0000px at 100px
```

Latin digits fall inside Plex's range, so currency, IDs, dates and tabular
figures resolve to Plex **structurally** rather than by convention.

Scale is fluid `clamp()` from 11px meta to a 2.25–3.75rem display. Inputs are
locked at 16px minimum, below which iOS Safari zooms on focus.

---

## 5. Space, shape, elevation

4px base scale, `--ui-space-1` through `--ui-space-20`.

**One radius system:** controls `0.5rem`, containers `0.75rem`, pills full,
dividers square. Mixed radii without a documented rule is the most common tell
of an assembled interface.

Four elevation steps, all tinted to the canvas hue, never pure black. The auth
group uses none of them: it builds depth from hairlines and space alone.

---

## 6. Auth composition

**No card and no split.** The form sits directly on the canvas, which removes
"white rectangle on a gradient" structurally rather than by restraint. The
layout is asymmetric rather than bisected, so there is no seam and it cannot
read as a split screen.

`.auth-card` keeps its class name because four Playwright specs assert on it.
It is not a card: no background, no border, no shadow.

- **Below 900px:** single column, form column max 24rem, supporting panel
  `display: none`. A decorative panel on a phone pushes the form under the
  fold, which is what made the original screens unusable at 320px. Mobile gets
  its own orientation mark instead: a single 2px resolved rule under the
  heading, costing ~2px rather than a third of the viewport.
- **900px and above:** `minmax(0, 26rem) minmax(0, 1fr)`. The form column is
  fixed and sits left of centre; the supporting area takes the remainder and
  bleeds off-canvas.
- **1600px and above:** the composition anchors to a max container rather than
  stretching. The supporting area simply gains open space.

Reading order puts the form column first in the DOM. Its heading is the page's
single `<h1>` and names the task, never the product. The supporting panel is
entirely `aria-hidden`.

---

## 7. Supporting visual — Approach

Sparse vector paths enter spread apart and resolve toward a single heavier
accent vector. Abstract directional flow, and deliberately **not** a transit
map: no nodes, no stations, no labels, no legend, no grid, no scale.

Rules it obeys, all verified in the built code:

- **It draws once.** `both` fill, no iteration count. A permanently animating
  background is a permanent compositing cost on a phone, for decoration.
- Pure SVG geometry: no image request, no canvas, no WebGL, no dependency.
- Inside an `aria-hidden` container, `focusable="false"`.
- Occupies open area only and never sits behind text, so it cannot degrade a
  contrast ratio.
- Under reduced motion it renders its resolved figure immediately.

---

## 8. Controls

**Fields.** Label above, control below, both inside `.auth-field`. Visible
labels always; no floating labels and no placeholder-as-label. 16px text,
44px minimum height, 1px `--ui-line-strong` border measuring 3.50:1, which is
the WCAG 2.2 requirement for a control boundary. Focus and hover change colour
only, so the target never moves.

**Groups.** `.auth-group` separates related fields by space and one hairline,
used by Register for *your details*, *your company*, *sign-in details*.
Grouping rather than staging, so password-manager autofill still reads a whole
form.

**Resolved fields.** `.auth-field--resolved` de-emphasises a value that
arrived already correct, currently the reset token from an emailed link. Never
disabled, never hidden, full contrast restored on focus.

**Password reveal.** One grammar across all three password routes: an in-field
`<button>` with `aria-pressed`, an accurate `aria-label`, keyboard activation
and a 44px target, sitting inside the input's reserved padding so it never
covers the typed text. Reset has one per field, so revealing the confirmation
never exposes the password. The checkbox pattern is retired and must not
return.

**Primary action.** Full width, 44px floor, accent ground, `scale3d(0.98)` on
press.

**Status.** Errors and confirmations sit **above** the fields, never below the
submit button, where a failure on a phone is frequently under the fold.

**Confirmation.** `.auth-confirm` replaces the form outright on Forgot and
Reset, so no editable field invites a second submission.

---

## 9. Motion

Every animation is justifiable as hierarchy, storytelling, feedback or state
transition. Anything else was removed.

| Token | Value | Use |
|---|---|---|
| `--ui-duration-instant` | 80ms | press |
| `--ui-duration-fast` | 140ms | hover, focus |
| `--ui-duration-exit` | 160ms | overlays leaving |
| `--ui-duration-enter` | 240ms | overlays arriving |
| `--ui-duration-move` | 320ms | layout, shared element |
| `--ui-duration-page` | 380ms | route change |

Easings: `--ui-ease-enter` decelerates, `--ui-ease-exit` accelerates,
`--ui-ease-move` is symmetric, `--ui-ease-settle` is a spring with **no
overshoot past 1**, so it is safe over dense data.

Built rules: exits resolve faster than entrances; everything is interruptible;
only `transform` and `opacity` animate; hover never moves a target; no
permanent loops anywhere; the skeleton sweep is a single pass, not a shimmer.

**Reduced motion is a designed mode, not a disabled one.** Every transform
collapses to its opacity component; durations drop to 1ms except entrances,
which hold 120ms because a fade still communicates arrival at no vestibular
cost; stagger is 0; Approach renders resolved. It is expressed as token values
rather than a blanket `!important` override, so it composes.

---

## 10. Route guard

While `AuthProvider` verifies a cached session against `/auth/me`, `RoleRoute`
holds the route rather than redirecting, because redirecting before the real
role is known bounces a legitimate user off a page they are entitled to.

The state is a quiet line of text, faded in after a 240ms delay so a fast
verification shows nothing at all. Deliberately not a spinner and not a
progress bar: the wait is normally one round trip, and a percentage would be
invented since nothing here knows how long the request has left.
`role="status"` and `aria-live="polite"` are preserved exactly.

---

## 11. Accessibility

Enforced and verified, not asserted:

- Exactly one `<h1>` per route, naming the task rather than the product.
- Supporting visuals `aria-hidden`, SVG `focusable="false"`.
- Visible labels on every field; `autocomplete` preserved throughout.
- Errors `role="alert"`, successes `role="status"`, both above the fields.
- Password toggles: `aria-label` plus `aria-pressed`.
- 44 × 44px control floor; 16px input text floor.
- `:focus-visible` only, so a mouse click leaves no ring but every keyboard
  user keeps one.
- Status never conveyed by colour alone.
- 44 axe checks and 57 gated contrast pairs pass.

---

## 12. What this system does NOT yet cover

The application shell, dashboard, registers, finance, administration, activity,
site operations and both portals still run on the previous stylesheets. Those
sheets remain live and load-bearing. `.password-input-wrapper` and
`.password-toggle-btn` are shared with `UsersPage`, so the auth system scopes
its own copies under `.auth-shell` to avoid restyling an unmigrated route; see
AUTH-020.
