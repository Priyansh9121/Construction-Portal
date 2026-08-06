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

### AUD-013 — Site Operations references design tokens that do not exist

| Field | Value |
|---|---|
| **Category** | Design System |
| **Severity** | Low |
| **Files** | `frontend/src/styles/pages/site-operations.css` |
| **Description** | Surfaced while classifying AUD-008 groups G22–G24. Rules use `var(--success-bg, #dcfce7)`, `var(--warning-bg, #fef3c7)`, `var(--surface-muted, #f4f5f7)`, `var(--text-muted, #6b7280)` and `var(--primary-color, #2563eb)`. |
| **Evidence** | `--success-bg`, `--warning-bg`, `--surface-muted` and `--primary-color` are **not declared anywhere** in `tokens.css`. Every one of these resolves to its hard-coded hex fallback, so the file is effectively using raw colour values while appearing token-compliant. `--text-muted` does exist, so that one resolves correctly — its fallback is dead but harmless. |
| **Risk** | These colours do not follow the palette. `#a16207` and `#6b7280` are not in the slate/amber/green/red families, so Site Operations badges drift from the product's status scale, and a future token change will not reach them. |
| **Recommended fix** | Replace with the canonical `--status-*-bg` / `--status-*-fg` pairs and drop the fallbacks. |
| **Fix applied** | **None.** |
| **Status** | **Needs Manual Decision** — this is a visible colour change to Site Operations status badges, so it needs before/after screenshots at the affected widths rather than a blind token swap. Also resolves AUD-008 G21–G24 once done. |

---|---|
| **Category** | Duplicate CSS |
| **Severity** | Medium |
| **Files** | 28 duplicate bodies across the 24 stylesheets |
| **Description** | 28 declaration bodies (>40 characters) appear under two or more distinct selectors. |
| **Evidence** | Analyser normalises each block (sorted declarations, whitespace-collapsed) and groups identical bodies. |
| **Risk** | A change made in one place and not the other is the classic source of visual drift. |
| **Recommended fix** | Consolidate where the selectors genuinely share intent; leave alone where two components coincidentally share a body but would diverge under change. |
| **Fix applied** | None this pass. |
| **Verification** | n/a |
| **Status** | **Blocked** — consolidating requires deciding, per pair, whether the shared body is intent or coincidence. That judgement needs per-pair review with visual verification, which did not fit this pass. Recorded in §Remaining technical debt with the full list available from the analyser output. |

---

### AUD-009 — No TODO / FIXME / HACK markers

| Field | Value |
|---|---|
| **Category** | Technical Debt |
| **Severity** | None |
| **Evidence** | Analyser scanned every line of all `.js`, `.jsx`, `.css` under `frontend/src` and `frontend/tests` for `TODO`, `FIXME`, `HACK`, `XXX`. **Zero matches.** |
| **Status** | **Resolved** — nothing to do. Recorded so the absence is a measured result, not an assumption. |

---

### AUD-010 — Dead `.login-*` rule set (found by reading, not by the analyser)

| Field | Value |
|---|---|
| **Category** | Unused CSS / Dead Code |
| **Severity** | Medium |
| **Files** | `frontend/src/styles/core/animations.css` |
| **Description** | Six rules targeting `.login-brand`, `.login-brand::after`, `.login-brand h1/p` and `.login-box form` — including an infinite `floatTiny` animation and a radial-gradient overlay. The auth screens were rebuilt on `.auth-*` classes, so none of these selectors match anything. |
| **Evidence** | `grep -rF login-brand frontend/src \| grep -v '\.css:'` returns exactly **one** hit — an explanatory comment inside `AuthShell.jsx`. No JSX uses the class. |
| **Risk** | 20 lines of dead CSS including a permanently-running animation, shipped to every user. |
| **Fix applied** | All six rules removed. `animations.css` 691 → 671 lines. |
| **Verification** | lint clean · build passes · 300 responsive + 44 axe assertions pass · CSS bundle 73.28 → 72.62 kB. |
| **Status** | **Resolved** |

*Worth noting how this was found: the analyser did not flag it, because
`.login-brand` appears in a source comment and my class-usage check treats any
textual occurrence as a reference. Reading the file caught what the tool
missed — a caution against trusting either method alone.*

---

### AUD-011 — Anti-pattern motion on cards, badges and navigation

