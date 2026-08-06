# Complete Codebase Audit

**Repository:** `construction-portal` · **Baseline:** `bb2fae7`
**Pass:** independent re-audit, verified from source. No prior audit, report or
TODO was trusted.

**Method:** a purpose-built Python analyser
(`audit_analyze.py`, reproduced in §Appendix) walks every `.js`, `.jsx` and
`.css` file under `frontend/src` plus `frontend/tests` and reports unused
exports, unreferenced files, unused CSS classes, unused custom properties,
unused `@keyframes`, duplicate declaration blocks and TODO/FIXME markers.
Every finding was then **manually verified against source** before any action.

---

## Repository statistics (measured)

| Extension | Files | Lines |
|---|---:|---:|
| `.js` | 146 | 55,950 |
| `.jsx` | 64 | 39,914 |
| `.css` | 24 | 5,819 |
| `.md` | 11 | 3,400 |
| `.json` | 6 | 8,006 |
| `.sql` | 5 | 5,912 |
| other | 27 | 1,158 |
| **Total** | **283** | **~120,000** |

Excluded: `node_modules`, `.git`, `dist`, `coverage`, `test-results`.

---

## Findings

### AUD-001 — Four documentation files deleted from the working tree

| Field | Value |
|---|---|
| **Category** | Documentation |
| **Severity** | High |
| **Files** | `DEPLOYMENT.md`, `HANDOVER.md`, `STALE_UNUSED_CODE_AUDIT.md`, `FIX_IMPLEMENTATION_TRACKER.md` |
| **Description** | All four tracked documentation files were deleted (unstaged) from the working tree. The deletion was not made by this audit. |
| **Evidence** | `git status --short` showed ` D` against all four across two consecutive sessions. All four were present in `HEAD` at 831 / 446 / 1,167 / 179 lines. |
| **Risk** | `DEPLOYMENT.md` is the project's operational runbook and is explicitly named as a document to maintain. |
| **Recommended fix** | Restore all four from Git; update rather than recreate. |
| **Fix applied** | **Restored — verified present.** `HANDOVER.md` (446), `STALE_UNUSED_CODE_AUDIT.md` (1,167) and `FIX_IMPLEMENTATION_TRACKER.md` (179) are byte-identical to `HEAD` (`git diff --quiet HEAD -- <file>` passes on all three). `DEPLOYMENT.md` is present at **1,178 lines** and is deliberately *not* a plain HEAD restore — see the correction below. One genuinely missing section (**SITE-OPS-DATA-01**, the tender/site attribution constraint) was appended to the restored file rather than the file being replaced. |
| **Verification** | All four exist on disk. `git status` shows only ` M DEPLOYMENT.md`; no `.md` deletions remain. `grep -c SITE-OPS-DATA-01 DEPLOYMENT.md` → 1. |
| **Status** | **Resolved** |

#### Correction to an earlier claim in this document

A previous revision of AUD-001 stated that the working-tree edits to
`DEPLOYMENT.md` were "unrecoverable". **That was wrong**, and the error is
recorded here rather than quietly overwritten.

The evidence for the original claim was
`git show HEAD:DEPLOYMENT.md | grep -c "AuthShell|PortalPrimitives|test:a11y"`
returning `0`. That correctly showed the *HEAD* copy lacked those sections —
but it said nothing about whether the working-tree copy still existed
somewhere recoverable. It did. On restore, the file came back at 1,157 lines
against HEAD's 831, carrying `ResponsiveTable` ×7, `AuthShell`,
`PortalPrimitives`, `test:a11y`, `createLocalPortalFixtures` and the 21st.dev
quota section intact — roughly 326 lines of work that had been declared lost.

**Consequence for the restore procedure:** running the prescribed
`git restore DEPLOYMENT.md` at that point would have *destroyed* those 326
lines by reverting to the older HEAD copy. The command was therefore not run
against `DEPLOYMENT.md`; the file was already present and was updated in
place, per the instruction to update rather than replace. The other three
needed no such care and match HEAD exactly.

---

### AUD-002 — Analyser false positive: dynamic imports (method defect, not a code defect)

