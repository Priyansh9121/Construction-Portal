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

## Predicted blockers, before the walk starts

These are measured, not guessed. Two of them stop the walk outright.

### BLOCKER 1 — migration 004 was never applied to production

    material_catalog    0 rows
    labour_categories   0 rows

`004_seed_reference_data.sql` is what seeds the material taxonomy — including the
notebook's Gujarati `name_local` values, `કપચી`, `રેતી`, `સિમેન્ટ` — and the
labour trade categories.

**Both target tables are empty in production.** The tables exist, so the schema
migrations ran; the seed did not. **Material entry is impossible: there is
nothing to select.** Labour entry loses its trade vocabulary.

This is a migration gap nobody has recorded. 006 and 007 were applied
deliberately; 004 apparently never was, or was applied to a different database.
**It must be resolved before step 6, and it is a data change to production, so it
is yours to make.**

### BLOCKER 2 — every worker login in production is in BUG-002's broken state

    workers table                      0 rows
    users with role 'worker'           3
    worker users linked to a register  0

`workers` is empty, so **no worker login is linked to a register row**.
`profileLink.service.js` refuses an unlinked worker login at seven call sites in
`workerPortal.controller.js`. All three existing worker users will hit *"No
worker profile is linked to this login user."*

### BLOCKER 3 — half the users have no company membership

| user | role | company membership |
|---|---|---|
| 1 | admin | ✅ |
| 2 | worker | ❌ |
| 6 | subcontractor | ❌ |
| 7 | worker | ❌ |
| 8 | admin | ✅ |
| 9 | worker | ✅ |

Portal admission needs a `company_users` row. Users 2, 6 and 7 cannot pass it
regardless of anything else. **Only user 9 is a viable supervisor candidate**, and
it still needs a register row per Blocker 2.

### BLOCKER 4 — there are zero `manager` users

`manager` exists in every role gate and in `WINDOW_EXEMPT_ROLES`, and **no user
holds it**. Any step that assumes a manager cannot be walked at all.

---

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
