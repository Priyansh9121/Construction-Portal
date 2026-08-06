# UI / UX Audit and Redesign

**Repository:** `construction-portal` · **Baseline:** `bb2fae7`
**Date:** 2026-08-06
**Scope:** frontend presentation only. No backend file, API call, route,
permission or business rule was changed.

---

# 1. Headline result

| Metric | Before | After | Evidence |
|---|---|---|---|
| Route×width combos with horizontal overflow | **108 / 144** | **0 / 144** | Chromium, 16 routes × 9 widths |
| Routes with sub-44px touch targets | **15 / 16** | **0 / 16** | measured at 375px |
| Authenticated routes verified in-browser | **0** (blocked) | **18** | incl. both portals |
| axe checks (22 routes × 2 widths) | not run | **44/44**, zero exceptions | |
| Browser assertions | 35 | **344** | 300 responsive/portal/table/auth/site-ops + 44 axe |
| Console errors across all routes | 0 | 0 | |
| Failed network requests | 0 | 0 | |
| Frontend lint | 0 problems | **0 problems** | |
| Frontend build | passes | **passes** | |
| CSS bundle | 53.91 kB (11.17 gz) | 73.28 kB (13.24 gz) | +2.07 kB gzipped |
| JS entry chunk | 456.97 kB (146.78 gz) | 463.75 kB (149.41 gz) | +2.63 kB gzipped |
| Dependencies added | — | **none** | |

The worst single measurement before: `/tenders/:id` overflowed by **221px at
1920px** and 359px at 320px. Every authenticated route overflowed at nearly
every width, desktop included.

---

# 2. The blocker the previous pass could not clear

The prior audit marked all 18 authenticated routes **BLOCKED** — login did
not complete, so nothing behind the sign-in wall could be seen.

**Root cause found:** `BREAK_GLASS_ADMIN_EMAIL` and
`BREAK_GLASS_ADMIN_PASSWORD` are present as keys in `backend/.env` but
**empty**. `scripts/createBreakGlassAdmin.js` validates them before doing
anything, so no account had ever been created. The failure was never in the
credentials, CORS or the wiring — all of which the previous pass had
correctly cleared.

**Resolved by** creating a dedicated fixture against the **local** database
(`DATABASE_URL` → `postgresql://…@localhost:5432/construction_portal`;
`NODE_ENV=development`). A *new* address was used so the script's
`ON CONFLICT` upsert could not overwrite any of the 98 existing users:

```
id 1688 · ui-redesign-e2e@local.test · company 1 · role admin
```

`SUPABASE_URL` in that file points at hosted storage for file uploads only;
the database itself is local. No production data was read or written.

**A second blocker surfaced during the work:** the first full audit run
tripped the backend rate limiter, and 15 of 16 routes silently returned
HTTP 429. Layout still measured correctly, but the tables were empty — so
the numbers would have understated table overflow. The run was repeated with
`RATE_LIMIT_MAX` raised on the command line (`.env` untouched) and zero HTTP
errors. **Every figure in this document comes from the clean run.**

---

# 3. Tooling — both used, genuinely

## UI/UX Pro Max skill ✅

Installed at `.claude/skills/ui-ux-pro-max/` (146 files, 7 skills, CSV
databases, Python search scripts). Invoked, not just read.

**Queries run:**

| Command | Used for |
|---|---|
| `search.py "enterprise construction management SaaS operational financial dashboard data-dense" --design-system --variance 2 --motion 2 --density 8` | Overall direction |
| `--domain product "saas admin enterprise b2b operations"` | Product classification |
| `--domain color "saas enterprise professional trust blue slate"` | Palette |
| `--domain typography "professional enterprise dashboard data precise readable"` | Type |
| `--domain ux "table data density responsive mobile overflow"` | Table strategy |
| `--domain ux "form validation label error accessibility grouping"` | Forms |
| `--domain web "navigation sidebar drawer touch targets safe area"` | Shell |

**What was taken:**

- `--domain color` returned **SaaS (General): `#2563EB` "trust blue"** and
  **B2B Service: `#0F172A` slate**. These directly corroborate the brief's
  requested palette and drove the primary-action change in §5.
- `--domain ux` → *"Tables can overflow on mobile → use horizontal scroll or
  card layout"* and *"Design mobile-first, then enhance"* shaped §4.2 and §5.
- `--domain web` → the 44×44 floor and 8px spacing rules, enforced in §4.6.
- Quick Reference §1–§2 (Accessibility, Touch) used as the pre-delivery
  checklist.

**What was rejected, and why — this matters.**
`--design-system` resolved to the **"Real-Time / Operations Landing"**
pattern with the **"Exaggerated Minimalism"** style: `font-size: clamp(3rem,
10vw, 12rem)`, `font-weight: 900`, "massive whitespace", a dark-mode-default
palette (`--color-background: #020617`), and an anti-pattern list whose first
entry is *"Light mode default"*.

That output is tuned for a **marketing landing page**, not an authenticated
operational tool. Following it would have produced precisely what the brief
forbids — oversized headlines, huge empty areas, a decorative dark shell.
The skill's own guidance says not to combine incompatible styles; the
landing-page pattern was therefore discarded and only the domain-level
results above were used. **Recorded here rather than quietly dropped,
because it is the single largest divergence between tool output and
delivered work.**

Typography: the skill's top pairing was *Dashboard Data* (Fira Code + Fira
Sans) and its accessibility pick was *Corporate Trust* (Lexend + Source Sans
3). Both were declined — adding two webfonts costs a network round trip,
FOIT risk and bundle weight for an app whose value is data density. The
system font stack is retained, with `font-variant-numeric: tabular-nums`
applied to figures, which is what the skill's `number-tabular` rule is
actually asking for.

## 21st.dev MCP ✅

Connected and used. **Account is free tier: searches unmetered, but only
2 component-code retrievals per day** (`get_usage` → `freeRetrievalsPerDay:
2`). Since the registry is shadcn/Tailwind and this project is neither,
metadata comparison was the right level of engagement and **zero retrievals
were spent** — the two remain available.

**13 searches run**, ~80 components reviewed by metadata and preview:

| # | Query | Category |
|---|---|---|
| 1 | responsive activity log / activity feed timeline | Activity Log |
| 2 | enterprise SaaS dashboard app shell responsive sidebar navigation | Shell |
| 3 | KPI metric stat cards dashboard summary | Metrics |
| 4 | responsive data table with sorting pagination and mobile card layout | Tables |
| 5 | filter toolbar search bar with faceted filters and active filter chips | Filters |
| 6 | mobile bottom sheet drawer dialog responsive modal | Modals |
| 7 | multi step form wizard with grouped sections and validation | Forms |
| 8 | empty state placeholder and skeleton loading states | States |
| 9 | file upload dropzone with camera photo capture mobile | Upload |
| 10 | invoice payment finance dashboard billing transactions | Finance |
| 11 | field operations site inspection work log inventory data entry mobile | Site Ops |
| 12 | scrollable tabs segmented control mobile responsive | Tabs |
| 13 | status badge pill semantic states with icon | Badges |

