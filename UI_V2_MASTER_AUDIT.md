# UI v2 — Master Audit

Living record of every UI v2 decision. Append; do not rewrite history.
Prior audits (`COMPLETE_CODEBASE_AUDIT.md`, `UI_UX_AUDIT.md`) describe UI v1 and
remain valid for that system.

Status legend: **Proposed** · **Accepted** · **Implemented** · **Verified** ·
**Rejected** · **Blocked**

---

## Phase 0 — Baseline (measured 2026-08-06, commit `6905b1f`, clean tree)

| Metric | Value | Source |
|---|---|---|
| Routes registered | **28** (24 screens + 4 redirects) | `tools/ui_v2/route_inventory.py` |
| Lazy boundaries | 19 | same |
| Page components | 22, **0 unregistered** | same |
| Stylesheets | 23 | `tools/ui_v2/css_inventory.py` |
| CSS source lines | 5,380 | same |
| Declared classes | 232 | same |
| CSS bundle | 65.89 kB (gzip **11.28 kB**) | `vite build` |
| JS entry | 463.80 kB (gzip **149.43 kB**) | same |
| Largest chunks | `brandedExportTheme` 713 kB (gz 233), `FinanceTrendChart` 363 kB (gz 104), `html2canvas` 200 kB (gz 47) | same |
| Total `dist/assets` | 2.4 MB across 33 files | `du` |
| Assertions | 349 | `npx playwright test` |
| axe | 44/44, zero exceptions | `npm run test:a11y` |

### Route guard map (drives which fixture can verify each route)

| Guard | Count | Routes |
|---|---:|---|
| `RoleRoute` | 2 | `/worker-portal`, `/subcontractor-portal` |
| `AdminLayout` (admin only) | 2 | `/daily-update-approvals`, `/users` |
| `AdminManagerLayout` | 18 | dashboard, tenders, payments, workers, … |
| none (public) | 4 | `/login`, `/register`, `/forgot-password`, `/reset-password` |
| redirect only | 4 | `/projects`, `/sites`, `/sites/:id`, `/`, `*` |

---

## UIV2-001 — "Inter" is declared but has never been loaded

| Field | Value |
|---|---|
| **Category** | Typography / Foundation |
| **Severity** | High — the product's typeface has never been the one the design system specifies |
| **Evidence** | `tokens.css` declares `--font-sans: "Inter", ui-sans-serif, system-ui, …`. `index.html` contains **0** `<link>` tags; the stylesheet tree contains **0** `@font-face` rules and **0** `@import url(...)`. Nothing loads Inter. |
| **Consequence** | Every user has been seeing their OS default — SF Pro on macOS/iOS, Segoe UI on Windows, Roboto on Android. The product renders as three different products, and none of them is the designed one. Line lengths, metric alignment and optical sizing were all tuned against a font that was never present. |
| **Status** | **Accepted — fix in Phase 2** |

---

## UIV2-002 — Design source: UI/UX Pro Max returned a landing-page pattern

| Field | Value |
|---|---|
| **Category** | Research method |
| **Command** | `python3 scripts/search.py "construction operations enterprise SaaS dashboard financial compliance field workforce" --design-system -p "Construction Portal UI v2" --variance 7 --motion 7 --density 8 -f markdown` |
| **Accepted** | **Style: "Data-Dense Dashboard"** (multiple widgets, minimal padding, maximum data visibility; rated ⚡ Excellent performance, ✓ WCAG AA). Dark structural palette `#0F172A`/`#020617`. Motion: stagger 300–450ms. Checklist: SVG icons not emoji, 150–300ms hover transitions, `prefers-reduced-motion`, focus states. |
| **Rejected 1** | The entire **Pattern** block — "Real-Time / Operations **Landing**", "Hero (product + live preview)", "CTA (Start trial / Contact)", "Conversion Focus". This is a marketing page recipe. The brief explicitly forbids accepting it for an authenticated operational app. |
| **Rejected 2** | **Accent `#22C55E` (green) as the action colour.** Green is already the success status colour here. Making the primary action green recreates precisely the semantic collision `DESIGN_SYSTEM.md` §2 documents (brand amber vs warning amber) and had to fix. Action colour stays blue. |
| **Rejected 3** | **"Light mode default" listed as an anti-pattern.** This product is used outdoors on phones in direct sunlight by site workers. A dark data surface is the wrong call for that audience — dark chrome with light data surfaces is adopted instead. |
| **Rejected 4** | All **GSAP** snippets. GSAP is a large runtime dependency for effects that CSS + WAAPI already deliver. The *timings and easings* are ported; the library is not. |
| **Adopted verbatim** | The skill's own warning: *"Don't use `back.out` on dense data tables; the overshoot reads as sloppy on informational UI."* No overshoot easing on any data surface. |
| **Status** | **Accepted with four rejections** |

### Secondary skill queries