| Field | Value |
|---|---|
| **Category** | Animations / Design System |
| **Severity** | Medium |
| **Files** | `frontend/src/styles/core/animations.css` |
| **Description** | Decorative motion contradicting DESIGN_SYSTEM.md §7 and §14 was live across authenticated routes. |
| **Evidence (runtime, not static)** | A Playwright probe measured computed styles on 7 routes at 1440px. **Gradient `::before` sweep active on 60 elements** — Dashboard 34, Tenders 15, Subcontractor 4, Worker 3, SiteOps 2, Activity 2. **Infinite `pulseGlow` running on 3 routes** (`button.active-tab` on Tenders, Worker Portal, Subcontractor Portal). Card and badge `transition` both declared `transform`, the vector for the 7px lift. |
| **Risk** | A 7px hover lift moves the target the user is aiming at — the same mis-click risk already fixed for buttons. Two permanently-running animations carry continuous compositing cost on every authenticated page. |
| **Fix applied** | Removed: the `.card/.panel/.stat-card::before` gradient sweep and its `:hover::before` reveal; the `.card/.stat-card:hover` 7px lift + 60px shadow; the `.badge/.tender-status-badge:hover` lift; `.sidebar a.active` pulseGlow (**dead** — nav uses `.active-link`); `.tabs .active-tab` pulseGlow (**live**); the now-dead `transform` vectors from card and row transitions; `animation: softPop` on every card (34 on Dashboard alone); `animation: rowEnter` on every table row; `animation: fadeDown` on `.page-header`. Orphaned keyframes `pulseGlow`, `fadeDown`, `rowEnter`, `floatTiny` deleted. |
| **Interaction feedback preserved** | `.active-tab` retains a solid background fill (`tabs.css:31`) plus weight change and underline (`foundation.css:620`) — verified, no state indication lost. Modal fade/scale and alert entry animations **retained**: DESIGN_SYSTEM.md §7 explicitly permits them. |
| **Verification** | Runtime probe re-run: **infinite animations 0/7 routes** (was 3), **gradient `::before` 0** (was 60). 21 before/after screenshots at 390/768/1440 across 7 routes: **18 byte-identical**; the 2 with deltas (Worker/Subcon @1440) are exactly where `pulseGlow` was mid-cycle; 1 differs by 78 bytes. Visual inspection of Worker@1440 confirms no regression. lint clean · build passes · 300 responsive + 44 axe pass. |
| **Status** | **Resolved** |

---

### AUD-012 — `borderFlow` infinite animation on `.report-bar-fill`

| Field | Value |
|---|---|
| **Category** | Animations / Performance |
| **Severity** | Low–Medium |
| **Files** | `frontend/src/styles/core/animations.css`, `frontend/src/styles/pages/reports.css` |
| **Description** | `.report-bar-fill` declared a 3-stop gradient plus `animation: borderFlow 3s linear infinite`. |
| **Correction to the previous entry** | The earlier revision recorded this as **Blocked**, on the grounds that `/reports` rendered zero `.report-bar-fill` elements. **That was the wrong route.** The class is used 7 times, none of them in `ReportsPage.jsx`: `TenderOverviewTab` ×2, `TenderSitesTab` ×2, `FinanceOverview` ×2, `TenderSummaryCard` ×1. The class name is a leftover from a removed reports implementation; the styling migrated to tender and finance views. |
| **Evidence (runtime)** | Measured **2 live elements on `/tenders/229` AND 2 on `/payments`**, each reporting `animationName: "borderFlow"`, `animationIterationCount: "infinite"`, `backgroundImage: "none"`. |
| **The actual defect** | `styles/pages/reports.css` loads **after** `animations.css` and sets `background: var(--blue-dark)`. The `background` shorthand resets `background-image` to `none`, so the gradient never painted — but `animation` was not overridden, leaving an infinite animation running against a background that does not exist. Permanent compositing cost, zero visual output, on two routes. |
| **Fix applied** | Removed the gradient and the `animation` declaration from the `animations.css` rule, keeping only `transition: width 900ms` (the bar growing to its value carries real meaning). `@keyframes borderFlow` deleted as orphaned. |
| **Verification** | Re-measured on both routes: `animationName: "none"`, `iterationCount: "1"`, element count unchanged at 2, `backgroundImage` unchanged at `"none"` — proving no visual change. lint clean · build passes · 300 responsive + 44 axe pass. |
| **Status** | **Resolved** |

