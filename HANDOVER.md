# Construction Portal — what changed and what is left

Written at the end of the hardening and build-out pass. Start with **Do
this first**; the rest is reference.

> **Later documents supersede parts of this one.** This is a point-in-time
> record of that pass, kept for its reasoning rather than its counts.
>
> - `DEPLOYMENT.md` — how to run, deploy and maintain the project now
> - `STALE_UNUSED_CODE_AUDIT.md` — full 249-file stale/unused audit
> - `FIX_IMPLEMENTATION_TRACKER.md` — status of every audit finding
> - `backend/database/migrations/README.md` — migration order and RLS

---

## Do this first

### 1. Rotate four credentials

`backend/.env` was committed to a **public** GitHub repository from the very
first commit. Removing the file does not un-publish anything already cloned
or indexed.

| Credential | Where | Why it matters |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | Bypasses row-level security completely. Worst of the four. |
| Database password | Supabase → Settings → Database | Direct read/write to everything. |
| `JWT_SECRET` | generate a new one | Anyone holding it can mint a token for any user and role. |
| `BREAK_GLASS_ADMIN_PASSWORD` | change, then leave unset in deployments | A deliberate authentication bypass. |

### 2. Get Render running

It is failing with `injected env (0)` because configuration used to come
from the committed `.env`. See **DEPLOYMENT.md** — it takes five minutes.

### 3. Run the migrations

`backend/database/migrations/README.md` says which files to run for a local
database versus a fresh Supabase project, and why migration 005 must run
even on a fresh install.

---

## What was actually wrong

The original audit was directionally right but wrong on specifics. Verified
against the running code and database:

### Confirmed and fixed

**Cross-tenant data leakage — worse than reported.** The audit named four
controllers. There were **eight**, and the tests found the extra ones:

| Module | What it did |
|---|---|
| `payments` | listed every company's financial records |
| `siteLogs` | listed and **deleted** any company's site history |
| `workerMoney` (allocations + expenses) | listed, **approved** and **deleted** any company's money movements |
| `dailyUpdateApprovals` | let one company's admin approve another's updates, writing into their site history |
| `sites` | listed every company's sites; `createSite` took `company_id` from the request body |
| `workers` | same |
| `subcontractors` | same — including bank details |
| `invoices` | same |

The audit described this as read leakage. It was also cross-tenant
**approve and delete** by id enumeration.

**Two tables the code queried did not exist.** `daily_update_approvals` and
`tender_workers` — confirmed with `ERROR: relation does not exist`. The
whole approvals queue and the worker portal's assignment screens threw on
every call.

**No rate limiting, no `helmet`, no TLS verification, no email provider,
`AuthContext` white-screen crash, no tests.** All confirmed, all fixed.

### Wrong in the audit

- `clients` and `files` **do** exist. The audit said they were missing.
- The upload module had already been rewritten — MIME allowlist, extension
  matching, company-scoped storage paths, per-record ownership checks. Four
  of its "P0s" were already closed.
- `modules/companies/` exists; the server boots fine.
- "Enable RLS on `company_id`" was not directly possible: `worker_allocations`,
  `worker_expenses` and `worker_assignments` had **no `company_id` column at
  all**. Migration 001 adds it.
- `sites`, `workers`, `subcontractors` and `invoices` were described as
  company-scoped. None of them were.

---

## Bugs found while working — none of these were in the audit

These were all live in `main`:

1. **Tender creation was completely broken.** `inconsistent types deduced
   for parameter $7` — the status parameter was used both as a column value
   and inside a `CASE`. Every tender insert and update failed. This is the
   core entity of the application.

2. **Creating a worker, subcontractor, invoice or site was broken.** All
   four inserted a `created_by` column that does not exist on those tables
   (`42703`).

3. **Every date was off by one.** `node-pg` converts a `DATE` to a JS Date
   at local midnight; serialised to JSON it becomes the previous day.
   `2026-08-01` reached the browser as `2026-07-31T14:00:00.000Z`. This hit
   `payment_date`, `log_date`, `due_date` — every date in the app.

4. **`tenderQueries` read columns that do not exist** — `clients.is_deleted`
   and `clients.client_name` (the column is `name`). Broke every query built
   on the shared tender FROM clause.

5. **`workerPortal` joins `tenders.site_id`**, which does not exist — sites
   point at tenders, not the reverse.

