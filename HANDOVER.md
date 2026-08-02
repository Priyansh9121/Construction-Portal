# Construction Portal — what changed and what is left

Written at the end of the hardening and build-out pass. Start with **Do
this first**; the rest is reference.

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
database versus a fresh Supabase project.

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

Four migration files in `backend/database/migrations/`, each executed and
verified rather than just written:

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

45 passing. `npm test` in `backend/`.

- `tenantIsolation.test.js` — seeds two companies, asserts neither can read
  or touch the other through any endpoint. This is the test that found the
  four extra leaking modules.
- `paymentCalculations.test.js` — the money maths, including your notebook's
  worked example as a regression test, and the timezone arithmetic.

---

## Still outstanding

Being straight about what is not done:

### Functional

- **Frontend for the Add Payment hierarchy.** The API and the tree are
  ready; `PaymentsPage`/`FinanceWizard` still use the old flat form. The
  server serves the structure at `GET /api/payments/hierarchy` — the form
  can be generated from it.
- **Worker and subcontractor portal screens** for the new material, labour
  and banking endpoints. Backend is complete and tested; `SiteOperationsPage`
  covers the office side of the same data.
- **Masters UI** for investors, suppliers and clients.
- **Notification bell** is still computed client-side from tenders and
  invoices; it should read `GET /api/notifications`.

### Still-unused tables

`ai_conversations` and `ai_insights` (pgvector embeddings),
`inventory_items`, `inventory_transactions`, `tender_milestones`,
`site_inspections`, `site_3d_models`, `site_model_annotations`, `comments`,
`tags`, `tag_assignments`, `saved_reports`, `user_settings`,
`worker_sensitive_details`.

`worker_sensitive_details` is worth doing next — it has encrypted columns
for bank details, while `subcontractors` currently stores account numbers
in plain text.

### Known issues

- **Two npm advisories remain, both non-exploitable here.** `react-router`
  7.12–8.2 has an open redirect via a backslash in `<Link to>`; every route
  target in this app is a literal or an internal id, and the one
  database-driven link is now sanitised. `xlsx` has parsing
  vulnerabilities; this app only writes spreadsheets, never reads them.
  Recheck both when upstream fixes land.
- **No pagination on the frontend.** The API paginates; the screens still
  request and render everything.
- **No code splitting.** The bundle is ~1.9 MB.
- **Nine pages exceed 1,000 lines.**
- `useAuth` is exported from `AuthContext.jsx` alongside the provider, which
  breaks fast refresh. Pre-existing; fixing it touches 17 files.

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

**Run the isolation test before shipping anything that touches a query.**
It is the cheapest guard you have against reintroducing the leak, and it
already caught four modules nobody suspected.

**RLS is not live until `DATABASE_URL` uses `construction_app`.** As long as
the API connects as `postgres`, the policies in migration 003 do nothing.

**Dates are calendar dates.** `DATE` columns come back as `"YYYY-MM-DD"`
strings on purpose — see the parser in `database/pool.js`. Do not convert
them to `Date` objects on the way out.
