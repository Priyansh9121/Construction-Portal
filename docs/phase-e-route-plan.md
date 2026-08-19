# Phase E — the ordered route plan  ·  **REORDERED 2026-08-19**

> **The pause is lifted, and the reason it was called was wrong twice over.**
>
> Phase E was paused because a production census read the system as never used.
> That census was taken without company context while RLS was in force, so every
> tenant-scoped table read as empty. Read as `postgres` through the SQL Editor,
> which bypasses RLS, production is:
>
>     OFFICE                          SITE
>     tenders            10           site_material_entries       0
>     sites              13           labour_work_entries         0
>     payments           13           supervisor_expenses         0
>     tender_documents   12           supervisor_fund_receipts    0
>     subcontractors      5           daily_update_approvals      0
>     workers             5           entry_access_requests       0
>     activity_logs      23           daily_site_logs             1
>     companies 1 · users 6           worker_assignments          1
>
> **The finding is a clean split.** The office half is in daily use — 23 logged
> actions to 2026-08-13, across five distinct record types. The site half has
> never received a single row, from any user, in the product's life. And four of
> five workers have no tender assignment at all.
>
> That split is the **first non-flat ordering axis this project has found**, and
> it inverts the tier order below. The ordering argument is rewritten against it
> in "The usage axis" section. **Nothing is migrated yet** — the new order is a
> proposal, held for your word.

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

## The usage axis — measured, and it inverts Tier 1

The two axes this plan was built on are flat: a11y passes 44/44 on migrated and
unmigrated routes alike, and the gap list is 32 implemented / 3 partial. Style
generation discriminates perfectly but only tells you what is *done*, not what
is *worth doing*. Usage is the axis that ranks by consequence, and it exists.

**What the office actually touches.** Ten tenders, thirteen sites, thirteen
payments, twelve tender documents, five subcontractors, five workers. Those rows
were created through `/tenders`, `/tenders/:id` (sites and documents are its
tabs), `/payments`, `/subcontractors` and `/workers`. Every one is **legacy**
generation except `/payments`, which is v2.

**What the site half has never touched.** `/site-operations` writes to six
tables through its four controllers:

    material.controller       site_material_entries        0 rows
    labour.controller         labour_work_entries          0 rows
    labour.controller         labour                       not yet counted
    banking.controller        supervisor_fund_receipts     0 rows
    banking.controller        supervisor_expenses          0 rows
    accessRequest.controller  entry_access_requests        0 rows

**Correction to the brief that prompted this:** it is five zero-row tables, not
three, and a sixth (`labour`) that has not been counted in production. The
understatement does not change the conclusion; it strengthens it.

`/daily-site-updates` and `/daily-update-approvals` are the same story:
`daily_site_logs` holds one row and `daily_update_approvals` holds none.

### The principle, restated

**Migrate where the product is used. Do not migrate what has never worked.**

The old principle was *operational consequence first, weighted by device*, which
put the supervisor surfaces at the front on the reasoning that field roles are
the constrained case. That reasoning is still true about *importance* and now
demonstrably false about *readiness*: those screens have never recorded anything,
and the role-set composition explains why a supervisor cannot even open
`/site-operations`. **A redesign cannot fix an unreachable screen, and doing it
first would hide the fact that it is unreachable behind a fresh coat.** The site
half needs a product decision and a code fix before it needs a migration.

### Tier 1 — the routes carrying real usage  *(proposed, not started)*

Sequenced small-first so the shared patterns settle on the cheapest page.

1. **`/payments`** (11 KB, **v2**) — 13 payment rows, the largest single body of
   real data after tenders. Smallest unmigrated page, drives the 796-line payment
   taxonomy, and the only page whose own markup names v2 classes. Migrating it
   does not let `v2` be deleted — see the correction below — but it removes the
   last page that names it directly.
2. **`/tenders/:id`** (36 KB) — 13 sites and 12 documents live in its tabs, so it
   carries more real rows than any other single route. It is also where the walk
   broke: its Workers tab cannot write an assignment.
3. **`/tenders`** (52 KB) — 10 tenders, and the only surface that creates a site
   at all. Largest of the three, so last, once the patterns exist.

### Tier 2 — the rest of the office, by evidence then size

4. **`/workers`** (28 KB) — 5 worker rows; the register the walk used at step 5.
5. **`/subcontractors`** (41 KB) — 5 subcontractor rows, and 1.9 "Generate Bill",
   the only rule the gap list could not verify. Settle that as a backend
   question before this comes up.
6. **`/invoices`** (24 KB) · 7. **`/users`** (42 KB) · 8. **`/worker-money`**
   (51 KB) · 9. **`/reports`** (34 KB) · 10. **`/masters`** (19 KB)

### Tier 3 — the site half, AFTER it is made usable

Not last because it matters least. Last because **migrating it now would be the
only work in this plan that cannot be validated by anyone using it.**

11. **`/site-operations`** (39 KB) · 12. **`/daily-site-updates`** (31 KB) ·
13. **`/worker-portal`** (60 KB) · 14. **`/daily-update-approvals`** (31 KB)

**Precondition on this whole tier:** the role-set composition is resolved as a
product decision, and the assignment path can write. Until then these four are
blocked on something a redesign cannot supply.

### Tier 4 — last

15. **`/subcontractor-portal`** (53 KB) — external-facing, low-traffic, S-01
    already fixed server-side.
16. **`/settings`** (52 KB) — the largest page with the least rule content.

### What happened to Tier 0 and to the old Tier 1

**Tier 0 dissolved** earlier and stays dissolved: it existed to delete `v2` after
migrating `/payments`, and `v2` cannot be deleted.

**`/site-operations` led the old Tier 1 on two arguments, both dead before this
census** and recorded here so the reasoning is not re-derived:

- *the plan's:* most business rules per screen, all needing surfaces. **Dead** —
  eight of ten are already surfaced.
- *mine, after the analysis:* the only route where a missing surface costs a
  supervisor their work. **Dead** — a supervisor cannot open the route, and
  everyone who can is exempt from the entry window.

What survived was "zero v2 dependence", which is a reason to find it cheap, not
first. The census now supplies the third and decisive argument: **the tables it
writes have never held a row.** Its position is no longer unjustified-but-held;
it is justified, and it is late.

**Calibration that still applies to every route analysis:** the gap list's
verdicts describe the *server*. Start expecting rules to be present in the UI and
hunt the specific ones that are not. And check who the router admits before
reasoning about who is inconvenienced — a file header saying who a screen is
"for" is not evidence of who can reach it.

---

## Decisions taken

- **The old ordering was accepted and is now superseded** by the usage axis
  above. The new order is **proposed and not started** — no route has been
  migrated under it.
- **`v2` is deleted at the END of Phase E, not the start.** Its deletion is the
  proof the migration finished, because it is the only test that no route still
  depends on the old layer. The CSS baseline to measure it against is
  **175,364 bytes uncompressed, 31,143 gzip** (recorded 2026-08-19), and that
  number belongs to that moment rather than to today.
- **Merge per tier, not at the end.** The redesign sitting unmerged for months
  is the failure this avoids — a tier that is done should be in front of users
  before the next one starts.
- **1.9 "Generate Bill" is settled as a backend question first**, before
  `/subcontractors` comes up in Tier 2 (it was Tier 2 under both orderings). Discovering mid-redesign that a rule
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