6. **Express 5 leaves `req.body` undefined** when a POST carries no body, so
   any handler reading an optional field returned 500. Approve/reject
   endpoints are legitimately called with no body.

Items 3 and 6 were found by writing the tests, which is the argument for
having them.

---

## What was built

### Database

Five migration files in `backend/database/migrations/`, each executed and
verified rather than just written (005 is described under *Still
outstanding* below):

- **001** — the two missing tables, `company_id` on eight tables that lacked
  it, payments extended for the Add Payment hierarchy, and seven new
  operational tables from the site notebook.
- **002** — complete baseline for a fresh Supabase project. Generated from
  the local database *after* 001 was applied, then verified by loading it
  into an empty database and diffing: identical, 47 tables, 156 indexes,
  167 foreign keys.
- **003** — row-level security. Creates a non-superuser `construction_app`
  role, because `postgres` bypasses RLS and would render the policies
  decorative.
- **004** — 24 materials and 13 labour categories per company, Gujarati
  names preserved, with a trigger so new companies are seeded automatically.

Isolation was proven with two seeded tenants: each sees only its own rows,
no session context returns zero, and a cross-tenant insert is rejected.

### From your notebook

`backend/modules/siteOperations/` — tested end to end against a live server:

- **Material entries** — catalog with Gujarati names, daily quantity, rate,
  bill, GST pulled from the catalog. Verified: 50 bags cement at ₹350 →
  ₹17,500 + 28% GST → ₹22,400.
- **Photo provenance** — camera versus gallery, recorded and corroborated
  against the claimed capture time, so the office can tell a live photo
  from a re-upload.
- **The two-day rule** — full cycle tested: blocked at 10 days → supervisor
  requests access → still blocked while pending → office grants → succeeds
  → grant is single-use and the next backdated entry is blocked again.
- **Labour ledger** — per-labourer account, half days, running outstanding.
  Verified: 1 day at ₹800 paid ₹500 → ₹300 outstanding.
- **Supervisor banking** — the three routes from page 4 (bank, cash, GST
  cash). Verified: ₹75,000 in, ₹1,700 spent, ₹73,300 in hand.

**Add Payment hierarchy** — the full income/expense tree, served from the
API so the form and the server's validation cannot drift. Your worked
example reproduces exactly: bill ₹12,000 at 2% = ₹240, with મળેલ GST and
બાકી GST tracked. Investor interest accrues per day: ₹500,000 at 12% =
₹164.38/day.

### Previously unused database tables, now wired up

`investors`, `suppliers`, `clients` (with a per-investor statement showing
interest accrued across every tender), `activity_logs` (redacted audit
trail), `notifications` (with dispatch on access requests and grants).

### Security

Tenant isolation everywhere, `helmet`, rate limiting (verified cutting in
at exactly 10 failed logins), real TLS verification, token revocation via
`token_version` (verified: old token 401s, new token 200s), nodemailer for
password reset, `.gitignore`, `.env.example`, security headers in
`vercel.json`.

### Tests

222 passing. `npm test` in `backend/`.

(Was 143 at the time of the original hand-over; the suite has grown with
each subsequent pass.)

- `tenantIsolation.test.js` — seeds two companies, asserts neither can read
  or touch the other through any endpoint. This is the test that found the
  four extra leaking modules.
- `roleSeparation.test.js` — the same question inside one company: a
  labourer must not reach the office registers, and must keep their portal.
- `tenderChildResources.test.js` — every document, material, banking and
  subcontractor write, each checked for the owning `company_id` read back
  from the database rather than echoed from the response.
- `portals.test.js` — the worker and subcontractor screens end to end,
  from the office assigning someone to the update they submit.
- `activityLog.test.js` — the audit trail, including that a password never
  reaches it and that a failed request writes nothing.
- `notifications.test.js` — the access-request fan-out and queue privacy.
- `masters.test.js` — investors, suppliers, clients and the statement.
- `paymentCalculations.test.js` — the money maths, including your notebook's
  worked example as a regression test, the timezone arithmetic, and both
  directions of the Add Payment tree: every option it offers is one the
  validator accepts, and every combination the validator accepts is
  reachable from it.

---

## The audit pass

A second sweep went over every file, then re-ran until nothing new
surfaced. Sixteen commits. The headline is that a lot of this application
did not work, and the reasons were structural rather than scattered.

