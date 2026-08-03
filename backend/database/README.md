# Database

PostgreSQL, reached directly through the `pg` package. Supabase is used for
file storage only — its PostgREST layer and client libraries are not
involved in any query.

## Files in this folder

| File | What it is |
|---|---|
| `pool.js` | The connection pool every module imports. Also sets the `DATE` type parser and provides the tenant-scoped query helpers. |
| `schema.sql` | **Not the schema.** A pointer to the migrations, kept because the name is where people look first. |
| `check-database.js` | A hand-run diagnostic that reports which database, schema and search path a connection actually has. Not imported by anything. |
| `migrations/` | The real schema, in numbered order. Start with `migrations/README.md`. |
| `snapshots/schema-production.sql` | A `pg_dump` of the deployed schema, kept for comparison. **Stale** — it describes 18 tables and the database has 47. Do not build from it. |

## Setting a database up

Which files to run depends on whether the database already has data.
`migrations/README.md` covers both cases; briefly:

```bash
# A fresh, empty database (including a new Supabase project)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f database/migrations/002_baseline_supabase.sql \
  -f database/migrations/003_supabase_rls.sql \
  -f database/migrations/004_seed_reference_data.sql

# An existing local database that predates the upgrade
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f database/migrations/001_upgrade_schema.sql \
  -f database/migrations/004_seed_reference_data.sql
```

Every migration is idempotent and wrapped in a transaction, so a failure
rolls the whole file back rather than leaving the schema half-applied.

## Connection

`DATABASE_URL` in `backend/.env`:

```
postgresql://user:password@host:port/database
```

`pool.js` reads it, along with the `DB_*` variables that set pool bounds,
timeouts and TLS. See the comments in `backend/.env` for what each does.

**Row-level security only takes effect when this connects as the
`construction_app` role.** A superuser — which `postgres` is — bypasses
every policy, so while `DATABASE_URL` names `postgres` the policies created
by migration 003 have no effect at all. Tenant isolation is then resting
entirely on the `WHERE company_id = $1` clauses in the application.

## Scale

47 tables. The ones a new developer meets first:

**Tenancy** — `companies`, `users`, `company_users`. Every other table
carries `company_id`, and it is `NOT NULL` on 35 of them.

**Work** — `tenders` (called Projects in the UI), `sites` (which belong to a
tender — note the direction, there is no `tenders.site_id`), `workers`,
`subcontractors`, `worker_assignments`, `tender_subcontractors`.

**Money** — `payments` is the main ledger; `tender_finance_records` is a
separate one reached through `/api/tenders/:id/finance`;
`worker_allocations` and `worker_expenses` cover money handed to workers;
`invoices`.

**Site operations** — `material_catalog`, `site_material_entries`, `labour`,
`labour_work_entries`, `supervisor_fund_receipts`, `supervisor_expenses`,
`entry_access_requests`. These come from the operations notebook and are
described in migration 001.

**Cross-cutting** — `daily_site_logs`, `daily_update_approvals`,
`notifications`, `activity_logs`, `files`.

**Not yet written to** — `ai_conversations`, `ai_insights`, `inventory_items`,
`inventory_transactions`, `tender_milestones`, `site_inspections`,
`site_3d_models`, `site_model_annotations`, `comments`, `tags`,
`tag_assignments`, `saved_reports`, `user_settings`,
`worker_sensitive_details`. Schema ahead of the code rather than dead code.

## Conventions

**Soft delete.** Most tables carry `is_deleted`, `deleted_at`, `deleted_by`
rather than removing rows. Every read must filter on it — a missing
`COALESCE(is_deleted, FALSE) = FALSE` is how deleted records reappear.

**`updated_at` triggers.** Migration 001 installs `set_updated_at()` and
attaches it to the tables it creates, so that column maintains itself.

**Dates are calendar dates.** `pool.js` overrides node-postgres's `DATE`
parser to return the `"YYYY-MM-DD"` string rather than a JS `Date`. Without
it, a date is parsed at local midnight and serialises to JSON as the
previous day. Do not convert these to `Date` on the way out.

**Money is `NUMERIC`, never float.** node-postgres returns `NUMERIC` as a
string to avoid losing precision, which is why comparisons in the code go
through `Number()` and why `activityLog.diff()` compares loosely — `100`
and `"100"` are one value in two shapes.