| Field | Value |
|---|---|
| **Category** | Testing |
| **Severity** | Critical (had it been acted on) |
| **Files** | all 18 files under `frontend/src/pages/` |
| **Description** | The first analyser run reported **all 18 page components as unreferenced**. |
| **Evidence** | The import resolver matched only `from "…"` and `import "…"`. Every page is loaded through `React.lazy(() => import("../pages/X"))` in `AppRoutes.jsx`, which the pattern missed. |
| **Risk** | Acting on the finding would have deleted the entire application. |
| **Recommended fix** | Extend the resolver to `import(...)` call expressions. |
| **Fix applied** | Resolver updated; re-run reports **0 unused files**. |
| **Verification** | Re-ran analyser from the repository root; `unused_files: 0`. |
| **Status** | **Resolved** |

*Recorded because it is the strongest argument in this document for verifying
every static-analysis finding against source before deleting anything.*

---

### AUD-003 — Unused `@keyframes`

| Field | Value |
|---|---|
| **Category** | Unused CSS |
| **Severity** | Low |
| **Files** | `frontend/src/styles/core/animations.css` |
| **Description** | Three keyframe blocks are declared but referenced by no `animation` or `animation-name` declaration: `blobMove`, `gridMove`, `shine`. |
| **Evidence** | Analyser cross-references every `@keyframes NAME` against every `animation*` declaration across all 24 stylesheets. Zero matches for all three. `blobMove`/`gridMove` drove the removed decorative background; `shine` drove the removed button sweep. |
| **Risk** | Dead CSS shipped to every user. |
| **Recommended fix** | Delete all three blocks. |
| **Fix applied** | Pending — see §Work applied. |
| **Verification** | Build + Playwright + axe. |
| **Status** | See §Work applied |

---

### AUD-004 — Stale CSS selectors targeting classes that no longer exist

| Field | Value |
|---|---|
| **Category** | Unused CSS |
| **Severity** | Low–Medium |
| **Files** | `responsive.css`, `animations.css`, `auth.css`, `cards.css`, `forms.css`, page sheets |
| **Description** | 58 class selectors are defined in CSS and referenced nowhere in JS/JSX. **15 were individually verified as genuinely dead**; the rest are false positives (see AUD-005). |
| **Evidence** | Verified per class with `grep -rF <class> frontend/src \| grep -v '\.css:'` → 0 non-CSS references. Spot-check confirming the method: `.command-palette` is defined at `responsive.css:313`, but `CommandPalette.jsx` uses `.command-modal`, `.command-backdrop`, `.command-header`, `.command-results`, `.command-empty` — never `.command-palette`. Likewise `.export-buttons` is defined but `ExportButtons.jsx` uses `.export-menu*`. |
| **Verified dead (15)** | `tab--active`, `worker-header`, `auth-error`, `auth-required`, `primary-btn`, `skeleton`, `login-message`, `success-message`, `warning-message`, `toolbar`, `tenders-page`, `command-palette`, `export-buttons`, `subcontractor-tenders`, `worker-grid` |
| **Risk** | Dead selectors mislead future maintainers into thinking a hook exists, and are shipped to every user. |
| **Recommended fix** | Remove the verified 15. Leave the remainder pending per-class verification. |
| **Fix applied** | Pending — see §Work applied. |
| **Verification** | Build + Playwright + axe + visual diff. |
| **Status** | See §Work applied |

---

### AUD-005 — Dynamically-composed class names (false positives, must NOT be removed)

| Field | Value |
|---|---|
| **Category** | Unused CSS |
| **Severity** | Informational |
| **Files** | `foundation.css`, `site-operations.css`, `tables.css` |
| **Description** | 10 of the 58 reported-unused classes are constructed at runtime from data and would break if deleted. |
| **Evidence** | Template literals found in source: `` `badge badge--${photo.source}` `` → `badge--camera`, `badge--gallery`, `badge--unknown`. `` `status status--${approval_status}` `` → `status--approved`, `status--denied`, `status--expired`, `status--granted`, `status--pending`, `status--rejected`, `status--used`. |
| **Risk** | Deleting them silently removes status colouring from Site Operations material/banking/access records — a data-integrity signal, not decoration. |
| **Recommended fix** | Retain. Any future dead-CSS tooling must resolve template literals before reporting. |
| **Fix applied** | None — retained deliberately. |
| **Verification** | n/a |
| **Status** | **False Positive** |

---

### AUD-006 — Unused CSS custom properties