| Command | Used |
|---|---|
| `search.py "route transition page enter modal drawer" --domain gsap` | **Asymmetric timing**: "Exit animation should always resolve faster than entrance so back/forward feels snappy"; "cap exit at ~250ms so the app never feels unresponsive". Adopted as a motion-token rule. Rejected: the 400–600ms overlay-wipe transition (novelty navigation, too slow for an ops tool) and the Flip shared-element transition (requires GSAP Flip). |
| `search.py "enterprise operational numeric tabular data" --domain typography` | Reviewed "Dashboard Data" (Fira Code + Fira Sans) — **rejected**: Fira Code is a ligature *coding* font; ligatures in currency and IDs are a correctness hazard. Rejected Roboto (generic Android default, not distinctive). |
| `search.py "data table mobile card responsive" --domain ux` | Confirmed: card layout over horizontal scroll on mobile; larger touch targets on mobile specifically; mobile-first with `min-width` queries. Already satisfied by v1 and carried forward. |

---

## UIV2-003 — Design source: 21st.dev

Connection confirmed. `get_usage` → tier `free`, **`freeRetrievalsRemaining: 0`**.
Search and metadata are unmetered and were used extensively; **`get_component`
was not called** — quota is exhausted today, so no component code was retrieved.
This matches the brief's instruction to retrieve only for the strongest
candidates and never install blindly. Everything below is therefore classified
from metadata, preview and video only.

| ID | Name / author | Idea taken | Class |
|---|---|---|---|
| 14941 | Dashboard Sidebar — arunjdass | Dual "Charcoal Ink (dark) / Alabaster (light)" architectural palette; collapsible multi-tier nav; micro-contrast spacing | **VISUAL REFERENCE** — validates dark chrome + light data surface |
| 8252 | SidebarShowcase — ruixen.ui | Grouped nav with collapsible sub-labels; status badges on nav items | **ADAPT** (idea only; it ships Framer Motion + shadcn) |
| 19009 | Sidebar Dashboard Skeleton — cnippet.dev | Skeleton that mirrors the real layout (rail, header, stat cards, rows) | **ADOPT pattern** — prevents CLS |
| 23557 | Skeleton Swap — ddoemonn | Crossfade skeleton → content with **zero layout shift**, reserved box held until data ready | **ADOPT pattern** — directly serves the CLS budget |
| 5530 | Omni Command Palette — lovesickfromthe6ix | Recents, pinned actions, fuzzy highlight, **mobile-friendly** | **ADAPT** — feature set for the existing palette |
| 16937 | HeroUI Table — hero_ui | Expandable rows, explicit empty state, async loading state, column controls | **ADAPT** |
| 23561 | Sortable Table — ddoemonn | Rows animate **into place on sort** | **ADAPT** — sorting is a state change (an allowed motion moment), unlike per-render row animation |
| 10635 | Interactive Logs Table — moumensoliman | Animated filters + expandable rows on an observability log | **ADAPT** → Activity Log |
| 9216 | Chrono Board — dhileepkumargm | Timeline with status cues + quick actions per entry | **ADAPT** → Activity Log |
| 20459 | Number Ticker — danielpetho | Ref-triggered count-up, fires on demand | **ADAPT** — count once on reveal, never looping |
| 15024 | Progress Metric Card — makviesainte | KPI headline figure paired with a chart, built on **Recharts** | **ADAPT** — Recharts is already a dependency |
| 19357 | Workbench Sidebar — nexus-ui | Dense glassmorphic sidebar | **REJECT** — brief prohibits "glass everywhere" |
| 9227 | signal-authentication — dhileepkumargm | Generative soundwave login background | **REJECT** — permanent RAF loop, decorative spectacle |
| 857 | Timeline — manuarora700 | Scroll-linked "beam follow" | **REJECT** — continuous scroll-driven motion on a data log |
| 1943 | Process Timeline — youcefbnm | Scroll-trigger step reveal | **REJECT** — same reason |
| 21515 | Number Ticker Metrics — shadcnspace | Live "active" **pulse** indicator | **REJECT** — infinite pulse is explicitly prohibited |
| 19050 / 20036 / 9106 / 7014 / 20035 | Split-screen auth — various | Split layout is the one durable idea | **VISUAL REFERENCE only** — all ship social login (this product has none), gradient/grain panels, and "floating animated backgrounds" |

**Method finding — `get_inspiration` rejected as a source for this product.**
Query: *"authenticated operational console for construction field and finance
staff, dense tables, dark navigation chrome, light data surfaces, no marketing
hero"*. It returned **7 of 8 marketing hero sections** (Light Saas Hero, SaaS
Template, Hero Section, Experience Hero, Financial Hero, Underline Hero,
Navbar+hero), confidence 0.51–0.54, with keyword-noise rationales such as
*"Matches for, and, navigation"*. The catalog is skewed to landing pages; its
ranking ignored the explicit negative constraint. Metadata `search` was
productive; `get_inspiration` was not, and is not used further.

---

## UIV2-004 — Technology decision

