# The first real tender — a walkthrough plan

**Nothing is built here.** This is the shortest path to getting one real tender
through the system end to end, the role each step needs, and **every point where
it is expected to break**, predicted from what has already been measured rather
than from reading each screen afresh.

Written because Phase E is paused: production has never been used, so there is no
usage signal to order twenty-two route migrations by. This walkthrough is what
produces that signal.

---

## Why this, and why now

~~Production holds one company, six users, and no business data at all.~~
**Retracted — see the census below.** Production holds one company, six users,
and a **used office half**: 10 tenders, 13 sites, 13 payments, 12 tender
documents, 5 subcontractors, 5 workers, 23 logged actions to 2026-08-13. What is
genuinely untouched is the **site half**, where every table holds zero rows.

Every path below has therefore only ever been exercised by **fixtures**, and this
repository already knows what that hides: `createMember` manufactured the exact
broken state BUG-002 described while 254 tests passed. A fixture proves the code
runs. It does not prove the code is reachable by a real user holding a real role.

**The walkthrough's value is the breaks, not the completion.**

---

## CORRECTION — my census was wrong, and RLS is why

**Retracted 2026-08-19, before the walk.** Every "0 rows" below came from a
connection with **no company context set**. Production connects as
`construction_app`, RLS is in force, and `current_company_id()` returns `null`
without `SET app.company_id` — so **every tenant-scoped table read as empty.**

    material_catalog   0 without context   ->   24 with company 1
    tenders            0                   ->   10
    sites              0                   ->   13
    payments           0                   ->   13
    tender_documents   0                   ->   12
    activity_logs      0                   ->   23

I established that RLS was in force **in the same session**, recorded it as a
finding, and then never applied it to counts I had already taken. Measuring the
environment was right; forgetting that the measurement itself is subject to what
it measured was not.

### What is actually true

**The office side has been used.** Ten tenders, thirteen sites, thirteen
payments, twelve tender documents, five subcontractors, five workers, 23 logged
actions, most recently **2026-08-13**.

**The site side has never been used.** Authoritative counts, taken as `postgres`
through the SQL Editor, which bypasses RLS rather than depending on context:

    site_material_entries      0
    labour_work_entries        0
    supervisor_expenses        0
    supervisor_fund_receipts   0
    daily_update_approvals     0
    entry_access_requests      0
    daily_site_logs            1
    worker_assignments         1   (against 5 workers)

**Second correction, 2026-08-19 (mine).** The figures above supersede an earlier
set on this page that read *eleven sites, seven payments, worker_assignments 0*.
Two of those were low and one was wrong in a way that mattered — see the
correction inside WALK RESULT.

The table name **`material_entries` does not exist**; the real table is
`site_material_entries`. Four such names were carried in backend file headers
(`material_entries`, `labour_entries`, `supervisor_banking`, `banking_expenses`)
and have been corrected against what the controllers actually query.

So the useful finding is sharper than the wrong one: **the office half of the
product is in use and the supervisor half has never been touched.** That is a
real usage signal, and it is the first non-flat ordering axis this project has
found.

### Blocker status after the correction

| # | Claim | Status |
|---|---|---|
| 1 | Migration 004 never applied | **RETRACTED.** It is applied — 24 materials, 13 labour categories. Confirmed independently |
| 2 | Worker logins unlinked | **STANDS, narrowed.** `workers` holds one row, *Priyansh*, with `user_id NULL`. Three `worker` users exist and none resolves a register row |
| 3 | Users without company membership | **STANDS.** 1 of 3 workers has a membership; the subcontractor has none. Not an RLS artefact — identical with and without context |
| 4 | Zero `manager` users | **STANDS.** 3 worker, 2 admin, 1 subcontractor |
| — | No worker assigned to any tender | **CORRECTED.** `worker_assignments` holds **1** row against **5** workers. Four of five workers have no assignment, and the one that exists cannot have come from the UI — see WALK RESULT |

## The path

Roles: **A** = admin, **W** = worker (supervisor). Route names as registered.

