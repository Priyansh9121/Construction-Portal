# Business rules — implementation gap list

Phase A step 2. Every rule in `business-rules.md` diffed against the code, with
the file that implements it. Read at `7c8bb6c`/`f21b774`, branch
`redesign/ui-foundation`.

Verdicts: **implemented** · **partial** · **absent** · **contradicted**
(the code deliberately does something else).

---

## The headline finding — the brief's premise is wrong

The master brief opens (§0):

> The notebooks contain business rules that exist **nowhere in the repository**.

**That is not the case.** Three files are explicit transcriptions of the same
notebooks, and quote them:

- `modules/payments/payment.hierarchy.js` — *"Transcribed from the 'Add
  Payment' notebook. This is the server-side source of truth: the frontend
  renders from GET /api/payments/hierarchy rather than keeping its own copy, so
  the two cannot drift."* Its header comment reproduces the whole Income/Expense
  tree, including the 6-vs-3 asymmetry.
- `modules/siteOperations/entryWindow.service.js` — quotes the site notebook
  directly: *"All of this must be added within 2 days… you have to call the
  company and take access."*
- `modules/siteOperations/material.controller.js` — quotes the photo rule:
  *"Keep an option to add the material photo from gallery OR direct camera."*

The seed data carries the notebook's Gujarati material names verbatim —
`કપચી`, `રેતી`, `સિમેન્ટ` — in `004_seed_reference_data.sql`.

**Consequence for the plan:** Phase A's premise that "nobody knows how much is
already built" was right; its premise that the rules are unrecorded was not.
Far more is implemented than the brief assumes. The payment taxonomy is done.

---

## §1.1–§1.10 Add Payment taxonomy

Implemented server-side in `modules/payments/payment.hierarchy.js` (796 lines),
which drives both validation and the rendered form.

| Rule | Verdict | Evidence |
|---|---|---|
| 1.1 Two sides; Income 6 categories, Expense 3 | **implemented** | `DIRECTIONS`, `SCOPES`, `SUB_TYPES`; asymmetry preserved |
| 1.2 Income · Personal tender → Investor | **implemented** | `INVESTOR_FIELDS` — name, FD/site, date, amount, cash/bank, interest % |
| 1.2 Interest accrues and is displayed | **implemented** | `payment.service.js` `calculateInterest`; `GET /api/payments/investor-interest`; computed live, not stored |
| 1.2 Income · Government bill (GST amount) | **implemented** | `GOVERNMENT_BILL` |
| 1.3 Income · Subcontractor | **implemented** | `SUBCONTRACTOR_TENDER` scope reuses 1.1/1.2 |
| 1.4 Income · Office | **implemented** | `OFFICE_INCOME` |
| 1.5 Income · Company charge (%, GST received/outstanding) | **implemented** | `company_charge_percent`, `bill_amount * pct / 100`, `gst_received`, `gst_total - gst_received` |
| 1.6 Income · TDS | **implemented** | `TDS` |
| 1.7 Income · GST Return | **implemented** | `GST_RETURN` |
| 1.8 Expense · Personal tender → Supervisor / Site A–E / Investor | **implemented** | `SUPERVISOR`, `MATERIAL`, `SALARY`, `LABOUR`, `GST`, `OTHER` |
| 1.9 Expense · Subcontract → Investor / Government bill → generate bill | **partial** | Scope and sub-types present; **"Generate Bill" DOES NOT EXIST** — verified 2026-08-19, see below |
| 1.10 Expense · Office (Salary, PF, Tax, Other) | **implemented** | `SALARY`, `PF`, `TAX`, `OTHER` |

---

### 1.9 "Generate Bill" — verified absent 2026-08-19

The gap list previously said "not verified". It is now verified, and the answer
is that **there is no bill generation anywhere**.

`modules/payments/payment.hierarchy.js:628` declares

    // "Pay into subcontract company - Generate Bill"
    generatesBill: true,

and a repository-wide search for `generatesBill` across backend and frontend
returns **that one line and nothing else**. No handler reads it, no route acts
on it, no component renders differently because of it. It is a data flag with no
behaviour behind it.

**Recorded so the next reader does not assume behaviour exists behind the flag.**
Its presence in the hierarchy makes the taxonomy correct — the notebook's
Expense → Subcontract → Government Bill branch really does say "Generate Bill" —
but the taxonomy is a description, not an implementation.

Nor is there anything for a generated bill to attach to. `public.invoices`
(`002_baseline_supabase.sql:626`) is scoped by `tender_id` and carries no
`payment_id` and no `subcontractor_id`, so linking a bill to the payment that
generated it needs a schema change.

