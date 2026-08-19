# Phase E — the ordered route plan

Both axes were run before deciding anything. **Neither discriminates**, and that
is the headline finding: the ordering has to come from somewhere else.

---

## Axis 1 — the a11y sweep does not measure migration progress

**44 / 44 pass. Every route, migrated and unmigrated alike.**

The prediction recorded last session was that *"migrated routes should audit
clean, and unmigrated ones may not"*, which would have made the sweep a nearly
free migration probe. **Measured, the second half is false.** Sixteen unmigrated
routes audit exactly as clean as the six migrated ones, with
`DOCUMENTED_EXCEPTIONS` empty and no rules disabled.

Accessibility and design generation are orthogonal here: the legacy markup is
already semantic and labelled. So the clean portal result last session was
evidence the *design system* produces accessible output — it was **not** evidence
that the audit can tell the generations apart, and I over-read it. This axis is
dead for ordering purposes.

It keeps its real value as an acceptance bar: a migrated route that stops
auditing clean has diverged from the system.

## Axis 2 — the business-rule gap list is nearly flat

    32 implemented · 3 partial · 0 genuinely absent · 1 contradicted (resolved)

The gap list's own conclusion says why: *"The real gap is not backend business
logic… it is the frontend surfaces for rules the backend already enforces."*

So the list cannot rank routes by missing rules, because almost nothing is
missing. Only three items attach to a route at all:

| gap | route | note |
|---|---|---|
| 1.9 "Generate Bill" not verified | Payments / Subcontractors | the one unverified rule |
| §1.11 "Personal Banking" not modelled as a branch | Worker Portal | partial |
| Labour has no approve/reject workflow | Site Operations | **policy question by decision, not a bug** |

## The axis that does work — style generation, measured

Built because the other two were flat. It classifies every `className` in each
page against which generation declares it, and the result is **perfectly
bimodal** — no page sits in between:

    migrated    100% system-only classes, zero legacy
    unmigrated    0% system-only classes

**Correction to the handoff:** it said auth, the shell and the Dashboard are
migrated. **ActivityPage is migrated too** — 16 system classes, zero legacy,
backed by `styles/system/activity/activity.css`. Six pages, not five.

**Correction to the brief:** `css_inventory.py` does *not* settle the three style
generations; it reports class consumption. The generations were measured
separately. All three do coexist and all three ship:

    legacy (core + components + pages)   20 files   4,087 lines
    v2                                    8 files   2,100 lines
    system                               39 files  10,362 lines

---

## The table

`gen` = style generation. `a11y` is uniform and carried only to show it is.

| Route | Page | Rules | a11y | Gen | Size |
|---|---|---|---|---|---|
| `/login` | LoginPage | — | ✓ | **system** | 9 KB |
| `/register` | RegisterPage | — | ✓ | **system** | 10 KB |
| `/forgot-password` | ForgotPasswordPage | — | ✓ | **system** | 6 KB |
| `/reset-password` | ResetPasswordPage | — | ✓ | **system** | 9 KB |
| `/dashboard` | DashboardPage | — | ✓ | **system** | 17 KB |
| `/activity` | ActivityPage | — | ✓ | **system** | 12 KB |
| `/worker-portal` | WorkerPortalPage | §1.11 partial; §1.12–1.15 need surfaces | ✓ | legacy | 60 KB |
| `/subcontractor-portal` | SubcontractorPortalPage | S-01 fixed | ✓ | legacy | 53 KB |
| `/tenders` | TendersPage | implemented | ✓ | legacy | 52 KB |
| `/settings` | SettingsPage | — | ✓ | legacy | 52 KB |
| `/worker-money` | WorkerMoneyPage | implemented | ✓ | legacy | 51 KB |
| `/users` | UsersPage | implemented | ✓ | legacy | 42 KB |
| `/subcontractors` | SubcontractorsPage | 1.9 partial | ✓ | legacy | 41 KB |
| `/site-operations` | SiteOperationsPage | §1.13 surfaces; labour policy Q | ✓ | legacy | 39 KB |
| `/tenders/:id` | TenderDetailsPage | implemented | ✓ | legacy | 36 KB |
| `/reports` | ReportsPage | — | ✓ | legacy | 34 KB |
| `/daily-update-approvals` | DailyUpdateApprovalsPage | — | ✓ | legacy | 31 KB |
| `/daily-site-updates` | DailySiteUpdatesPage | §1.13 surfaces | ✓ | legacy | 31 KB |
| `/workers` | WorkersPage | implemented | ✓ | legacy | 28 KB |
| `/invoices` | InvoicesPage | — | ✓ | legacy | 24 KB |
| `/masters` | MastersPage | — | ✓ | legacy | 19 KB |
| `/payments` | PaymentsPage | 1.9 partial; taxonomy implemented | ✓ | **v2** | 11 KB |

Payments is the only page whose *own markup* names v2 classes (4 v2-only
against 1 legacy). **That is not the same as being v2's only consumer — see the
correction below.**

---

## Proposed order, and the principle behind it

Since neither given axis ranks anything, the ordering principle proposed is
**operational consequence first, weighted by device, with size used to sequence
within a tier rather than across tiers.**

The justification is the brief's own: *"Mobile is the constrained case, and it is
the case that matters"* — field roles reach this product on phones, and the
screens they use are the ones carrying the anti-fraud rules.

### Tier 0 — DISSOLVED

It was going to collapse three generations to two by migrating `/payments` and
deleting `v2`. **`v2` cannot be deleted, so nothing in the tier made anything
cheaper, and a tier is not worth keeping alive because it was planned.**
`/payments` returns to Tier 2.