### Classification

**ADOPTED DIRECTLY — none.** Every candidate is shadcn/ui + Tailwind. This
project is React 19 + Vite with hand-written CSS and no `tailwind.config` or
`components.json`. Installing any of them means a second design system,
which the brief forbids. No `npx shadcn add` was run.

**ADAPTED to the current stack (pattern reimplemented in CSS tokens):**

| ID | Component | What was taken |
|---|---|---|
| 14941 | Dashboard Sidebar | Grouped multi-tier nav sections → the five-group sidebar |
| 11356 | Badge (coss.com) | 8 semantic variants + icon slot → the badge tone scale |
| 6602 | Filter Chips Breadcrumb | Removable active-filter chips → planned filter bar |
| 19009 | Sidebar Dashboard Skeleton | Skeleton mirroring real layout → loading states |
| 22187 | Invoice History Table | Outstanding-total footer row → finance tables |

**USED AS VISUAL REFERENCE ONLY:**

| ID | Component | Why reference only |
|---|---|---|
| 1354 / 4514 | Credenza / Modal | Dialog-on-desktop, drawer-on-mobile switch — right idea; depends on Radix + vaul |
| 16938 | HeroUI Table | Expandable rows, async + empty states; whole-library dependency |
| 23558 | Drawer (ddoemonn) | Headless focus-trap + scroll-lock hook; ours already does this |
| 23552 | Segmented Control | Accessible radio-group with arrow-key nav |
| 7884 | Capsule Tabs | Overflow handling for many tabs → Site Operations |
| 23557 | Skeleton Swap | Zero-CLS crossfade into real content |
| 10635 | Interactive Logs Table | Expandable log rows → Activity Log desktop |
| 7632 | List | Only result explicitly claiming "fully responsive" activity feed |
| 9216 | Chrono Board | Timeline with status cues |
| 19201 | File Dropzone | Validation + preview behaviour → Site Operations upload |
| 13985 | Efferd Dashboard 2 | Dense KPI grid proportions |

**REJECTED:**

| ID | Component | Reason |
|---|---|---|
| 13218 | 8-bit Stats Dashboard | Retro pixel styling — wrong product class entirely |
| 8948 | SaaS Template | Marketing landing hero; the exact thing being removed |
| 19357 | Workbench Sidebar | Glassmorphic — ruled out for ordinary business chrome |
| 21517 | Animated Sidebar | Drag-to-resize + spring hover; novelty in an ops tool |
| 22177 | Complex Data Table | Requires TanStack Table dependency |
| 1428 | Expandable Tabs | Collapses to icon-only — harms discoverability |
| 8243 | Review Filter Bars | Star-rating domain, irrelevant |
| 18044 | Chat Form Dropzone | Chat domain, irrelevant |
| 2365 / 2364 / 2384 | reaviz Incident components | Security-observability domain, not construction ops |
| 2503 / 7841 / 7792 / 7760 | Chart-led "stat" cards | Decorative sparklines that answer no business question |

## Supplied component examples — REVIEWED FROM ACTUAL SOURCE

No files were attached to the session and none exist locally. Searched:
the whole repo excluding `node_modules`/`.git`/`dist`, every untracked file,
`~/Downloads`, `~/Desktop`, `~/Documents`, `/tmp`, and all 30 `tmp-mount-*`
attachment mount points (every one empty).

Both are **published 21st.dev components**, so the real source was retrieved
through the MCP rather than classified from description. Two retrievals spent;
the quota is 2/day.

### Gradient Shimmer — id 16788, `@mona_biasia`

| Aspect | Finding (from source) |
|---|---|
| Dependencies | **Genuinely none.** `registryDependencies.npmDependencies` is `{}`, and the file imports only from `react` |
| Tailwind | Not used by the component (the *demo* uses Tailwind classes; the component does not) |
| TypeScript | Yes — typed props, would need converting to JSX |
| Animation cost | Web Animations API, animates `background-position` only |
| Reduced motion | **Handled properly** — `prefersReducedMotion()` short-circuits the sweep and renders a static gradient |
| Other gating | Pauses off-screen (IntersectionObserver), while the tab is hidden, and during scroll |
| Accessibility | Renders plain text in a `<span>`; relies on `background-clip: text` with a capability check that reveals normal text where unsupported |
| Responsive | Re-measures on font size; sweep speed normalised to px/s |

**Classification: SUITABLE FOR LIMITED USE — but not adopted, because this
portal has no use for it.** The component is well built and its own
description names the right use case: "signalling a running / loading task
inline in text". This portal has no AI-processing state and no long-running
inline task. Its loading states are register fetches, which are better served
by skeleton blocks that reserve layout than by shimmering text. Adding it
would mean a TypeScript→JSX conversion for a component with no consumer.

Revisit **only** if a genuinely long-running inline operation appears (a bulk
export, a background reconciliation). It must never animate page titles,
table headers or ordinary business data.

### Marquee Along SVG Path — id 19091, `@danielpetho`

| Aspect | Finding (from source) |
|---|---|
| Dependencies | `motion/react` (Framer Motion) — a real runtime dependency |
| Tailwind/shadcn | Imports `cn` from `@/lib/utils`, a shadcn helper that does not exist here |
| TypeScript | Yes, heavily typed |
| Animation cost | `useAnimationFrame` running **continuously**, plus `useScroll`/`useVelocity`/`useSpring` — permanent main-thread work |
| Reduced motion | **None.** No `prefers-reduced-motion` check anywhere in the file |
| Accessibility | Only `aria-hidden` on duplicate repeats; content is dragged and moved with no keyboard path |
| **Correctness defect** | **Calls React hooks inside `items.map()`** — `useTransform`, `useMotionValue` and `useEffect` are all invoked per item in the render body. That violates the Rules of Hooks: change the number of children and hook order changes between renders, which React treats as an error |

**Classification: REJECTED for the portal.** Marketing-only at best. Four
independent reasons: a continuously-running animation frame in a data-dense
operational tool, no reduced-motion support at all, a shadcn/Tailwind
dependency this project does not have, and a Rules-of-Hooks violation that
would be a latent bug wherever it were used. The same reasoning retired the
animated background blobs (§4.3).

Neither component was installed. No dependency was added for either.

---

# 4. What was actually wrong — measured, not guessed

Every cause below was confirmed in Chromium before being changed. Two
plausible-looking suspects were **disproved** and left alone, which is the
part worth reading.

## 4.1 `.topbar-actions` — 52px on every route

The header's action cluster was a text "Logout" button plus a bell, with
`flex: 0 0 auto`. Measured **343px wide inside a 375px viewport**, right edge
at 427px. Because it refused to shrink it pushed every authenticated page
sideways.