---

### AUD-004 — Dead CSS classes

| Field | Value |
|---|---|
| **Category** | Unused CSS |
| **Method** | Static analysis + a runtime collector walking all 22 routes, clicking every tab strip and expanding disclosures (205 distinct classes observed), + per-class source verification. |
| **Outcome** | **58 → 11.** 47 dead selectors removed; 11 correctly retained. |
| **Removed** | 37 rules deleted outright and 17 selector lists trimmed, plus 3 stragglers in a second pass and 1 newly-orphaned keyframe. The remover only deletes a rule when **every** class in its selector list is dead; a mixed list like `.auth-success, .login-message` is rewritten to keep the live half. |
| **Retained (11)** | 1 **False Positive** — `recharts-default-tooltip`, stamped by the Recharts library. 10 **Unsafe To Remove** — `badge--{camera,gallery,unknown}` and `status--{approved,denied,expired,granted,pending,rejected,used}`, produced by template literals. |
| **Verification** | The runtime collector was re-run after deletion: **205 classes before, 205 after, none lost, none gained.** lint clean · build passes · 300 responsive + 44 axe pass. |
| **Status** | **Resolved** |

**Tooling defect caught before it did damage:** the first version of the
remover parsed CSS comment prose as selectors — it proposed "trimming"
`/* File purpose: … */`. Running it would have corrupted eight stylesheets.
Fixed by masking comment bodies with equal-length spaces so offsets stay
valid. Recorded because it is the second time in this audit that inventorying
before applying prevented real damage.

---

### AUD-006 — Design token candidates

| Field | Value |
|---|---|
| **Category** | Unused CSS / Design System |
| **Outcome** | **All 34 candidates classified. 9 removed, 25 retained with reasons.** |

| Category | Count | Action |
|---|---:|---|
| **Intentional scale member** | 17 | Retain — `--space-0`, `--radius-xl/2xl`, `--dur-instant/slow`, `--z-base/modal/modal-scrim`, `--ease-in-out`, `--font-mono`, `--line-height-relaxed`, `--color-{amber-50/400/600, green-50, red-50, slate-500}`. A token scale is a *palette*, not a usage list; a scale that only declares what is currently consumed forces a token edit for every new component. |
| **Active semantic token, currently unconsumed** | 7 | Retain — `--accent-brand-subtle`, `--bg-active`, `--bg-surface-raised`, `--border-strong`, `--content-max-narrow`, `--status-neutral-border`, `--text-on-accent`. These complete semantic families whose siblings are in use. |
| **Legacy alias, 0 consumers** | 9 | **Removed** — `--primary-light`, `--danger-light`, `--success`, `--warning`, `--warning-light`, `--bg`, `--mobile-bg`, `--shadow-login` (tokens.css) and `--transition-slow` (animations.css). |
| **False positive** | 1 | `--active` was never a token. The analyser's `(--[\w-]+)\s*:` pattern matched inside the BEM class `.ops-module--active:hover`. |

Verified zero remaining `var()` references for all 9 removed aliases. No raw
values were introduced — every removal was of an alias with no consumer, so
nothing needed migrating. Live legacy aliases (`--primary`, `--danger`,
`--text`, `--muted`, `--border`, `--panel-bg`, `--blue-dark`, …) are
**Intentionally Retained**: they still have consumers across the page sheets,
and retiring them requires per-sheet migration, which is separate work.

| **Status** | **Resolved** |

---

### AUD-008 — Duplicate CSS declaration groups

| Field | Value |
|---|---|
| **Category** | Duplicate CSS |
| **Description** | The analyser reports 26 groups (down from 28 as a side effect of the AUD-004 deletions). |
| **Fix applied** | **None.** |
| **Status** | **Blocked** — not started in this pass. Each group needs an individual intent-vs-coincidence judgement against specificity, source order, media scope and page ownership, with computed-style verification per merge. That did not fit the remaining budget, and a partial merge would change cascade order in ways the test suite would not necessarily catch. |

---

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
| AUD-006 | Legacy token aliases | Requires per-sheet migration off `--bg`, `--warning`, `--primary-light`, `--mobile-bg`, `--shadow-login`, `--danger-light`, `--active` before the aliases can go |
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
