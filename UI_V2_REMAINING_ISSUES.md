# UI v2 — Remaining Issues

Every issue found during the UI v2 migration, recorded when found rather than
silently fixed. Issues are logged here first; a fix references its ID.

Severity: **Critical** (broken/inaccessible) · **High** (visible defect or real
user cost) · **Medium** (inconsistency, debt with a cost) · **Low** (polish,
opportunity)

Status: **Open** · **Fixed** · **Deferred** · **Won't fix** · **By design**

---

## Found during Phase 0/1 baseline

| ID | Sev | Issue | Files | Recommendation | Status |
|---|---|---|---|---|---|
| **V2-I001** | High | `"Inter"` declared as `--font-sans` but **never loaded** — 0 `<link>`, 0 `@font-face`, 0 `@import`. Every user has read the product in their OS default, so it renders as three different products across macOS/Windows/Android. | `styles/core/tokens.css`, `index.html` | Self-host the typeface. | **Fixed** — UIV2-006, IBM Plex Sans variable |
| **V2-I002** | Medium | `brandedExportTheme` chunk is **713 kB** (gzip 233 kB) — the single largest asset in the product, larger than the entire React entry. It is the PDF/xlsx export path (`jspdf` + `xlsx` + `html2canvas`). | `dist/assets/brandedExportTheme-*.js` | Confirm it is lazily loaded on an export action only, never on route entry. If it is eager anywhere, defer it. | **Open** |
| **V2-I003** | Medium | `FinanceTrendChart` is **363 kB** (gzip 104 kB) — Recharts pulled into a route chunk. | `components/FinanceTrendChart.jsx` | Verify it is behind a lazy boundary; consider a lighter SVG sparkline for the small KPI charts and keep Recharts only for the full trend view. | **Open** |
| **V2-I004** | Low | 9 classes have **no consumer found** by static analysis: `fab`, `icon`, `login-box`, `mobile-page-nav`, `recharts-default-tooltip`, `stat-card`, `subcontractor-profile`, `tab`, `unread`. | 23 stylesheets | `recharts-default-tooltip` is injected by a third-party library and is a **false positive**. The other 8 need hand-verification before Phase 6 deletion. Do not bulk-delete. | **Open** |
| **V2-I005** | Low | `css_inventory.py`'s test-selector scan over-reports: it treats dotted property access (`el.className`, `.closest`) as class names. | `tools/ui_v2/css_inventory.py` | Harmless — it only ever *adds* to the protected set, so it fails safe. Tighten the regex if the noise becomes confusing. | **By design** |

---

## Found during Phase 2A/2B (foundations + Login)

| ID | Sev | Issue | Files | Recommendation | Status |
|---|---|---|---|---|---|
| **V2-I006** | High | `--v2-chrome-text-muted` measured **4.40:1** on `--v2-chrome-bg-active` — under AA, and muted labels do render on active nav items. | `styles/v2/core/tokens.css` | Added `--v2-ink-450`. | **Fixed** — UIV2-008 |
| **V2-I007** | High | Status indicator bars measured **1.93:1** (warning) and **2.07:1** (success) against their own tint. Invisible in direct sunlight — the condition this product is read in. | `styles/v2/core/tokens.css` | `-bar` tokens now use the `-fg` value (4.51 / 4.57). | **Fixed** — UIV2-008 |
| **V2-I008** | High | Separator and control-boundary colours were one concept. Control borders were below the 3:1 that WCAG 1.4.11 requires for a control's boundary. | `styles/v2/core/tokens.css` | Split: `--v2-line*` (separators, decorative) vs `--v2-control-line*` (controls, 3.34:1). | **Fixed** — UIV2-008 |
| **V2-I009** | Medium | The contrast audit initially gated decorative separators at 3:1, which would have forced a heavy grid and made dense financial tables *harder* to scan. | `tools/ui_v2/contrast_audit.py` | The **audit** was wrong, not the tokens. Separators reclassified as `INFORMATIONAL` — reported with their ratio, never gated. | **Fixed** |
| **V2-I010** | Medium | Legacy `!important` **beats** v2 `!important` because `!important` reverses cascade-layer order. Legacy has 9 of them. | `core/animations.css`, `components/tables.css`, `pages/dashboard.css`, `core/responsive.css` | Only the reduced-motion blanket in `animations.css` is behaviourally significant, and it is compatible with v2 by design. Re-check each when its owning sheet is deleted in Phase 6. | **Open** |
| **V2-I011** | Low | The blueprint SVG uses a single `stroke-dasharray: 900` for every path rather than each path's measured length, so shorter paths finish their sweep early. | `styles/v2/pages/auth.css` | Visually imperceptible at these durations and it avoids a `getTotalLength()` pass in JS on every mount. Revisit only if the geometry gains much longer paths. | **By design** |