| Question | Answer |
|---|---|
| New runtime dependency needed? | **No.** |
| Motion library | **`framer-motion@12.42.2` is already installed and already used** by `AnimatedStatCard`, `FloatingActionButton`, `CommandPalette`, `NotificationCenter`, `PageTransition`, and is already in the entry chunk. Its cost is paid. UI v2 uses it only where it already is; new motion is CSS + WAAPI. |
| Charts | **Recharts already installed.** No new charting dependency. |
| Icons | Existing `Icon.jsx` (28 inline SVG glyphs, no dependency). Extend, don't replace. |
| Fonts | **Self-host IBM Plex Sans + IBM Plex Mono** as woff2 subsets. Not Google CDN: a third-party request on the critical path, and the CSP/offline story is worse. Mono is for currency, IDs and tabular figures. |
| CSS | Cascade layers, custom properties, container queries, `clamp()`, logical properties, `dvh`. |
| Route transitions | **View Transitions API** with a no-op fallback; never blocking navigation. |
| Rejected | Tailwind, shadcn, Bootstrap, MUI, Chakra, Mantine, Ant, GSAP, WebGL/canvas backgrounds, any permanent `requestAnimationFrame` loop. |

**Net new dependencies: 0.** Net new font weight: ~2 woff2 subsets (budgeted in
Phase 2, measured before adoption).

---

## UIV2-005 — CSS migration safety net

`tools/ui_v2/css_inventory.py` maps every declared class to its consumers before
anything is deleted. Baseline: 232 classes — **209 static, 12 dynamic, 2
test-only, 9 with no consumer found**.

The 9 unresolved (`fab`, `icon`, `login-box`, `mobile-page-nav`,
`recharts-default-tooltip`, `stat-card`, `subcontractor-profile`, `tab`,
`unread`) are **not** treated as dead. `recharts-default-tooltip` is injected by
a third-party library and can never appear in our source; the rest need
hand-verification. The tool deliberately errs toward over-reporting consumers:
its test-selector scan picks up some false positives (`className`, `closest`),
which only ever *adds* to the protected set.

Two traps this encodes, both of which have already caused damage in this
repository: comment prose parsing as selectors, and dynamically composed class
names (`badge--${tone}`) looking dead to a literal grep.

**Status: Accepted.** Deletion happens only in Phase 6, per class, with the
inventory re-run and the diff verified.

---

## UIV2-006 — Typeface: IBM Plex Sans variable, self-hosted, no monospace

| Field | Value |
|---|---|
| **Category** | Typography / Performance |
| **Measured before adopting** (condition 1) | Google's `css2` API splits each family into 6 subsets. Only `latin` and `latin-ext` are relevant. |
| **Finding 1** | **IBM Plex Sans is a variable font.** All four requested weights (400/500/600/700) resolve to ONE woff2 URL. Verified in Chromium: the four weights render at 124.89 / 128.39 / 130.67 / 133.09 px from that single file. Cost is 40.2 kB latin + 25.9 kB latin-ext for the entire weight axis. |
| **Finding 2** | **₹ (U+20B9) lives in `latin-ext`, not `latin`.** A latin-only build would render the rupee sign in the fallback font beside Plex digits — visibly wrong in a currency column. Both subsets are shipped with their `unicode-range`, so the browser fetches latin-ext only on pages that actually contain it. |
| **Finding 3** | **Plex has tabular figures by default.** Measured: `0123456789` and `1111111111` render at identical widths (240 px) *without* `font-variant-numeric: tabular-nums`. Currency columns align natively. |
| **Decision** | **IBM Plex Mono dropped entirely** — Finding 3 removes the reason for it. Saves 37.8 kB (3 static weights × latin + latin-ext). Total font payload: **66.1 kB**, of which 40.2 kB is unconditional. |
| **Fallback** | Real, not decorative: `font-display: swap` means every user reads the fallback first, so `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto…` must already be correct. `.v2-figure` also sets `tabular-nums` explicitly so columns stay aligned during the swap and if the webfont never arrives. |
| **Status** | **Implemented — verified in Chromium** |

---

## UIV2-007 — CSS architecture: cascade layers, verified through the build

| Field | Value |
|---|---|
| **Category** | Architecture |
| **Problem** | UI v1 and UI v2 must share one document for the whole migration without a specificity war, and without editing 23 legacy files that Phase 6 will delete anyway. |
| **Risk checked first** | Vite inlines `@import` at build time, so `@import "x.css" layer(legacy)` could plausibly have been flattened and the layer silently lost. A throwaway Vite project was built to check. It emitted `@layer legacy{.probe{color:red}}@layer v2{.probe{color:green}}` — layers preserved, `layer()` honoured. |
| **Solution** | `src/index.css` now declares `@layer legacy, v2-reset, v2-foundation, v2-components, v2-pages, v2-utilities;` and imports all 23 legacy sheets with `layer(legacy)`. **No legacy file was edited.** |
| **Verified in the built bundle** | Byte offsets confirm the real order: `@layer legacy{` at 0, `v2-reset` at 65 837, `v2-foundation` at 67 143, statement for `v2-components,v2-pages,v2-utilities` at 75 293. The minifier prunes already-registered layers from the statement, which is valid. |
| **Known caveat** | `!important` **reverses** layer order, so a legacy `!important` beats a v2 one. Legacy has 9. The meaningful one is the blanket `animation/transition: none !important` under `prefers-reduced-motion` in `animations.css`; it stays authoritative during coexistence and is compatible with v2's reduced-motion design rather than in conflict with it. |
| **Opt-in** | v2 element styling is scoped to `.v2-root`. An unscoped `button {}` in a v2 layer would restyle all 24 legacy routes at once and invalidate the 349 assertions measuring the v1 design. A route adopts v2 by adding that one class. |
| **Status** | **Implemented — verified in the built bundle** |