| Field | Value |
|---|---|
| **Category** | Unused CSS / Design System |
| **Severity** | Low |
| **Files** | `frontend/src/styles/core/tokens.css` |
| **Description** | 32 declared custom properties are never read via `var()`. |
| **Evidence** | Analyser diffs every `--token:` declaration against every `var(--token)` reference across CSS **and** JS. |
| **Sample** | `--accent-brand-subtle`, `--bg-active`, `--bg-surface-raised`, `--border-strong`, `--color-amber-400/50/600`, `--content-max-narrow`, `--dur-instant`, `--dur-slow`, `--ease-in-out`, `--font-mono`, `--radius-xl`, `--radius-2xl`, `--space-0`, `--z-base`, `--z-modal`, `--z-modal-scrim`, plus legacy aliases (`--bg`, `--warning`, `--danger-light`, `--primary-light`, `--mobile-bg`, `--shadow-login`, `--active`). |
| **Risk** | Low. A token scale is deliberately a *palette*, not a usage list — a design system that only declares what is currently consumed forces a token edit for every new component. |
| **Recommended fix** | **Split the decision.** (a) Legacy aliases (`--bg`, `--warning`, `--primary-light`, `--mobile-bg`, `--shadow-login`, `--danger-light`, `--active`) are migration scaffolding and should be removed once the page sheets stop needing them — but they are currently still referenced by older sheets, so removal requires per-sheet migration first. (b) Scale members (`--space-0`, `--radius-xl`, `--z-modal`, `--dur-slow`) are intentional completeness. |
| **Fix applied** | None. |
| **Verification** | n/a |
| **Status** | **Intentionally Retained** — removing scale members would make the token system incomplete and is not a maintainability win. Legacy-alias removal is real debt, recorded in §Remaining technical debt. |

---

### AUD-007 — `PortalSection` exported but never consumed

| Field | Value |
|---|---|
| **Category** | Dead Code / Unused Exports |
| **Evidence** | `grep -rn PortalSection frontend/src frontend/tests` returned only its own declaration plus three documentation mentions. Its CSS (`.portal-section`, `.portal-section-head`, `+ h2`, `+ p`) was referenced by nothing but the component itself. Neither portal uses the pattern — both compose sections from `.panel` directly. |
| **Fix applied** | Component removed (22 lines) and its four CSS rules deleted. Documentation updated. |
| **Verification** | `unused_exports` **1 → 0**. Runtime collector: 205 classes before, 205 after, none lost. lint clean · build passes · 344 assertions pass. |
| **Status** | **Resolved** |

---|---|
| **Category** | Dead Code / Unused Exports |
| **Severity** | Low |
| **Files** | `frontend/src/components/portal/PortalPrimitives.jsx` |
| **Description** | `PortalSection` is exported but imported by no file. |
| **Evidence** | Analyser: the only export with zero references outside its declaring file. Confirmed by grep across `frontend/src` and `frontend/tests`. |
| **Risk** | Ships unused code and implies a pattern that no page actually follows. |
| **Recommended fix** | Remove it. Both portals use `.portal-section` styling directly via existing markup; the component adds nothing they use. |
| **Fix applied** | Pending — see §Work applied. |
| **Verification** | Build + Playwright + axe. |
| **Status** | See §Work applied |

---

### AUD-008 — Duplicate CSS declaration groups

| Field | Value |
|---|---|
| **Category** | Duplicate CSS |
| **Outcome** | **All 26 groups classified. 4 resolved, 22 retained with documented reasons.** Analyser now reports 22. |

#### Consolidated (4)

| Group | Selectors | Classification | Why |
|---|---|---|---|
| **G06** | `.dashboard-cards` in `cards.css` + `dashboard.css` | Legacy duplicate | Byte-identical restatement, later in the cascade, nothing overriding between. Removed the `dashboard.css` copy. |
| **G07** | `.summary-cards` in `foundation.css` + `cards.css` | **Required cascade override — and a real bug** | `foundation.css` scopes the multi-column grid to `@media (min-width: 480px)` with `1fr` below. `cards.css` loads later and restated it **unconditionally**, so the mobile rule never applied. Measured on `/reports`: **479px rendered two 215.5px columns** where DESIGN_SYSTEM §4 intends one. After removal: 320/375/414/479 → 1 column, 480 → 2. Breakpoint restored. |
| **G09** | `.portal-assignment p` + `.portal-section-head p` | Legacy duplicate | Resolved as a side effect of AUD-007. |
| **G15** | `.password-input-wrapper` in `tabs.css` + `auth.css` | Legacy duplicate | The same class defined identically in two files. It is an authentication control; a tab stylesheet has no ownership claim. `auth.css` is canonical. |