Logout moved into an account menu behind a fixed-size avatar trigger; the
cluster is now ~126px of icon controls and the page title is the elastic
element. A later 3px residual at 320px was traced to the reverse mistake
(letting the cluster shrink below its content) and corrected.

A second, unrelated rule contributed: `animations.css` carried
`@media (max-width: 768px) { .topbar-actions { width: 100% } }`, a leftover
from an older stacked header. It inflated the cluster to 218px and squeezed
the page title to 57px — rendering "Dashboard" as "Das…". Removed.

## 4.2 `table { min-width: 640px }` — the desktop overflow too

`foundation.css` applied a 640px floor to **every** `table`, wrapped or not.
A DOM probe across all routes found **19 tables not inside `.table-wrapper`**
(4 on Dashboard, 4 on Tender Details, 2 on Payments, 1 each on nine others).
Each forced a 640px box into whatever container held it — 265px of overflow
on a phone, and still 74px at 1440px.

The floor is now scoped to `.table-wrapper table`. Unwrapped tables get a
`:where()`-based safety net that makes the table its own scroll container, so
a table added later without a wrapper degrades to "scrolls inside itself"
rather than "breaks the page sideways".

Also found and fixed: **`.table-wrapper` was declared twice** — once in
`foundation.css` with tokens, once in `tables.css` with hard-coded hexes.
`tables.css` loads later, so the documented foundation rule was dead code.

## 4.3 Disproved: the background blobs

`.bg-blob-one/two` appeared in 80 culprit measurements and looked like an
obvious cause. They are **not** — the parent `.app-bg-effects` carries
`overflow: hidden`, so they are clipped. `getBoundingClientRect()` reports an
element's box regardless of ancestor clipping, which is what made them look
guilty. The detection was corrected to walk ancestors for clipping before
attributing blame.

They were still removed, for the honest reason: two blurred blobs and a
scrolling grid animating continuously behind every page is decoration the
approved direction rules out, and a permanent compositing cost on a phone.
**Removed as design cleanup, not as an overflow fix.**

## 4.4 Disproved: `body { overflow-x: hidden }` masking the diagnosis

The first diagnostic pass found *zero* unclipped causes, which was wrong. The
ancestor walk was treating `body`'s last-resort `overflow-x: hidden` guard as
a legitimate clip, marking every element innocent. Excluding `body`/`html`
from the walk immediately surfaced §4.1 and §4.2. The guard remains, but it
was hiding the diagnosis rather than solving the problem.

## 4.5 Specificity: `.topbar button`

`forms.css` listed `.topbar button` (0,1,1) in a compound selector setting
`background: var(--primary)`. That beat `.sidebar-toggle`, `.account-trigger`
and `.notification-button` (all 0,1,0), painting every header control solid
primary — a row of identical blue blocks with no hierarchy.

This is the **same trap already documented three lines below it** for
`.login-box button`, which the previous pass had fixed with a `:not()`.
Rather than add a second exception, `.topbar button` was removed from the
list and the header styles its own controls.

## 4.6 Touch targets

`forms.css` redefined `.secondary-btn` at 42px, `.delete-btn` at 38px and
`.export-menu-button` at 42px — all silently undercutting the 44px floor
`button` already establishes. `.table-link-button` reset `min-height` to
`auto`, producing a **17px** control; it is how a record is opened from a
register, one of the most-tapped things in the product. Bare
`<Link>Open</Link>` in dashboard cells measured 17px, and "View all" section
links 23px.

All raised to the floor. `.table-link-button` deliberately does **not** take
WCAG 2.2's inline-link exemption: it is a standalone action in a cell, not a
link in prose, and the people tapping it are on site.

## 4.7 Documentation that contradicted the code

Two claims in `Sidebar.jsx` were false:

- *"The current route carries `aria-current="page"`"* — the code passed
  `aria-current={undefined}` to every `NavLink`, explicitly overriding React
  Router's default. The current page was **never** announced.
- *"`inert` removes them from the tab order"* — there was no `inert`
  anywhere. Tab walked straight into the off-canvas drawer.

Both now implemented, and both have regression tests.

## 4.8 Focus landed on the scrim

The drawer's focus-on-open searched the wrapper, which contains the scrim
*before* the panel. A user opening the menu was placed on "Close navigation
menu". Scoped to `#app-sidebar`. Caught by the new test suite, not by eye.

## 4.9 The dashboard hero

A full-bleed gradient banner: the eyebrow "GOOD AFTERNOON", the product's own
name at `clamp(36px, 5vw, 58px)`, a marketing sentence, and four glass tiles
showing Income / Expense / Profit / Running — three of which were **duplicated
verbatim** by stat cards directly below it.

Its grid was `minmax(0, 1.2fr) minmax(300px, 0.8fr)`. Two tracks with a 300px
floor cannot fit a 375px viewport, so at phone width the text column was
crushed and every word wrapped **one letter per line**, with the first tile
outside the viewport entirely.

Replaced with a short greeting plus a **"needs attention" strip** that answers
the brief's first dashboard question — overdue invoices and their value,
tenders past deadline, tenders closing soon, invoices awaiting payment,
tenders to submit. It renders nothing when nothing is wrong, because a panel
that is always present stops being read. Every figure was already computed by
the page for its stat cards; nothing new is derived and no new request made.

---

# 5. Design direction

**Industrial Enterprise SaaS** — slate structural spine, construction blue
for action, amber reserved for warning.

## The palette correction

The token layer had `--accent: slate-900` for primary actions and
`--accent-brand: amber-500`. Two problems:

1. **A semantic collision.** `--accent-brand` and `--status-warning-border`
   were *both* `amber-500`. In a portal where amber means overdue, pending or
   unsafe, the brand accent and the danger signal were the same colour.
2. With slate-900 as the primary action, a filled button was
   indistinguishable from the sidebar and from body text — "what do I click"
   had no colour answer.

Now:

```css
--accent:        var(--color-blue-600);   /* #2563eb — primary action */
--accent-hover:  var(--color-blue-700);
--identity-mark: var(--color-amber-500);  /* sidebar mark ONLY        */
```

Amber is a semantic warning colour everywhere else. The one decorative
exception is the sidebar brand mark, named `--identity-mark` so nobody reuses
it by accident. This matches both the brief's requested palette and the
skill's `--domain color` result for this product class.

## Selected system

| Dimension | Decision |
|---|---|
| Style | Restrained enterprise; flat surfaces, 1px slate borders, shadow only for true elevation |
| Colour | Slate spine · blue action · amber warning · green success · red danger |
| Typography | System stack; `tabular-nums` on figures; page title 18–22px, never a marketing headline |
| Spacing | 4px scale + fluid `--page-gutter: clamp(16px, 3vw, 32px)` |
| Density | High (dashboard tier) — the skill's `--density 8` |
| Radius | 4 / 6 / 10 / 14 / 18 / 24 / pill |
| Borders | `--border-subtle` default; colour-coded left bar carries severity |
| Shadow | 5 steps; `xs`–`sm` for cards, `lg`+ for overlays only |
| Motion | 80–320ms; all durations collapse to 0 under `prefers-reduced-motion` |
| Responsive | Mobile-first, `min-width` only; `auto-fit`/`minmax`/`clamp` over breakpoints |
| Tables | Wrapper scroll now; per-table card mode outstanding (§7) |
| Mobile nav | Off-canvas drawer < 1024px, permanent sidebar ≥ 1024px |
| Forms | Visible labels, 16px inputs (iOS zoom floor), grouped sections |
| Icons | Inline SVG set, 24px grid, 1.75 stroke, `currentColor` — **no dependency** |