**Left undecided by decision.** What "generate a bill" should mean — a PDF
(`jspdf` is already a frontend dependency), an `invoices` row (needs a link
column, so a migration), or a counterpart income entry — is a product decision,
and it will be made with the `/subcontractors` route in front of us rather than
in the abstract.

---

## §1.11 Worker Portal — structure

| Rule | Verdict | Evidence |
|---|---|---|
| **Tender-scoped login: ID + password per tender** | **CONTRADICTED** | See below |
| Two branches: Tender list, Personal Banking | **partial** | `GET /assignments` (tender list), `GET /money`; a distinct "Personal Banking" branch is not modelled as such |
| Within a tender: Documents | **implemented** | `GET /api/worker-portal/tenders/:id/documents` |
| Within a tender: Material data | **implemented** | `siteOperations/material.controller.js` |
| Within a tender: Banking | **implemented** | `siteOperations/banking.controller.js` |
| Within a tender: Labour work | **implemented** | `siteOperations/labour.controller.js` |

### The contradiction — RESOLVED 2026-08-17 in favour of the code

The notebook says a worker logs in **per tender**, with an ID and password for
each. The code does something else entirely:

- `workerPortal.routes.js`: *"Mounted by server.js behind authMiddleware and a
  role gate… the role gate proves the caller is a worker, not WHICH worker."*
- Authentication is the ordinary application login (`users` table, email/role).
- Tender access comes from **`worker_assignments`** rows.
- The portal then requires a linked `workers` profile — its own error text is
  *"No worker profile is linked to this login user."*

Searched for any per-tender credential concept across `modules/` and
`database/`: **nothing**. No `tender_credential`, no `portal_password`, no
per-tender login column, and no such table in `002_baseline_supabase.sql`.

This is one login plus assignment rows — a different architecture, not a
partial implementation. **The user has confirmed the code is correct and
per-tender credentials will not be built**; access is a property of the
assignment, not of the identity. Verdict above therefore reads *contradicted*
in the sense of *supersedes the notebook*, not *defective*. Full reasoning in
`business-rules.md` §1.11.

---

## §1.12–§1.15 Worker Portal — the four areas

| Rule | Verdict | Evidence |
|---|---|---|
| 1.12 Materials grouped into sections | **implemented** | `main_section` column; controller groups server-side *"so the UI can render the notebook's 'Main Section' structure"* |
| 1.12 Item taxonomy (colour, sand, cement, aggregate/કપચી, firestone, tiles, iron, bricks, block, soil, other) | **implemented** | `004_seed_reference_data.sql` with `name_local` Gujarati, unit, default GST |
| 1.12 Daily quantities added with the bill | **implemented** | `material.controller.js` |
| 1.12 Photo upload | **implemented** | `material.controller.js` |
| **1.13 Entry window: 2 days** | **implemented** | `entryWindow.service.js`, `SUPERVISOR_EDIT_WINDOW_DAYS` |
| **1.13 One extra grace day** | **implemented** | `SUPERVISOR_BANKING_GRACE_DAYS`, **banking only** |
| 1.13 Older entries need company-granted access | **implemented** | `findUsableGrant`, `consumeGrant`; scoped per user + module + **exact date**, single-use, expiry-aware |
| 1.13 Future dates | **implemented** | Explicit `FUTURE_DATE` refusal |
| 1.13 Photo: gallery or direct camera | **implemented** | `PHOTO_SOURCES = ["camera","gallery"]` |
| 1.13 Company must see which was used | **implemented** | Source recorded; `LIVE_CAPTURE_TOLERANCE_MS` corroborates a camera claim against capture time — treated as signal, not proof, exactly as the brief requires |
| 1.14 Banking: bank / cash / GST cash | **implemented** | `["bank","cash","gst_cash"]`; validation message names all three |
| 1.14 Supervisor records daily expenditure and wages | **implemented** | `banking.controller.js` |
| 1.15 Supervisor adds labourers | **implemented** | `labour` master per supervisor |
| 1.15 Per-labourer account, daily payments | **implemented** | `GET /labour/:id/ledger`, running paid/outstanding balance |
| 1.15 Grouped by trade | **implemented** | `category` + `category_local` (Gujarati) |
| 1.15 Outstanding dues visible | **implemented** | Ledger carries outstanding |

---

## [verify] items — all three resolved 2026-08-17

**1.2 Investor interest: daily or monthly?** → **Daily.**
`payment.service.js`: *"Whole days only. Interest starts accruing the day AFTER
the money…"*, returning `{ interest_amount, days_accrued, daily_interest }`.
**Confirmed by the user as intent**, and the notebook supports it: *રોજનું* on the Investor page means daily. No change needed.