---

## Found during verification

| ID | Sev | Issue | Files | Recommendation | Status |
|---|---|---|---|---|---|
| **V2-I012** | High | The Playwright suite cannot run at the default worker count against the documented backend config: `AUTH_RATE_LIMIT_MAX=10` per 15-minute window, but each Playwright **worker process** re-imports `fixtures.js` and logs in independently — 3 roles × 4 workers = 12 sign-ins, over the limit. It presents as `"Too many attempts"` and 160 tests silently not running. | `backend/.env`, `frontend/tests/support/fixtures.js`, `DEPLOYMENT.md` | Either run `--workers=2`, or start the backend with the raised limits DEPLOYMENT.md already documents. Worth recording in DEPLOYMENT.md as the *reason*, since the symptom looks like a test failure rather than a config limit. | **Open** |
| **V2-I013** | Medium | Local fixture credentials drift silently: a stale `fixture.env` produces `"Invalid email or password"`, which reads as a broken test rather than a stale fixture. | `frontend/tests/support/fixtures.js` | The error message is already actionable (it prints the exact recreate command). No change needed, but re-running the two fixture scripts should be the first response, not debugging. | **By design** |

---

## Found during Phase 2C (shell)

| ID | Sev | Issue | Files | Recommendation | Status |
|---|---|---|---|---|---|
| **V2-I014** | High | The v2 reset applied `background:none; border:0; padding:0` to `:where(button)` inside `.v2-root`. Because `.v2-root` sits on `.app-layout`, and cascade-layer order beats specificity regardless of `:where()`'s zero weight, this stripped the appearance of **every legacy button in the authenticated app** — the "Export" control rendered as bare text and the FAB as a pale circle. Not caught by the suite: the tests assert touch targets, overflow and ARIA, never `background-color`. Found by looking at a screenshot. | `styles/v2/core/reset.css` | The reset must normalise only what is safe to normalise during coexistence (`font`, `color`, `cursor`). Appearance belongs to `.v2-btn`, not to the element reset. | **Fixed** |
| **V2-I015** | High | The v2 `.skip-link` was 36px tall — under the 44px floor — on all 16 authenticated routes. | `styles/v2/shell/app-shell.css` | Added `min-block-size: var(--v2-touch)` and flex centring. Caught by `authenticated.spec.js`. | **Fixed** |
| **V2-I016** | Medium | `body` still declares `--font-sans: "Inter"`, which is never loaded. Nothing renders against it today (`.v2-root` covers the authenticated app and `.auth-shell` covers auth), so it is invisible — but it is a live lie in the token file. | `styles/core/tokens.css` | Remove with the legacy token block in Phase 6, once no legacy consumer remains. | **Open** |
| **V2-I018** | High | Same class as V2-I014, second instance: the v2 reset applied `color: inherit` to `:where(button)`, replacing every legacy button's white label with the inherited body colour. axe measured **ink-900 on blue-600 = 3.68:1** and failed `color-contrast` on 24 route/width combinations. Caught by the axe suite, not by eye. | `styles/v2/core/reset.css` | Reset normalises metrics (`font`, `margin`) only. Colour belongs to the component. | **Fixed** |
| **V2-I019** | Medium | The lesson from V2-I014 and V2-I018: **any** element-level declaration in a v2 layer reaches unmigrated legacy markup, and `:where()` gives no protection because layer order outranks specificity entirely. | `styles/v2/core/reset.css` | Before adding any new bare-element rule to a v2 layer, ask what it does to a legacy page. Prefer class-scoped rules until Phase 6. | **Open** |
| **V2-I017** | Medium | The v2 reset also zeroes margins on `:where(h1..h6, p, ul, ol, dl, figure)` inside `.v2-root`, which reaches unmigrated legacy pages. No visible damage found so far — legacy sheets set explicit margins — but it is the same class of leak as V2-I014. | `styles/v2/core/reset.css` | Re-verify each page group as it migrates; treat any unexplained spacing collapse on a legacy route as this first. | **Open** |