## Navigation

Fifteen flat links became five labelled groups — Overview, Projects, People,
Finance, Administration — each its own `<nav>` with an accessible name, plus
an identity footer pinned below the scrolling list.

There is deliberately **no "Sites" entry**: `/sites` is a redirect to
`/tenders` (sites are managed inside the tender that owns them), so a second
link to the same destination would be noise. Worth knowing when reading the
brief's suggested nav groups against what shipped.

Role filtering is unchanged and still matches `AppRoutes.jsx` exactly: User
Management and Update Approvals remain admin-only.

## Icons — no dependency added

Twenty-eight glyphs drawn inline in `components/ui/Icon.jsx`: 24px viewBox,
stroke-only, 1.75 width, round caps, `currentColor`, `aria-hidden` by
default. `lucide-react` would have been ~1.5 MB installed and a module per
icon for the same result.

Emoji used as icons were removed — 🔔 in the notification button and 📄/📊
across three export components. Emoji are font-dependent, render differently
per platform, cannot inherit colour, and are announced by screen readers on
top of the control's own label. (UI/UX Pro Max: `no-emoji-icons`.)

---

# 6. Files changed

**Added (3)**
- `frontend/src/components/ui/Icon.jsx`
- `frontend/tests/authenticated.spec.js`
- `DESIGN_SYSTEM.md`

**Removed (1)**
- `frontend/src/components/AppBackground.jsx` — decorative layer; all
  consumers checked first (only `AppLayout.jsx` + one CSS block)

**Modified (14)**
- `frontend/src/components/Sidebar.jsx` — grouped nav, icons, identity footer, `aria-current`
- `frontend/src/components/Topbar.jsx` — account menu, overflow fix, icon
- `frontend/src/components/NotificationCenter.jsx` — emoji → SVG
- `frontend/src/components/DashboardHero.jsx` — marketing hero → attention panel
- `frontend/src/layouts/AppLayout.jsx` — `inert`, focus scope, background removed
- `frontend/src/pages/DashboardPage.jsx` — attention-panel wiring
- `frontend/src/components/export/ExportButtons.jsx`, `export/DocumentExportButtons.jsx`, `tenderDetails/TenderFinanceTab.jsx` — emoji removed
- `frontend/src/styles/core/tokens.css` — palette correction
- `frontend/src/styles/core/foundation.css` — table scoping, touch floors, shared eyebrow
- `frontend/src/styles/core/shell.css` — sidebar groups, account menu, topbar flex
- `frontend/src/styles/core/animations.css` — background removed, stale mobile rule removed
- `frontend/src/styles/components/forms.css` — touch floors, `.topbar button` removed, gradient removed
- `frontend/src/styles/components/tables.css` — duplicate wrapper removed, tokens
- `frontend/src/styles/pages/dashboard.css` — hero → intro + attention strip

**A near-miss worth recording.** Deleting the dashboard hero CSS would have
silently unstyled **five other screens** — all four auth pages and the Tender
Details header all use `.dashboard-hero-eyebrow`. Caught by grepping
consumers before deleting; the class moved to `foundation.css` as a shared
primitive. This is exactly the failure mode the brief's CSS rules warn about.

## CSS architecture

Unchanged in shape — the previous pass's structure was already sound:

```
index.css                    single entry, cascade order explicit
  core/tokens.css            tokens only, no selectors
  core/foundation.css        reset + shared primitives
  core/shell.css             sidebar, topbar, drawer, container
  core/utilities.css  core/animations.css  components/*.css
  pages/*.css                genuinely page-specific
  core/responsive.css        cross-cutting, last so it wins
```

What changed *within* it: the duplicate `.table-wrapper`, the dead
`.dashboard-hero*` block, the orphaned `.app-bg-effects` rules and a stale
mobile `.topbar-actions` override were removed; hard-coded hexes in
`tables.css` and `forms.css` were replaced with tokens.

---

# 7. Business logic — unchanged

No file under `backend/` was modified. No service, hook, context, route, role
check, request payload or calculation was touched. The one JS-behaviour
change outside presentation is `DashboardPage` reading `user.full_name` from
the existing auth context for a greeting — no permission or data decision
derives from it.

`DashboardHero`'s new props are all values the page **already computed** for
its stat cards. Nothing new is derived and no new request is made.

Route-level lazy loading is intact — 18 `lazy()` boundaries, unchanged.

---

# 8. Table inventory and mobile strategy

## The verified count is not 25

The earlier "25 tables" figure was wrong. It came from a DOM probe of the 16
office routes only. Measured properly:

- **81 `<table>` tags in JSX source** (`grep -rn "<table" src/`)
- **42 tables actually rendered** across all 18 reachable routes, counted in
  the browser with real data — the gap is tabs, conditional branches and the
  two portals an admin cannot see.

Of those 42, **18 have no `<thead>` at all**: they are layout tables used for
filter panels, ratio bars and metric grids (Dashboard "Finance Health",
Payments "Expense Ratio", every "…Filters" panel). They hold no tabular data,
so a card transform would be meaningless. **24 are real data tables.**

## Strategy per table

