# Fresh UI Route Matrix

Migration state of all 28 registered routes. A route is **Complete** only when
its design brief is satisfied, its feature inventory is preserved, it passes
all nine widths in both motion modes, and the full gate is green.

**Status key:** Not started · Researched · Concept locked · In progress ·
Complete · Verified

**System key:** V1 = `styles/core` + `styles/pages` · V2 = `styles/v2` ·
**System** = `styles/system` (the current design system)

---

## Auth group — first group to be fully cleaned

| Route | Page | Current system | Status | Notes |
|---|---|---|---|---|
| `/login` | `LoginPage.jsx` | **System** | **Complete** | Boundary B verified. Prop contract preserved; `?next=` orientation added as UI-only helper |
| `/register` | `RegisterPage.jsx` | **System** (shared only) | **Blocked** | AUTH-001: signup returns 400 (no `company_name`); role select is ignored by the API. Needs a product decision before route-specific work |
| `/forgot-password` | `ForgotPasswordPage.jsx` | V1 + V2 | **Concept locked** | Invariant response is a security contract |
| `/reset-password` | `ResetPasswordPage.jsx` | V1 + V2 | **Concept locked** | 1500 ms success window is a real designed moment |

**Shared auth surface:** `AuthShell.jsx` (+ `AuthLink`, `StructuralFrame`) —
concept locked, `StructuralFrame` to be replaced (AUTH-003).

**Auth exit criteria.** Both `styles/pages/auth.css` and
`styles/v2/pages/auth.css` removed, zero remaining consumers proven, and no
auth compatibility layer left behind.

---

## Application shell — blocked until auth is verified

| Surface | File | Current system | Status |
|---|---|---|---|
| App shell | `AppLayout.jsx` | V2 (`.v2-root`) | Not started |
| Sidebar | `Sidebar.jsx` | V1 + V2 | Not started |
| Topbar | `Topbar.jsx` | V1 + V2 | Not started |
| Command palette | `CommandPalette.jsx` | V2 | Not started |
| Notification centre | `NotificationCenter.jsx` | V1 | Not started |
| Route guard loading | `RoleRoute.jsx` | inline styles | Not started (AUTH-007) |

---

## Office routes

| Route | Page | Current system | Status |
|---|---|---|---|
| `/dashboard` | `DashboardPage.jsx` | V2 (`v2-metrics`, `v2-ratio`, `v2-skeleton`) | Not started |
| `/tenders` | `TendersPage.jsx` | V1 | Not started |
| `/tenders/:id` | `TenderDetailsPage.jsx` | V1 | Not started — 9 tabs |
| `/payments` | `PaymentsPage.jsx` | V1 | Not started |
| `/invoices` | `InvoicesPage.jsx` | V1 | Not started |
| `/workers` | `WorkersPage.jsx` | V1 | Not started |
| `/worker-money` | `WorkerMoneyPage.jsx` | V1 | Not started |
| `/subcontractors` | `SubcontractorsPage.jsx` | V1 | Not started |
| `/daily-site-updates` | `DailySiteUpdatesPage.jsx` | V1 | Not started |
| `/daily-update-approvals` | `DailyUpdateApprovalsPage.jsx` | V1 | Not started |
| `/masters` | `MastersPage.jsx` | V1 | Not started |
| `/users` | `UsersPage.jsx` | V1 | Not started |
| `/activity` | `ActivityPage.jsx` | V1 | Not started |
| `/reports` | `ReportsPage.jsx` | V1 | Not started |
| `/settings` | `SettingsPage.jsx` | V1 | Not started |

## Shared office + supervisor

| Route | Page | Current system | Status |
|---|---|---|---|
| `/site-operations` | `SiteOperationsPage.jsx` | V2 | Not started |

## Portals

| Route | Page | Current system | Status |
|---|---|---|---|
| `/worker-portal` | `WorkerPortalPage.jsx` | V1 | Not started |
| `/subcontractor-portal` | `SubcontractorPortalPage.jsx` | V1 | Not started |

## Redirects

| Route | Behaviour | Status |
|---|---|---|
| `/` | Role-dependent redirect via `getHomePath` | Not started (AUTH-006) |
| `*` | Redirect | Not started |

---

## Group ordering

Auth → shell and overlays → shared data/form/feedback → dashboard →
registers and detail → finance → administration and reports → activity and
site operations → portals → obsolete removal → full matrix.

The shell does not begin until the auth gate is green.

---

## Standing gate

Applied to every group before it is marked Complete.

| Gate | Requirement |
|---|---|
| Lint | 0 problems |
| Build | passes |
| Playwright + axe | ≥ 358 passed, 0 failed |
| Token audit | all checks pass |
| Font probe | passes |
| Contrast | no gated pair fails |
| Widths | 320, 375, 390, 414, 768, 1024, 1280, 1440, 1920 |
| Motion modes | normal and `prefers-reduced-motion` |
| Console | no errors |
| Network | no unexpected failed requests |
| Touch targets | ≥ 44 × 44 px |
| Backend | unchanged |
| `git diff --check` | clean |