---

## Found during Phase 3 (shared data surfaces)

| ID | Sev | Issue | Files | Recommendation | Status |
|---|---|---|---|---|---|
| **V2-I020** | High | Table row action links ("New", "Open") measured **44px tall but 28.9-37.3px wide**. WCAG 2.2 target size is an *area*; `authenticated.spec.js` asserts height only, so this passed while the real tap target was roughly two-thirds the intended size. They are standalone row actions, so the inline-link exception does not apply. | `styles/v2/components/data.css`, `authenticated.spec.js` | Enforced `min-inline-size` as well as `min-block-size`. **The suite's touch-target assertion should be widened to check both axes** — otherwise this class of defect stays invisible. | **Fixed** (CSS) / test widening **Open** |
| **V2-I022** | Critical | The v2 `.badge` base rule outranked Site Operations' BEM modifiers (`.badge--camera`, `.status--pending`, …) because it sits in a later cascade layer. Every Site Operations badge collapsed to neutral grey, making photo-source and approval states **indistinguishable** — status information silently lost, not merely restyled. | `styles/v2/components/data.css`, `pages/site-operations.css` | Mapped each modifier onto the v2 status family. Caught by the AUD-013 regression test, which was written for precisely this failure mode. Lesson: a base rule in a later layer defeats **every** modifier in an earlier one — restyling a base class means re-homing its variants too. | **Fixed** |
| **V2-I021** | Medium | Legacy `.empty-table-message` carries `!important` on padding and text-align. Because `!important` reverses layer order, v2 must also use `!important` to restyle it — the only place in the v2 tree that does. | `components/tables.css`, `styles/v2/components/data.css` | Remove both when `components/tables.css` is deleted in Phase 6. | **Open** |

---

## Found during Phase 2C remainder (overlays + route transitions)

| ID | Sev | Issue | Files | Recommendation | Status |
|---|---|---|---|---|---|
| **V2-I023** | ~~Medium~~ | The notification panel stayed open after `Escape` while verifying the command palette — it was still visible behind the palette in the screenshot. Either Escape is not wired to the notification disclosure, or opening the palette does not dismiss it. Both leave two overlays stacked with ambiguous focus. | `components/NotificationCenter.jsx`, `components/CommandPalette.jsx` | Confirm Escape closes the notification panel, and that opening the palette dismisses any open disclosure. Behavioural, not cosmetic — needs a JSX change and a test, so it is logged rather than fixed in a styling pass. | **Resolved** — shared `useDismissableOverlay`; 4 runtime tests |
| **V2-I024** | Low | Route transitions are opted in on sidebar `NavLink`s only. Navigations from in-page links, breadcrumbs, the command palette and `navigate()` calls do not cross-fade, so the effect is inconsistent depending on how the user moved. | `components/Sidebar.jsx`, `components/CommandPalette.jsx` | Extend `viewTransition` to the palette's navigation and to in-page links, or move to a router-level wrapper. Resolved with `AppLink`/`AppNavLink`/`useAppNavigate`; 5 behaviour tests. | **Resolved** |

---

## Found during the shared-layer gate