| # | Step | Route | Role | What must work | Expected to break? |
|---|---|---|---|---|---|
| 1 | Sign in | `/login` | A | Users 1 and 8 are admin, active, with membership | **No.** The one path production has exercised |
| 2 | Company exists | — | — | 1 row already | No |
| 3 | Create a tender | `/tenders` | A | `POST /tenders`; `tenders` is empty | Unknown — **never executed in production** |
| 4 | Create a site under it | **`/tenders/:id` → Sites tab** | A | `POST /sites` via `siteService.js:33` | ⚠️ **`/sites` and `/sites/:id` are redirects, not screens** (`route_inventory.py`). Site creation lives inside `TenderSitesTab`. Anyone looking for a Sites screen will not find one |
| 5 | Create a worker | `/workers` | A | Workforce create — five fields, no login | No. Recently exercised |
| 5b | Give that worker a login | `/workers` → Invite login | A | `POST /api/auth/users` with `profile:{mode:"link"}` | No — built and tested this session. **This is what avoids Blocker 2 for the new worker** |
| 6 | Assign the worker to the tender | **`/tenders/:id` → Workers tab** | A | writes `worker_assignments` | ⚠️ Table is `worker_assignments`. **`tender_workers` does not exist in production** despite being in `002_baseline_supabase.sql` — verify which the code writes |
| 7 | Seed the material catalog | — | — | `material_catalog` must be non-empty | 🛑 **BLOCKER 1.** Cannot proceed without it |
| 8 | Worker signs in | `/login` → `/worker-portal` | W | membership + linked register row + `status='active'` | 🛑 **BLOCKER 2/3** for existing users; fine for the worker created at 5b |
| 9 | Record a week of material | `/worker-portal` | W | material entries against the assignment | ⚠️ Depends entirely on step 7. Also **the first real test of the §1.13 entry window**, since a `worker` is *not* in `WINDOW_EXEMPT_ROLES` |
| 10 | Record a week of labour | `/worker-portal` | W | labour entries; trade grouping needs `labour_categories` | ⚠️ Categories empty — Blocker 1 again |
| 11 | Office reviews and approves | `/site-operations` | A | approve/reject via `DecideCell` | ⚠️ **The role-set composition.** Admin can reach it and approve — but is window-exempt, so the anti-fraud control never fires for the reviewer. Also `admin_comment` is always empty (caller passes two args) |
| 12 | Record a payment | `/payments` | A | the payment taxonomy | Unknown — never executed. Note **1.9 "Generate Bill" does not exist** if the subcontract branch is used |
| 13 | See it on the Dashboard | `/dashboard` | A | aggregates over real rows | ⚠️ **Every figure has only ever seen zero or fixture data.** Empty-state versus real-data rendering is untested |

---

## What the walk will tell us that nothing else can

1. **Which routes are actually on the critical path.** Thirteen steps touch
   roughly eight routes. The other fourteen route components are not needed to
   get a tender through the system, which is the ordering signal Phase E lacked.
2. **Whether the §1.13 entry window works for the role it is meant to bind.**
   Step 9 is the first time a non-exempt user will ever have hit it in
   production.
3. **Where fixtures have been lying.** Every step marked *never executed* is a
   path whose only evidence is a test that built its own state.

## What I am NOT proposing

- No code. No migration. No production write. Blocker 1 is a data change to
  production and is yours.
- No decision on the `/site-operations` gate, which remains a product question.
- No Phase E reordering until the walk produces a usage signal.

---

# WALK RESULT — steps 1–5b pass, step 6 is a genuine break (2026-08-19)

Walked in a real browser against the **local** stack, not production. Chromium
via Playwright driving the actual screens; every claim below is a screenshot, an
HTTP status or a row count, not a reading of the code. Where I read code it was
*after* the measurement, to explain it.

**Environment.** Both servers were already up and were killed and restarted, so
nothing here is trap 1. API with the three limiters raised — verified on the
wire, `RateLimit-Policy: 100000;w=900` on `/api/health` and `1000;w=900` on
`/api/auth/login`. Local DB connects as `postgres`, which the boot log correctly
reports as bypassing RLS, so local counts need no `SET app.company_id`; that
caution applies to production and production was not touched.

## What happened, step by step

| # | Step | Result |
|---|---|---|
| 1 | Sign in `/login` | ✅ `200 POST /api/auth/login`, lands on `/dashboard` |
| 2 | Company exists | ✅ company 1 |
| 3 | Create a tender | ✅ **merged with step 4** — see below. `201 POST /api/tenders`, tender **1707** |
| 4 | Create a site under it | ✅ same request. Site **1809**, no `POST /api/sites` was issued |
| 5 | Create a worker | ✅ `201 POST /api/workers`, worker **1242** "Kirit Patel" |
| 5b | Give that worker a login | ✅ `201 POST /api/auth/users`. User **5012**, `role=worker`, `status=active`, `company_users` row present, `workers.user_id=5012` |
| 6 | Assign the worker to the tender | 🛑 **BREAK.** `400 POST /api/tenders/1707/workers` — `"Tender site is required."` |

