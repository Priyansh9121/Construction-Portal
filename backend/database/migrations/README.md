# Database migrations

Numbered, forward-only SQL. There are **no `down` steps** — rollback is
restore-from-backup. Take a dump before you run anything.

| File | Lines | What it does |
|---|---|---|
| `001_upgrade_schema.sql` | 785 | Upgrades an **existing older** database: adds the 2 tables the code queried but that did not exist, `company_id` on 8 tables that lacked it, payment columns for the Add Payment hierarchy, and 7 operational tables |
| `002_baseline_supabase.sql` | 4,421 | Complete baseline for a **fresh** database: 48 tables, 11 unique indexes, the `tender_site_counts` view, triggers. Generated with `pg_dump` after 001 was applied |
| `003_supabase_rls.sql` | 387 | Creates the non-superuser `construction_app` role and the row-level security policies |
| `004_seed_reference_data.sql` | 249 | 24 materials and 13 labour categories per company (Gujarati names preserved), plus a trigger that seeds every new company automatically |
| `005_drop_duplicate_assignment_table.sql` | 70 | Drops `tender_workers`, a duplicate of `worker_assignments`. Conditional and non-destructive |
| `006_idempotency_keys.sql` | 108 | Adds the `idempotency_keys` table so a retried Site Operations write returns the first answer instead of duplicating evidence or burning a single-use grant. Was missing from this table |
| `007_subcontractor_user_link_unique.sql` | 110 | Adds `ux_subcontractors_user_id`, the partial unique index `workers` already had. Checks for existing duplicates first and names them. Re-runnable |

---

## Which files to run

### Fresh database (new Supabase project, or a new local database)

```
002  ->  003  ->  004  ->  005  ->  006  ->  007
```

**Do not run 001.** It is an upgrade script for a database that predates the
baseline; 002 already contains everything it adds.

### Existing older database

```
001  ->  003  ->  004  ->  005  ->  006  ->  007
```

**Do not run 002 on a database that already has data.** It is a `pg_dump`
baseline and assumes an empty schema.

---

## Why 005 must run after 002

This is the part that is easy to get wrong.

`002_baseline_supabase.sql` was generated from a database **before**
`tender_workers` was recognised as a duplicate. It therefore still creates
the table (line 1671), its sequence `tender_workers_id_seq` (line 1697) and
the trigger `trg_tender_workers_updated_at`.

So a fresh install that stops after 004 ends up with the exact dead table
that 005 exists to remove:

```
002 creates tender_workers  ─┐
                             ├─►  005 drops it
001 creates tender_workers  ─┘
```

There were two tables for one concept:

- **`worker_assignments`** — what the office writes, read/inserted/updated
  through `/api/tenders/:id/workers`. **This is the live one.**
- **`tender_workers`** — added by 001 only because the worker portal queried
  a table that did not exist. Creating it stopped the `42P01`, but nothing
  has ever written a row to it, so the portal read an empty table and told
  every worker they were not assigned to the site they were standing on.

The portal now reads `worker_assignments`, leaving `tender_workers` with no
reader and no writer.

**005 is safe.** It drops the table *only when it is empty*. If your database
has rows in `tender_workers`, the migration leaves it alone and tells you —
move those rows into `worker_assignments` first, then re-run.

**The baseline is deliberately not edited.** 002's value is that it
reproduces a known-good dumped state; rewriting a migration that has already
been applied somewhere is worse than running one extra file.

---

## Backup first

Always, on any database with data you care about:

```bash
pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%Y%m%d-%H%M).dump
```

`*.dump` is gitignored. Restore with:

```bash
pg_restore -d "$DATABASE_URL" --clean --if-exists backup-YYYYMMDD-HHMM.dump
```

---

## How to run

### Local (psql)

```bash
cd backend

pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%Y%m%d-%H%M).dump

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/002_baseline_supabase.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/003_supabase_rls.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/004_seed_reference_data.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/005_drop_duplicate_assignment_table.sql
```

`-v ON_ERROR_STOP=1` matters. Without it psql continues past a failed
statement and you end up with a half-applied migration and a zero exit code.

### Supabase (SQL Editor)

Open each file, paste the whole contents into the SQL Editor, Run. One file
at a time, in order, checking each succeeds before the next.

---

## Seeding

There is no separate seed command. `004_seed_reference_data.sql` inserts the
material catalog and labour categories for every existing company, and
installs `trg_seed_company_reference_data` on `companies` so a newly
registered company is seeded automatically.

Re-running 004 is safe; it is written to be idempotent.

---

## The `construction_app` role and RLS

`003` creates a **non-superuser** role. That is the whole point: `postgres`
bypasses row-level security, so the policies do nothing while the API
connects as the superuser.

The running server tells you which situation you are in:

```
[database] Connected as a role that BYPASSES row-level security (postgres).
The migration 003 policies have no effect; tenant isolation rests entirely
on the WHERE clauses in the application.
```

To activate RLS, after running 003:

```sql
ALTER ROLE construction_app WITH PASSWORD 'a-long-random-password';
```

then repoint `DATABASE_URL` at that role.

### Verify the tenant context BEFORE you repoint