#### Retained (22)

| Groups | Pattern | Classification | Reason |
|---|---|---|---|
| G01–G04, G10, G11 | Status tone bodies — `.badge.green` vs `.activity-marker[success]` vs `.attention-icon[info]` vs `.portal-action-icon[danger]` | **Coincidental equality** | These are four unrelated components that happen to consume the same token pair. That is the token system working as intended, not duplication. Merging would couple a badge, an audit-trail marker, a dashboard attention icon and a portal icon so that changing one changes all four. |
| G05, G12, G13, G26 | `display:flex; flex-direction:column; min-width:0` and similar | **Coincidental equality** | A generic layout idiom across unrelated components. Extracting a `.stack` utility would trade a duplicated three-line body for lost component ownership. |
| G14 | Uppercase micro-label ×4 (`.portal-summary-label`, `.portal-project-facts dt`, `.ops-context-label`, `.ops-context-meta dt`) | **Needs Manual Decision** | The only genuine shared-primitive candidate, with four real consumers. Extraction requires adding a class at four JSX sites across two features; the benefit is real but it is a component-API decision, not a mechanical dedup. |
| G08 | `.secondary-btn` + `.export-menu-button` | **Coincidental equality** | Both are secondary actions today, but export is a menu trigger and may grow an affordance the plain secondary button must not inherit. |
| G16, G20 | Hover/input bodies across `tabs` vs `ops-module`, `auth` vs `ops-workspace` | **Coincidental equality** | Different components in different scopes. |
| G17 | `.sr-only` + `.table-wrapper--cards thead` | **Unsafe To Merge** | The standard visually-hidden idiom. A `<thead>` cannot carry the utility class without markup changes in every card-mode table. |
| G18 | `.form-actions, .modal-actions` + `.inline-form` | **Responsive counterpart** | Both are stacking rules inside media queries; merging couples unrelated responsive intents. |
| G19 | `.sidebar-brand-mark` + `.auth-brand-mark` | **Needs Manual Decision** | Genuinely the same brand mark in two shells. Merging means one canonical `.brand-mark` and a JSX change in both — worth doing, but it is a naming decision. |
| G21–G24, G25 | Site Operations pill/tone bodies; portal page containers | **Needs Manual Decision** | See AUD-013 below — these carry a separate defect that should be fixed first. |

| **Status** | **Resolved** (all classified; every safe duplicate consolidated) |

---

### AUD-013 — Site Operations referenced design tokens that do not exist

| Field | Value |
|---|---|
| **Category** | Design System |
| **Severity** | Medium (raised from Low — two pairs were failing WCAG AA) |
| **Files** | `frontend/src/styles/pages/site-operations.css` |
| **Scope correction** | The finding recorded **4** missing tokens. A repo-wide scan for `var(--x, …)` where `--x` is undeclared found **16 missing tokens across 42 references** — including an entire parallel spacing scale (`--space-xs/sm/md/lg`) that never existed. All 42 were in this one file; no other stylesheet had any. |
| **False positive** | `--danger` (3 refs) was initially reported missing. It **is** declared at `tokens.css:325`; the scanner's BEM guard (`\.[\w-]*--danger:`) wrongly excluded it. Verified and discounted. |

#### The accessibility defect

Two of the hard-coded fallback pairs were **below the 4.5:1 AA floor**. The
canonical tokens fix both:

| Pair | Before | After | Verdict |
|---|---|---|---|
| `status--pending` / `badge--gallery` | `#a16207` on `#fef3c7` = **4.42:1** ❌ | `#b45309` on `#fef3c7` = **4.51:1** | now AA |
| `status--used` / `badge--unknown` | `#6b7280` on `#f4f5f7` = **4.43:1** ❌ | `#475569` on `#f8fafc` = **7.24:1** | now AA, comfortably |
| `status--approved` / `badge--camera` | 4.57:1 | 4.57:1 | unchanged |
| `status--denied` / `alert--error` | 5.30:1 | 5.30:1 | unchanged |

#### Migration