The walk stopped there, unworked-around.

## Step 6 — the break

**The screen cannot satisfy the endpoint it calls.** The Workers tab renders
exactly three controls — worker, notes, status — and no site control of any
kind. `validateTenderWorker` requires `site_id`. So every submission from this
screen is refused, for every tender, regardless of how many sites it has. The
toast shows the backend's message verbatim: *Tender site is required.* — naming
a field the form does not contain.

Measured, then traced:

    frontend/src/pages/TenderDetailsPage.jsx:923   posts { tender_id, worker_id, notes, status }
    frontend/src/pages/TenderDetailsPage.jsx:111   EMPTY_WORKER_FORM has no site_id
    backend/modules/tenders/tenderValidation.js:1604  site_id -> normaliseRequiredPositiveId(..., "Tender site")

There is exactly one caller of `assignWorkerToTender` and the string `site_id`
does not appear anywhere in `pages/TenderDetailsPage.jsx` or
`components/tenderDetails/`. This is not a defaulting bug that a single-site
tender could dodge; the field is absent from the payload's shape.

**The vestige.** `TenderDetailsPage.jsx:1734` passes `sites={tenderSites}` to
`TenderWorkersTab`, and that component's parameter list (line 26) does not
destructure `sites`. The prop is supplied and dropped. The site selector was
intended and is missing.

**Why 254 green tests did not catch it.** `backend/tests/portals.test.js:101`
assigns a worker by sending `site_id: siteId` itself. The endpoint is proven to
work and the screen is proven unusable by the same suite. This is the ninth
instance, and the cleanest one yet: the fixture supplied the field the UI cannot.

**It also explains the census — with one correction to my own claim.** I wrote
that `worker_assignments` is empty in production. **It is not: it holds one row,
against five workers.** Empty locally, across 15 companies and 732 users, but not
empty in production. The measured statement that survives is narrower and still
decisive: **step 6 cannot be performed through this screen.**

The one production row therefore did not come from this screen, and the history
says it never could have. `worker_assignments` has exactly one writer in the
codebase (`tenderQueries.js:2722`, reached only from `assignWorker`), and both
that writer and the `site_id` requirement arrived in the **same commit**,
`50aab56` on 2026-08-01 — before it, no backend code inserted into the table at
all. The form has never carried `site_id` in any revision reachable from
`git log -S`. So there has been no window in which this screen could write an
assignment.

**Provenance of that row is unexplained and worth one query**, because it decides
whether someone has a working path the UI does not expose:

    SET LOCAL app.company_id = '1';
    SELECT id, worker_id, site_id, assigned_by, assigned_at, created_at
      FROM worker_assignments;
    SELECT * FROM activity_logs WHERE entity_type ILIKE '%assign%';

If `activity_logs` has no matching entry, it was not written through the API.

Four of five workers having no assignment is the same finding seen from the
other end. Steps 9 and 10 need an assignment, and only one worker in production
has one.

Corollary, settled in passing: `tender_workers` does not exist in the local
database either — `to_regclass` returns null. The code writes
`worker_assignments`. That half of the step-6 question needs no further work.

## Corrections to this plan, from walking it

**Steps 3 and 4 are one step.** `/tenders` carries a full Create Tender form
with a "Tender Sites" block and an "Add Another Site" button, and the site name
is `required` — native validation refuses the submit with *Please fill out this
field.* A tender **cannot** be created without at least one site. So the
prediction that step 4 is where someone hunts for a missing Sites screen did not
happen: the site is created before the tender exists, in the same request. The
observation that `/sites` and `/sites/:id` are redirects stands, and did not
bite.

**Step 7 is not a blocker locally.** Company 1 holds **24 materials and 13
labour categories** — the same numbers migration 004 produces in production.
Consistent with Blocker 1 already being retracted.

**Step 5b works exactly as designed.** The row action is on the Workforce
register, the dialog states plainly that no email is sent, and the three rows it
must write were all written. Blocker 2 was avoided rather than hit, as predicted.

## Friction noticed on the way, none of it blocking

1. **Dashboard copy disagrees with itself.** The headline reads *"5 things need
   you today."*, four items are listed, and the link below says *"1 more item
   need attention"* — a missing "s", and a headline that counts an item the list
   hides.
2. **The Workforce register cannot show who has a login.** There is no email or
   account column; the only tell is whether a row offers "Invite login". On 57
   rows that is a scan, not an answer.