### Tier 1 — the anti-fraud surfaces field roles use on phones

1. **`/site-operations`** (39 KB) — **the reasoning for putting this first has
   been wrong twice. Both arguments are now dead. See
   `docs/phase-e-site-operations.md` and the role-set finding below.**

   *First argument (the plan's):* the most business rules per screen, all
   needing a surface. **Dead** — it carries the most rules, but eight of ten are
   already surfaced in the UI.

   *Second argument (mine, after the analysis):* the only route where a missing
   surface costs a supervisor their work. **Dead** — a supervisor cannot open
   this route at all, and everyone who can is exempt from the window.

   *What actually survives:* **zero v2 dependence**, which makes it the cheapest
   route available to migrate and nothing more. That is a reason to find it
   easy, not a reason to find it first.

   **Ordering is on hold pending production data** on which role really records
   site work. Until then this position is unjustified rather than justified.

   **Calibration for every route analysis after this one:** the gap list's
   verdicts describe the *server*, and this screen showed 8/10 already surfaced
   in the UI too. Start the next analysis expecting rules to be present and hunt
   the specific ones that are not. And **check who the router admits before
   reasoning about who is inconvenienced** — a file header saying who a screen
   is "for" is not evidence of who can reach it.

2. **`/daily-site-updates`** (31 KB) — the same entry window and photo
   provenance, smaller. Second so the patterns from 1 are reused, not invented.
3. **`/worker-portal`** (60 KB) — the field role's home, and the §1.11 "Personal
   Banking" partial. Largest in the codebase, so it goes third, after two
   smaller screens have settled the shared components.

### Tier 2 — money, and the one genuinely unverified rule

4. **`/payments`** (11 KB) — smallest unmigrated page, drives the 796-line
   payment taxonomy.
5. **`/subcontractors`** (41 KB) — carries 1.9 "Generate Bill", the only rule the
   gap list could not verify.
6. **`/worker-money`** (51 KB)

### Tier 3 — office registers, ascending by size

7. `/masters` (19) · 8. `/invoices` (24) · 9. `/workers` (28) ·
10. `/daily-update-approvals` (31) · 11. `/reports` (34) ·
12. `/tenders/:id` (36) · 13. `/users` (42) · 14. `/tenders` (52)

### Tier 4 — last

15. **`/subcontractor-portal`** (53 KB) — external-facing but low-traffic, and
    S-01 is already fixed server-side.
16. **`/settings`** (52 KB) — the largest page with the least rule content, and
    the one whose churn risk buys the least.

---

## Decisions taken

- **Ordering accepted**, with `/payments` moved into Tier 0.
- **`v2` is deleted at the END of Phase E, not the start.** Its deletion is the
  proof the migration finished, because it is the only test that no route still
  depends on the old layer. The CSS baseline to measure it against is
  **175,364 bytes uncompressed, 31,143 gzip** (recorded 2026-08-19), and that
  number belongs to that moment rather than to today.
- **Merge per tier, not at the end.** The redesign sitting unmerged for months
  is the failure this avoids — a tier that is done should be in front of users
  before the next one starts.
- **1.9 "Generate Bill" is settled as a backend question first**, before
  `/subcontractors` comes up in Tier 2. Discovering mid-redesign that a rule
  does not exist is the wrong time to find out.


---

## CORRECTION — "v2 has one consumer" was wrong, and why the tool could not see it

The table above originally read *"`v2`: 2,100 lines, one consumer
(`/payments`)"*. **That is false.** It was measured with a classifier that
scanned `className="..."` tokens in `src/pages/*.jsx`, and v2 is not built that
way.

**`.v2-root` sits on `AppLayout`** (`frontend/src/layouts/AppLayout.jsx:233`),
so it wraps **every authenticated route**. `styles/v2/components/data.css` then
restyles the shared vocabulary through descendant selectors from it:

    .v2-root  .card  .panel  .stat-card  .badge  .badge--camera  .status--approved
              .table-wrapper  .table-wrapper--cards  .tabs  .tender-tabs
              .active-tab  .modal-card  .amount-cell  .number-cell
              .empty-table-message  table  thead  tbody  td

Those are in **32 files (`.card`), 42 (`.panel`), 25 (`.badge`), 21
(`.empty-table-message`), 19 (`.table-wrapper`), 15 (`.tabs`)**. Deleting `v2`
would have stripped the styling from every unmigrated route in production.

**Why the classifier was blind to it, and the general lesson.** A `className=`
token scan can only see a class a component *names*. v2's coupling is one root
class on the layout plus descendant selectors, so the pages it styles never
mention it. **The tool could not have found this no matter how carefully it was
run** — it was the wrong instrument, not a badly used one. The failure is the
same shape as the guard that watched `form:first` and missed an input outside
it: *a measurement that watches one container is not a measurement.*

So before quoting a scan as evidence of absence, state what the scan could not
have seen. Two consequences here:

1. **`v2` is not residue. It is the interim visual layer that makes all sixteen
   unmigrated routes presentable**, and it must survive until the last of them
   is migrated.
2. **A migrated route must reference ZERO classes that v2 restyles.** If both
   system classes and v2 descendant rules apply to a page, it is not migrated —
   it is still inheriting the old layer. This is a mechanical check and belongs
   in the acceptance bar for every route.

`styles/pages/dashboard.css` was also listed for deletion. It is 142 lines
declaring four classes, two of them live — `premium-chart-panel` and
`premium-chart-shell` — and `premium-chart-panel` is in `css_inventory.py`'s
**dynamic prefix** list, so it is assembled at runtime and no static scan
resolves it. Deleting it would have been a silent visual regression.