| Missing token | Fallback | Canonical replacement | Uses |
|---|---|---|---:|
| `--space-xs` / `--space-sm` / `--space-md` / `--space-lg` | 4/8/16/24px | `--space-1` / `--space-2` / `--space-4` / `--space-6` | 16 |
| `--success-bg` / `--success-text` | `#dcfce7` / `#15803d` | `--status-success-bg` / `-fg` | 4 |
| `--warning-bg` / `--warning-text` / `--warning-border` | `#fef3c7` / `#a16207` / `#fde68a` | `--status-warning-bg` / `-fg` / `-border` | 7 |
| `--danger-bg` / `--danger-text` | `#fee2e2` / `#b91c1c` | `--status-danger-bg` / `-fg` | 4 |
| `--surface-muted` | `#f4f5f7` | `--bg-surface-sunken` | 4 |
| `--text-color` | `#1f2430` | `--text-primary` | 2 |
| `--border-color` | `#e6e8ec` | `--border-subtle` | 3 |
| `--primary-color` / `--primary-bg` | `#2563eb` / `#eff6ff` | `--accent` / `--accent-subtle` | 2 |

**No new aliases were created.** The old names were migrated away from
entirely, per the instruction to prefer canonical names.

Additionally, **11 dead fallbacks** on tokens that *do* exist
(`var(--text-muted, #6b7280)`, `var(--radius-sm, 6px)`) were stripped. These
could never apply — and `#6b7280` is not even `--text-muted`'s value
(slate-600 `#475569`), so it would have silently mis-coloured the page if the
token were ever renamed.

#### Verification

- **Repo-wide rescan: zero undefined tokens referenced anywhere.**
- `site-operations.css`: **0** `var()` fallbacks, **0** raw hex values.
- Computed styles confirmed on live DOM: camera/approved `#dcfce7`/`#15803d`,
  gallery/pending `#fef3c7`/`rgb(180,83,9)`, unknown `#f8fafc`/`rgb(71,85,105)`,
  denied `#fee2e2`/`#b91c1c` — all matching their canonical tokens.
- **24 screenshots** (4 modules × 3 widths, before and after). Labour, Banking
  and Access Requests **byte-identical**; Material differs by +37/+17/+1 bytes
  at 1440/768/390 — the photo-source badges, the only place the changed tones
  render.
- **2 regression tests added**: one asserts each badge/status class resolves to
  its canonical token (so a broken link fails loudly instead of silently
  falling back to a literal); one asserts tones still carry text labels.
- lint clean · build passes · **346 assertions** · axe 44/44.

| **Status** | **Resolved** |

### AUD-014 — Live legacy token aliases

| Field | Value |
|---|---|
| **Category** | Design System |
| **Severity** | Medium (two live WCAG AA failures were found and fixed) |
| **Files** | 14 stylesheets: `tokens.css`, `animations.css`, `foundation.css`, `utilities.css`, `responsive.css`, `cards.css`, `forms.css`, `tables.css`, `tabs.css`, `dashboard.css`, `reports.css`, `settings.css`, `tender-details.css`, `site-operations.css` |
| **Scope correction** | The brief listed **7** aliases. A repo-wide inventory found **17 live** ones: the 11 in the `tokens.css` "LEGACY ALIASES" block, 3 `--accent-brand*` aliases in §2, and a **second `:root` block in `animations.css`** declaring a parallel motion scale. |

#### Phase 1 — inventory

| Alias | Defined at | Consumers | Canonical replacement | Computed equality | Class |
|---|---|---:|---|---|---|
| `--primary` | `tokens.css` §11 | 4 | `--accent` | `#2563eb` = `#2563eb` | exact |
| `--success-light` | §11 | 1 | `--status-success-bg` | `#dcfce7` = | exact |
| `--blue-light` | §11 | 1 | `--status-info-bg` | `#dbeafe` = | exact |
| `--panel-bg` | §11 | 1 | `--bg-surface` | `#ffffff` = | exact |
| `--text` | §11 | 10 | `--text-primary` | `#0f172a` = | exact |
| `--muted` | §11 | 12 | `--text-muted` | `#475569` = | exact |
| `--border` | §11 | 3 | `--border-subtle` | `#e2e8f0` = | exact |
| `--input-border` | §11 | 1 | `--border-default` | `#cbd5e1` = | exact |
| `--shadow-panel` | §11 | 2 | `--shadow-md` | identical | exact |
| `--accent-brand` | §2 | 1 | `--accent` | `#2563eb` = | exact |
| `--accent-brand-hover` | §2 | 1 | `--accent-hover` | `#1d4ed8` = | exact |
| `--accent-brand-subtle` | §2 | **0** | `--accent-subtle` | — | dead |
| `--danger` | §11 | 3 | `--status-danger-fg` | `#dc2626` → `#b91c1c` | **ambiguous** |
| `--blue-dark` | §11 | 8 | role-split | `#1d4ed8` → two outcomes | **ambiguous** |
| `--transition-fast` | `animations.css` | 7 | `--transition-base` | 150ms → 140ms | deprecated, live |
| `--transition-med` | `animations.css` | 11 | `--transition-base` | 280ms → 140ms | deprecated, live |
| `--ease-pro` | `animations.css` | 6 | `--ease-out` | curve change | deprecated, live |
| `--ease-bounce` | `animations.css` | 3 | *none exists* | — | **promoted to `tokens.css` §7** |