---

## UIV2-008 — Token contrast gate

`tools/ui_v2/contrast_audit.py` resolves the `var()` chain to literals, composites
alpha over its backdrop, and gates the build: **57 pairs, 0 failing** (exit 1 on
any failure).

Three token changes came from its first run, and one **audit** change:

| Finding | Resolution |
|---|---|
| `--v2-chrome-text-muted` on `--v2-chrome-bg-active` = **4.40:1** | Genuine fail. Added `--v2-ink-450` and repointed the token. Now 4.5+. |
| Status bars at **1.93:1** (warning) and **2.07:1** (success) against their own tint | Genuine. Mid-tone bars are invisible in sunlight — the condition this product is read in. `-bar` tokens now use the `-fg` value: 4.51 and 4.57. |
| Input borders below 3:1 | Genuine. Split the concept: `--v2-line*` for separators, new `--v2-control-line*` for control boundaries (3.34:1). |
| Separators flagged at 1.43:1 | **The audit was wrong, not the token.** WCAG 1.4.11 governs UI components and meaningful graphics; a rule between two table cells is neither. Forcing 3:1 would produce a heavy grid that makes dense financial tables *harder* to scan. Reclassified as `INFORMATIONAL` — reported with its ratio, not gated. |

---

## UIV2-009 — Login rebuilt (Phase 2B)

| Field | Value |
|---|---|
| **Composition** | ≥900px two panels — chrome plane carrying a drafting grid and an SVG structural blueprint, data plane carrying the form. <900px single light column, brand panel `display:none`. |
| **The blueprint** | Pure inline SVG: two columns, three floor plates, a diagonal brace, a dimension line and two node plates. Drawn once via `stroke-dashoffset` with a staggered delay, then it rests. **No loop, no canvas, no WebGL, no image request.** `aria-hidden`, `focusable="false"`. |
| **Class names retained** | `.auth-shell`, `.auth-brand`, `.auth-card`, `.auth-submit`, `.password-input-wrapper`, `.password-toggle-btn`. Those 30 assertions encode real requirements — exactly one `h1`, brand hidden on phones, submit full-width at 320px, toggle inside the input's reserved padding — so keeping the hooks means the suite now verifies **UI v2** instead of being rewritten to suit it. |
| **Behaviour preserved** | `handleLogin` prop, controlled email/password, email trim+lowercase, local validation strings, `submitting` guard, `autocomplete="email"`/`"current-password"`, `role="alert"`, toggle `aria-label`+`aria-pressed`, both footer links. No API, payload or redirect touched. |
| **Verified, 9 widths × 2 motion modes** | 320/375/390/414/768/1024/1280/1440/1920. Horizontal overflow **0** at every width. Sub-44px controls **0**. Console errors **0**. Failed requests **0**. Computed `font-family` = **IBM Plex Sans** at every width. Submit width == form width at every width. |
| **Reduced motion** | Blueprint `stroke-dashoffset` measured at **0px immediately** — already drawn, nothing missing, no sweep. Error shake replaced by a fade; `role="alert"` carries the meaning. |
| **Bundle** | CSS 65.89 → **88.65 kB** raw, gzip 11.28 → **15.89 kB** (+4.6 kB) for tokens + reset + typography + motion + foundation + auth. Legacy CSS shrinks as routes migrate. JS entry unchanged. Fonts +66.1 kB, 40.2 kB unconditional. |
| **Status** | **Implemented — verified** |

---

## UIV2-010 — Blocker resolved: it was not the rate limiter

The Phase 2B blocker is closed. Re-probing found the auth limiter returning
normal `"Invalid email or password"` responses, not `"Too many attempts"` — the
15-minute window had cleared and the real cause was **stale fixture
credentials**. Re-running the two documented local-only fixture scripts fixed
it; the suite then passed 349/349.

Two things worth keeping, since the symptom was misleading both times:

- **Worker count drives the login count.** Each Playwright worker process
  re-imports `tests/support/fixtures.js`, so session caching is per-worker:
  3 roles × 4 workers = 12 sign-ins against `AUTH_RATE_LIMIT_MAX=10`. Running
  `--workers=2` keeps it under the limit with no backend change. Recorded as
  V2-I012.
- **A stale fixture password reports as `"Invalid email or password"`**, which
  reads like a broken test rather than a stale fixture. Recorded as V2-I013.

---

## UIV2-011 — Application shell rebuilt (Phase 2C)