### Whole screens that did nothing

**Every write on Tender Details.** Adding or deleting a document,
material, banking record or subcontractor assignment posted to a flat
`/api/tender-details/*` path no router served. Nine actions, all 404.

Underneath sat a second fault the first one hid: migration 001 made
`company_id` NOT NULL on five tender child tables and none of the INSERTs
wrote it. Fixing the routing alone would have turned a 404 into a 500.

**Every write in both portals.** Four more INSERTs omitted the same
column, so a worker or subcontractor submitting a daily update, a
backdated one, an expense or a document got a 500. The worker portal also
read its assignments from `tender_workers`, a second table for the same
concept that nothing has ever written to, and joined on `tenders.site_id`,
a column that does not exist. Every worker was told they were not assigned
to the site they were standing on.

**The supervisor float could only fall.** Expenses had a form; the
receipts that fund them had an API, a table and no way in.

**Nothing could be approved.** Material entries, supervisor expenses and
worker allocations are all recorded pending. No screen could decide any of
them, so they stayed pending — and a pending allocation cannot be spent.

**A deleted project was gone.** Soft delete, and the list hard-coded
`is_deleted = FALSE`, so `POST /:id/restore` could not be reached.

**A disabled user stayed disabled.** Disable worked; enable had no button.

### Authorisation

Authentication was being treated as authorisation. Twelve office registers
sat behind `authMiddleware` alone, so any worker or subcontractor login
could read the tender list with `estimated_value`, `estimated_margin`,
`actual_margin` and client contact details, the entire payment ledger,
worker allocations and expenses, subcontractors with their bank details,
and the investor list — and could create payments, invoices and
subcontractors. Verified against a running server before and after.

### Two copies of the same thing

**The Add Payment tree existed twice** — once in the API, which validates
every submission, and once hard-coded in the frontend, which the form was
built from. They had drifted both ways: the form offered three
combinations the server refuses and hid two it accepts, and dropped a
whole level, so material, labour and GST could not be recorded against a
personal tender at all. The form now reads `GET /api/payments/hierarchy`.

**Three CSV exporters**, one reachable. **Two adapter modules** whose own
headers called them temporary. **Six copies** of the same forty-line page
loader. **Six copies** of the same data hook, three of which had lost
their role check.

### Dormant code, now working

`activity_logs` had a complete writer that nothing called, so
`GET /api/activity` served an empty table. `notifyRole` selected on a
column that does not exist and the failure was swallowed, so no
notification was ever written — and the bell never asked, deriving its
list from whatever the current page happened to be holding. Investors,
suppliers and clients had a tested API and no screen.

All three are wired, with screens: Activity Log, a real notification
queue, and Master Data with the investor statement.

### What holds it shut

Seven checks, all reporting clean, several written during the pass because
the same class of fault kept reappearing:

| Check | Was | Now |
|---|---|---|
| Frontend calls with no route | 10 | 0 |
| INSERTs missing a NOT NULL `company_id` | 6 | 0 |
| SQL naming a column that does not exist | 3 | 0 |
| ESLint problems | 47 | 0 |
| Dead exports | 30 | see note |
| `className` with no CSS rule | 9 | 0 |
| Orphan files | 14 | 0 |

Tests went 45 → 143. The column checker was itself tested against a
deliberately broken column to confirm it detects one.

---

## Still outstanding

### Functional

- **Company administration.** `PUT /api/company`, member role changes,
  member removal and ownership transfer all work and have no screen.
  Settings should grow one.
- **A file manager.** `GET /api/upload`, `/upload/:id` and
  `DELETE /upload/:id` have no caller.
- **Material and labour editing.** A supervisor who mistypes an entry
  cannot correct it; the delete and update endpoints exist.
- **Pagination.** The API paginates; the screens request everything.

### Still-unused tables

`ai_conversations` and `ai_insights` (pgvector embeddings),
`inventory_items`, `inventory_transactions`, `tender_milestones`,
`site_inspections`, `site_3d_models`, `site_model_annotations`, `comments`,
`tags`, `tag_assignments`, `saved_reports`, `user_settings`,
`worker_sensitive_details`.

These are schema ahead of the code rather than dead code in the repo, and
dropping them destroys design intent — so they are reported, not removed.
The one exception was `tender_workers`, which duplicated a table in active
use; migration 005 drops it, and only when it is empty.