The policies compare every row against the `app.company_id` session
variable. Something has to set it on the connection running the query.
`authMiddleware` binds the company into an `AsyncLocalStorage` context
(`database/tenantContext.js`) and `pool.query` / `withTransaction` read it
back and issue `SET LOCAL`.

**The failure mode is silent and `npm test` cannot see it.** With no context,
writes raise `42501` and reads return **zero rows rather than erroring** —
which reads like "no data" rather than "broken". The test suite passes
either way, because the local database usually has no RLS applied and
connects as a superuser.

So, before any deploy that repoints `DATABASE_URL`:

```bash
cd backend
node scripts/verifyTenantContext.js
```

It builds a scratch database with 003's policy shape, drives the real query
paths as a role that cannot bypass RLS, and **exits non-zero** if the
context is not arriving.

---

## Verification

After running the migrations:

```bash
# Table count — expect 48 on a fresh install, 47 after 005 drops tender_workers
psql "$DATABASE_URL" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"

# tender_workers should be gone
psql "$DATABASE_URL" -c "SELECT to_regclass('public.tender_workers');"   # expect NULL

# worker_assignments should exist
psql "$DATABASE_URL" -c "SELECT to_regclass('public.worker_assignments');"  # expect the name

# Reference data seeded
psql "$DATABASE_URL" -c "SELECT count(*) FROM material_catalog;"
psql "$DATABASE_URL" -c "SELECT count(*) FROM labour_categories;"

# Application health
cd backend && node database/check-database.js
npm test
```

---

## Rollback limitations

- **No migration has a `down` step.** They are forward-only by design.
- The only rollback is `pg_restore` from a dump taken beforehand.
- `005` is the sole destructive file, and it refuses to run when the table
  it targets is non-empty.
- Never edit a migration that has already been applied to a deployed
  database. Add a new numbered file instead.

---

## Adding a new migration

1. Next number, descriptive name: `006_add_whatever.sql`.
2. Wrap it in `BEGIN; ... COMMIT;`.
3. Make it idempotent where you can (`IF NOT EXISTS`, `DROP ... IF EXISTS`).
4. `company_id` is `NOT NULL` on 35 tables — a new table holding tenant data
   needs it, plus an RLS policy in the shape 003 uses.
5. Add the file to the table at the top of this README.
6. Note it in `DEPLOYMENT.md` under *Migration process*.

---

## Production has no applied-migrations tracking

**Recorded 2026-08-19.** There is no `schema_migrations` table, no runner, and no
log. Nothing in the database records which of `001`–`007` has been applied. The
only way to answer "is migration N applied?" is to look for an object it creates
and infer.

All four questions asked so far were answered that way, by signature object:

    006  idempotency_keys table exists              -> applied
    007  ux_subcontractors_user_id index exists     -> applied
    003  50 RLS policies present                    -> applied
    005  tender_workers correctly absent            -> applied
    004  material_catalog has 24 rows               -> applied

### Why this is worth fixing, stated accurately

The motivating incident was **not** a migration going missing. `004` was applied
the whole time. What actually happened is worse in a quieter way:

A session concluded that `004` had never been applied, because
`material_catalog` read as **0 rows** — a count taken through `construction_app`
with no company context while RLS was in force, so every tenant-scoped table
appeared empty. That wrong conclusion was written into three documents and used
to justify pausing a phase of work.

**With a `schema_migrations` table it would have taken one query to disprove.**
Without one, the only available check was the row count that was already
lying — and inference from data is exactly the check that RLS, soft deletes,
tenant scoping or an empty seed can all corrupt.

So the value of tracking is not that it stops a migration being forgotten. It is
that it gives an **authoritative answer that does not depend on reading tenant
data correctly.**

### Two ways to fix it, and what each costs

**A. A `schema_migrations` table, written by hand on each apply.**

    INSERT INTO public.schema_migrations (version, applied_at)
    VALUES ('004', NOW());

*Costs:* it is a manual step, so it is only as reliable as the person applying
the migration remembers to be — and the failure mode is silent and identical to
the problem it solves. Retro-filling `001`–`007` means asserting today what was
applied historically, which is inference again, just written down once. It needs
its own RLS decision, since a tenant-scoped policy on it would reproduce the
exact blindness that caused this. **Cheapest to build, weakest guarantee.**

**B. A boot-time check asserting each migration's signature object exists.**

A table of `version -> a query that must return true`, run at startup, reporting
anything missing.

*Costs:* the signature list is hand-maintained and must be extended with every
new migration — a migration added without its signature is invisible to the
check, which is a quieter failure than A's. It runs at boot, so it costs a few
queries per deploy. It cannot tell "applied" from "someone created that object
by hand". **More code, but it verifies reality rather than recording a claim,
and it cannot be corrupted by RLS if the signatures query `pg_catalog` rather
than tenant tables.**

**B fits this codebase's existing habit.** `reportEnvAdjustments()` prints what
the environment actually resolved to at boot; the byte gate asserts the built
artefact rather than the intent; `assertServerFresh()` checks the running server
against the tree. All three verify reality at the moment it matters rather than
trusting a record. A would be the first thing here that trusts a written claim.

**Not built.** This is a proposal.