| Field | Value |
|---|---|
| **Composition** | Sidebar is the chrome plane — dark, with a static drafting grid masked to the top 55%, grouped navigation under uppercase micro-labels, and the identity block pinned to the foot. Everything right of it is the data plane. The seam is a single hairline, not a shadow. |
| **Active-route rail** | A `::before` on `.sidebar-link` that animates `scaleY(0)` → `scaleY(1)`. Transform-only, so becoming active costs a composite and not a layout. Measured live: `matrix(1,0,0,1,0,0)` on the active item at all three widths. |
| **Drawer** | `transform: translate3d(-100%,0,0)` → `none`, never `left`, which would relayout the page on every frame. Scrim fades with a `visibility` delay so it is not focusable while closed. `inert` handling, focus trap, Escape and focus-return are unchanged from v1 and still asserted. |
| **Topbar** | The one surface with `backdrop-filter`, because it genuinely floats over scrolling content — blur here communicates layering rather than decorating. `@supports not (backdrop-filter)` falls back to an opaque surface. |
| **Class names retained** | `.app-layout`, `.sidebar`, `.topbar`, `.sidebar-toggle`, `.sidebar-scrim`, `.skip-link`, `.active-link`, `.account-*`. 164 `authenticated.spec.js` assertions now verify UI v2 unchanged. |
| **Verified** | lint clean · build clean · **349 assertions** · axe **44/44** · contrast gate 57/57 · overflow **0** at 390/768/1440 · console errors **0** · failed requests **0** · `git diff --check` clean · backend unchanged. |
| **Bundle** | CSS 88.65 → **97.95 kB** raw, gzip 15.89 → **17.36 kB** (+1.47 kB for the whole shell). JS entry unchanged at 464.70 kB. |
| **Status** | **Implemented — verified** |

### Two regressions the shell introduced, and what they teach

Both were the same mistake in different clothes: an **element-level rule in a
v2 layer reaches unmigrated legacy markup**, and `:where()`'s zero specificity
buys nothing because layer order outranks specificity entirely.

| | Caught by | Effect |
|---|---|---|
| `:where(button) { background:none; border:0; padding:0 }` | **A screenshot.** No test asserts `background-color`. | Every legacy button in the app lost its surface — "Export" rendered as bare text, the FAB as a pale circle. |
| `:where(button) { color: inherit }` | **axe.** | Legacy white labels became ink-900 on the blue fill: **3.68:1**, failing `color-contrast` on 24 route/width combinations. |

The reset now normalises metrics only (`font`, `margin`, `cursor`,
`box-sizing`). Appearance and colour belong to the component. Recorded as
V2-I014, V2-I018 and the general rule V2-I019.

---

## UIV2-012 — Shared data surfaces (Phase 3)

One file, `styles/v2/components/data.css`, re-skins every remaining route
through the class vocabulary they already share (`.panel`, `.card`, `table`,
`.badge`, `.tabs`, `.modal-card`). Twenty-one routes gain a coherent base at
once, and each can then be individually designed on top of it rather than
drifting into twenty-one one-off stylesheets.

**Table decisions** (this is a financial product, so the table *is* the
product): sticky column headers, because a register scrolled past its own
labels cannot be read; no zebra striping, because alternating fills fight the
status tints that carry real meaning; numbers right-aligned and tabular;
hover changes colour, never position. Rejected 21st #10379's "proximity hover
highlighting" — cursor-tracking motion across a data grid is continuous
decorative movement, and it makes scanning harder.

Mobile: below 768px a register becomes a list of record cards via the existing
`.table-wrapper--cards` + `data-label` machinery, with the column label
reconstructed from `data-label` so a value keeps its meaning once the header
row is gone.

**Two regressions this introduced, both from the same root cause** — a base
rule in a later cascade layer defeats every modifier in an earlier one:

| Issue | Caught by | Effect |
|---|---|---|
| V2-I022 | The AUD-013 regression test | The v2 `.badge` base outranked Site Operations' BEM modifiers, collapsing every badge to neutral grey. Photo-source and approval states became **indistinguishable** — status information lost, not merely restyled. |
| V2-I020 | A Python probe, not the suite | Row action links measured 44px tall but **28.9–37.3px wide**. WCAG 2.2 target size is an area; the suite asserted height only, so this had been passing while the real target was two-thirds its intended size. |

The AUD-013 test's expected token names were moved from `--status-*` to
`--v2-*`, since Site Operations now renders inside `.v2-root`. Its intent is
unchanged and still the point: each class must resolve to a declared token,
never to a hard-coded literal.

---

## UIV2-013 — Overlays and route transitions (Phase 2C remainder)