3. **The assignment form has no site, and reads as if it needs none.** Its own
   copy says *"Allocate workers to this tender"*, which is consistent with the
   form and inconsistent with the API. Whoever writes the fix has to decide which
   of the two is right — this is a product question, not only a missing input.
4. **`/tenders` and `/tenders/:id` are visibly pre-redesign** — blue and red
   buttons, boxed cards — against a Dashboard that is not. Two generations sit
   one click apart on the critical path.
5. Local `workers` is 57 rows of e2e churn (`… Invite Me`, `Orphan`, `Payroll
   Only`). Not a product finding, but it makes the worker picker on the
   assignment form nearly unreadable, and it is worth a cleanup.

## What was NOT done

No fix, no workaround, no code change. Steps 7–13 are unwalked: 8 and 11–13 were
reachable but 9 and 10 sit behind the assignment, and walking the office end
first would have reported a completion the product cannot actually deliver.
Production was not read or written.

---

# WALK RESULT 2 — the site half is not broken, it is walled off (2026-08-19)

The adjusted walk: not creating a first tender, but following what production
already has and finding where the site half fails to start. Walked as the local
supervisor fixture at **390 × 844**, a phone, because that is the condition the
role actually works in. Local company 1 mirrors production — office data present,
site half empty.

**The answer is the gate, and it is measured end to end.**

    backend      POST /site-operations/materials has NO role guard   any authenticated
    API, as a worker   GET /materials/catalog · /materials · /labour  200 · 200 · 200
    frontend router    /site-operations, /daily-site-updates          redirect to /worker-portal
    worker portal      five tabs, zero material or labour surface
    admin             records material successfully                   201

The server was built for the product as described: **supervisors record, the
office approves.** Only `/materials/:id/approve` and `/reject` carry
`requireOffice`. The recording endpoints are open to any authenticated user, and
the API serves a `worker` 200 on every site-operations read.

The **frontend route is the entire obstruction.** `AppRoutes.jsx:631` wraps
`/site-operations` in `AdminManagerLayout`, so the one role the API was designed
for is bounced. Measured, not inferred: signed in as a worker, `/site-operations`
and `/daily-site-updates` both land on `/worker-portal` **silently** — no error,
no explanation, no trace that a screen was refused.

And there is nowhere else to go. The worker portal's five tabs — Home, My
Projects, Daily Updates, My Money, My Profile — contain **no material entry and
no labour entry surface at all**. A text search of the whole portal for
*material*, *labour*, *quantity* and *cement* returns nothing. `SiteOperationsPage`
is the only consumer of `siteOperationsService` in the codebase.

So the site half's zero rows are not a defect in the recording path. **The only
people who can record are office admins who are not on site, and production has
two of them and zero managers.** The supervisors who are on site have no surface
anywhere. That is why nothing has ever been recorded.

**This corrects the walkthrough's own step 9 and 10.** They place material and
labour recording at `/worker-portal`. It is not there and never has been.

## The second defect — recorded entries name no site

Signed in as admin, `/site-operations` opens and recording works:
`201 POST /api/site-operations/materials`, 50 bags of Cement (OPC 53) at ₹380,
₹24,320.00 with 28% GST, arithmetic correct. The row it wrote:

    id 371 · company_id 1 · tender_id NULL · site_id NULL · approval_status pending

The form has nine controls — material, date, quantity, rate, bill number,
supplier, vehicle number and two file inputs — and **not one of them is a site.**
The screen's own header reads *"Record material, labour and banking for the
site."* The definite article, with no site named anywhere and no way to name one.
The pre-existing local row from 2026-08-02 has `site_id` NULL too, so this is not
new.

**This is the same defect shape as the step-6 break, with the safer half
missing.** Both forms omit a site the schema and the copy expect. `POST
/tenders/:id/workers` refuses and says so; `POST /site-operations/materials`
accepts and writes NULL. The refusal is the better failure — it cannot
accumulate. Every cost recorded on this screen lands in an unallocated
company-wide pool, unattributable to a tender, on a product whose entire value
is per-tender costing.

## Friction, none of it blocking

1. **The refusal is silent.** A supervisor who bookmarks `/site-operations`, or
   follows a link to it, is moved to `/worker-portal` with no message. Nothing
   distinguishes "you may not open this" from "that page does not exist".
2. **The recorder can approve their own entry, one row away.** The entry landed
   in "Recent entries" with **Approve** and **Reject** beside it, clickable by
   the admin who had just created it. The role-set composition, made concrete on
   screen: same person, same screen, both halves of the control.