| # | Route | Table | Cols | Strategy | Why |
|---|---|---|---|---|---|
| 1 | Workers | Workers Register | 6 | **A — cards** ✅ | One row = one worker |
| 2 | Users | Users Register | 5 | **A — cards** ✅ | One row = one user; long emails need to wrap |
| 3 | Tenders | Tenders Register | 8 | **A — cards** ✅ | One row = one tender |
| 4 | Subcontractors | Subcontractors Register | 8 | **A — cards** ✅ | One row = one subcontractor |
| 5 | Activity Log | Audit trail | 6 | **Not a table any more** ✅ | Replaced by a date-grouped stream — see §8b |
| 6 | Invoices | Invoices Register | 5 | **A — cards** ✅ | One row = one invoice |
| 7 | Approvals | Approval Requests | 10 | **A — cards** ✅ | One row = one request awaiting a decision |
| 8 | Daily Site Updates | Daily Progress | 7 | **A — cards** ✅ | One row = one site update |
| 9 | Worker Money | Pending Expense Approvals | 6 | **A — cards** ✅ | One row = one claim |
| 9b | Worker Money | Expense ledger | 8 | **A — cards** ✅ | One row = one expense record |
| 10 | Worker Money | Allocation Summary | 9 | **D — scroll** | Allocated / spent / remaining must stay side by side to be read as a balance |
| 11 | Payments | Finance Records | 11 | **D — scroll** | Genuine financial matrix; 11 columns compared across rows |
| 12 | Reports | Finance Report Preview | 9 | **D — scroll** | Export preview must mirror the exported column order exactly |
| 13 | Tender Details | Profit Breakdown | 2 | **C — priority columns** | Only metric + amount; already readable unchanged |
| 14 | Tender Details | Cost Breakdown | 3 | **C — priority columns** | Three narrow columns fit a phone |
| 15–21 | Dashboard | 7 summary tables (Recent Payments, Upcoming Tenders, Recent Invoices, Recent Tenders, Recent Workers, Recent Sites, Suggested Actions) | 4 each | B — expandable rows | Each is a 4-column preview capped at ~5 rows; full detail lives on the linked route |
| 22 | Worker Portal | Recent Activity | 3 | **C — priority columns** | Three columns, already phone-readable |
| 23 | Subcontractor Portal | Recent Updates | 3 | **C — priority columns** | Same |
| 24 | Tenders | secondary register | — | D — scroll | Nested inside a tender detail context |
| — | 18 others | Layout/filter/ratio panels | 0 | **N/A** | No `<thead>`; not tabular data |

**✅ = implemented and asserted in `tests/portals-and-tables.spec.js`.**
**All nine card-suitable registers now use card mode.** Rows 1–4 assert the
derived `data-label` values directly; rows 7–9b are empty in the local seed,
so they assert card mode and zero overflow instead — the stamping itself is
the same `ResponsiveTable` code path proven by rows 1–4.

# 8b. Activity Log — the audit trail is no longer a table

An audit trail is read chronologically. Nothing on the page benefited from
column alignment, which is the only thing a table buys, and the six-column
layout had to squeeze onto a phone. Its widest column held a run-on string —
`salary: 24000 → 26000 · status: active` — which is the least readable
possible form for structured data.

`components/activity/ActivityStream.jsx` replaces it with:

- **Date grouping** into *Today* / *Yesterday* / a formatted date. Buckets
  are derived by comparing local calendar components, **not** by
  string-matching the timestamp, so they stay correct across timezones and
  whatever format the API sends. The day heading sticks on desktop so the
  reader never loses context while scrolling.
- **A timeline rail** with a per-action marker (create / update / delete),
  paired with a text badge — the action is never colour alone.
- **Expandable metadata** as a real disclosure: a `<button>` with
  `aria-expanded` and `aria-controls`, collapsed by default, rendering a
  `<dl>` of key/value pairs. A changed field shows both sides with the old
  value struck through, so the direction of change does not depend on
  position alone.
- The panel is **absent when collapsed**, not merely hidden — a hidden copy
  would make a screen reader walk 200 rows of invisible field values.
- `<time dateTime>` carries the machine-readable timestamp.

One layout serves both widths — the stream is already one column, so there
is no separate mobile markup to drift.