| Field | Value |
|---|---|
| **Command palette** | Moved to the **chrome plane** — the second and last place dark carries content (Login's brand panel is the other). It is a tool for operating the application rather than a view of the data in it, so it should not look like a page. Verified live: `rgb(19,23,34)`, 16px radius, chrome text, 16px input (the iOS zoom floor), scrim `blur(3px)`. |
| **Glassmorphism removed** | The legacy palette was `backdrop-filter: blur(14px)` over `rgba(255,255,255,0.96)`. Blur there communicated nothing: the palette is modal, so what is behind it is not actionable. Only the scrim blurs now, and only to signal dismissability. |
| **Notification surface** | Stays on the **data plane** — everything in it is operational content, and content belongs where the rest of the data lives. Verified: white surface, hairline, 352px. Unread carries a bar *and* a dot *and* weight, never colour alone. The count badge does not pulse: a permanently animating badge stops being read, and then it fails on the day it matters. |
| **Route transitions** | View Transitions API via React Router 7's `viewTransition` on `NavLink`. Verified live: `view-transition-name: v2-page` computed on `.page-content`, `document.startViewTransition` available. Only the content region is named — naming the shell would animate the sidebar and topbar on every route change, which is the novelty navigation the brief rules out. Pure progressive enhancement; navigation is never awaited on an animation. |
| **Verified** | lint clean · build clean · **349 assertions** · axe 44/44 · contrast 57/57 · console errors **0** · `git diff --check` clean · backend unchanged |
| **Bundle** | CSS 105.42 → **111.95 kB** raw, gzip 18.38 → **19.12 kB** |
| **Status** | **Implemented — verified** |

---

## UIV2-014 — Overlay dismiss arbitration (V2-I023, Resolved)

| Field | Value |
|---|---|
| **Defect** | The notification panel had no Escape handling at all. It stayed open behind the command palette with focus left on a node that had been removed from the document — which strands a keyboard user at the top of the page. |
| **Architecture inspected first** | Four things already listened for Escape: the command palette (`window`), the mobile drawer (`document`), the account menu (`document`), and nothing for notifications. A naive fifth listener would have made one Escape dismiss several layers at once. |
| **Shared helper justified** | `hooks/useDismissableOverlay.js`. The brief's bar was "only if at least two current overlays can use it without changing their behaviour" — the account menu already had exactly the right semantics (outside-click, Escape, focus return, listeners only while open), so it became the reference implementation and now consumes the extracted hook unchanged. Two consumers, one source, no drift. |
| **Escape ownership** | Two rules. (1) A module-level stack: overlays register on open, and only the most recently opened responds. (2) A modal surface outranks every dropdown — while `.command-backdrop` or `.modal-backdrop` is mounted, these overlays ignore Escape entirely. Rule 2 is a DOM check rather than stack participation **on purpose**: it leaves the palette's and drawer's own handlers completely untouched. |
| **Accessibility added** | Trigger carries `aria-expanded` + `aria-controls` + `aria-haspopup="dialog"`; panel carries `role="dialog"` + `aria-label="Notifications"` and an `id`. |
| **Unchanged** | Notification loading, marking-read, mark-all, navigation, endpoints and payloads. |
| **Verified at runtime — 4 tests** | Escape closes and `aria-expanded` returns to `false`; focus verified back on `.notification-button`; Escape with nothing open changes neither URL nor layout; **with both open, the palette's Escape closes only the palette and the panel beneath stays open**; drawer Escape still works at 768px. Zero console errors. |
| **Status** | **Resolved — runtime verified** |

---

## UIV2-015 — Route transition ownership (V2-I024, Resolved)

**Inventory first** (`grep` over every `.jsx`/`.js`): 1 `NavLink`, 21 `Link`,
11 `navigate()`, 13 `<Navigate>` redirects, 4 `window.location`.

**Architecture.** `components/ui/AppLink.jsx` (`AppLink`, `AppNavLink`) and
`hooks/useAppNavigate.js`. The brief forbade hand-adding `viewTransition` to
every call site, and rightly: that makes behaviour consistent today while
leaving the *policy* scattered across 21 files, where the next link added
silently opts out again. The policy now lives in one module.

The hook is a separate file from the components because a module exporting
both breaks React Fast Refresh — caught by
`react-refresh/only-export-components`, not by hand.

**Animated** — user-initiated navigation between content routes: sidebar,
dashboard cards and quick actions, table and detail links, breadcrumbs,
notification links, command-palette navigation, and programmatic navigation a
user gesture caused.

**Deliberately not animated**, achieved by *not* using these primitives there
rather than by a flag:

| Path | Why |
|---|---|
| `/login` after register / reset / sign-out | Motion delays completion of authentication for no benefit |
| `RoleRoute` + 13 `<Navigate>` redirects | A user sent somewhere they did not ask to go should not have it dressed up as a transition |
| `axiosClient` 401 handler | A security response and a full document load, not an SPA navigation |
| `window.location` sign-out | Same |
| Same-route state, anchors, downloads, exports, external links | Not route changes |

**Adopted now** in the shell (Sidebar, NotificationCenter, FloatingActionButton,
CommandPalette). Page-level links adopt `AppLink` as each page migrates in
Phase 4/5 — their markup is being rewritten then anyway, so a separate sweep
would be risk without benefit.

**Verified at runtime — 5 behaviour tests, no timing assertions:** exactly one
element carries a transition name and it is `.page-content` (so the shell
never animates with the content); sidebar navigation reaches the route and
`.main-content` is immediately interactive; browser Back and Forward work;
under `prefers-reduced-motion` the computed name is `none` and navigation
still works; with `Document.prototype.startViewTransition` deleted the router
falls back to a plain DOM update with zero page errors.

**Status: Resolved — runtime verified**

---

## SHARED-LAYER GATE — green

358 assertions (349 + 9 new) · axe **44/44** · contrast **57/57** · lint clean ·
build clean · `git diff --check` clean · backend unchanged · console errors 0 ·
failed requests 0 · horizontal overflow 0 at 390/768/1440 on dashboard,
tenders and payments.

CSS 111.95 kB (gzip 19.12) · JS entry 465.79 kB (gzip 149.99).

Phase 4 is unblocked.

---

## UIV2-016 — Dashboard, partial (Phase 4 Group 1)

**Research.** 21st.dev searched for command-centre / attention-panel patterns:
#19966 rejected (pulsing status dot — infinite pulse is prohibited), #8092
rejected (calendar, not applicable), #8371 kept as a generic density
reference. UI/UX Pro Max `--domain chart` returned **Bullet Chart** for
"multiple KPIs side by side; space-constrained contexts where a gauge is too
large" — adopted as the design for the four ratio metrics, though not yet
built. Decomposition Tree and Treemap rejected as over-engineered here.

**Inventory documented before any change** as V2-I027…I034 in
UI_V2_REMAINING_ISSUES.md: ~20 panels, 12 flat KPI cards, six stacked "Recent
X" tables, 4,465px tall at 1440 (about five screens).

### Built and verified

| Issue | Change | Evidence |
|---|---|---|
| **V2-I028** | Six stacked "Recent X" tables → one tab set with three panels. Real tab semantics: `role="tablist"`, `aria-selected`, `aria-controls`, labelled `tabpanel`, roving `tabIndex`. **Nothing removed** — same three sections, same six tables, same links. | Verified live: 3 tabs, 2 tables visible instead of 6, switching updates the panel |
| **V2-I027** | Twelve equal KPI cards → two tiers. Primary is what someone opens the product to check (Cash Position, Net Profit, Invoice Outstanding, Running Tenders); the other eight form a denser supporting band. Sized with **container queries**, so a card sizes its figure by the space *it* has rather than by viewport width. No figure removed, none re-sourced. | Build clean; 0 overflow at all 9 widths |
| **V2-I030** | Removed `AnimatedStatCard`'s hover lift (`y: -8, scale: 1.02`) and tap scale. AUD-011 removed hover lifts everywhere else; this survived because it was a Framer Motion prop, not CSS, so the stylesheet sweep never saw it. The count-up is kept — one-shot, bounded, and it draws the eye to a figure that changed. | `whileHover`/`whileTap` absent from the component |
| **V2-I034** | `.dashboard-grid`, `.two-column-dashboard`, `.section-title-row`, `.summary-cards` and the chart shell now have v2 definitions, so the legacy rules can be deleted in Phase 6. Chart shell moved from a fixed 360px to `clamp(14rem, 32vh, 22rem)` — a letterbox on a phone otherwise. | Build clean |

**Measured result:** page height at 1440 **4,465 → 3,636px (−19%)**. Across all
nine widths × both motion modes: horizontal overflow **0**, sub-44px controls
**0**, console errors **0**, failed requests **0**.

### Designed but NOT built — and the CSS was removed rather than left

V2-I029 (a dedicated RISK zone promoting overdue/due-soon work), V2-I031
(bullet-style ratio bars) and V2-I032 (demoting the "Executive Dashboard"
wrapper) were designed and their CSS written, then **deleted** when
implementation capacity ran out.

That deletion was deliberate. Unused CSS is precisely the debt AUD-004,
AUD-008 and AUD-013 spent three passes clearing, and shipping ~150 lines of
it as "ready for later" is how it comes back. The design intent is recorded in
the issues register instead, which costs nothing and cannot rot.

**Update — Dashboard is now COMPLETE.** The three deferred items were built in
the following pass and V2-I029 was withdrawn; see UIV2-017 below.

**Gate at this point:** 358 assertions · axe 44/44 · contrast 57/57 · lint
clean · build clean · `git diff --check` clean · backend unchanged.
CSS 111.95 → **113.75 kB** (gzip 19.12 → **19.46**). DashboardPage chunk
34.19 → **35.28 kB** (gzip 8.20 → 8.49).

---

## UIV2-017 — Dashboard completed (Phase 4 Group 1)

### V2-I029 — withdrawn as a FALSE FINDING

`DashboardHero` already implements the risk zone I specified: five items
ordered danger → warning → info — overdue invoices **with their monetary
total**, overdue tenders, due-soon tenders, pending invoices, tenders to
submit — each linking to the register that resolves it
(`DashboardHero.jsx:93-139`). I recorded it as a weakness without reading the
item construction carefully enough. Kept in the register rather than deleted,
per the rule that false findings are preserved.

### Built

| Issue | Change | Verification |
|---|---|---|
| **V2-I031** | `RatioRow` — bullet-style label / bar / value, 4 consumers, replacing bare percentages in the health tables. Adopted from UI/UX Pro Max's Bullet Chart guidance ("space-constrained contexts where a gauge is too large"). Not a gauge, donut or circle: all cost more width for less precision and none sit in a table row. Grows from 0 once on mount; `role="img"` with the value as a sentence, and the exact figure still printed beside it so nothing depends on the graphic. Track hidden below 520px, where the figure matters more than the affordance. | 4 `.v2-ratio` rendered; fills at 0% because this fixture's ratios genuinely are 0 |
| **V2-I032** | The "Executive Dashboard" panel removed — a bordered box wrapping a heading that restated the page, a sentence describing the product to someone already inside it, and six links. Export control and quick actions remain as a plain row under a "Jump to" label. | Description string confirmed absent from the DOM |
| **V2-I033** | Skeleton loading, **inferred locally**. The five register arrays arrive as props with no loading flag, so "empty" and "not yet fetched" are indistinguishable — a company with no records would skeleton forever. The page already runs its own `getSubcontractors` request, so that is the signal: in flight → first load unfinished; settled either way → skeleton clears. Correct for an empty account, and **nothing was threaded from AppRoutes**, so no data-flow or business-logic change was needed. The placeholder reuses the real grid classes and card count, so it occupies exactly the box the content will. | Verified with a 2.5s delayed response: 12 skeleton cards at the real grid width (1112px), real grid `hidden`; after load 0 skeletons, 4 primary cards visible |

### Measured

Page height at 1440: **4,465 → 3,543px (−21%)**. All nine widths × both motion
modes: overflow **0**, sub-44px **0**, console errors **0**, failed requests
**0**.

CSS 113.75 → **115.77 kB** (gzip 19.46 → **19.76**). DashboardPage chunk
35.28 → **36.35 kB** (gzip 8.49 → 8.80).

Gate: lint clean · build clean · **358 assertions** · axe **44/44** · contrast
**57/57** · `git diff --check` clean · backend unchanged.

### Found at the end, logged not fixed

**V2-I035** — ₹0.00 renders in tinted success/danger cards and "Overdue: 0" in
a danger card. A zero is neither a success nor a failure, and tinting it
trains the user to ignore the tint so it stops working when the number is
real. Same anti-pattern the portal work fixed earlier. Changing it alters
which branch renders, so it wants its own verification.

**V2-I037** — 47 v2 classes have no JSX consumer, and I applied the
"no dormant CSS" rule inconsistently: I deleted the dashboard's unused blocks
and left an unconsumed foundation layer standing. Eight are genuinely
speculative and should go; the rest are design-system primitives Phase 4/5
will consume, and deleting them means rebuilding per group. Recorded with a
deadline rather than acted on at the end of a pass.

**Dashboard is COMPLETE.** Group 2 not started.

---

## UIV2-018 — Payments completed (Phase 4 Group 3, taken first)

**Read first:** `PaymentsPage.jsx` (511) plus seven components in
`components/finance/` — 1,814 lines. Structure: overview → trend chart →
payment-type loading/error → an 875-line wizard (Income/Expense → section →
child → form) → records table → delete confirmation.

**Research.** 21st.dev #22187 "Invoice History Table" contributed the
outstanding-total footer idea (carried to Invoices); #7715 rejected (animated
bubble chart — decorative motion on financial data). UI/UX Pro Max `--domain
ux` returned **"Color Only — Don't: red/green only for error/success",
severity High**, which is precisely the defect found below.