`worker_sensitive_details` is worth doing next — it has encrypted columns
for bank details, while `subcontractors` stores account numbers in plain
text.

### Known issues

- **Three npm advisories, none of which apply here.** Checked rather than
  assumed:

  `react-router` 7.12–8.2, **CSRF bypass in RSC mode**. This is a Vite SPA
  using client-side routing; there is no React Server Components mode, no
  framework mode, and no server handler. The only remedy npm offers is a
  downgrade to 7.11.0, which is a major version back — not worth taking for
  a path the app does not have. Note this advisory *replaced* the
  open-redirect one that was recorded here earlier; the `toInternalPath`
  guard in `NotificationCenter` stays regardless, since notification links
  are the one route target that comes from the database.

  `xlsx`, **prototype pollution and ReDoS**, no fix published. Both are in
  the parser. This app never parses: the only calls are
  `XLSX.utils.aoa_to_sheet`, `book_new`, `book_append_sheet`,
  `encode/decode_cell` and `writeFile`. There is no `XLSX.read` anywhere.

  Recheck when upstream fixes land — `npm audit` in `frontend/`.
- **No code splitting.** The bundle is ~1.9 MB.
- **Eight pages exceed 1,000 lines.**
- **The audit trail records outcomes, not diffs.** The writer sits on the
  response, so it sees what a record became rather than a before/after
  pair. Who, when and what it became is recorded; the previous value is
  not. The column is labelled Details rather than Change for that reason.

---

## Commands

```bash
# backend
cd backend
npm run dev
npm test

# frontend
cd frontend
npm run dev
npm run build

# migrations
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/001_upgrade_schema.sql
```

---

## Notes for whoever works on this next

**`company_id` comes from the session, never the request body.** Several
endpoints accepted it from the client, which let anyone write into another
company. `utils/scopedCrud.js` makes that structurally impossible for the
simple registers — use it for new CRUD modules rather than hand-writing
another controller.

**Authentication is not authorisation.** A new register goes behind
`requireOffice` in `server.js` unless a worker or subcontractor genuinely
needs it. That check is mounted rather than per-route so a route added
inside one of those modules inherits it instead of having to remember it.

**Run the isolation and role tests before shipping anything that touches a
query.** They are the cheapest guard you have, and between them they found
four leaking modules and twelve open registers that nobody suspected.

**A route the frontend cannot reach is not "spare capacity".** Nine of the
faults in this pass were an endpoint and a screen that disagreed, and each
looked fine from either side alone. The checks in the audit pass table
above are worth re-running after any routing change.

**RLS is not live until `DATABASE_URL` uses `construction_app`.** As long as
the API connects as `postgres`, the policies in migration 003 do nothing.

**Repointing `DATABASE_URL` is not a one-line switch — verify it first.**
The policies compare every row against the `app.company_id` session
variable, so something has to set it on the connection running the query.
That now happens automatically: `authMiddleware` binds the company into an
`AsyncLocalStorage` context (`database/tenantContext.js`), and `pool.query`
and `withTransaction` read it back and issue `SET LOCAL`. Nothing at a call
site has to remember anything.

It did not always work that way, and the failure mode is worth knowing
because `npm test` cannot see it. `withTenant` was written as "the only
supported way" to set that variable and then never called — all 139
`pool.query` sites and 11 `withTransaction` blocks ran with no context. The
moment the API connected as `construction_app`, every policy failed closed:
writes raised `42501` and reads silently returned **zero rows** rather than
erroring. Add Tender was simply the first screen to say so out loud.

The test suite passes either way, because the local database has never had
003 applied and connects as a superuser, which bypasses every policy. So
before any deploy that repoints `DATABASE_URL`:

```bash
node scripts/verifyTenantContext.js
```

It builds a scratch database with 003's policy shape, drives the real query
paths as a role that cannot bypass RLS, and exits non-zero if the context
is not arriving. A silent zero-row read is the one database failure this
application cannot detect on its own.

**Dates are calendar dates.** `DATE` columns come back as `"YYYY-MM-DD"`
strings on purpose — see the parser in `database/pool.js`. Do not convert
them to `Date` objects on the way out.

**`company_id` is NOT NULL on 35 tables.** A new INSERT that forgets it
fails with `23502`, and only on the code path that runs it — which is how
six of them survived. Write it explicitly.