**1.13 Does the grace day extend the window to 3?** → **Yes, for banking only.**
`checkEntryWindow` uses `EDIT_WINDOW + BANKING_GRACE` for
`MODULES.BANKING` and `EDIT_WINDOW` alone for material, labour, expense and
daily update. **Confirmed by the user as intent** — the grace day is written on the banking page specifically. No change needed.

**1.11 One credential per tender, or one granting several?** → **moot.**
Resolved in favour of the implementation: one identity, many
`worker_assignments`. Per-tender credentials will not be built; if
per-tender enrolment is needed later it will be enrolment codes that link
a worker to a tender on first use. Recorded in `business-rules.md` §1.11.

---

## Defects and gaps found while diffing

> **Corrected 2026-08-17.** Two of the four were **wrong**. I took them from
> `entryWindow.service.js`'s own docstring, which described a migration (F-13)
> as still pending when the code had already completed it. Reading the callers
> rather than the comment shows both are fixed. Recorded here rather than
> quietly deleted, because the lesson is the repository's own: *do not reason
> from an unverified premise* — a stale comment is exactly that.

1. ~~`daily_update` bypasses the grant mechanism.~~ **WRONG.**
   `siteLog.controller.js` imports `checkEntryWindow`, `consumeGrant`, `MODULES`
   and calls `checkEntryWindow({ module: MODULES.DAILY_UPDATE })`. Daily updates
   do participate, and grants are module-scoped. The stale docstring has been
   corrected in place.
2. ~~Inconsistent backdating exemption, admin-only in `siteLog`.~~ **WRONG.**
   That file's own comment says the divergent `role !== "admin"` check
   *"diverged from the canonical rule"* — past tense. F-13 removed it; every
   dated module now reads one exemption set. Docstring corrected.
3. **Multi-timezone resolution — FIXED 2026-08-17.** `checkEntryWindow` resolved
   "today" against `DEFAULT_TIMEZONE` rather than `companies.timezone`, so a
   deployment serving companies in more than one region judged every
   supervisor's current day against somebody else's calendar.
   `companyTimezone()` now reads the company's own column, and
   `accessRequest.controller.js` — which had the same defect at its
   `daysAgo(target_date)` call — uses it too. Falls back to `DEFAULT_TIMEZONE`
   when the row or column is missing, so a lookup failure can never be the
   reason an entry is refused. **It cannot widen the window**: it only makes
   "today" the site's own day, which is what the rule always meant. For a
   single-region deployment nothing observable changes. 254 backend tests pass.
4. **Labour has no approve/reject workflow**, unlike materials and banking,
   which the office signs off. Bounded only by the entry window. The notebook
   does not specify. **Left recorded as a policy question by decision** — who
   may amend site history is not a bug fix.

---

## BUG-002 — CONFIRMED and FIXED 2026-08-17

> The hypothesis below was recorded before the database was diffed. It was
> **correct**, and the diagnosis is now closed with the picker's query read end
> to end. Full trace and implementation in
> `docs/phase3-login-continuation.md`.

`GET /workers` — the tender picker's source — is
`SELECT t.* FROM workers t WHERE t.company_id = $1`. One table, **no join to
`users`**. A worker created through User Management was a `users` row with no
`workers` row, so the picker could not return them: not filtered out, absent
from the table being read.

The cause was not that one path forgot a step. `workers.user_id` and
`subcontractors.user_id` had always existed and had always been writable, and
**nothing in the product ever set either** — the only writer in the repository
was a local dev fixture script. The linking operation had never been built.

**Fixed** by `modules/auth/profileLink.service.js`: creating a `worker`- or
`subcontractor`-role login now resolves a register record — link an existing
one, or create a minimal new one — inside `createCompanyUser`'s existing
transaction, so a login with no record cannot be created. The direction stays
asymmetric: a payroll-only worker with no login remains valid, which is the
normal case.

### The original hypothesis, kept for the record

The portal's own failure message is *"No worker profile is linked to this login
user. Ask admin to link this user to a worker record."* With authentication
being the ordinary app login and tender access coming from
`worker_assignments`, the likely gap is that User Management writes a `users`
row without the linked `workers` row and/or the `worker_assignments` row.

---

## SECURITY — S-01: cross-tenant record exposure in the subcontractor portal

**Found while fixing BUG-002. Latent, never triggered in this database, closed
by migration 007 on 2026-08-17.** Recorded here rather than only in the working
notes because it is a data-isolation defect, and this is the file an audit
reads.