### The central finding: tone was spent on facts, not statuses

`FinanceOverview` hardcoded status colour on values that have no status:

| Card | Was | Why that is wrong |
|---|---|---|
| Total Expense | always `highlight-danger` | An expense is normal business operation. Nothing has gone wrong. |
| Total Income | always `highlight-success` | Income is a fact, not an achievement. |
| Baki GST | always `highlight-warning` | ₹0 outstanding is the **good** outcome, rendered amber. |
| Baki Company Charge | always `highlight-danger` | Same — zero rendered red. |

A tone that is always on is not a signal. Spending the danger vocabulary on
figures that can never be bad is what makes users stop seeing it — and then it
fails on the day a number really is bad.

**Now:** Income, Expense and Total Records are neutral facts. Balance carries
a *three-way* tone — positive/negative/zero — and the outstanding cards tone
only above zero. Every toned card also carries a text status ("In surplus",
"Settled", "Nothing recorded"), so state is never colour alone.

**Hierarchy:** six equal cards became the Dashboard's `.v2-metrics` tiers —
Balance leads with the two figures it derives from; outstanding amounts and
record count form the supporting band. The two pages now share one vocabulary.

**Page head added** (V2-I041) with the record count and a real empty-state
sentence, replacing a page that opened on six cards with no title.

