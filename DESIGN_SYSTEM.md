# Construction Portal — Design System

Rules for building new screens so they look like the rest of the product.
Tokens live in `frontend/src/styles/core/tokens.css`; that file is the source
of truth and this document explains how to use it.

**One rule above all others: never invent a raw value.** If you are typing a
hex, a pixel padding or a millisecond duration, there is almost certainly a
token for it.

---

## 1. Colour

| Role | Token | Use for |
|---|---|---|
| Primary action | `--accent` (#2563eb) | The one main action per screen |
| Primary hover | `--accent-hover` | |
| Page background | `--bg-page` | |
| Surface | `--bg-surface` | Cards, panels, table backgrounds |
| Text | `--text-primary` / `--text-secondary` / `--text-muted` | In that order of emphasis |
| Borders | `--border-subtle` / `--border-default` / `--border-strong` | |
| Identity mark | `--identity-mark` | **Sidebar brand mark only.** Nothing else. |

### Status — one scale, used everywhere

| Meaning | Tokens | Colour |
|---|---|---|
| running / active / info | `--status-info-*` | blue |
| completed / approved / paid | `--status-success-*` | green |
| pending / waiting / due soon | `--status-warning-*` | amber |
| overdue / rejected / failed | `--status-danger-*` | red |
| draft / cancelled / archived | `--status-neutral-*` | slate |

Each family has `-bg`, `-fg` and `-border`. `-fg` on `-bg` is ≥ 4.5:1.

**Two hard rules:**

1. **Amber means warning.** It is not a brand colour. The only decorative
   amber in the product is `--identity-mark` on the sidebar. Reusing amber
   for emphasis re-creates the collision this system was built to fix.
2. **Never signal state by colour alone.** Every badge keeps its text label;
   every severity carries an icon or a left border as well as a hue.

---

## 2. Typography

System font stack — no webfont, deliberately. Data density is the product's
value, and two Google fonts cost a round trip and FOIT risk for no gain.

| Token | Size | Use |
|---|---|---|
| `--font-size-xs` | 12px | Timestamps, table meta |
| `--font-size-sm` | 13px | Secondary text, table cells, nav |
| `--font-size-base` | 15px | Body |
| `--font-size-md` | 16px | **All inputs — never smaller** |
| `--font-size-lg` | 18px | Card titles |
| `--font-size-xl` | fluid 18→22px | Page titles |
| `--font-size-2xl` | fluid 22→28px | Rare; section leads |

**16px on inputs is not negotiable.** iOS Safari zooms any input under 16px
on focus, which leaves the page scrolled sideways — a large share of apparent
"mobile overflow" bugs are really this.

**No marketing headlines inside the portal.** A page title is 18–22px. If you
find yourself reaching for `--font-size-3xl`, ask what the user learns from
it.

Put `font-variant-numeric: tabular-nums` on every currency, count and
figure, so columns of numbers align and don't jitter as they update.

---

## 3. Spacing, radius, elevation

Spacing is a 4px scale: `--space-1` (4px) through `--space-16` (64px).
Page gutters use `--page-gutter` — `clamp(16px, 3vw, 32px)`, so they grow
with the viewport instead of jumping at a breakpoint.

Radius: `--radius-sm` (6px) for controls, `--radius-md` (10px) for cards and
panels, `--radius-pill` for badges and avatars.

Elevation: `--shadow-xs`/`sm` for resting cards. `--shadow-lg`/`xl` are for
things that genuinely float — modals, drawers, menus. A card that sits on the
page does not need a 24px shadow.

---

## 4. Responsive

Mobile-first. **Base styles target 320px; every media query is `min-width`.**

| Breakpoint | Purpose |
|---|---|
| 480px | Summary tiles go multi-column |
| 640px | Form grids and toolbars go inline |
| 768px | Table card-transform boundary; panel padding grows |
| 1024px | **Sidebar becomes permanent**; drawer retired |
| 1280px | Tile density increases |

Prefer layout that needs no breakpoint at all:

```css
/* Collapses to one column on its own — no media query needed. */
grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
```

Note `min(100%, 240px)` rather than a bare `240px`. A bare minimum wider than
the viewport is the single most common cause of mobile overflow in this
codebase — it is exactly what broke the old dashboard hero.

Every flex/grid ancestor of a wide thing needs `min-width: 0`, or it refuses
to shrink below its content and widens the page.

---

## 5. Tables

Every table goes inside `.table-wrapper`:

```jsx
<div className="table-wrapper">
  <table>…</table>
</div>
```

The wrapper scrolls horizontally and applies a 640px floor so columns stay
readable. A table without a wrapper falls back to scrolling inside itself —
that is a safety net, not a licence to skip the wrapper.

### Choosing a mobile strategy — required, per table

| Strategy | When | How |
|---|---|---|
| **A · Record cards** | One row = one independent entity: a worker, a user, an invoice, a tender, an audit event | `<ResponsiveTable mobile="cards">` |
| **B · Expandable rows** | Several secondary fields, but rows still need compact comparison | `mobile="cards"` + collapse detail cells |
| **C · Priority columns** | Only two or three columns; already readable on a phone | Leave as-is; no wrapper mode needed |
| **D · Horizontal scroll** | A genuine financial matrix — seeing the columns beside each other *is* the information | `<ResponsiveTable mobile="scroll" label="…">` |

**D is a decision, not a default.** Reach for it only when converting to
cards would destroy a relationship the user needs — an allocated / spent /
remaining balance, an 11-column finance ledger, an export preview that must
mirror the exported column order. If you cannot name the relationship that
breaks, the answer is A.

### Using it

```jsx
import ResponsiveTable from "../components/ui/ResponsiveTable";

<ResponsiveTable mobile="cards">
  <table>
    <thead><tr><th>Name</th><th>Status</th></tr></thead>
    <tbody>…</tbody>
  </table>
</ResponsiveTable>
```

**Do not hand-write `data-label`.** It is derived from the `<thead>` at
runtime and re-derived when rows change. A hand-written copy is a duplicate
of the `<th>` three lines above it, and the two drift — rename the column,
the header updates, the mobile label silently does not, and the card starts
lying to the user. One column, one source of truth for its name.

Cells with `colSpan > 1` (the "no records" row) are skipped automatically.

`<thead>` becomes `sr-only`, **not** `display: none`, so the table is still
announced as a table.

Scrolling wrappers get `tabIndex={0}` so a keyboard user can reach them —
a region that scrolls but cannot be focused is unusable without a mouse.
Card mode does not scroll, so it correctly gets no tab stop.

> **Current adoption: all 9 card-suitable registers.** Workers, Users,
> Tenders, Subcontractors, Invoices, Daily Update Approvals, Daily Site
> Updates and both Worker Money registers. Activity Log left the table model
> entirely — see §11. Allocation Summary, Finance Records and the Finance
> Report preview stay on strategy D by design. Full 42-table inventory in
> `UI_UX_AUDIT.md` §8.

---

## 6. Touch and accessibility

- **44 × 44px minimum** for anything tappable. `--touch-target` is the token.
  This includes links inside table cells — a cell action is not prose, so
  WCAG 2.2's inline-link exemption does not apply.
- Icon-only controls need `aria-label`.
- Use native HTML before ARIA. The drawer scrim is a real `<button>`, not a
  `div` with a click handler.
- Visible focus everywhere; never remove the ring without replacing it.
- Overlays: trap focus, close on Escape, return focus to the trigger, lock
  body scroll, and make the closed state `inert` if it stays in the DOM.
- Headings in order. One `<h1>` per page — the topbar owns it.

## 7. Motion

Durations: `--dur-fast` (140ms) for hover/state, `--dur-normal` (220ms) for
overlays. Animate `transform` and `opacity` only.

All duration tokens collapse to `0ms` under `prefers-reduced-motion`, so
honouring it is automatic **provided you use the tokens**. Hard-code a
duration and you have opted the user out of their own accessibility setting.

Do not animate page titles, ordinary text, or every card on load. No
marquees, no continuous background motion — a data-dense screen that is
always moving is harder to read.

---

## 8. Icons

Use `<Icon name="…" />` from `components/ui/Icon.jsx`. 24px grid, stroke-only,
1.75 width, `currentColor`, decorative by default.

**Never use an emoji as an icon.** Font-dependent, platform-inconsistent,
cannot take the surrounding colour, and screen readers announce it on top of
the control's own label. Add a new path to `Icon.jsx` rather than reaching
for a library.

---

## 9. Building a new page

1. Page title goes to `AppLayout` via `activePage` — the topbar renders the
   `<h1>`.
2. Wrap content sections in `.panel`.
3. Heading + action row: `.section-title-row`.
4. Tables in `.table-wrapper`; pick and implement a mobile strategy.
5. Forms: visible `<label>` for every field, 16px inputs, errors below the
   field with `role="alert"`.
6. Give the page a loading, an empty and an error state. An empty register
   should say what it is and offer the action that fills it.
7. Add the route to `frontend/tests/authenticated.spec.js` — it is a one-line
   addition and gets you overflow and touch coverage at nine widths.

## 10. Before you call it done

- [ ] No hard-coded hex, px spacing or ms duration
- [ ] Checked at 320px and 1920px
- [ ] No horizontal overflow (the test suite proves it)
- [ ] Every control ≥ 44px
- [ ] Keyboard-reachable with a visible focus ring
- [ ] State is never colour-only
- [ ] Table has a documented mobile strategy
- [ ] `npm run lint` and `npm run build` clean
- [ ] `npx playwright test` passes

---

## 11. Activity streams

An audit trail or event log is read **chronologically**, not compared
column-by-column. Use `ActivityStream`, not a table.

- Group by calendar day: *Today*, *Yesterday*, then a formatted date.
  Derive the bucket by comparing **local calendar components**, never by
  string-matching the timestamp — a substring compare breaks the moment the
  API format or the viewer's timezone shifts.
- One column at every width. A stream is already single-column, so there is
  no separate mobile markup to drift out of sync.
- The action gets an icon marker **and** a text badge. Never colour alone.
- Wrap the timestamp in `<time dateTime={iso}>`.

### Disclosures

Any "show more" control is a real disclosure:

```jsx
<button aria-expanded={open} aria-controls={panelId} onClick={toggle}>…</button>
{open ? <dl id={panelId}>…</dl> : null}
```

- Render the panel **only when open**. A hidden-but-present copy makes a
  screen reader walk every field of every collapsed row.
- The control is a `<button>`, never a clickable `<div>` or a bare chevron.
- Give it the 44px floor like any other control.
- Show a changed value as `old → new` with the old struck through, so the
  direction of the change does not depend on position alone.

## 12. Destructive colour — when it is allowed

`--status-danger-*` and `.delete-btn` mean **this destroys data**.

| Action | Style |
|---|---|
| Delete, remove, reject, disable an account | Destructive |
| **Log out** | **Secondary** — it ends a session, it destroys nothing |
| Cancel, dismiss, close | Secondary or plain |
| Overdue / failed / rejected *state* | Danger tone on the badge, not the button |

Both portals shipped with Logout as `delete-btn` in four places. A worker
signing off at the end of a shift was being shown the same red the product
uses for "overdue invoice". If an action is reversible by simply doing it
again, it is not destructive.

## 13. Status-tinted cards

Flat tint plus a solid 3px left bar. Never a gradient.

```css
.card.highlight-warning {
  border-inline-start: 3px solid var(--status-warning-border);
  background: var(--status-warning-bg);
}
```

The bar carries the severity, not the tint. A background wash that fades to
white is close to invisible to a colour-blind user and unreadable outdoors —
which is exactly where the Worker Portal is used.

## 14. Button effects — what not to add back

No sweep, sheen or shimmer pseudo-element on controls. No hover lift
(`translateY`) and no press scale: they move the thing the user is aiming
at, which in a dense row of table actions is a genuine mis-click risk.

Hover feedback is a colour change. It is instant, visible, and it moves
nothing.

If you add a decorative effect to a bare `button` selector, remember it will
also hit every text-style button in the product — the link-style controls in
table cells and the activity disclosures have no background of their own and
will render as filled blocks.

### The specificity trap

`foundation.css` sets `button:hover:not(:disabled)`, which scores **(0,2,1)**.
A plain `.my-text-button:hover` scores (0,2,0) and **loses**. Match the shape
of the rule you need to beat:

```css
.my-text-button:hover:not(:disabled) { background: none; }
```

`.table-link-button` and `.activity-disclosure` both do this, for exactly
this reason.

---

## 15. AuthShell — the unauthenticated screens

All four public screens (Login, Register, Forgot Password, Reset Password)
use `components/auth/AuthShell.jsx`. Do not hand-roll a fifth.

```jsx
<AuthShell
  eyebrow="Account Recovery"
  title="Forgot password"          // brand panel, desktop only
  intro="One supporting sentence."
  heading="Reset access"           // this is the page's <h1>
  subheading="One line under it."
  footer={<AuthLink to="/login">Back to sign in</AuthLink>}
>
  <form onSubmit={…}>…</form>
</AuthShell>
```

**Rules the shell already enforces — don't re-implement them per page:**

- **The `<h1>` is the task, not the product.** "Sign in", not "Construction
  Portal". One per page; the brand panel is `aria-hidden` because everything
  in it is decorative or duplicated by the card.
- **The brand panel is `display: none` below 900px.** A decorative panel on a
  phone pushes the form under the fold.
- **Errors render above the fields**, never under the submit button — under a
  full-width button on a phone they are frequently below the fold, so the
  user sees nothing happen and submits again.
- **Submit uses `.auth-submit`** — full width, 44px floor.
- **Each field goes in `.auth-field`**, label above input.
- Every input needs a visible `<label>` and an `autocomplete` attribute.

**The supporting visual is a CSS blueprint grid** — two
`repeating-linear-gradient`s. No image request, scales to any viewport, says
construction without a stock photo. It is static: nothing on an
authentication screen should be moving.

**Style controls by class, never by descendant selector.** `.login-box button`
is what made the password toggle render as a filled dark button over the
input. And `.password-toggle-btn` needs the `:not(:disabled)` shape to beat
`button:hover:not(:disabled)` — see §14.

---

## 16. Site Operations — the field workspace

### Context card

`SiteOpsContextCard` shows the **working date**, a relative status chip
(`Today` / `Yesterday` / `N days ago`) and the active module.

The relative status is **text, never colour alone** — backdating is what
triggers the `ACCESS_REQUIRED` flow, so a supervisor must be able to read that
they are not recording for today.

**There is deliberately no tender or site selector.** Operational records carry
no tender/site attribution, and adding selectors would change what is written
rather than how it looks. Tracked as **SITE-OPS-DATA-01**; a test asserts their
absence. Do not add them without that decision.

The card is presentational: it does not filter the register and does not set
the value any module submits.

### Module navigation

`ModuleTabs`. Every module stays visible and one tap away — scroll
horizontally on a phone, never wrap into a "more" menu. Burying a module
behind an overflow control on a screen used on site is the kind of tidying
that costs someone a job.

Keyboard is the WAI-ARIA roving tabindex: arrows move between tabs, Home/End
jump to the ends, only the active tab is in the tab order. The panel is a
`role="tabpanel"` with `aria-labelledby` pointing at its tab.

Active state carries a fill **and** a weight change, plus `aria-selected`.

### Field forms

Below 768px: one column, 16px inputs, full-width submit. A two-column grid on
a phone gives two unusable half-width fields — on site, with gloves and in
sunlight, that is the difference between a record being made and not.

Camera and gallery inputs are separate controls and must stay that way: the
page records which one produced a photo, and the office relies on the
distinction.

---

## 17. Field-user portals (Worker, Subcontractor)

Use `components/portal/PortalPrimitives.jsx`.

**Density is deliberately lower than the office pages.** Consistency means a
shared design language — same tokens, status scale, radii, focus treatment —
**not** the same information density. A supervisor scanning a register at a
desk and a worker checking their site on a phone in daylight are not the same
reader.

### Information hierarchy — answer the first question first

1. `PortalHeader` — name, role, account actions. Compact: a daily user does
   not need the product explained again.
2. `CurrentAssignmentCard` — **where am I today**. Site name is the headline;
   it is what the person travels to. Always give it a real empty state.
3. `RequiredActionsPanel` — what they still owe. **Renders nothing when
   empty**: a panel that always reads "0" stops being read, and then it fails
   on the day it matters.
4. `PortalSummaryCard` tiles — supporting figures.
5. Everything else.

### Rules

- **Never `<h2>` a number.** `PortalSummaryCard` uses `<strong>`; an `<h2>`
  containing "3" gives a screen reader a heading called "3".
- **A zero never carries a success tone.** Green "0 approved" says "all good"
  when it means "nothing yet". Apply tone only to a meaningful value.
- **Tone always travels with a text detail line** — never colour alone.
- Money uses `font-variant-numeric: tabular-nums` and `clamp()` so large
  amounts shrink rather than clip.
- Long site and tender names **wrap**; a half-shown site name is worse than a
  tall card.
- **Logout is neutral.** See §12 — ending a session destroys nothing.
- Flat surfaces only. A wash that fades to white is near-unreadable outdoors,
  which is exactly where these screens are used.

### Adaptive width

Cap portal pages at **1100px**, not the office `--content-max` (1600px). From
1024px, `.portal-context-row` puts assignment and required actions side by
side. Never add office sidebar navigation or admin controls.

### Worker vs Subcontractor — siblings, not twins

Both portals share tokens, spacing, typography, card treatment, status scale,
focus handling and the neutral logout. They differ in what they lead with,
because they answer different first questions:

| | Card | Headline | Beneath |
|---|---|---|---|
| Worker | `CurrentAssignmentCard` | **Site** — what they travel to | Project |
| Subcontractor | `CurrentProjectCard` | **Project** — what they contracted for | Site, assigned value, due date |

These are **separate components on shared CSS**, not one component with a
`variant` prop. Their branches would share no logic; the design language lives
in the stylesheet, which is what they genuinely have in common.

**Consistency means a shared design language, not an identical page.** Do not
force the two into the same hierarchy or the same summary figures.

Contract figures go in a `<dl>` with visible labels — a bare row of numbers on
a contract is exactly the kind of thing that gets misread.

---

## 18. Undefined tokens and fallbacks

**Never write `var(--token, #hex)` for a token you have not declared.**

`site-operations.css` referenced 16 custom properties that were never defined
— `--success-bg`, `--warning-text`, `--space-md`, `--primary-color` and others
— each with a hard-coded fallback. The file read as fully tokenised while
every one of those declarations shipped a raw literal. Two of the resulting
colour pairs were below the 4.5:1 AA floor, and nobody noticed because the
code looked correct.

Rules:

- **A fallback is not a token.** If you need a value the scale does not have,
  add it to `tokens.css` with a rationale — do not smuggle it in as a
  `var()` second argument.
- **Do not add fallbacks to tokens that exist.** They can never apply, and
  they rot: `var(--text-muted, #6b7280)` sat in this file while
  `--text-muted` was slate-600 `#475569`. A rename would have silently
  swapped in a colour nobody chose.
- **Use the canonical family names.** Status colours are
  `--status-{success,warning,danger,info,neutral}-{bg,fg,border}`. Spacing is
  the numeric 4px scale (`--space-1`…`--space-16`), not a t-shirt scale.
- **Do not create an alias to preserve old naming.** Migrate the consumers.

To check: search for `var(--` and confirm every name is declared in
`tokens.css`. A regression test in `tests/portals-and-tables.spec.js` guards
the Site Operations classes specifically.

---

## 19. Legacy aliases — there are none, keep it that way

`tokens.css` used to carry a "LEGACY ALIASES" block so ~2,850 lines of
pre-existing CSS did not all have to change at once: `--primary`, `--danger`,
`--text`, `--muted`, `--border`, `--panel-bg`, `--blue-dark`, `--input-border`,
`--shadow-panel`, `--success-light`, `--blue-light`, plus three
`--accent-brand*` names and a whole second motion scale declared in
`animations.css`. All seventeen are gone; their consumers were migrated.

**Do not reintroduce one.** An alias costs nothing to add and is expensive to
remove, because by the time anyone notices it has consumers in a dozen files.
Migrate the consumers instead — that is the whole job, and it is smaller than
it looks.

Retiring one properly:

1. **Inventory first, and do not trust the list you were given.** The brief for
   this migration named 7 aliases; the repo had 17. Search CSS, JSX, inline
   styles, `getComputedStyle`/`getPropertyValue`, docs and tests.
2. **Classify before replacing.** An alias is *exact* (same computed value as
   its canonical token), *ambiguous* (matches several, or none), or a
   *duplicate declaration site*. Only exact ones are mechanical.
3. **For ambiguous aliases, the role of the property decides — not the value.**
   `--blue-dark` was blue-700, which matched both `--status-info-fg` and
   `--accent-hover`. Informational uses went to `--status-info-fg`; actions went
   to `--accent`, because the product has exactly one action colour. Replacing
   one generic name with another generic name is not a migration.
4. **Migrate every consumer in one batch, then delete the declaration.** A
   half-migrated alias is worse than an un-migrated one: the two halves drift.
5. **Prove computed equality in a browser, not on paper.** Walk
   `document.styleSheets` and resolve each `var()` through a throwaway element,
   before and after. Two traps: CSSOM does not enumerate a shorthand whose
   value contains `var()` (`background: var(--x)` is invisible to
   `for (const p of rule.style)` — parse `cssText` instead), and a probe
   element reused across many declarations will return **mid-transition**
   colours once a `transition` value has been set on it.

Colour changes are acceptable only where the current value violates the design
system or a contrast requirement — and then they must be measured. AUD-014
changed eight, all of which improved or preserved contrast, and two of which
fixed live AA failures (`.error` at 4.41:1, and muted text on the accent fill
at 3.48:1).