Filters, pagination, the export, the API call and permissions are unchanged.
No comment or reply affordance was added: the portal has no such feature,
and inventing one would misrepresent what the audit trail is. (That is the
one thing deliberately *not* taken from 21st.dev's Activity Feed, 19073.)

**Asserted:** day grouping renders, the stream contains no `<table>`,
metadata expands and collapses, `aria-expanded` flips, `aria-controls`
resolves to a real element, Enter operates it from the keyboard, the
disclosure stays a text control on hover, and there is no overflow at 320px
with a panel expanded.

## How cards are implemented

`components/ui/ResponsiveTable.jsx`. The important decision: `data-label` is
**derived from the `<thead>` at runtime**, not hand-written on each cell.

Hand-writing meant ~500 attributes across 24 files, each a duplicate of the
`<th>` three lines above it. Those copies drift — someone renames a column,
the header updates, the mobile label silently does not, and the card starts
lying to the user. Reading the header instead gives a column exactly one
source of truth for its name. A `MutationObserver` re-stamps when rows change
so filtered and paginated tables stay labelled, and cells with `colSpan > 1`
(the "no records" row) are skipped rather than mislabelled with the first
column's name.

Asserted per register: rows stack (`display: block`), `<thead>` stays
`sr-only` rather than `display: none` so the table is still announced, every
non-spanning cell carries a label, the labels are the real column names, and
**desktop still renders a table** at 1440px.

# 8c. Authentication — one shared shell

All four public screens carried the same `.login-shell` → `.login-brand` +
`.login-box` markup, each with its own copy of the eyebrow, heading and
supporting paragraph. Four copies of one layout is four places to fix a
spacing bug. This was the clearest proven repetition in the codebase — the
bar is two consumers and this had four.

`components/auth/AuthShell.jsx` + `AuthLink` now own the frame. Each page
passes content and keeps its own form state, submission and API call exactly
as they were.

**Layout.** Mobile-first single column. The brand panel is `display: none`
below 900px — on a phone the form is the whole job, and a decorative panel
above it pushes the fields under the fold. At 900px it returns as the left
half of a two-panel layout.

**The supporting visual is a CSS blueprint grid** — two
`repeating-linear-gradient`s on the dark panel. No image request, scales to
any viewport, and it reads as construction without a stock photo or a
marketing hero. It is static; nothing on an authentication screen should move.

**Heading order fixed.** The form card's heading is now the page's `<h1>` and
names the task ("Sign in"), not the product. The brand panel is
`aria-hidden` — everything in it is decorative or duplicated by the card, so
a screen reader reaches the form immediately instead of hearing the product
blurb first.

**Errors moved above the fields.** They used to render under a full-width
submit button, which on a phone is frequently below the fold: the user sees
nothing happen and presses Sign in again.

**Specificity trap removed.** The old sheet styled controls by descendant
selector (`.login-box button`), which is what made the password toggle render
as a filled dark button over the input. Controls are styled by class now, and
`.password-toggle-btn` uses the `:not(:disabled)` shape needed to beat
`button:hover:not(:disabled)`.

**Asserted for all four pages:** shared shell present, exactly one `<h1>`,
brand panel hidden at 375px and visible at 1440px, submit full-width at
320px and ≥44px tall, password toggle flips `type` and `aria-pressed` without
overlapping the input text, and every input has a visible label plus an
`autocomplete` attribute.

Authentication behaviour is unchanged — no API call, token handling,
validation, reset-token flow, redirect or role routing was touched.

# 8d. Site Operations — date-only workspace (option c)

The redesign brief specifies a **Context Selector Card** carrying a *tender
selector, site selector and date selector*, and says "no duplicated selectors
elsewhere on the page". Before building it I read the page, the hook, the
service, the four controllers and the schema. The premise does not hold, and
building it anyway would silently change what the product records.

## Evidence

**The page has no tender or site selector to consolidate.** `SiteOperationsPage`
renders a header, four tabs (Material, Labour, Banking, Access Requests) and
the selected tab. The only shared dimension is `entry_date`, which each tab's
form owns individually.

**The frontend never sends or filters by either field:**

```
grep -rn "tender_id\|site_id"   src/services/siteOperationsService.js   src/hooks/useSiteOperations.js   src/pages/SiteOperationsPage.jsx
→ zero matches
```

**But the API accepts them.** `material.controller.js:410` destructures
`tender_id = null, site_id = null` from the body and writes both into
`site_material_entries` (`:575`). `labour.controller.js` has `l.tender_id` /
`l.site_id` query filters; `banking.controller.js` has a `tender_id` filter on
receipts, expenses and the summary.

**So every entry ever recorded has been saved unattributed:**

```sql
select count(*) total, count(tender_id) with_tender, count(site_id) with_site
from site_material_entries;
→ 1 | 0 | 0
```

## Why this is a decision, not a styling task

Adding the selectors means the frontend starts sending `tender_id` and
`site_id` on every create. That is not a presentation change:

- It changes what is written to the database from `null` to a real foreign key.
- It changes the meaning of existing rows relative to new ones — every
  historical entry stays unattributed while new ones are attributed, so any
  report filtered by tender silently excludes all prior data.
- Material entries carry `approval_status`, and the banking module filters by
  tender. Introducing attribution may change which records appear in an
  approver's queue.

The brief also states, in the same document, **"do not modify request
payloads"** and **"no new backend capabilities"**. Those two instructions and
the Context Selector Card requirement cannot all be satisfied at once.

## What is safe to build without the decision

A context card centred on **date** — the dimension that genuinely exists
today. Every form already has `entry_date`, and the whole access-request flow
is date-gated (`ACCESS_REQUIRED` for entries outside the allowed window). The
module navigation and the mobile one-column field layout are also pure
presentation and carry no such risk.

## Precise manual next step

Decide one of:

1. **Attribute going forward.** Confirm that new entries should carry tender
   and site while historical rows stay null, and that reports filtering by
   tender are expected to exclude pre-change data. Then the selectors are a
   small change — the API already accepts the fields.
2. **Backfill first.** Attribute the existing rows, then add the selectors, so
   filtering behaves consistently across all data.
3. **Keep it company-and-date scoped.** Drop the tender/site selectors from
   the design and ship the date context card only.

## Decision taken: option 3 — company-and-date scoped

The owner chose to keep Site Operations company-and-date scoped for this pass.
The tender/site attribution question is tracked separately as
**SITE-OPS-DATA-01** (see below) and is explicitly out of scope for UI work.

## What was built

**`components/siteOperations/SiteOpsContext.jsx`** — a date-only context card
plus the operational module navigation.

The card shows the working date (`Thursday, August 6, 2026`), a relative
status chip (`Today` / `Yesterday` / `N days ago`) and the active module. The
relative status is **text, not a colour** — a supervisor recording a backdated
entry needs to see that in words, and backdating is what triggers the
`ACCESS_REQUIRED` flow.

It is strictly presentational. It does **not** filter the register and does
**not** set the value any module submits — every module keeps its own
`entry_date` field exactly as it was. No request payload changed.

**Module navigation.** All four modules (Material, Labour, Banking, Access
Requests) are always visible, scrolling horizontally on a phone rather than
wrapping or collapsing into a "more" menu. Burying Banking or Access Requests
behind an overflow control on the screen a supervisor uses on site is the kind
of tidying that costs someone a job.

Keyboard: a proper WAI-ARIA roving tabindex — arrow keys move between modules,
Home/End jump to the ends, and only the active tab is in the tab order.
Previously all four were plain buttons with no arrow-key support. The panel is
now a labelled `role="tabpanel"` pointing back at its tab.

**Mobile field entry.** Below 768px every operational form is one column with
16px inputs and full-width submits. A two-column grid on a phone gives two
unusable half-width fields; on site, with gloves and in sunlight, that is the
difference between a record being made and not. Both photo inputs — the
camera-capture one and the gallery one, which the page records separately —
are preserved and asserted.

**Verified at 390 / 768 / 1440:** context card renders, four modules present,
one active, zero overflow, zero controls under 44px, no console errors, and
**zero tender/site selectors** — asserted by a test that names
SITE-OPS-DATA-01 in its failure message so the guard explains itself.

---

# SITE-OPS-DATA-01 — tender/site attribution for operational entries

**Status:** open · **Type:** product + data migration · **Not a UI task**

Decide whether Site Operations entries should be attributed to a tender and a
site.

**Current state.** The API accepts `tender_id` and `site_id` on a material
create (both default to `null`) and offers tender filters on labour and
banking. The frontend has never sent or filtered by either, so every row in
`site_material_entries` has both columns null (`1 | 0 | 0` at time of writing).

**What must be decided together:**

- Whether new entries start carrying attribution, and what happens to
  historical rows — attribute-forward means any tender-filtered report
  silently excludes all pre-change data.
- Whether a backfill is possible, and on what basis rows would be assigned.
- Whether material `approval_status` routing changes once entries are
  attributed.
- Migration ordering: selectors must not ship before the backfill decision, or
  the data splits into two incompatible eras.

**Blocked until decided:** tender and site selectors anywhere in Site
Operations. A test enforces their absence.

# 8e. Worker Portal — mobile-first restructure

## Feature inventory (read in full: 2,619 lines + service + child components)

**API surface — 7 calls, all preserved unchanged:** `getWorkerProfile`
(`/worker-portal/me`), `getWorkerAssignments`, `getWorkerDailyUpdates`,
`createWorkerDailyUpdate` (POST), `getWorkerTenderDocuments`,
`getWorkerMoney`, `createWorkerPortalExpense` (POST), plus `uploadFile` for
photo evidence (10 MB ceiling).

**Sections (five tabs, all retained):** Home / My Projects / Daily Updates /
My Money / My Profile.

**Features retained:** assignment list; daily-update form (project select,
date bounded by `minimumUpdateDate` = today−2 and `today`, notes, photo with
preview); expense form (allocation select, amount, date, description,
evidence upload with preview); allocation summary with per-allocation spent
and remaining; documents (lazily loaded, `documentsLoading`); export buttons
(context-sensitive per tab); logout.

**Derived state retained:** `allocationSummary` (spends netted per allocation,
rejected expenses excluded), `totals` (allocated, spent, remaining,
pendingUpdates, approvedUpdates, pendingExpenses), `recentUpdates`,
`selectedAssignment`.

**States retained:** full-page loading, full-page load error with Retry +
Logout, per-form submitting flags, `isBusy` disabling tabs during any
submission, status badges.

**Loads immediately:** profile, assignments, updates, money.
**Loads lazily:** tender documents, on entering that section.
**Submits:** daily update, expense. **Sensitive:** money/allocation figures —
the backend resolves the caller's own worker record from their user id, so
the portal cannot address another worker.

## Original problems

1. **It never answered the worker's first question.** The site and project
   existed only inside a `<select>` in the update form. The top of the screen
   showed a *count* — "My Projects: 3" — so "which site am I on today" was
   the one thing the portal would not tell you.
2. **Four office KPI tiles led the page** (My Projects, Pending Updates,
   Pending Expenses, Available Balance) — an admin-dashboard pattern on a
   field worker's phone.
3. **Numbers were marked up as `<h2>`**, giving a screen reader a heading
   called "3" and putting bare figures in the document outline.
4. **The header spent three lines** on a greeting plus a sentence explaining
   what the portal is for — text a daily user never needs again.
5. **Pending counts were inert.** They reported a problem without offering
   the action that resolves it.

## Final structure

**Mobile (one column, 320–414px):** compact `PortalHeader` (name, role,
export, neutral logout) → `CurrentAssignmentCard` → `RequiredActionsPanel` →
summary tiles → existing tabs and sections, untouched.

`CurrentAssignmentCard` is new. It leads with the **site name**, then the
project, and has a real empty state for a worker between jobs ("Your
supervisor will assign one — nothing is needed from you right now") rather
than a blank card. `currentAssignment` prefers the form's selection and falls
back to the first assignment, so it is populated on arrival and always agrees
with the form.

`RequiredActionsPanel` turns the two pending counts into actions that
navigate to the relevant section. It renders **nothing** when both are zero —
a panel that always reads "0" stops being read, and then it fails on the day
it matters.

**Tablet (768px+):** assignment card centres its icon and the site name steps
up a size. **Desktop (1024px+):** assignment and required actions share a row
— "where am I" and "what do I owe" answered together above the fold — and the
page is capped at **1100px**, well below the office `--content-max` of 1600px.
A worker's portal stretched across a 1920px monitor is a line length nobody
reads.

**Density is deliberately lower than the office pages.** Consistency here
means a shared design language — same tokens, status scale, radii, focus
treatment — not the same information density.

## Fixed along the way

- A **zero tinted as success**: "Approved updates: 0" rendered green, which
  says "all good" when it means "nothing approved yet". Tone now applies only
  to a meaningful value. Asserted by test.
- Summary figures are `<strong>`, not `<h2>`. Asserted by test.

## Components created

`components/portal/PortalPrimitives.jsx` — `PortalHeader`,
`CurrentAssignmentCard`, `RequiredActionsPanel`, `PortalSummaryCard`,
`PortalSection`. Placed under `portal/` rather than inside the Worker Portal
because the Subcontractor Portal is the intended second consumer; they carry
no business logic and make no API calls.

**Reused:** `Icon`, existing tokens, `.secondary-btn`, the status scale,
`ExportButtons` (unchanged).

## Verified

390 / 768 / 1440 screenshots, plus all nine widths asserted. Zero overflow,
zero sub-44px controls, one `<h1>`, no console errors, no failed requests,
logout neutral, no decorative gradients (the one remaining gradient is
`.table-wrapper`'s 24px scroll-affordance hairline, which is functional).
Admin rejection still enforced.

# 8f. Subcontractor Portal — mobile-first restructure

## Feature inventory (read in full: 2,420 lines + service + controller)

**API surface — 5 calls, all preserved unchanged:** `getSubcontractorProfile`
(`/subcontractor-portal/me`), `getSubcontractorTenders`,
`getSubcontractorTenderDetails`, `createSubcontractorDailyUpdate` (POST),
`addSubcontractorTenderDocument` (POST), plus `uploadFile`.

**Sections (five tabs, all retained):** Home / My Tenders / Daily Updates /
Documents / My Profile.

**Features retained:** assigned tender list with `assignment_status`,
`tender_status`, `assigned_amount`, `due_date`; tender detail fetch (sites,
documents, banking); daily-update form (tender select, date bounded to
today−2..today, notes, photo upload with preview); document upload against
the selected tender; profile with `bank_name`; export buttons per tab;
logout.

**Derived state retained:** `totals` (assignedValue, runningTenders,
completedTenders, pendingUpdates, approvedUpdates), `recentUpdates`,
`selectedTender`.

**States retained:** full-page loading, load error with Retry + Logout,
per-form submitting flags, `isBusy` tab disabling, status badges.

### Masked / sensitive data — the important finding

`/subcontractor-portal/me` returns the caller's **own** `account_number` and
`ifsc_code`. The controller documents this as deliberate ("it is their own
bank record"). The frontend has **never displayed them** — only `bank_name`
is rendered, at one place in the profile section.

That behaviour is preserved exactly, and is now **enforced by test**: the
suite walks all five sections and fails if an IFSC-shaped value or an
"account number"/"IFSC" label appears anywhere in the rendered text. A
redesign that surfaced the full record would put a bank account on a phone
screen on a building site.

## Original problems

1. **Seven office KPI tiles led the page** — My Tenders, Running, Completed,
   Assigned Value, Pending Updates, Approved Updates, Selected Tender
   Documents. Twice the Worker Portal's four, and the project itself was only
   reachable by opening a tab.
2. **It never answered "which project am I on?"** — the same failure the
   Worker Portal had with its site.
3. Numbers marked up as `<h2>`, giving screen-reader headings called "0".
4. Header spent three lines re-explaining the portal.

## Final structure

**Mobile:** compact `PortalHeader` (business name, role, export, neutral
logout) → `CurrentProjectCard` → `RequiredActionsPanel` → four summary tiles
→ existing tabs and sections, untouched.

`CurrentProjectCard` is a **sibling of `CurrentAssignmentCard`, not a mode of
it** — the two answer different first questions, and that difference is the
point:

| | Headline | Beneath |
|---|---|---|
| Worker | **Site** — what they travel to | Project |
| Subcontractor | **Project** — what they contracted for | Site, assigned value, due date |

Collapsing them behind a `variant` prop would produce an abstraction whose
branches share no logic. They share the CSS instead, which is where the
design language actually lives.

The project facts are a `<dl>`: a bare row of numbers on a contract is
exactly the kind of thing that gets misread.

**Summary tiles reduced 7 → 4** (My projects with a running count, Assigned
value, Approved updates, Completed projects). Running/completed counts and the
document count moved into the sections that own them — a tile that reports a
number with no action attached is a dashboard habit, not a contractor need.

**Desktop (1024px+):** project card and required actions share a row; page
capped at 1100px, same as the Worker Portal.

## Sibling, not twin

Same tokens, spacing, typography, card treatment, status scale, focus
handling and neutral logout as the Worker Portal. Different hierarchy,
different first question, different summary figures. Consistency here means a
shared design language, not an identical page.

## Verified

390 / 768 / 1440 screenshots plus all nine widths asserted. Zero overflow,
zero sub-44px controls, one `<h1>`, no console errors, no failed requests,
neutral logout, zero decorative gradients on portal surfaces, all five
sections still reachable, admin rejection still enforced, and the masked
bank fields still absent from every section.

# 9. Not completed — honest status

The brief asks for every route to be individually redesigned. **That is not
what was delivered.** What *was* delivered: every route individually audited
in a browser, every route's structural defects fixed and verified, and the
shell, dashboard, palette, icon system and test harness rebuilt.

| Item | Status | Detail |
|---|---|---|
| **Mobile table cards** | **Done — all 9** | Workers, Users, Tenders, Subcontractors, Invoices, Approvals, Daily Site Updates and both Worker Money registers. Activity Log left the table model entirely. Allocation Summary, Finance Records and the Report preview stay scrollable by design (§8). |
| **Activity Log** | **Done** | Date-grouped stream, timeline rail, expandable metadata, keyboard disclosure — §8b. |
| **Fixture credential hardening** | **Done** | No password defaults anywhere in tracked source; suites fail fast naming the missing variable. |
| **Portal visual defects** | **Partial** | Logout no longer uses destructive red on either portal (it was `delete-btn` in four places — a non-destructive action wearing the colour that means "overdue, rejected, failed"). The three gradient stat cards are now flat tinted surfaces with a status left-bar. The **fuller portal restructure** in the brief — assignment-first ordering, quick-action blocks, a compact worker header — was **not** done. |
| **Site Operations bespoke layout** | **Not done** | Overflow, touch targets and axe all pass; the file inputs got accessible names. The tender/site/date context card, scrollable module tabs and one-column mobile entry forms were **not** built. |
| **Auth page redesign** | **Done** | All four rebuilt on a shared `AuthShell` — see §8c. |
| **Shared component library** | **Partial** | `Icon`, `ResponsiveTable`, `ActivityStream`, `AuthShell` and `AuthLink` built and in use. `PageHeader`, `StatusBadge`, `EmptyState`, `Modal`, `ConfirmDialog`, `Pagination`, `FilterBar`, `ContextSelectorCard` **not** extracted. |
| **Per-route filters / empty / loading states** | **Not done** | Not individually reviewed or standardised. |
| **Screen-reader walkthrough** | **Not done** | Semantics verified by axe and by assertion, not by listening with a real screen reader. axe catches roughly a third of WCAG issues; it is a floor, not a certificate. |

## Also fixed this pass — a global animation anti-pattern

`animations.css` gave **every** `button` in the product a skewed white
gradient `::after` that swept across it on hover, plus
`transform: translateY(-3px)` with a 30px drop shadow, plus `scale(0.96)` on
press. All three are removed:

1. Gradients on ordinary controls, heavy shadows and novelty interactions are
   all ruled out by the approved direction.
2. `z-index: -1` on the sweep painted a layer behind every button *including
   text-style ones with no background*, which is what made the Activity Log's
   "Hide details" control render as a solid filled block.
3. A 3px lift moves the thing the user is aiming at. In a dense table of row
   actions that is a real mis-click risk, and it contradicts the
   `stable-interaction-states` rule.

Hover feedback is now the colour change each control defines for itself —
visible, instant, and it moves nothing.

## Known issue found but not fixed

`UsersPage` renders the **role** badge through the same helper as *status*,
so an `Admin` role displays in danger red — the colour that means "overdue,
rejected, failed" everywhere else in the product. Visible in the mobile card
screenshot. It is page-level logic rather than a design-system defect, and
fixing it means introducing a separate role-badge mapping; left alone rather
than changed late without review.

## Recommended order for the next pass

1. Convert the last three card-suitable registers (Approvals, Daily Site
   Updates, Worker Money pending approvals) — mechanical, one swap each.
2. Worker and Subcontractor portal visual redesign. They are now openable and
   fully testable, and they are the two phone-first audiences.
3. Activity Log desktop timeline; then Site Operations field workspace.
4. Auth page redesign.
5. Fix the role-badge colour mapping in User Management.
6. Extract the remaining shared components; migrate page sheets off the
   legacy token aliases.

---

## Legacy token aliases retired (AUD-014)

Item 6 of the list above — "migrate page sheets off the legacy token aliases"
— is done. Full evidence is in COMPLETE_CODEBASE_AUDIT.md AUD-014; the
design-relevant summary:

**17 aliases, 72 references, 14 stylesheets, 0 remaining.** The brief named 7;
the inventory found 17, including three `--accent-brand*` names and a second
`:root` block in `animations.css` holding a parallel motion scale.

**What changed visually, and why.** Nine aliases were exact — same computed
value, so the migration was invisible. Eight rules did change:

| Change | Reason |
|---|---|
| `.error` red-600 → red-700 | **Was failing AA at 4.41:1** on the page background. Now 5.91:1, and it matches what `auth.css` already used for the same class. |
| Notification badge + unread dot red-600 → red-700 | Same family; white-on-fill goes 4.83:1 → 6.47:1. |
| Table links, "mark all read", report bars, row-hover bar blue-700 → blue-600 | The product has **one** action colour. Two different blues for the same role was the fragmentation this programme exists to remove. Contrast 6.70:1 → 5.17:1, still AA. |
| Muted text on the accent fill slate-300 → slate-100 | **Was failing AA at 3.48:1.** Now 4.72:1. |
| `th` slate-500 → slate-600, `td` slate-800 → slate-900 | Raw hex that predated the token scale. Column headers were sitting at 4.55:1, a hair over the floor; now 7.24:1. |
| Quick-action hover: pale blue-300 hairline → `--accent` | A blue-300 border on a white tile against a slate-100 page is close to invisible, and it was the *only* signal the tile is interactive. |
| Quick-action hover lift removed | `translateY(-2px)` is the hover lift AUD-011 removed everywhere else — "a lift on hover moves the thing the user is aiming at". This rule loads after `animations.css`, so it survived that sweep. |
| Card/button transitions 280ms → 140ms, modal 180ms → 220ms | DESIGN_SYSTEM.md §7 assigns `--dur-fast` to hover/state and `--dur-normal` to overlays. The old values were hard-coded and therefore **ignored `prefers-reduced-motion`**. |

**What did not change.** 843 declarations resolve to a byte-identical computed
value. `/login` is pixel-identical. On every table route the largest per-pixel
delta is 18–23/255 — the intentional text darkening — with effectively nothing
above 16.

**Gradient removed.** `.form-section-title` was a `linear-gradient(135deg, …)`
wash; it is now the flat `--accent-subtle`. That was the last gradient on an
ordinary business surface.

### Still open after this pass

- Three focus-ring alphas (`rgba(37,99,235,0.10/0.12/0.15)`) express one
  affordance three ways. Unifying them changes focus appearance on every
  control, so it wants its own visual pass.
- `.command-modal` is still glassmorphic (`backdrop-filter: blur(14px)` over
  `rgba(255,255,255,0.96)`), which contradicts the approved direction. Removing
  it is a redesign, not a token migration.
- `.summary-cards .card:nth-child(3n+…)` still set `animation-delay`, but
  AUD-011 removed the entry animation they were staggering.