**72 `var()` references** to these names existed at HEAD (comments excluded), across
14 stylesheets. All 72 are gone; every alias declaration has been deleted.

**False positives — not touched.** `.claude/skills/**` matches
(`hsl(var(--primary))`, `hsl(var(--muted))`, `hsl(var(--border))`) are vendored
shadcn/Tailwind reference documentation describing a *different* design system.
`UI_UX_AUDIT.md:318` is prose describing a historical defect. **No JavaScript
references any of these tokens** — `getComputedStyle`, `getPropertyValue` and
`setProperty` do not appear anywhere in `frontend/src`.

#### The two ambiguous aliases

`--danger` was `red-600`, which matches **no member** of the danger family
(`-bg` is red-100, `-fg` red-700, `-border` red-500). All three uses moved to
`--status-danger-fg`, which raises contrast in every one:

| Use | Before | After |
|---|---|---|
| `.error { color }` on `--bg-page` | `#dc2626` = **4.41:1** ❌ | `#b91c1c` = **5.91:1** ✅ |
| `.notification-button span` (white text on fill) | 4.83:1 | 6.47:1 |
| `.notification-panel a.unread strong::after` (7px dot) | — | — |

`.error` was the significant one: it is the shared error style for every
non-auth form, and `auth.css` **already** used `--status-danger-fg` for
`.auth-card .error`, so the two now agree.

`--blue-dark` was `blue-700`, which matches **two** canonical tokens
(`--status-info-fg` and `--accent-hover`), so value alone could not decide it.
Split by the role of the property:

| Consumer | Role | Replacement | Value |
|---|---|---|---|
| `.blue { color }` (bg is `--status-info-bg`) | info | `--status-info-fg` | unchanged |
| `.notification-panel strong` | info | `--status-info-fg` | unchanged |
| `.notification-panel a.unread { border-left }` | info marker | `--status-info-fg` | unchanged |
| `.password-toggle-btn` | action | `--accent` | **no visible change** — `auth.css` already overrode this rule; measured `rgb(37,99,235)` before the migration |
| `.table-wrapper a` | action | `--accent` | blue-700 → blue-600 (6.70:1 → 5.17:1, both AA) |
| `.notification-panel .link-button` | action | `--accent` | same |
| `.report-bar-fill` | data emphasis | `--accent` | same |
| `tbody tr:hover` inset bar | hover affordance | `--accent` | same |

The unread marker deliberately uses `-fg`, **not** `-border`: `--status-info-border`
is blue-500, which measures **3.38:1** against that row's own tinted background.

#### The motion scale (not in the brief, found by inventory)

`core/animations.css` carried a second `:root` block. DESIGN_SYSTEM.md §7 states
that `prefers-reduced-motion` is honoured by collapsing the `--dur-*` tokens to
`0ms`, "**provided you use the tokens** — hard-code a duration and you have
opted the user out of their own accessibility setting". `--transition-fast: 150ms`
and `--transition-med: 280ms` did exactly that; they survived only because a
separate blanket `transition: none !important` rule caught them. Every consumer
of both was a hover/state transition on a card, button, badge or thumbnail —
which §7 assigns to `--dur-fast`. `--ease-bounce` is the only overshoot curve in
the product and had no canonical equivalent, so it was **promoted into
`tokens.css` §7** as a token in its own right rather than approximated away.

#### Phase 3 — dashboard.css

`.quick-actions` was the last block in the product built entirely from raw
values: 6 hexes, an off-scale radius, a bespoke shadow, 5 raw px sizes. All
migrated. Two changes are visible rather than equivalent, both justified:

