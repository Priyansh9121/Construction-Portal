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

Production holds **one company, six users, and no business data at all** — zero
tenders, sites, workers, payments, and an empty `activity_logs`, which records
every mutating request. Nothing has been *done*, not merely nothing recorded.

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
    sites              0                   ->   11
    payments           0                   ->    7
    activity_logs      0                   ->   23

I established that RLS was in force **in the same session**, recorded it as a
finding, and then never applied it to counts I had already taken. Measuring the
environment was right; forgetting that the measurement itself is subject to what
it measured was not.

### What is actually true

**The office side has been used.** Ten tenders (five created, six deleted),
eleven sites, seven payments, one invoice, one subcontractor, 23 logged actions,
most recently **2026-08-13**.

**The site side has never been used.** These are genuinely zero *with* context:

    site_material_entries      0
    labour_work_entries        0
    supervisor_expenses        0
    supervisor_fund_receipts   0
    worker_assignments         0

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
| — | No worker assigned to any tender | **NEW.** `worker_assignments` is empty, so step 6 has never been performed |

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

**It also explains the census.** `worker_assignments` is empty in production —
and empty locally too, across 15 companies and 732 users. The walkthrough
recorded that as *"step 6 has never been performed."* Measured, the sharper
statement is that **step 6 cannot be performed through the UI at all.** The
office half of the product stops exactly here, which is also why the supervisor
half has never been touched: steps 9 and 10 need an assignment that nothing can
create.

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