### V2-I043 — caught by looking, not by testing

After fixing the above, the Balance card still used `balance >= 0`, so an
empty ledger rendered green and read "In surplus". The same defect I had just
corrected, one level deeper, and no test would ever have caught it. Now
three-way.

### Verification

All nine widths × both motion modes: overflow **0**, sub-44px **0**, console
errors **0**, failed requests **0**. Gate: lint clean · build clean · **358
assertions** · axe **44/44** · contrast **57/57** · `git diff --check` clean ·
backend unchanged. CSS unchanged at 115.77 kB (gzip 19.76) — this was JSX
semantics, not new styling. PaymentsPage chunk 31.51 → **32.30 kB**.

**Payments is COMPLETE.**

---

## SUPERSEDED — the Phase 2B blocker entry below

Kept for history; resolved by UIV2-010.

## BLOCKED — authenticated suite verification

`AUTH_RATE_LIMIT_MAX=10` per 15-minute window (`backend/.env`). The
authenticated suites need more sign-ins than that across 4 workers, so they
abort with *"Too many attempts"* and 160 tests do not run.

This is **not** a UI v2 regression:
- `responsive.spec.js` — which never signs in — passes **57/57**, including all
  30 auth-shell assertions against the rebuilt Login.
- The failure is `login()` in `tests/support/fixtures.js`, before any page loads.

DEPLOYMENT.md already documents the fix and calls it "not optional":

```bash
cd backend
RATE_LIMIT_MAX=100000 AUTH_RATE_LIMIT_MAX=100000 npm start
```

The backend is currently the user's own `nodemon` process (PID 81265) in their
terminal. Restarting it is their call, not something to do unasked.