3. **Material optgroups render raw machine codes** — `aggregate`, `binder`,
   `road`, `steel`, `masonry`, `finish`, `service`, `other`. Confirmed in the
   real UI, as predicted. The options themselves are good: English with the
   Gujarati name beside it, which is the right call for the audience.
4. **Every supervisor reads as "Pending" forever.** My Profile renders
   `getStatusClass(worker?.status)`, and `GET /worker-portal/me` returns
   `worker_status`, not `status`. The value is `undefined`,
   `normaliseStatus` (line 208) defaults to `"pending"`, and the screen shows
   **Status: Pending** for a worker the database and the API both call `active`.
   A wrong figure on real data, on the only screen this role has.
5. **The empty state is good, and worth keeping.** *"You have not been assigned
   to a site yet. Your supervisor will assign one — nothing is needed from you
   right now."* It is calm, it explains, and it tells the reader they are not at
   fault. That is the tone the rest of these screens should be held to — and it
   is describing a wait that, per WALK RESULT 1, would never end.
6. **The phone layout holds up.** No horizontal overflow, controls tappable, the
   module switcher (Material · Labour · Banking · Access Requests) reads clearly
   at 390 px. The screen a supervisor cannot open is the one best suited to their
   device.

## Where this stops

Stopped at the gate, which is a product decision and not mine to change.
Everything downstream of it — the entry window that §1.13 exists for, the
approve/reject flow, the access-request path — is unreachable for the role it
was written for and cannot be walked until the gate is answered.

---

# CENSUS CORRECTION — a large share of production is invisible to the app (2026-08-19)

Run to settle the `worker_assignments` provenance question. It answered that
and found something bigger.

**Method.** Connected as `construction_app`, which is what the API connects as,
with RLS in force and `SET LOCAL app.company_id = '1'` **inside a transaction**.
The first attempt used `SET LOCAL` outside one, where it applies to its own
implicit transaction and is gone by the next statement — which would have
reported zeros again, the same way the original census did. Verified before
trusting anything: `current_setting('app.company_id')` = 1 and
`current_company_id()` = 1.

## What the application can actually see

| table | SQL Editor (`postgres`, RLS bypassed) | visible to the app (company 1) | unreachable |
|---|---|---|---|
| tenders | 10 | 10 | 0 |
| activity_logs | 23 | 23 | 0 |
| sites | 13 | 11 | **2** |
| payments | 13 | 7 | **6** |
| subcontractors | 5 | 1 | **4** |
| workers | 5 | 1 | **4** |
| tender_documents | 12 | 0 | **12** |
| worker_assignments | 1 | 0 | **1** |
| daily_site_logs | 1 | 0 | **1** |

**Every tender document in production is unreachable by the product that wrote
it.** So are six of thirteen payments, four of five workers, four of five
subcontractors. `companies` holds exactly one row, id 1, so these rows carry a
`company_id` that is null or points at a company that does not exist. RLS then
hides them from every application query — permanently and silently.

I cannot read their `company_id` as `construction_app`; that needs the SQL
Editor:

    SELECT company_id, count(*) FROM tender_documents GROUP BY 1;
    SELECT company_id, count(*) FROM payments GROUP BY 1;
    SELECT id, company_id, worker_id, site_id, assigned_by FROM worker_assignments;

**This changes what the earlier census meant.** "The office half is in daily
use" stands — 10 tenders and 23 logged actions are real and visible. But the
higher SQL Editor figures include a population of orphans, and the difference
is not small.

## The provenance question, answered

**The `worker_assignments` row is an orphan, not a hidden working path.**

- It is invisible under the only company that exists.
- `activity_logs` — which records every mutating request — contains **no
  assignment action at all**. Its 23 rows are: payments create ×7, tenders
  delete ×6, tenders create ×5, users create ×2, users update ×1,
  worker_allocations create ×1, worker_expenses create ×1.

No log entry and no valid tenant means it did not come through the API. That
matches the code: `worker_assignments` has one writer, and it and the `site_id`
requirement arrived in the same commit. **Nobody has a working path the UI does
not expose.** It is a manual or imported row, and it belongs with the other
orphans rather than with the assignment question.

## One more correction to "the site half has never received a row"

`worker_expenses` holds **1** and `worker_allocations` holds **1**, both created
**2026-08-05, thirteen seconds apart**, both with activity-log entries — so both
went through the API. The worker-money path has had exactly one round trip.

The site-operations tables are still genuinely zero: `site_material_entries`,
`labour`, `labour_work_entries`, `supervisor_expenses`,
`supervisor_fund_receipts`, `entry_access_requests`, `daily_update_approvals`.
