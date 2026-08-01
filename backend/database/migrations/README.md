# Database Migrations

Run these in order. Which file you run depends on whether the database
already has data.

---

## Which files do I run?

### A. Your existing LOCAL database (pgAdmin 4)

Your local `construction_portal` database already has 38 tables. It only
needs the upgrade.

```
001_upgrade_schema.sql        ← run this
004_seed_reference_data.sql   ← then this
```

Skip `002` — it is for empty databases and your local one is not empty.

`003` (row-level security) is optional locally but recommended, because it
is the same thing you will run in production and you want to catch any
surprises on your machine first. See the warning under *Row-level security*
below before running it.

### B. A fresh SUPABASE project

```
002_baseline_supabase.sql     ← complete schema, 47 tables
003_supabase_rls.sql          ← tenant isolation
004_seed_reference_data.sql   ← material catalog + labour categories
```

Do **not** run `001` on Supabase after `002` — `002` already includes
everything `001` does. Running it anyway is harmless (every statement is
guarded) but pointless.

---

## How to run

### pgAdmin 4

1. Left panel → expand **Servers** → your server → **Databases** →
   `construction_portal`
2. Right-click the database → **Query Tool**
3. Open the `.sql` file (folder icon, or `Ctrl/Cmd+O`)
4. Execute (**F5**, or the ▶ button)
5. Check the **Messages** tab — you want `COMMIT`, and no `ERROR`

`NOTICE` and `WARNING` lines are expected and fine. Only `ERROR` matters.

### Supabase

1. Dashboard → **SQL Editor** → **New query**
2. Paste the whole file
3. **Run**

`002` is large (~4,300 lines). If the editor struggles, run it via psql
instead:

```bash
psql "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
  -f 002_baseline_supabase.sql
```

### psql (either environment)

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 001_upgrade_schema.sql
```

`ON_ERROR_STOP=1` makes psql halt on the first error instead of ploughing on.

---

## Safety

Every file is **idempotent** — running it twice changes nothing the second
time. Each runs inside a single transaction, so a failure rolls the whole
file back rather than leaving the schema half-migrated.

Take a backup first anyway:

```bash
pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%Y%m%d-%H%M).dump
```

Restore with:

```bash
pg_restore -d "$DATABASE_URL" --clean --if-exists backup-....dump
```

---

## What each file does

### 001_upgrade_schema.sql

**Creates two tables the code already queries but that did not exist.**
Before this migration, these endpoints returned a PostgreSQL `42P01`
"relation does not exist" error every time they were called:

| Table | Broken endpoints |
|---|---|
| `daily_update_approvals` | the entire approvals queue; worker and subcontractor daily-update submission |
| `tender_workers` | worker portal assignments, documents and money screens |

**Adds `company_id` to eight tables that lacked it**, then backfills from the
owning parent (`worker_allocations` → `workers`, `worker_expenses` →
`worker_allocations`, `tender_*` → `tenders`). Without this column the
controllers physically could not filter by tenant.

This backfill is free while the tables are empty. It will not be free later.

**Extends `payments`** with `payment_direction`, `bill_number`,
`charge_amount`, `gst_received`, `gst_left`, `company_charge_left`,
`interest_amount`, `investor_id`, `supplier_id` and related fields, so the
Add-Payment income/expense hierarchy has somewhere to store its data.

**Adds seven operational tables** from the site notebook:

| Table | Purpose |
|---|---|
| `material_catalog` | the "Main Section" material list (કપચી, રેતી, સિમેન્ટ, …) |
| `site_material_entries` | daily material receipt: quantity, rate, bill, photo |
| `labour` | labourers under a supervisor, with work category |
| `labour_work_entries` | per-labourer daily wage ledger |
| `supervisor_fund_receipts` | money to a supervisor by bank / cash / GST cash |
| `supervisor_expenses` | daily supervisor spend |
| `entry_access_requests` | the "call the office for access" flow for backdated entries |

**Adds `token_version` to `users`**, which is what makes a password change
or a deactivation invalidate tokens that were already issued.

### 002_baseline_supabase.sql

The complete schema — all 47 tables, 156 indexes, 167 foreign keys.

Generated from the local database *after* `001` was applied and verified,
then checked by running it into an empty database and diffing the result.
It is not hand-written, so it cannot drift from what actually works.

PostgreSQL 18-only directives (`\restrict`, `transaction_timeout`) are
stripped so it runs on Supabase's PostgreSQL 15/17.

### 003_supabase_rls.sql

Row-level security, so tenant isolation is enforced by the database rather
than by every developer remembering a `WHERE` clause.

**Read the warning in the file header.** RLS is bypassed by superusers. Your
API currently connects as `postgres`, which means these policies will have
**no effect at all** until you switch it to the `construction_app` role this
migration creates. The file prints the connection string you need.

How it works: the API sets `app.company_id` per transaction (see
`withTenant` in `database/pool.js`), and each policy compares `company_id`
against it. If the variable is unset, policies match nothing — it fails
closed.

Verified behaviour with two seeded companies:

```
company 1 → sees only company 1 rows
company 2 → sees only company 2 rows
no context → 0 rows
insert with another company's id → rejected
```

### 004_seed_reference_data.sql

Seeds 24 materials and 13 labour categories per company, with the Gujarati
names from the notebook kept in `name_local` so supervisors see familiar
labels.

Also installs a trigger so a newly registered company gets both lists
automatically, and its supervisor screens are never empty on day one.

---

## After running

Verify:

```sql
-- 9 new tables
SELECT tablename FROM pg_tables
 WHERE schemaname = 'public'
   AND tablename IN ('daily_update_approvals','tender_workers',
                     'material_catalog','site_material_entries','labour',
                     'labour_work_entries','supervisor_fund_receipts',
                     'supervisor_expenses','entry_access_requests')
 ORDER BY 1;

-- company_id present on the previously unscoped tables
SELECT table_name FROM information_schema.columns
 WHERE table_schema = 'public' AND column_name = 'company_id'
   AND table_name IN ('worker_allocations','worker_expenses',
                      'worker_assignments','tender_documents')
 ORDER BY 1;

-- seed data
SELECT main_section, count(*) FROM material_catalog GROUP BY 1 ORDER BY 1;
SELECT code, name, name_local FROM labour_categories ORDER BY sort_order;
```

Then restart the API and confirm it still boots:

```bash
cd backend && npm run dev
```

---

## Adding the next migration

Number it `005_`, keep it idempotent (`IF NOT EXISTS`, guarded `DO` blocks),
wrap it in `BEGIN`/`COMMIT`, and describe it here.

There is no migration runner in this project yet — files are applied by
hand and the numbering is the only ordering. Adopting `node-pg-migrate` or
Knex is worth doing before the list gets much longer, so that what has been
applied is recorded in the database rather than remembered.