| ID | Sev | Issue | Files | Recommendation | Status |
|---|---|---|---|---|---|
| **V2-I025** | Medium | A filter chip labelled "All" on `/tenders` measures **44px tall but 39.9px wide** — the same area-vs-height defect as V2-I020, on an unclassed `<button>` so no selector reaches it. Present at 390, 768 and 1440. | `pages/TendersPage.jsx` | Fix in Phase 4 Group 2 when the page is redesigned and the chip gets a class. **Deliberately not patched with a bare `button` rule** — an unscoped element rule in a v2 layer is exactly what caused V2-I014 and V2-I018. | **Open — Phase 4 Group 2** |
| **V2-I026** | Low | `authenticated.spec.js`'s touch-target assertion still checks height only, so V2-I020 and V2-I025 were both invisible to it. | `frontend/tests/authenticated.spec.js` | Widen it to assert both axes. Doing so will likely surface more instances across unmigrated routes, so it should land with Phase 4 Group 1 rather than before it. | **Open** |

---

## Phase 4 Group 1 — Dashboard: inventory and weaknesses (documented before any change)

**What is on the page today** — `pages/DashboardPage.jsx` (1,626 lines):
DashboardHero (greeting + attention strip) · "Executive Dashboard" panel with
6 quick actions · **12 `AnimatedStatCard`s in one flat grid** · Today's Finance
+ Project Portfolio · FinanceTrendChart · Finance Health + Invoice Health ·
Project Status + Operational Capacity · **six "Recent X" panels** (Payments,
Upcoming Tenders, Invoices, Tenders, Workers, Sites) · Suggested Next Actions.
Roughly 20 panels. Measured full-page height at 1440: **4,465px — about five
screens.**

| ID | Sev | Issue | Evidence | Affected | Resolution | Status |
|---|---|---|---|---|---|---|
| **V2-I027** | High | **No hierarchy in the KPI grid.** Twelve `AnimatedStatCard`s render in one flat `repeat(4, 1fr)` grid, every one the same size and weight. Cash Position and Total Records are given identical prominence, so nothing reads as important and the user must scan all twelve. | `DashboardPage.jsx:691-762` | `/dashboard` | Tier the grid: a small number of primary figures at larger scale, the rest as a dense secondary band. | **Fixed** |
| **V2-I028** | High | **Six "Recent X" tables**, each showing ~5 rows, stacked vertically. None answers a question — they are six views of "here is some data", and together they account for roughly four of the five screens of scroll. The information is already one click away on each register page. | `DashboardPage.jsx:1141-1549` | `/dashboard` | Consolidate into one tabbed "Recent activity" section. Every table and every link is preserved and reachable; the page stops being a scroll. | **Fixed** |
| **V2-I029** | High | **Overdue and due-soon work is computed but not surfaced.** `overdueTenders`, `overdueInvoices`, `dueSoonTenders`, `pendingInvoices` all exist as derived values, but overdue tenders appear as one card among twelve and overdue invoices only inside a health panel. The brief's first question — "what needs attention" — is answered weakly. | `DashboardPage.jsx:316-411` | `/dashboard` | — | **FALSE FINDING — withdrawn.** `DashboardHero` already implements exactly this: five items ordered danger → warning → info (overdue invoices *with their monetary total*, overdue tenders, due-soon tenders, pending invoices, tenders to submit), each linking to the register that resolves it. I recorded it as a weakness without reading the item construction in `DashboardHero.jsx:93-139` carefully enough. Kept in the register per the rule that false findings are not deleted. |
| **V2-I030** | Medium | **`AnimatedStatCard` has a hover lift** (`whileHover` translate). Explicitly prohibited by the design direction — a control that moves under the cursor is a mis-click risk, and AUD-011 already removed hover lifts everywhere else. It survived because it is a Framer Motion prop, not CSS, so the CSS sweep never saw it. | `components/AnimatedStatCard.jsx` | `/dashboard` | Remove the transform; keep the count-up, which is a one-shot reveal and legitimate. | **Fixed** |
| **V2-I031** | Medium | **Four ratio metrics render as bare percentages** (profit margin, expense ratio, invoice collection rate, tender completion rate). A number alone gives no sense of position against a target or against each other. UI/UX Pro Max returns **Bullet Chart** for exactly this: "multiple KPIs side by side; space-constrained contexts where a gauge is too large". | `DashboardPage.jsx:473-492` | `/dashboard` | Render each as a labelled bar with its value. CSS only — no charting dependency. | **Fixed** — `RatioRow`, 4 consumers, bar grows once on mount, hidden below 520px where the figure matters more than the affordance |
| **V2-I032** | Medium | **The "Executive Dashboard" panel carries no data** — a heading, a description and the quick actions. A full panel of chrome wrapping six links. | `DashboardPage.jsx:660-690` | `/dashboard` | Demote to a plain action row; the panel border and heading earn nothing. | **Fixed** — panel, heading and description removed; verified absent from the DOM |
| **V2-I033** | Low | The dashboard has **no skeleton state**. Data arrives via props from `AppRoutes`, so the page renders with zeros before the fetch resolves — the user briefly sees a confident ₹0 rather than "loading". | `DashboardPage.jsx`, `routes/AppRoutes.jsx` | `/dashboard` | Inferred locally from the page's own `getSubcontractors` request — no prop threading, no data-flow change, and it clears correctly for an empty company. | **Fixed** — verified with a delayed response: 12 skeleton cards at the real grid width, real grid `hidden`, both correct after load |
| **V2-I034** | Low | `.dashboard-grid`, `.two-column-dashboard`, `.section-title-row`, `.summary-cards` have no v2 definitions and rely on legacy sheets. | `styles/core/foundation.css`, `styles/pages/dashboard.css` | `/dashboard` | Define in the v2 dashboard sheet; delete legacy rules only once `css_inventory.py` shows no other consumer. | **Fixed** (v2 defined; legacy deletion deferred to Phase 6) |