**Severity: high if reached.** One subcontractor could have been served another
subcontractor's tenders, documents, invoices and bank details, with nothing in
the logs to distinguish it from normal use.

### The defect

Both portals resolve the caller's own record by their login id:

```sql
SELECT ... FROM subcontractors s ... WHERE s.user_id = $1 LIMIT 1
```

`LIMIT 1` with no uniqueness guarantee. The two registers were **not** equally
protected:

| table | constraint on `user_id` |
|---|---|
| `workers` | `ux_workers_user_id` — UNIQUE, partial: `WHERE user_id IS NOT NULL AND is_deleted = false` |
| `subcontractors` | a foreign key to `users(id)`, and **nothing else** |

So two `subcontractors` rows could carry the same `user_id`. The portal would
not error — it would silently serve whichever row the planner returned first,
and that choice is not stable across plans or data changes. Every downstream
read in `subcontractorPortal.controller.js` scopes to that resolved record, so
one wrong resolution mis-scopes the whole session.

The identical `LIMIT 1` in `workerPortal.controller.js`
(`getWorkerByLoggedInUser`) is **harmless**, because the unique index makes a
second row impossible. Same code shape, opposite safety — which is precisely
why it went unnoticed.

### Why it never fired, and why that stopped being reassuring

Nothing in the product ever wrote `subcontractors.user_id`. The only writer was
`backend/scripts/createLocalPortalFixtures.js`, a local dev script that creates
one linked row deliberately. **A monopoly held by one careful script is not a
constraint.** BUG-002's fix turns linking into an operation admins perform, so
the accident that had been protecting this was about to be removed.

Measured before and after: **zero duplicate `user_id` values** on
`subcontractors` in the development database. This was never exploited here.
A production database was not checked and may differ — which is what the
migration's pre-check is for.

### The fix

`007_subcontractor_user_link_unique.sql` adds `ux_subcontractors_user_id`,
deliberately identical in shape to the workers index. It **refuses to run** if
the data already violates it, raising an exception that names every offending
login and the subcontractor ids sharing it, rather than letting `CREATE UNIQUE
INDEX` fail with a message an operator cannot act on. Re-runnable; verified by
temporarily inserting a duplicate inside a rolled-back transaction.

Two further layers were added in application code: `SELECT … FOR UPDATE` when
resolving a link, and a `rowCount === 1` assertion on the linking `UPDATE`. The
index is the one that still holds when a future caller forgets both.

### What this does not fix

The `LIMIT 1` reads themselves are unchanged. They are now correct on both
sides because both tables are constrained, but neither would report a violation
if one ever arose — they would still silently pick a row. **Any new
profile-style table linked by `user_id` must ship with the partial unique index
in the same migration**, or it reintroduces this exact defect.

---

## What this means for the roadmap

- **Phase A is essentially complete as a discovery exercise**, and its finding
  is that the backend is far further along than assumed. The payment taxonomy,
  the entry window, photo provenance, banking modes and the labour ledger are
  all built.
- **The real gap is not backend business logic. It is the worker-portal login
  architecture**, which contradicts the notebook, and the frontend surfaces for
  rules the backend already enforces.
- Phase E should be ordered against this list. Several routes may need far less
  work than their file size suggests, because the server already carries the
  rule.

---

## RLS — DETERMINED 2026-08-19. The policies are in force.

Recorded properly because this was flagged as undeterminable from the repository
**three separate times**, in three different sessions, each correctly noting that
nothing in the code could answer it:

> *"Whether the deployed API actually connects as `construction_app` and is
> therefore subject to RLS… `tenantScopingEnabled` is decided at runtime by
> reading `rls_enforced` and defaults to false; the migration's own closing notes
> say 'Until you do, RLS has NO effect because postgres bypasses it'. Nothing in
> the repository establishes which role production uses."*

It was never a code question. It was a question about the deployed environment,
and a single connection answered it:

    CONNECTED  db=postgres  user=construction_app
               PostgreSQL 17.6 on aarch64-unknown-linux-gnu

**Production connects as `construction_app`, not `postgres`.** `construction_app`
is a constrained role and does not bypass row-level security, so the policies in
`003_supabase_rls.sql` **are in force in production**, and tenant isolation does
not rest on the `WHERE` clauses alone.

That closes the caveat attached to S-01 and to every tenant-isolation note that
depended on it.

**The lesson worth keeping:** three sessions reasoned carefully about this and
each concluded, correctly, that the repository could not answer it — and none
tried the environment. *"No record of it in the code"* is not the same as
*"unknowable"*. When a question is about the deployment rather than the code,
the deployment is the artifact to measure.
