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

Payments is the only page touched by the middle generation — 4 v2-only classes
against 1 legacy.

---

## Proposed order, and the principle behind it

Since neither given axis ranks anything, the ordering principle proposed is
**operational consequence first, weighted by device, with size used to sequence
within a tier rather than across tiers.**

The justification is the brief's own: *"Mobile is the constrained case, and it is
the case that matters"* — field roles reach this product on phones, and the
screens they use are the ones carrying the anti-fraud rules.

### Tier 0 — make the migration cheaper for everything after it

Not merely "delete dead CSS". The point of this tier is that every route after
it is cheaper, because there are two generations to reason about instead of
three.

**0a. Migrate `/payments` to `system`** (11 KB, the smallest unmigrated page).
It is the sole consumer of the `v2` generation — 4 v2-only classes against 1
legacy — so migrating it is what makes the deletion below possible.

**0b. Delete `styles/v2/` entirely**, with its `@import` and its `@layer`
entries in `index.css`. 2,100 lines, one consumer, removed once that consumer is
gone. Anything in there that is genuinely wanted comes into `system` as a
deliberate act rather than by surviving unexamined. The classifier built for the
table is the tool that proves nothing else references it.

**0c. Delete the dead Dashboard CSS** from `styles/pages/dashboard.css`, now
that Dashboard is migrated. `css_inventory.py` independently lists
`dashboard-cards`, `stat-card`, `animated-stat-card`, `quick-actions`,
`filter-row` and `login-box` under *no consumer found*.

**Before deleting anything, verify the no-consumer list by hand.**
`css_inventory.py` names 112 such classes and warns explicitly that they must
be checked, because dynamic class construction is exactly what a static scan
cannot see. It already reports 7 dynamic prefixes. Deleting a class assembled at
runtime from a template string is a silent visual regression — the kind that
does not fail a test and does not throw.

**Measure shipped CSS bytes before and after.** That number is what proves this
tier was worth doing.

### Tier 1 — the anti-fraud surfaces field roles use on phones

1. **`/site-operations`** (39 KB) — materials, labour and banking in one screen.
   Carries §1.13's entry window, the camera-vs-gallery provenance signal and the
   per-labourer ledger. The most business rules per screen, all already enforced
   server-side and all needing a surface.
2. **`/daily-site-updates`** (31 KB) — the same entry window and photo
   provenance, smaller. Second so the patterns from 1 are reused, not invented.
3. **`/worker-portal`** (60 KB) — the field role's home, and the §1.11 "Personal
   Banking" partial. Largest in the codebase, so it goes third, after two
   smaller screens have settled the shared components.

### Tier 2 — money, and the one genuinely unverified rule

4. **`/subcontractors`** (41 KB) — carries 1.9 "Generate Bill", the only rule the
   gap list could not verify.
5. **`/worker-money`** (51 KB)

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
- **`v2` is deleted.** Not finished, not kept. Anything wanted from it re-enters
  `system` deliberately.
- **Merge per tier, not at the end.** The redesign sitting unmerged for months
  is the failure this avoids — a tier that is done should be in front of users
  before the next one starts.
- **1.9 "Generate Bill" is settled as a backend question first**, before
  `/subcontractors` comes up in Tier 2. Discovering mid-redesign that a rule
  does not exist is the wrong time to find out.