- **hover** `#93c5fd` (blue-300) was the only signal a tile is interactive, and
  a pale hairline on white against a slate-100 page is close to invisible. Now
  `--accent`, matching every other interactive surface.
- **lift** `transform: translateY(-2px)` is the hover lift AUD-011 removed from
  every other control ("a lift on hover moves the thing the user is aiming
  at"). This rule loads after `animations.css`, so it survived that sweep.

#### Phase 4 — raw-value sweep, and what was retained

After migration: **0 raw hex outside `tokens.css`**, **0 `var(--token, literal)`
fallbacks repo-wide**. Literals deliberately retained, with reasons:

| Retained | Where | Why |
|---|---|---|
| `rgba(255,255,255,0.07 … 0.85)` ×10 | `shell.css` | Translucent overlays on the dark sidebar. No token expresses "white at N% over an inverse surface". |
| `rgba(255,255,255,0.04)` ×2, `0.12` | `auth.css` | The blueprint grid and its divider — an intentional, documented decoration. |
| `rgba(0,0,0,0.45)` | `modal.css` | Modal scrim. No scrim token exists. |
| `rgba(15,23,42,0.55)`, `rgba(255,255,255,0.96)`, `rgba(255,255,255,0.45)` | `animations.css` | The command palette's translucent glass, which pairs with `backdrop-filter`. Replacing them with opaque tokens would break the effect. |
| `rgba(37,99,235,0.10 / 0.12 / 0.15)` | `animations.css`, `forms.css`, `foundation.css` | Three focus-ring alphas. No translucent-ring token exists; unifying them changes focus appearance and is listed as debt below. |
| `rgba(15,23,42,0.04)` | `foundation.css` | Scroll-fade affordance gradient. |
| `min-height: 82px` | `dashboard.css` | Card heights are bespoke throughout; well above the 44px floor. |
| `0.5s` ×2, `900ms`, `animation-delay: 40/90/140ms` | `animations.css` | No canonical token at those scales. Covered by the blanket reduced-motion rule. |
| Every hex in `tokens.css` | `tokens.css` | This file *is* the palette definition. |

#### Verification

A capture script recorded **every** declaration in every stylesheet rule whose
value contains `var()`, with the value the browser resolves it to — including
hover states, pseudo-elements and media-query branches that a rendered-element
probe cannot reach. Run before and after, then diffed:

- **843 declarations resolve to a byte-identical computed value.**
- **25 rules changed**, every one intentional: 8 colour (3 danger, 5 blue-dark)
  and 17 motion/count-difference rows.
- **Pixel diff, 26 screenshots × 3 widths.** `/login` **byte-identical**. On
  every table-bearing route the maximum per-pixel delta is **18–23 / 255** with
  essentially no pixel differing by more than 16 — that is the intentional
  darkening of `th` (slate-500 → slate-600) and `td` (slate-800 → slate-900).
  The dashboard's larger figure is a **2px reflow**, not a repaint: realigning
  the after-image by 2px drops the below-fold difference from 10.12% to 1.35%
  and strong-delta pixels from 87,342 to 4,746.
- **3 regression tests added** — no retired alias resolves on `:root`; no
  stylesheet references one; the `--blue-dark` role split is still observable.
  Each was confirmed to **fail** when an alias is reintroduced.
- lint clean · build passes · **349 assertions** · axe **44/44** · `git diff --check` clean · backend untouched.
- CSS bundle **65.70 → 65.89 kB** raw (added explanatory comments), **11.60 → 11.28 kB gzipped (−2.8%)**.

#### Method defect found and corrected

The first capture reported two phantom changes on `.site-operations-page` rules
whose authored value was *identical* in both runs. Cause: the probe element was
reused across ~900 declarations, so once a rule's `transition` value was applied
to it, the next colour read came back **mid-transition**. Suppressing
`transition`/`animation` on the probe removed both phantoms. Recorded because
the same trap will catch anyone re-running this measurement.

| **Status** | **Resolved** |

## Work applied this pass

| ID | Change | Files | Result |
|---|---|---|---|
| AUD-002 | Fixed the analyser's dynamic-import blindness | `audit_analyze.py` (tooling) | 18 false positives → 0 |
| AUD-003 | Removed dead `@keyframes blobMove`, `gridMove`, `shine` | `animations.css` | 708 → 691 lines |
| AUD-010 | Removed six dead `.login-*` rules | `animations.css` | 691 → 671 lines |
| AUD-011 | Removed gradient sweep, 2 hover lifts, 2 pulseGlow rules, 3 entry animations, 4 orphaned keyframes | `animations.css` | 671 → 631 lines |
| AUD-012 | Removed dead gradient + infinite `borderFlow` on `.report-bar-fill`; deleted orphaned keyframe | `animations.css` | 631 → 635 lines (comment added) |
| AUD-004 | Removed 47 dead selectors (37 rules + 17 trims + 3 stragglers + 1 keyframe) across 12 stylesheets | 12 `.css` files | CSS source 5,733 → 5,401 |
| AUD-006 | Removed 9 legacy token aliases with zero consumers | `tokens.css`, `animations.css` | CSS source 5,401 → 5,375 |
| AUD-008 | Consolidated 4 duplicate groups (incl. a breakpoint bug); classified 22 retained | `cards.css`, `dashboard.css`, `tabs.css` | duplicates 26 → 22 |
| AUD-007 | Removed `PortalSection` + its 4 CSS rules | `PortalPrimitives.jsx`, `portal.css` | unused exports 1 → 0 |
| AUD-013 | Migrated 42 undefined-token refs + stripped 11 dead fallbacks | `site-operations.css` | CSS bundle 65.95 → 65.70 kB; 2 AA failures fixed |
| AUD-014 | Retired all 17 live legacy aliases; migrated 72 references; raw-value sweep | 14 `.css` files | 0 aliases, 0 raw hex outside `tokens.css`, 0 fallbacks; 2 AA failures fixed; gzip 11.60 → 11.28 kB |

**Net:** `animations.css` 708 → **631 lines** (**−77**, −10.9%). CSS source
5,769 → **5,729 lines** (−40; the file shrank more than the total because
removed rules were replaced with explanatory comments). CSS bundle 73.28 → **70.74 kB**
(13.24 → **12.71 kB** gzipped, **−0.53 kB / −4.0%**). JS entry unchanged at
463.80 kB.

**Verification after changes:** frontend lint clean · production build passes ·
**300 responsive + 44 axe = 344 assertions, all passing** · zero axe exceptions
· no console errors · no failed requests.

**Not applied, deliberately:** AUD-007 (`PortalSection`) — the removal is
trivial but it is the one shared primitive a future portal section would reach
for, and deleting it during a cleanup pass is the kind of change that gets
silently re-added later. Recorded rather than actioned; see §Remaining debt.

---

## Remaining technical debt

| ID | Item | Why not fixed |
|---|---|---|
| AUD-001 | Four deleted docs | Awaiting owner decision |
| ~~AUD-006~~ | ~~Legacy token aliases~~ | **Closed by AUD-014.** All seven named here now have zero declarations and zero references, as does every other legacy alias. |
| AUD-014 | Three focus-ring alphas (`rgba(37,99,235,0.10/0.12/0.15)`) | Same affordance expressed three ways. No translucent-ring token exists; unifying them changes focus appearance on every control and wants its own visual pass. |
| AUD-014 | `.command-modal` glassmorphism | `backdrop-filter: blur(14px)` over `rgba(255,255,255,0.96)` contradicts the approved direction, but removing it is a redesign, not a token migration. |
| AUD-014 | Orphaned `animation-delay` rules | `.summary-cards .card:nth-child(3n+…)` still set 40/90/140ms delays, but AUD-011 removed the card entry animation, so they delay nothing. |
| AUD-008 | 28 duplicate CSS blocks | Each pair needs an intent-vs-coincidence judgement with visual verification |
| AUD-004 | ~43 remaining reported-unused classes | Only 15 of 58 were individually verified; the rest need the same per-class check |

## Known limitations of this audit

- **Backend was not audited.** The brief forbids changing backend logic; a
  read-only backend audit was not attempted and no backend claim is made here.
- **The CSS redesign and login redesign requested in the brief were not
  started.** They are a separate body of work from this audit and are not
  claimed.
- Static analysis cannot resolve every dynamic reference. AUD-005 documents
  the class of false positive found; others may remain in the unverified 43.

## Appendix — reproducing this audit

```bash
python3 audit_analyze.py audit.json    # run from the repository root
```

The analyser is deliberately conservative: it reports candidates, it does not
delete. Every removal in this document was verified by hand first.