| **V2-I035** | Medium | **Zero given a status tone.** "Today's Income/Expense/Net" render as tinted success/danger cards at ₹0.00, and "Overdue: 0" renders as a danger card. A zero is not a success and not a failure — tinting it trains the user to ignore the tint, so it stops working on the day the number is real. This is the same anti-pattern the portal work fixed in an earlier programme. | `pages/DashboardPage.jsx` (Today's Finance, Project Portfolio) | Apply the tone only when the value is non-zero, as the portals now do. Found by screenshot at the end of this pass; logged rather than fixed because it changes which branch renders and wants its own verification. | **Open** |
| **V2-I036** | Low | Only one quick action renders for an admin ("Add Tender") while `quickActions` is built for more. Pre-existing, unrelated to UI v2 — the array is filtered by role and this fixture resolves to one entry. | `pages/DashboardPage.jsx` | Confirm the intended set per role before Group 2. | **Open** |

| **V2-I037** | Medium | **47 v2 classes have no JSX consumer**, and I applied the "no dormant CSS" rule inconsistently: I deleted the dashboard's unused `.v2-metric*`/`.v2-risk*` blocks, then left an unconsumed foundation layer standing. Measured across `styles/v2/**`. Two distinct groups, and they are not equivalent: **(a) design-system primitives** — `.v2-btn*` (6), `.v2-input`/`.v2-select`/`.v2-textarea`/`.v2-field`/`.v2-label`/`.v2-hint`/`.v2-error`/`.v2-required` (8), `.v2-badge*` (5), `.v2-empty*` (4), `.v2-sr`, plus the motion primitives `.v2-fade`/`.v2-rise`/`.v2-scale-in`/`.v2-stagger`/`.v2-collapse`/`.v2-confirm`/`.v2-shake`/`.v2-indicator` (8) and the type primitives (7). These have documented contracts and are what Phase 4 Groups 2-4 and Phase 5 will consume; deleting them means rebuilding them per group, which is worse. **(b) genuinely speculative** — `.v2-page-head*` (5), `.v2-surface`, `.v2-panel*` (2): I wrote these expecting a use that never arrived, which is the same mistake as `.v2-metric`. | `styles/v2/core/*.css`, `styles/v2/components/data.css` | Delete group (b) now — 8 classes, no consumer, no plan. Keep group (a) but treat it as a **debt with a deadline**: if a primitive still has no consumer when Phase 5 ends, it was never needed and goes. Recorded rather than acted on because I am at the end of this pass and deleting a foundation layer unverified is exactly the kind of change that needs a full gate behind it. | **Open** |

---

## Phase 4 Group 2 — Payments (`/payments`)

**Read first:** `PaymentsPage.jsx` (511) + 7 components in `components/finance/`
(1,814 lines total). Structure: `FinanceOverview` (6 tinted cards + 2 ratio
panels) → `FinanceTrendChart` → payment-type loading/error → `FinanceWizard`
(875 lines: Income/Expense → section → child → form) → `FinanceTable` (345,
filters + records) → `DeleteVerificationModal`.

| ID | Sev | Issue | Evidence | Affected | Resolution | Status |
|---|---|---|---|---|---|---|
| **V2-I038** | High | **Status tone applied to facts, not statuses.** `FinanceOverview` hardcodes `highlight-danger` on **Total Expense** — an expense is normal business operation, not a failure — and `highlight-success` on Total Income. Neither is a status; both are facts. Colouring them spends the danger/success vocabulary on values that can never be "bad" or "good", which is what makes the tint stop meaning anything. | `FinanceOverview.jsx:14-24` | `/payments` | Income, Expense and Total Records become neutral. Only Balance keeps a conditional tone, because a negative balance genuinely is a status. | **Fixed** |
| **V2-I039** | High | **Zero rendered as a warning.** Baki GST is `highlight-warning` and Baki Company Charge `highlight-danger` **unconditionally** — so ₹0 outstanding, which is the *good* outcome, renders amber and red. Same defect as V2-I035 on the Dashboard, and the same one the portal work fixed earlier: a tone that is always on trains the user to ignore it. | `FinanceOverview.jsx:25-33` | `/payments` | Tone applies only when the outstanding amount is greater than zero; at zero the card is neutral and reads as settled. | **Fixed** |
| **V2-I040** | Medium | **No hierarchy in the overview.** Six equally-sized, equally-weighted cards — the same flat-grid problem the Dashboard had (V2-I027). Balance is the figure someone opens this page for, and it competes with Total Records. | `FinanceOverview.jsx` | `/payments` | Tier it: Balance, Income and Expense lead; outstanding and record count form the supporting band. Reuses the Dashboard's `.v2-metrics` tiers, so the two pages share one vocabulary. | **Fixed** |
| **V2-I041** | Medium | **The page has no header.** It opens directly on six cards with no title, no count and no context. The topbar says "Finance"; the page says nothing about what is in it. | `PaymentsPage.jsx:418` | `/payments` | Add a page head with the record count. Also gives `.v2-page-head` its first real consumer, retiring part of V2-I037's speculative group. | **Fixed** |
| **V2-I042** | Low | The ratio panels use `.report-bar` / `.report-bar-fill`, a third bar implementation alongside the Dashboard's `.v2-ratio` and the legacy report bars. | `FinanceOverview.jsx`, `pages/reports.css` | `/payments`, `/reports` | Re-point at the v2 ratio styling so there is one bar in the product. Deferred until `/reports` migrates, so both consumers change together rather than leaving two conventions live. | **Open** |
| **V2-I043** | Medium | **Zero given a status, one level down.** After fixing V2-I038/I039 the Balance card still used `balance >= 0`, so an empty ledger rendered green and read "In surplus". Zero is neither a surplus nor a deficit. Found by screenshot immediately after the fix — the same defect I had just corrected, one level deeper. | `FinanceOverview.jsx` | `/payments` | Three-way: positive → success/"In surplus", negative → danger/"In deficit", zero → no tone/"Nothing recorded". | **Fixed** |
