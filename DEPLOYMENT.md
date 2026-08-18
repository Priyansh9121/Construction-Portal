# Construction Portal — Deployment & Maintenance Guide

The single document for understanding, running, deploying and maintaining
this project.

Companion documents:

| Document | What it covers |
|---|---|
| `HANDOVER.md` | What was wrong historically and what was fixed. Analytical history. Some counts are stale — see *Stale Code & Technical Debt*. |
| `STALE_UNUSED_CODE_AUDIT.md` | Full 249-file audit of stale, unused and duplicated code, with evidence. **Partly superseded** — see the banner at its top. |
| `UI_UX_AUDIT.md` | The frontend design system, CSS architecture and what was redesigned. |
| `RESPONSIVE_TEST_MATRIX.md` | Per-route responsive verification status. |
| `FIX_IMPLEMENTATION_TRACKER.md` | **Current status of every audit finding** — fixed, retained or blocked. Read this before acting on the audit. |
| `docs/repository-reference/findings.md` | Numbered findings F-01…F-17 from the earlier documentation pass. |

---

# Project Overview

A multi-tenant construction management portal. One deployment serves many
companies; every row carries a `company_id` and every query is scoped to the
signed-in user's company.

**Core domain:** tenders (called "projects" in some older code and docs),
their sites, the workers and subcontractors assigned to them, the money that
moves against them, and the daily record kept by supervisors on site.

**User roles**

| Role | Reaches |
|---|---|
| `admin` | Everything, including user management and unmasked bank details |
| `manager` | The office registers; **not** payment credentials |
| `worker` | `/worker-portal` only — own assignments, updates, money |
| `subcontractor` | `/subcontractor-portal` only — own tenders and documents |

Role landing pages are decided by `getHomePath()` in
`frontend/src/routes/RoleRoute.jsx`, so `/` means something different per
role.

---

# Architecture

```
   Browser
      │
      │  HTTPS
      ▼
┌──────────────────┐        ┌──────────────────────┐
│  Vercel          │  API   │  Render              │
│  React SPA       │───────▶│  Express 5 (Node)    │
│  frontend/       │        │  backend/            │
└──────────────────┘        └──────────┬───────────┘
                                       │ pg (TLS)
                            ┌──────────▼──────────────────┐
                            │  Supabase Postgres          │
                            │  48 tables                  │
                            └──────────┬──────────────────┘
                                       │
                            ┌──────────▼──────────────────┐
                            │  Supabase Storage           │
                            │  bucket: construction-files │
                            └─────────────────────────────┘
```

## Frontend

- **React 19** + **Vite 8**, plain JavaScript (no TypeScript anywhere).
- Routing: `react-router-dom` 7, all routes declared in
  `frontend/src/routes/AppRoutes.jsx`, guarded by `RoleRoute.jsx`.
- State: React hooks. Shared registers load once per session through
  `hooks/useCollection.js` and are threaded down from `App.jsx`.
- HTTP: one axios instance, `src/api/axiosClient.js`, which attaches the
  bearer token and signs the user out on a 401.
- Styling: hand-written CSS, all imported through `src/index.css`.
- Exports: PDF via `jspdf` + `jspdf-autotable`, spreadsheets via `xlsx`.

## Backend

- **Express 5** on Node. Entry point: `backend/server.js`.
- **`server.js` is the authoritative routing and authorisation table.** Read
  it first. The mount list at lines 578-615 says who may call what; the
  individual route files assume the gate above them has already run.
- Feature modules under `backend/modules/<feature>/`, each with
  `.routes.js`, `.controller.js` and often `.service.js`.
- Middleware pipeline, in order: `trust proxy` → `cors` → `helmet` →
  `apiLimiter` → `express.json` → body normalisation → `requestLogger` →
  routes → 404 → `errorHandler`.
- 145 routes total.

## Database

- PostgreSQL (Supabase), 48 tables.
- Migrations in `backend/database/migrations/`, numbered 001-005.
- Connection pooling in `backend/database/pool.js`.
- **`DATE` columns are returned as `"YYYY-MM-DD"` strings on purpose.** A
  custom type parser in `pool.js` does this. Do not convert them to `Date`
  on the way out — that reintroduces the off-by-one-day bug.
- `company_id` is `NOT NULL` on 35 tables. An INSERT that forgets it fails
  with `23502`, and only on the code path that runs it.

## Storage

Supabase Storage, bucket `construction-files`. Uploads go through
`backend/modules/uploads/`, which enforces a MIME allow-list, an extension
match, a size ceiling and a company-scoped path.

## Authentication

- Bearer JWT, issued by `modules/auth/auth.service.js`. **No refresh-token
  flow exists** — `JWT_EXPIRES_IN` alone controls session length.
- Revocation via a `token_version` column: a password change bumps it and
  every previously issued token stops validating.
- No cookies, so the API has **no CSRF surface** (`server.js:314-319`).
- `authMiddleware` verifies the token and binds the company into an
  `AsyncLocalStorage` context (`database/tenantContext.js`), which
  `pool.query` reads back to issue `SET LOCAL` for RLS.

## Deployment flow

```
git push origin main
   ├── Vercel   detects frontend/, runs vite build, publishes the SPA
   └── Render   detects backend/, runs npm ci, then `node server.js`
```

Both deploy from `main`. `.github/workflows/ci.yml` runs lint on both
halves, the frontend build, and the backend suite against an ephemeral
PostgreSQL container on every push and pull request. It does **not** gate
the deploy — Vercel and Render react to the push independently — so a red
CI run and a live deploy can coexist. Add branch protection if that matters.

---

# Local Development

## Required software

| Tool | Version used | Notes |
|---|---|---|
| Node.js | v24.15.0 | Any modern LTS should work; no `engines` field is declared |
| npm | bundled with Node | `npm ci` for reproducible installs |
| PostgreSQL | 18.4 in dev | Local instance or a Supabase project |
| `psql` | matching client | Required to apply migrations |

## Installation

```bash
git clone <repo> && cd construction-portal

cd backend  && npm ci && cd ..
cd frontend && npm ci && cd ..
```

## Environment variables

### `backend/.env`

> `backend/.env.example` is the tracked template and now documents all 37
> variables `backend/config/env.js` reads, with no real values. The table
> below is the same information in reference form.

`config/env.js` is the **only** place the backend reads `process.env`.
Everything has a default except where marked **required**.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` | Drives `trust proxy`, error verbosity |
| `PORT` | no | `5051` | Listen port |
| `DATABASE_URL` | **yes** | — | Postgres connection string |
| `JWT_SECRET` | **yes** | — | Must be ≥32 chars or the app refuses to boot |
| `JWT_EXPIRES_IN` | no | `7d` | Session length |
| `CORS_ORIGINS` | no | — | Comma-separated allow-list; exact match, no wildcards |
| `FRONTEND_URL` | no | — | Where password-reset links point |
| `BASE_URL` | no | — | ⚠️ set in `render.yaml` but **read nowhere in code** |
| `DB_SSL` | no | `false` | `true` for managed Postgres |
| `DB_SSL_CA` | no | — | CA bundle so the certificate is verified, not trusted blindly |
| `DB_SSL_REJECT_UNAUTHORIZED` | no | — | Leave on in production |
| `DB_POOL_MAX` / `DB_POOL_MIN` | no | `10` / `0` | Pool sizing |
| `DB_IDLE_TIMEOUT_MS`, `DB_CONNECTION_TIMEOUT_MS`, `DB_STATEMENT_TIMEOUT_MS`, `DB_QUERY_TIMEOUT_MS` | no | see `env.js` | Timeouts |
| `DB_APPLICATION_NAME` | no | — | Shows in `pg_stat_activity` |
| `SUPABASE_URL` | no | — | Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | no | — | **Secret.** Bypasses RLS entirely |
| `SUPABASE_BUCKET` | no | `construction-files` | |
| `MAX_UPLOAD_SIZE_MB` | no | `10` | |
| `ALLOWED_UPLOAD_FOLDERS` | no | see `render.yaml` | Comma-separated folder allow-list |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | no | — | Without these, reset links are logged to the console instead of emailed |
| `MAIL_FROM`, `MAIL_FROM_NAME` | no | — | |
| `RESET_TOKEN_TTL_MINUTES` | no | see `env.js` | Password-reset link lifetime |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | no | `900000` / `300` | General API limiter |
| `AUTH_RATE_LIMIT_MAX` | no | `10` | Failed-login limiter |
| `DEFAULT_CURRENCY` / `DEFAULT_TIMEZONE` | no | `INR` / `Asia/Kolkata` | ⚠️ disagrees with `DEFAULTS.COMPANY_TIMEZONE` in `config/constants.js` (F-04) |
| `SUPERVISOR_EDIT_WINDOW_DAYS` | no | `2` | Backdated-entry window |
| `SUPERVISOR_BANKING_GRACE_DAYS` | no | `1` | |
| `BREAK_GLASS_ADMIN_EMAIL` / `_PASSWORD` / `_COMPANY_ID` | no | unset | **Leave unset in every deployed environment** |

Not read by any code, despite appearing in configuration:
`JWT_REFRESH_EXPIRES_IN` (there is no refresh flow — F-02).

### `frontend/.env`

```bash
VITE_API_URL=http://127.0.0.1:5051/api
```

Only two variables are read anywhere in the frontend: `VITE_API_URL` and
`import.meta.env.DEV`. `VITE_API_URL` is read once, in
`src/api/axiosClient.js`, and falls back to `http://127.0.0.1:5051/api`.

**Vite substitutes these at build time, not runtime.** Changing one requires
a rebuild, and the value ends up in public JavaScript. Never put a secret in
`frontend/.env`.

## How to run the backend

```bash
cd backend
npm run dev            # nodemon server.js
```

Expected output:

```
Database connected: { database: 'construction_portal', ... }
Construction Portal API running on port 5051
Local API: http://127.0.0.1:5051
```

## How to run the frontend

```bash
cd frontend
npm run dev            # vite, http://localhost:5173
```

If 5173 is occupied Vite picks the next free port and prints it.

## Database setup

```bash
createdb construction_portal
```

## Migration process

Apply **in numerical order**:

```bash
cd backend
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/001_upgrade_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/002_baseline_supabase.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/003_supabase_rls.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/004_seed_reference_data.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/005_drop_duplicate_assignment_table.sql
```

| File | Purpose |
|---|---|
| `001_upgrade_schema.sql` | Upgrades an **existing** older database: adds 2 missing tables, `company_id` on 8 tables, 7 operational tables |
| `002_baseline_supabase.sql` | Complete baseline for a **fresh** project: 48 tables, 11 unique indexes, the `tender_site_counts` view, triggers |
| `003_supabase_rls.sql` | Creates the `construction_app` role and the RLS policies |
| `004_seed_reference_data.sql` | 24 materials, 13 labour categories per company, plus a trigger seeding new companies |
| `005_drop_duplicate_assignment_table.sql` | Conditionally drops `tender_workers`. Non-destructive: refuses if the table has rows |

### Which files for which case

- **Fresh Supabase project:** `002` → `003` → `004` → **`005`**
- **Existing older database:** `001` → `003` → `004` → **`005`**

> ⚠️ **Run 005 even on a fresh install.** `002` is a `pg_dump` baseline that
> still creates `tender_workers` (line 1671) — the duplicate table that
> `005` exists to remove. Skipping it leaves the dead table behind.
>
> Full detail — backup, restore, the `construction_app` role, RLS
> verification and rollback limits — is in
> **`backend/database/migrations/README.md`**.

## Seed process

Reference data is seeded by migration `004`, which also installs
`trg_seed_company_reference_data` on `companies` so a newly registered
company is seeded automatically. There is no separate seed command.

## Testing

```bash
cd backend
npm test           # vitest run
npm run test:watch
```

Current state: **222 tests, all passing**, in roughly 17 seconds.

`masters.test.js › refuses a worker` previously appeared to fail with a 30 s
timeout. That was CPU contention from dev servers running alongside the
suite, not a defect — `createMember` does pure-JS bcrypt at cost 12. Run the
suite without `npm run dev` in another terminal.

The tests run against your **real configured database**, creating and
cleaning their own rows via `tests/helpers/testDb.js`.

**There is no frontend test runner.** `frontend/eslint.config.js:17` says so
explicitly.

## Linting

```bash
cd frontend && npm run lint      # 0 problems
```

```bash
cd backend && npm run lint      # 0 errors
```

Both halves are linted. The backend config is `backend/eslint.config.js`
(CommonJS + Node globals, Vitest globals for `tests/**`). It found eight
real issues on its first run.

## Building

```bash
cd frontend && npm run build
```

Entry chunk **456 kB (146 kB gzip)**. Every authenticated page is
code-split via `React.lazy` in `routes/AppRoutes.jsx`; the auth screens stay
eager. The build still warns about the on-demand export and chart chunks
(jsPDF/xlsx ~713 kB, recharts ~363 kB) — those download only when a user
actually exports or opens a chart.

---

# Production Deployment

## Render configuration

Declared in `render.yaml` at the repository root.

| Setting | Value |
|---|---|
| `rootDir` | `backend` |
| `buildCommand` | `npm ci` |
| `startCommand` | `node server.js` |
| `healthCheckPath` | `/api/health` |
| `plan` | `free` |

> Note: `server.js:40` claims `npm start` runs the app. **There is no `start`
> script.** Render invokes `node server.js` directly, so nothing is broken —
> the comment is stale.

Secrets are marked `sync: false` and must be set once in the dashboard:
`JWT_SECRET`, `DATABASE_URL`, `DB_SSL_CA`, `CORS_ORIGINS`, `FRONTEND_URL`,
`BASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_HOST`,
`SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`.

## Vercel configuration

Root directory: `frontend`.

### The Production Branch is `main`. Feature branches only ever build Previews.

This cost a second production incident on 2026-08-13, immediately after the
first one was fixed. The fix was committed, pushed, built and verified — on a
**Preview**. The production alias never moved, so the live site kept serving
the broken deployment and every check that targeted the preview said "fixed".

Pushing to `redesign/ui-foundation` (or any feature branch) creates a Preview
deployment and nothing else. Two things follow:

- **A preview passing is not evidence that production is fixed.** Verify
  against `https://construction-portal-one.vercel.app` itself — the live CSP,
  the deployment id, and the browser state. Nowhere else counts.
- **To ship, `main` has to move.** The feature branch is normally a strict
  descendant of `main`, so this is a fast-forward:

  ```
  git push origin redesign/ui-foundation:main
  ```

  Never force. If Git rejects it, the branches have diverged and that needs
  resolving deliberately, not with `--force`.

A deployment can also be promoted by hand in the Vercel dashboard — which is
how `b5ba26d` reached production, and why `main` had drifted 133 commits
behind what production was actually serving. Prefer moving `main`: a hand
promotion leaves no record in Git of what production runs.

Declared in `frontend/vercel.json`: an SPA rewrite (`/(.*)` → `/index.html`)
plus security headers (CSP, HSTS, X-Frame-Options, Permissions-Policy).
`camera=(self)` is **intentional** — the site-operations screen captures
material photos directly from the camera.

> ⚠️ **`VITE_API_URL` must be set in the Vercel dashboard.** `frontend/.env`
> is gitignored, so it is not in the repository Vercel builds from. If the
> variable is missing, the build silently falls back to
> `http://127.0.0.1:5051/api` and the deployed app calls the *visitor's own
> machine*. The symptom is a CSP error on every request.
>
> A **rebuild** is required — redeploying an existing build keeps the old
> baked-in value.

### Three things must agree

1. `VITE_API_URL` (Vercel dashboard)
2. `connect-src` in `frontend/vercel.json`
3. `CORS_ORIGINS` on the backend (which lists the **frontend** origin)

Get any one wrong and the browser blocks every call before it is sent.

### `script-src` must keep `'wasm-unsafe-eval'`

The Login world's GLB layers are meshopt-compressed, and meshopt decodes
through **WebAssembly**. Under CSP, compiling a WASM module counts as script
evaluation, so `script-src 'self'` alone blocks it.

This cost a production incident on 2026-08-13. Every symptom pointed away from
the truth: all five layers returned `200`, `model/gltf-binary`, correct
`glTF` magic bytes and byte-identical lengths to local, so `curl` said the
deploy was perfect. They failed *after* the fetch, at decode. The dev server
sends no CSP and `vite preview` does not read `vercel.json`, so this is a
header no local workflow had ever applied.

`'wasm-unsafe-eval'` is deliberately **not** `'unsafe-eval'`: it permits
WebAssembly compilation and nothing else, leaving JavaScript `eval()` and
`new Function()` still blocked. Do not "simplify" it to `'unsafe-eval'`.

`worker-src` is deliberately absent. `MeshoptDecoder.useWorkers()` is never
called (see `frontend/src/world/assets.js`), so the decoder's blob-worker path
never runs and the permission is not needed. If workers are ever enabled, this
policy needs `worker-src blob:` and will fail the same silent way without it.

Reproduce either arm without deploying:

```
cd frontend && npm run build
node tools/fresh_ui/csp_repro.mjs --old   # serves dist under the broken policy
node tools/fresh_ui/csp_repro.mjs         # serves dist under the committed one
```

## Supabase configuration

1. Create the project; copy the connection URI into `DATABASE_URL`.
2. Apply the migrations (above).
3. Create the storage bucket `construction-files`.
4. Copy the service-role key into `SUPABASE_SERVICE_ROLE_KEY`.
5. Set `DB_SSL_CA` — see below. Without it the backend will not boot.

### TLS to Supabase — `DB_SSL_CA` is mandatory

If the deploy fails with:

```
Backend startup failed: Error: self-signed certificate in certificate chain
    at .../database/pool.js:175
  code: 'SELF_SIGNED_CERT_IN_CHAIN'
```

…the configuration arrived and the app got as far as opening the database
connection. Supabase does not use a publicly trusted certificate. Its
Postgres endpoint presents:

```
  leaf          CN=*.pooler.supabase.com
  intermediate  CN=Supabase Intermediate 2021 CA
  root          CN=Supabase Root 2021 CA      <- self-signed, not in any
                                                 public trust store
```

`DB_SSL=true` with no `DB_SSL_CA` verifies against the system trust store,
which does not contain that root, so the chain is rejected.

**Get the certificate:** Supabase Dashboard → Project Settings → Database →
SSL Configuration → Download certificate. You get `prod-ca-2021.crt`.

Verify it before pasting it anywhere:

```bash
openssl x509 -in prod-ca-2021.crt -noout -subject -dates -fingerprint -sha256
```

Expected:

```
subject=C=US, ST=Delware, L=New Castle, O=Supabase Inc, CN=Supabase Root 2021 CA
notBefore=Apr 28 10:56:53 2021 GMT
notAfter=Apr 26 10:56:53 2031 GMT
sha256 Fingerprint=80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
```

Only the root is needed — the server sends the intermediate itself.

`DB_SSL_CA` is multi-line. Paste the **entire** PEM into Render's value box
as-is, `BEGIN`/`END` lines included. Render keeps the newlines. Do not
convert them to `\n`; the PEM goes to Node's TLS layer verbatim and an
escaped one will not parse.

> ⏰ **That certificate expires 26 April 2031.** Nothing warns you — the
> deploy simply starts failing with the same `SELF_SIGNED_CERT_IN_CHAIN`
> error. If Supabase rotates the root before then, re-download and update
> the variable.

**There is deliberately no escape hatch.**
`DB_SSL_REJECT_UNAUTHORIZED=false` **throws at startup** when
`NODE_ENV=production`, because an unverified TLS connection is encrypted but
not authenticated, and the point of running TLS to the database is that it
is both.

### `injected env (0) from .env` is expected

That log line on Render is harmless. There is no `.env` file in the image —
configuration comes from the dashboard. A successful boot looks like:

```
◇ injected env (0) from .env
Database connected: { database: '...', ... }
Construction Portal API running on port 10000
```

## Database role configuration and RLS requirements

> **RLS is not live until `DATABASE_URL` connects as `construction_app`.**

As long as the API connects as `postgres`, the policies from migration 003
do nothing — `postgres` bypasses row-level security. The running server says
so on boot:

```
[database] Connected as a role that BYPASSES row-level security (postgres).
The migration 003 policies have no effect; tenant isolation rests entirely
on the WHERE clauses in the application.
```

**Repointing `DATABASE_URL` is not a one-line switch.** The policies compare
every row against the `app.company_id` session variable, and something must
set it on the connection running the query. That now happens automatically:
`authMiddleware` binds the company into an `AsyncLocalStorage` context
(`database/tenantContext.js`) and `pool.query` / `withTransaction` read it
back and issue `SET LOCAL`.

The failure mode is silent and `npm test` cannot see it: with no context,
writes raise `42501` and **reads return zero rows rather than erroring**.
Before any deploy that repoints `DATABASE_URL`:

```bash
cd backend && node scripts/verifyTenantContext.js
```

It builds a scratch database with 003's policy shape, drives the real query
paths as a role that cannot bypass RLS, and exits non-zero if the context is
not arriving.

### Switching to the `construction_app` role

After running migration 003:

```sql
ALTER ROLE construction_app WITH PASSWORD 'a-long-random-password';
```

Then repoint `DATABASE_URL` at that role — and run
`verifyTenantContext.js` before the deploy, not after.

Application-level tenant filtering works either way; RLS is the second layer
that makes a forgotten `WHERE` clause return **nothing** instead of
everything.

## CORS configuration

`CORS_ORIGINS` is an exact-match, comma-separated allow-list — no wildcards,
no prefix matching, no regex (deliberate: `/example\.com$/` would also match
`evil-example.com`). Requests with no `Origin` header are allowed, because
CORS is a browser mechanism and blocking them would break health checks and
`curl` without protecting anything.

## JWT requirements

- `JWT_SECRET` must be **≥32 characters** or the app refuses to start.
- Generate with `openssl rand -base64 48`.
- Rotating it invalidates every outstanding session.

## Deployment order

1. Apply migrations to the database.
2. Deploy the backend (Render) and confirm `/api/health`.
3. Set `VITE_API_URL` in Vercel, then deploy the frontend with a **rebuild**.
4. Confirm `CORS_ORIGINS` contains the frontend origin.
5. Log in and load one page from each role.

Database first, backend second, frontend last — the frontend is the only
component that fails visibly, so it should be the last to change.

## Rollback process

| Component | How |
|---|---|
| Frontend | Vercel dashboard → Deployments → promote the previous build |
| Backend | Render dashboard → Events → roll back to the previous deploy |
| Database | **No automated rollback.** Take a `pg_dump` before every migration |

```bash
pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%Y%m%d-%H%M).dump
```

`*.dump` is gitignored. Migrations are forward-only; none has a `down` step.

---

# Maintenance

## Known issues

| Issue | Impact | Status |
|---|---|---|
| ~~1 failing test~~ | — | **Resolved** — environmental, not a defect (see *Testing*) |
| ~~Bundle ~1.95 MB~~ | — | **Fixed** — 456 kB entry chunk, route-level code splitting |
| Eight pages exceed 1,000 lines | Hard to change safely | Open |
| Audit trail records outcomes, not diffs | Cannot answer "what was it before" | By design (F-05) |
| `npm audit`: `react-router` CSRF-in-RSC, `xlsx` prototype pollution + ReDoS | **Neither applies here** — no RSC mode; no `XLSX.read` call anywhere | Monitored |
| ~~Two default timezones disagree~~ | — | **Fixed** — both `Asia/Kolkata`, pinned by a test |
| **`backend/.env` has `DEFAULT_TIMEZONE=India/Kolkata`** | Not a valid IANA zone. Code now warns and falls back, but **correct it by hand** | **Manual action required** |
| Subcontractor bank details stored in plain text | `worker_sensitive_details` has encrypted columns; `subcontractors` does not | Open (F-12, partially fixed) |

## Known technical debt

- **No frontend tests.** Static analysis and a build are the only net. The
  two duplicate-hook defects were structural and verified by grep + build,
  but a component test runner is still missing.
- **CI exists** (`.github/workflows/ci.yml`, 3 jobs) but has never run on a
  real push from this machine — verify the first run.
- **Pagination exists in the API and is not used by the screens.**
- **Duplicate collection-hook instances** in `WorkersPage` and
  `InvoicesPage` (see below) — a live correctness bug.

## Stale Code & Technical Debt

Every finding from `STALE_UNUSED_CODE_AUDIT.md`, summarised. Full evidence
is in that document.

### Priority 1 — Operational (a new developer cannot deploy from the docs)

| File | Problem | Risk | Recommendation | Priority |
|---|---|---|---|---|
| `DEPLOYMENT.md` | Was a 0-byte file while `HANDOVER.md:28` sent readers to it | Nobody could deploy from the documentation | **Fixed by this document** | P1 |
| `backend/.env.example` | 0 bytes. All 37 variables the backend reads are absent | A new environment is configured by guesswork | Populate with all 37 names, no values | P1 |
| `backend/database/migrations/README.md` | **Does not exist**, but `HANDOVER.md:30` and `backend/database/README.md:14,20` both point at it | Migration order undocumented; 005 gets skipped on fresh installs | Recreate, or rely on *Migration process* above | P1 |
| `backend/database/snapshots/schema-production.sql` | Referenced by `backend/database/README.md:15` and `.gitignore:96`; not tracked | Broken pointer | Remove the references | P2 |

### Priority 2 — Correctness

| File | Problem | Risk | Recommendation | Priority |
|---|---|---|---|---|
| `frontend/src/pages/WorkersPage.jsx:55` | Calls `useWorkers(user)` while `App.jsx:74` holds a separate copy | Adding a worker does not appear in Dashboard/Reports until a full reload | Thread the App-level instance down, as was done for tenders | **P1** |
| `frontend/src/pages/InvoicesPage.jsx:48` | Same pattern vs. `App.jsx:97` | Adding an invoice does not appear in Dashboard/Reports | Same fix | **P1** |
| `002_baseline_supabase.sql:1671` | Recreates `tender_workers`, which `005` exists to drop | A fresh install rebuilds a dead duplicate table | Do **not** edit the baseline; document that 005 always runs | P2 |

### Priority 3 — Dead code and dead configuration

| File | Problem | Risk | Recommendation | Priority |
|---|---|---|---|---|
| `backend/database/pool.js` | `withTenant`, `tenantQuery` have **zero callers** | Low today, but they relate to RLS enforcement | **Verify before removing** — confirm the `AsyncLocalStorage` path covers every query | P2 |
| `backend/middleware/rateLimiter.js` | `passwordResetLimiter` never mounted | None — `authLimiter` covers the route | Wire it or delete it | P3 |
| `backend/config/mailer.js` | `sendAccountInviteEmail`, `checkMailConnection`, `sendMail` unused; the first carries the unescaped-HTML defect F-07 | Dormant defect | Delete, or wire and fix F-07 | P3 |
| `backend/modules/workers/worker.controller.js` | `getWorkerById` exported, never routed | `GET /api/workers/:id` 404s | Route it or drop the export | P3 |
| `backend/modules/invoices/invoice.controller.js` | `getInvoiceById` — same | `GET /api/invoices/:id` 404s | Route it or drop the export | P3 |
| `backend/modules/tenders/tenderQueries.js` | `getTenderDailyUpdates` unused | None | Remove | P3 |
| `backend/utils/requestContext.js` | 8 exports with no external caller | None | Prune exports (check in-file use first) | P3 |
| `backend/config/constants.js` | 8 constant groups unused. `PAYMENT_TYPES`/`MODES`/`DIRECTIONS` duplicate what `GET /api/payments/hierarchy` serves | Drift between a static copy and the live tree | Remove the payment trio; **keep** `INSPECTION_STATUS`, `MILESTONE_STATUS`, `COMMENT_MODULES` (future tables) | P3 |
| `frontend/src/utils/tenderCalculations.js` | `getTenderValue`, `calculateFinancePreview` uncalled | None | Remove after confirming no dynamic use | P3 |
| `frontend/src/utils/currency.js` | 4 of 5 exports uncalled | None | Prune | P3 |
| `backend/server.js:131` | `tenderRoutes` imported, then line 685 re-requires inline | None | Use the binding | P3 |
| `frontend/package.json` | `@types/react`, `@types/react-dom` with no TypeScript in the repo | None | Remove | P3 |
| `backend/database/.DS_Store` + 2 more | macOS metadata tracked despite `.gitignore` | None | `git rm --cached` | P3 |

### Priority 4 — Duplicates

| Files | Problem | Risk | Recommendation | Priority |
|---|---|---|---|---|
| `tenderDetailsService.js:50`, `tenderWorkerService.js:42` | Two `tenderPath()` helpers with identical validation | Id-handling changes must be made twice | Export one, compose the other | P3 |
| `exportHelpers.js`, `documentExportHelpers.js`, `ledgerExportHelpers.js` | 1,177 lines, overlapping PDF/XLSX concerns. All three **are** reachable | Maintenance cost | Consolidate only with care — three output formats | P4 |
| `auth.css:121-143` | `.password-input-row` / `.password-toggle-button` superseded by `.password-toggle-btn` in `tabs.css` | None | Delete the stale rules | P4 |
| `server.js:741` + `master.routes.js` | `requireOffice` applied twice (F-15) | None | Remove the inner check; fix the banner | P4 |

### Priority 5 — Stale documentation

| File | Problem | Recommendation | Priority |
|---|---|---|---|
| `HANDOVER.md` | "143 passing" (now 215); "Four migration files" (five); `.env.example` listed as built (empty); `site_inspections`/`site_3d_models` listed unused (both referenced in `upload.controller.js:222-231`); "Dead exports 30 → 0" (52 candidates found) | Update the counts; the analysis is still sound | P3 |
| `docs/repository-reference/.pass-status.txt` | Indexes 3 files that do not exist, omits ≥6 that do, 160 entries still `TODO` | Regenerate or archive | P4 |
| `docs/repository-reference/findings.md` F-02 | Cites `.env.example` as declaring a variable; the file is empty | Update the evidence | P4 |
| `frontend/.env.example:42-59` | Contains a second, contradictory copy of its own header | Delete lines 42-59 | P4 |
| `tenderDetailsService.js:5-12` | Documents workers and finance endpoints the file does not call | Correct the banner | P4 |
| `server.js:40` | References a non-existent `npm start` | Correct or add the script | P4 |
| `backend/package.json` | `"main": "index.js"` — no such file (F-01) | Point at `server.js` | P4 |

### Endpoints with no consumer — product decision, not cleanup

Working, tested, unreachable from the UI. **Do not delete without deciding
the feature is dead:**

- `GET/POST/PUT/DELETE /api/tenders/:id/finance` + `/finance/summary` (5)
- `PUT` on tender documents, materials, banking, workers (4)
- `GET /api/upload`, `GET /api/upload/:id`, `DELETE /api/upload/:id` — a file manager
- `PUT /api/company`, member role change, member removal, ownership transfer — company administration
- `PUT`/`DELETE` on site-operations labour and materials — supervisors cannot correct a mistyped entry

## Unused code summary

| Category | Count |
|---|---|
| Whole unused files | **0** |
| Empty tracked files | 2 |
| Unused exported symbols | 52 candidates, ≥20 verified |
| Unused CSS classes | ~46 (of 57 flagged; 11 are built dynamically) |
| Unused npm packages | 2 |
| Endpoints with no internal consumer | ~20 |
| Tables with no code consumer | 12 (all classified **FUTURE**) |
| `className` with no CSS rule | **0** — verified |
| Orphaned modules | **0** — verified |

## Files requiring cleanup

Ranked: `backend/.env.example` → `WorkersPage.jsx` / `InvoicesPage.jsx` →
`HANDOVER.md` counts → `config/constants.js` → `.DS_Store` ×3 →
`frontend/package.json` → `auth.css`.

## Future improvements

- Add a CI workflow (lint + test on every push).
- Add ESLint to `backend/`.
- Add a frontend test runner.
- Code-split the bundle.
- Build the screens for the orphaned endpoints above, or remove them.
- Encrypt subcontractor bank details at rest, matching
  `worker_sensitive_details`.
- Thread the **company's own** timezone through `checkEntryWindow` instead of
  the global `DEFAULT_TIMEZONE` (F-13 remaining action).

## Security considerations

1. **Rotate the four credentials that were committed to a public repo.**
   `backend/.env` was committed from the first commit; removing it does not
   un-publish it. See *Password rotation checklist*.
2. **Never set `BREAK_GLASS_ADMIN_*` in a deployed environment** — it is a
   standing authentication bypass. `render.yaml` deliberately omits them.
3. **`company_id` comes from the session, never the request body.** Use
   `utils/scopedCrud.js` for new CRUD modules; it makes the mistake
   structurally impossible.
4. **Authentication is not authorisation.** A new register goes behind
   `requireOffice` in `server.js` unless a worker or subcontractor genuinely
   needs it.
5. **Run the isolation and role tests before shipping anything that touches a
   query.** Between them they previously found four leaking modules and
   twelve open registers.
6. `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS completely — treat it as the most
   sensitive value in the system.
7. Subcontractor payment identifiers are masked in list responses;
   `GET /api/subcontractors/:id` is admin-only and the only source of
   unmasked values.

## Important database notes

- `DATE` columns come back as `"YYYY-MM-DD"` strings. Do not convert them.
- `company_id` is `NOT NULL` on 35 tables. Write it explicitly.
- `clients` has **no** `is_deleted` column — it uses `status`. Filtering on
  the missing column raises `42703` (F-16).
- Twelve tables are schema-ahead-of-code (`ai_conversations`, `ai_insights`,
  `inventory_items`, `inventory_transactions`, `tender_milestones`,
  `site_model_annotations`, `tags`, `tag_assignments`, `saved_reports`,
  `user_settings`, `comments`, `worker_sensitive_details`). **Do not drop
  them** — dropping destroys design intent.
- `labour.category_local` is created but never populated; the seed fills
  `labour_categories.name_local` instead (F-06).

## Recovery procedures

| Situation | Action |
|---|---|
| Locked out of every admin account | Set `BREAK_GLASS_ADMIN_*` **locally**, run `node backend/scripts/createBreakGlassAdmin.js`, log in, fix the account, then unset |
| Suspect the database is misconfigured | `node backend/database/check-database.js` |
| Suspect RLS context is not arriving | `node backend/scripts/verifyTenantContext.js` |
| Deploy is failing on boot | Check Render logs for `Backend startup failed` — the app exits non-zero rather than serving 500s |
| Frontend calls localhost in production | `VITE_API_URL` is unset in Vercel. Set it and **rebuild** |

## Break-glass account information

`backend/scripts/createBreakGlassAdmin.js` creates an administrator from
three environment variables: `BREAK_GLASS_ADMIN_EMAIL`,
`BREAK_GLASS_ADMIN_PASSWORD`, `BREAK_GLASS_ADMIN_COMPANY_ID`.

**No secrets are recorded in this document.**

Rules:

- Use it locally, or in a maintenance window, and unset afterwards.
- Leaving these set in a deployed environment is a standing bypass.
- `render.yaml` deliberately ends without them, with a comment saying why.

## Password rotation checklist

From `HANDOVER.md` — `backend/.env` was committed to a **public** repository
from the first commit.

- [ ] `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Settings → API. *Worst of the four; bypasses RLS completely.*
- [ ] Database password — Supabase → Settings → Database. Update `DATABASE_URL` in Render.
- [ ] `JWT_SECRET` — `openssl rand -base64 48`. Invalidates all sessions.
- [ ] `BREAK_GLASS_ADMIN_PASSWORD` — change, then leave unset in deployments.
- [ ] Confirm `backend/.env` is no longer tracked: `git ls-files | grep "backend/.env$"` → empty.

## Deployment checklist

- [ ] `pg_dump` backup taken
- [ ] Migrations applied in order, **including 005**
- [ ] `node scripts/verifyTenantContext.js` exits 0 (mandatory if `DATABASE_URL` changed)
- [ ] `cd backend && npm test`
- [ ] `cd frontend && npm run lint && npm run build`
- [ ] `VITE_API_URL` set in Vercel; a **rebuild** triggered
- [ ] `CORS_ORIGINS` contains the frontend origin
- [ ] `connect-src` in `vercel.json` contains the backend origin
- [ ] `JWT_SECRET` ≥32 chars
- [ ] `BREAK_GLASS_ADMIN_*` **unset**
- [ ] `/api/health` returns 200 after deploy

## Verification checklist

After deploying:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<api>/api/health     # 200
curl -s https://<api>/ | head                                          # env + timestamp
```

- [ ] Log in as admin — dashboard loads with data
- [ ] Log in as worker — lands on `/worker-portal`, sees own assignments
- [ ] Log in as subcontractor — lands on `/subcontractor-portal`
- [ ] Create a tender — it appears in the Finance tender picker **without a reload**
- [ ] Upload a file — it reaches Supabase Storage
- [ ] Password reset — email arrives (or the link is logged if SMTP is unset)
- [ ] No CSP errors in the browser console

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| CSP error on every request in production | `VITE_API_URL` unset in Vercel; build fell back to `127.0.0.1:5051` | Set it, **rebuild** |
| Every browser request blocked by CORS | Frontend origin missing from `CORS_ORIGINS` | Add it, redeploy the backend |
| `injected env (0)` on Render | Environment variables never set in the dashboard | Set them; `render.yaml` lists every name |
| Reads return zero rows after repointing `DATABASE_URL` | RLS active, session context not arriving | `node scripts/verifyTenantContext.js` |
| Writes raise `42501` | Same cause | Same |
| `23502 null value in column "company_id"` | An INSERT omitted it | Write it explicitly from the session |
| `42703 column does not exist` | Query names a column that was never added — e.g. `clients.is_deleted` | Check the migration that should have added it |
| Dates off by one day | Something converted a `DATE` string to a `Date` | Keep them as `"YYYY-MM-DD"` strings |
| Rate-limited after 10 failed logins | `authLimiter` working as designed | Wait out `RATE_LIMIT_WINDOW_MS` |
| New worker/invoice missing from Dashboard | The duplicate-hook bug above | Reload; fix properly with the tenders pattern |
| Vite starts on 5174 instead of 5173 | Port in use | Harmless; use the printed URL |

## Performance observations

| Observation | Detail |
|---|---|
| Bundle ~1.95 MB (561 kB gzipped) | Single chunk, no code splitting |
| Vite build ~500 ms | Fast |
| Test suite ~46 s | 215 tests against a real database |
| Eight pages exceed 1,000 lines | Largest: `tenderQueries.js` 3,620; `tender.service.js` 2,774 |
| API paginates; screens request everything | Will degrade as data grows |
| `keepAliveTimeout` 65 s > balancer idle | Deliberate — prevents random 502s behind Render |
| **Render free tier sleeps after inactivity** | First request after idle takes 30–50 s |
| **Free PostgreSQL instances expire after 90 days** | Fine for testing; plan before real users |

## Monitoring recommendations

1. **Health check** — Render already polls `/api/health`. Alert on failure.
2. **`X-Request-Id`** — set per request by `requestLogger` and exposed to the
   browser. Capture it in any user-facing error report; it is the key to
   correlating a complaint with a server log.
3. **Watch for `42501` and zero-row reads** after any `DATABASE_URL` change —
   the one database failure this application cannot detect on its own.
4. **Watch `unhandledRejection` log lines.** They are deliberately non-fatal
   (usually a fire-and-forget audit or notification write), so they are
   invisible unless someone reads the logs.
5. **Track `activity_logs` growth.** It is retained longer and read more
   widely than the records it describes.
6. **Re-run the drift checks** in `STALE_UNUSED_CODE_AUDIT.md` §13 after any
   routing change — an endpoint and a screen disagreeing has been the single
   most common fault in this codebase.

---

*Last verified 2026-08-05 against commit `a6c8a01`. Frontend lint and build
pass; backend tests 214/215.*


---

# UI / UX System

Full detail in `UI_UX_AUDIT.md`. This is the operating summary.

## CSS architecture

`frontend/src/index.css` is the **only** stylesheet entry point. Cascade
order is the mechanism — general to specific:

```
1 core/tokens.css       118 design tokens. No selectors.
2 core/foundation.css   reset + shared primitives (panel, card, button,
                        table, form, badge, tabs, alert)
3 core/shell.css        sidebar, topbar, drawer, page container
4 core/utilities.css, core/animations.css, components/*.css
5 pages/*.css           genuinely page-specific rules only
6 core/responsive.css   cross-cutting, last so it wins
```

`main.jsx` imports `index.css` and nothing else. It previously re-imported
all 18 sheets, so each was parsed twice and one page's sheet
(`site-operations.css`) was loaded *only* from there — which is how that
page drifted into its own visual conventions.

## Design tokens

Everything visual comes from `core/tokens.css`. **Do not write a raw hex,
pixel padding or duration in a component.**

| Group | Prefix | Example |
|---|---|---|
| Backgrounds | `--bg-*` | `--bg-surface` |
| Text | `--text-*` | `--text-muted` |
| Borders | `--border-*` | `--border-subtle` |
| Status | `--status-*` | `--status-success-bg` |
| Spacing | `--space-*` | `--space-4` (16px, 4px scale) |
| Type | `--font-size-*` | `--font-size-base` |
| Radii | `--radius-*` | `--radius-md` |
| Elevation | `--shadow-*` | `--shadow-sm` |
| Motion | `--dur-*` | `--dur-fast` |
| Layers | `--z-*` | `--z-modal` |

**There are no legacy aliases left.** `--primary`, `--danger`, `--text`,
`--muted`, `--border`, `--panel-bg`, `--blue-dark`, `--input-border`,
`--shadow-panel`, `--success-light`, `--blue-light`, the three `--accent-brand*`
names and the `--transition-fast` / `--transition-med` / `--ease-pro` motion
scale were all retired in AUD-014. They no longer resolve, so a `var(--muted)`
added from muscle memory silently falls back to the inherited or initial value
rather than the colour you meant — grey text turns black, a border disappears,
and nothing errors. Three tests in `tests/portals-and-tables.spec.js` fail if
any of those names is redeclared or referenced.

Motion is the one place this bites hardest: `prefers-reduced-motion` is honoured
by collapsing `--dur-*` to `0ms`, so a hard-coded duration opts the user out of
their own accessibility setting. Use `--transition-base`, or `--dur-*` with
`--ease-out` / `--ease-bounce`.

**Two rules that are load-bearing:**

- Inputs must stay at `--font-size-md` (16px). Anything smaller makes iOS
  Safari zoom on focus, which leaves the page scrolled sideways.
- `--touch-target` (44px) is the floor for anything tappable. A browser test
  enforces it.

## Responsive breakpoints

Mobile-first. Base rules target **320px**; queries are `min-width`.

| Breakpoint | Purpose |
|---|---|
| 480px | Summary tiles go multi-column |
| 640px | Form grids and toolbars go inline |
| 768px | Table card-transform boundary |
| 900px | Auth two-column split |
| 1024px | **Sidebar becomes permanent**; drawer retired |
| 1280px | Tile density increases |

## Navigation

Below 1024px the sidebar is an off-canvas drawer behind a menu button; at
and above 1024px it is permanent and the toggle is hidden. State lives in
`AppLayout.jsx`, which also provides Escape-to-close, a focus trap, focus
restore, body scroll lock, and close-on-route-change.

## Accessibility conventions

- Skip link is the first tab stop on every authenticated page.
- `:focus-visible` ring on everything; never remove an outline without one.
- Status is never colour alone — badges keep their text label.
- Icon-only controls carry `aria-label`.
- Reduced motion is handled globally by zeroing the duration tokens.

## Adding a new page consistently

1. Use the existing primitives: `.panel`, `.card`, `.summary-cards`,
   `.section-title-row`, `.form-grid`, `.table-wrapper`, `.badge`,
   `.muted-text`. They are already styled and responsive.
2. Do not add a page stylesheet unless the page has genuinely unique
   layout. If you do, add it to section 5 of `index.css`.
3. Use tokens for every value.
4. Register the route in `AppRoutes.jsx` with `lazy()` — the entry bundle
   depends on it.

## Adding mobile behaviour to a table

Default is horizontal scroll (`.table-wrapper`) — right for dense financial
tables. For a table read one record at a time:

```jsx
<div className="table-wrapper table-wrapper--cards">
  <table>
    <thead>...</thead>
    <tbody>
      <tr>
        <td data-label="Tender">{row.title}</td>
        <td data-label="Status"><span className="badge green">{row.status}</span></td>
      </tr>
    </tbody>
  </table>
</div>
```

Below 768px each row becomes a card using `data-label` as the field name.
A table without `data-label` still renders correctly, so this can be
adopted per page.

## How the UI/UX skill is installed

```bash
npx ui-ux-pro-max-cli@latest init --ai claude   # from the repo root
```

Installs 146 files into `.claude/skills/`. Query it with:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "data table" --domain ux
```

Update with `npx ui-ux-pro-max-cli@latest update`. Requires Python 3.

## How 21st.dev is used

Wired in as an **MCP server** (see `.mcp.json`). It authenticates
interactively, so connect it from an interactive session with `/mcp` in
Claude Code, or `claude mcp` from a shell. A headless or cron run will not
have it.

### Quota — this matters

The account is **free tier**. Check before planning work:

- `mcp__21st__search`, `search_picker`, `get_inspiration` and every list /
  metadata tool are **free and unmetered**.
- `mcp__21st__get_component` (the actual component code) is limited to
  **2 retrievals per day**. `mcp__21st__get_usage` reports what is left.

**Compare search metadata and previews first; spend a retrieval only when a
component is genuinely going to be adapted.** The last full UI pass ran 13
searches across ~80 components and spent zero retrievals — the metadata was
enough to classify every candidate.

### Why its code is adapted, never installed

The registry is **shadcn/ui + Tailwind CSS**. This project is React 19 +
Vite with hand-written CSS: no `tailwind.config`, no `components.json`, no
Radix. Running the `npx shadcn@latest add …` command shown in a search
result would pull in a second, conflicting design system.

The workflow is:

1. Search, and read the metadata, preview image and video.
2. Classify: *adapt to this stack* / *visual reference only* / *reject*.
3. For anything worth taking, re-implement the **pattern** — the layout,
   the interaction, the accessibility behaviour — against the tokens in
   `DESIGN_SYSTEM.md`.
4. Never add a dependency for appearance alone.

**A full Tailwind or shadcn migration requires explicit owner approval.**

### No secrets

The `installCommand` in search results contains a literal
`?api_key=$API_KEY_21ST` placeholder. Do not expand it, commit it, or paste
a real key into source. Credentials belong in the MCP server config only.

## Shared presentation components

| Component | Where | Use for |
|---|---|---|
| `ui/Icon` | `components/ui/Icon.jsx` | All 28 glyphs. Inline SVG, no dependency. Never use an emoji as an icon. |
| `ui/ResponsiveTable` | `components/ui/ResponsiveTable.jsx` | Every data table. Pick `mobile="cards"` or `mobile="scroll"` — see DESIGN_SYSTEM.md §5. |
| `activity/ActivityStream` | `components/activity/ActivityStream.jsx` | Date-grouped audit trails with expandable metadata. |
| `auth/AuthShell` + `AuthLink` | `components/auth/AuthShell.jsx` | All four unauthenticated screens. See DESIGN_SYSTEM.md §15. |
| `portal/PortalPrimitives` | `components/portal/PortalPrimitives.jsx` | Both field-user portals: `PortalHeader`, `CurrentAssignmentCard` (worker), `CurrentProjectCard` (subcontractor), `RequiredActionsPanel`, `PortalSummaryCard`, `PortalSection`. See DESIGN_SYSTEM.md §17. |
| `siteOperations/SiteOpsContext` | `components/siteOperations/SiteOpsContext.jsx` | Site Operations date context card and module tabs. See DESIGN_SYSTEM.md §16. |

**Portal verification.** Both portals need their local fixtures (see below)
and are covered by `tests/portals-and-tables.spec.js` at all nine widths,
including role-guard checks that an admin is rejected and — for the
Subcontractor Portal — that the caller's own `account_number`/`ifsc_code` are
never rendered in any section.

Not yet extracted, and deliberately so: `PageHeader`, `StatusBadge`,
`EmptyState`, `Modal`, `ConfirmDialog`, `Pagination`, `FilterBar`. The two
portals now give several of these a genuine second consumer, so that
extraction is the natural next piece of work — it was deliberately not started
in the portal sessions.

## Responsive verification

Two suites. Both drive a real browser; neither may ever point at production.

```bash
cd frontend
npm run dev                                    # terminal 1
npx playwright test                            # terminal 2 — both suites
npx playwright test tests/responsive.spec.js   # public routes only
```

| Suite | Covers | Assertions |
|---|---|---|
| `tests/responsive.spec.js` | 4 public routes × 8 widths, touch targets, focus | 35 |
| `tests/authenticated.spec.js` | 16 authenticated routes × 9 widths, touch targets, drawer keyboard behaviour, `aria-current` | 164 |

### Running the authenticated suite

It needs a signed-in user, so create a **local-only** fixture first:

```bash
cd backend
BREAK_GLASS_ADMIN_EMAIL="$LOCAL_ADMIN_FIXTURE_EMAIL" \
BREAK_GLASS_ADMIN_PASSWORD="$LOCAL_ADMIN_FIXTURE_PASSWORD" \
BREAK_GLASS_ADMIN_COMPANY_ID=1 \
node scripts/createBreakGlassAdmin.js
```

Use an address that does not already exist — the script upserts on email and
will otherwise **overwrite that user's password and promote them to admin**.

Then start the backend with the rate limiter raised:

```bash
cd backend
RATE_LIMIT_MAX=100000 \
AUTH_RATE_LIMIT_MAX=1000 \
PASSWORD_RESET_RATE_LIMIT_MAX=100000 \
npm start
```

**Three limiters, not two.** `PASSWORD_RESET_RATE_LIMIT_MAX` defaults to **5 per
hour** and is governed by neither of the other two — `middleware/rateLimiter.js`
says it "is never skipped and there is no IP bypass", and its own comment states
it became configurable "ONLY so a local end-to-end run can exercise the recovery
flow more than five times an hour". Without it the `forgot-password` and
`reset-password` specs fail once the suite has requested six resets, which a
full run does easily — and they pass in isolation, so it reads as flakiness
rather than as a limit.

This is not optional. The suite makes ~150 page loads; at the default limit
the backend starts returning 429 partway through, the registers render
empty, and the layout assertions silently stop measuring anything real.

**`AUTH_RATE_LIMIT_MAX` must not exceed 1000.** This line used to read
`AUTH_RATE_LIMIT_MAX=100000` and that silently did the OPPOSITE of what it
says. `config/env.js` bounds it to `{ minimum: 3, maximum: 1000 }`, and
`parseInteger` returns the FALLBACK for an out-of-range value rather than
clamping it — so `100000` resolved to the default of **10**, the most
restrictive setting available, and the suite hit the 429 storm this paragraph
exists to prevent. `RATE_LIMIT_MAX=100000` is fine; its maximum is 100000.

To check rather than trust it, read the policy header the API returns:

```bash
curl -si -X POST http://localhost:5051/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"x","password":"y"}' \
  | grep -i ratelimit-policy
# RateLimit-Policy: 1000;w=900   <- the raised limit is in force
# RateLimit-Policy: 10;w=900     <- it is NOT; the value fell back
```

### Safety

`tests/authenticated.spec.js` **refuses to start** unless both
`E2E_BASE_URL` and `E2E_API_URL` are localhost origins — it signs in as an
admin and walks the whole application. It only reads: no form is submitted
and nothing is created, edited or deleted.

Neither suite runs in CI, which does lint and build only. Both need a live
backend and a seeded login.

### Local portal fixtures

`/worker-portal` and `/subcontractor-portal` are role-gated and need a user
whose `user_id` links to a real `workers` / `subcontractors` row.
`createBreakGlassAdmin.js` cannot make one — it hard-codes `role = 'admin'`.

```bash
cd backend

# create (passwords generated and printed once if not supplied)
LOCAL_WORKER_FIXTURE_PASSWORD='…' \
LOCAL_SUBCONTRACTOR_FIXTURE_PASSWORD='…' \
node scripts/createLocalPortalFixtures.js

# remove everything it created
node scripts/createLocalPortalFixtures.js --cleanup
```

Creates `worker-fixture@local.test` and `subcontractor-fixture@local.test`,
each with a `users` row, a `company_users` membership and the linked
`workers` / `subcontractors` record the portal controllers require.

**Guards.** It refuses to run when `NODE_ENV=production` or when
`DATABASE_URL` is not a localhost host, and it will only ever modify its own
two fixture addresses — unlike `createBreakGlassAdmin.js`, it cannot seize a
real account. No password is committed; values come from the environment or
are generated with `crypto.randomBytes`.

`--cleanup` deletes in FK-safe order (linked record → membership → user) and
touches nothing else.

## Accessibility testing

```bash
cd frontend
npm run test:a11y
```

Runs axe-core (`@axe-core/playwright`, a **devDependency** — it ships nothing
to users) against **22 routes × 2 widths**, tagged `wcag2a wcag2aa wcag21a
wcag21aa`. Needs the admin fixture *and* both portal fixtures.

Currently **44/44 pass with zero exceptions**.

`DOCUMENTED_EXCEPTIONS` at the top of `tests/a11y.spec.js` is deliberately
empty. Do not add to it to make a build green — every entry must name the
rule, the element, the reason and the remediation plan, and have an owner.
axe catches roughly a third of WCAG issues; a pass is a floor, not a
certificate.

## Mobile table strategy

Every data table must declare one. Use `ResponsiveTable`:

```jsx
import ResponsiveTable from "../components/ui/ResponsiveTable";

// One row = one entity → cards on a phone
<ResponsiveTable mobile="cards">
  <table>…</table>
</ResponsiveTable>

// Financial matrix → keep the columns, scroll sideways
<ResponsiveTable mobile="scroll" label="Finance records">
  <table>…</table>
</ResponsiveTable>
```

`data-label` is derived from the `<thead>` automatically — **do not hand-write
it**. Cells with `colSpan > 1` are skipped. See `DESIGN_SYSTEM.md` §5 for
how to choose between the four strategies, and `UI_UX_AUDIT.md` §8 for the
per-table decisions already made.

## Site Operations conventions

The page is **company-and-date scoped**. It has a date-only context card,
scrollable module navigation covering all four modules (Material, Labour,
Banking, Access Requests), and one-column forms below 768px.

**Do not add a tender or site selector.** Site Operations records carry no
tender/site attribution: the API accepts `tender_id`/`site_id` on a material
create (both default to `null`) and offers tender filters on labour and
banking, but the frontend has never sent or filtered by either — every row in
`site_material_entries` has both columns null.

Adding selectors would start writing attribution on new rows only, so any
tender-filtered report would silently exclude all pre-change data, and
material `approval_status` routing could shift. That is a data-migration
decision, not a layout one.

Tracked as **SITE-OPS-DATA-01** in `UI_UX_AUDIT.md` §8d. A test in
`tests/portals-and-tables.spec.js` asserts the selectors stay absent and names
the ticket in its failure message, so the guard explains itself.


## Password reset rate limiting

`POST /api/auth/forgot-password` is guarded by `passwordResetLimiter`, which is
deliberately tighter than the rest of `/api/auth`: it sends email, so it is the
target for both account enumeration and mail-bombing.

| Variable | Production default | Purpose |
|---|---|---|
| `PASSWORD_RESET_RATE_LIMIT_WINDOW_MS` | `3600000` (60 minutes) | Window length |
| `PASSWORD_RESET_RATE_LIMIT_MAX` | `5` | Requests per IP per window |

**Leave both unset in production.** Omitting them reproduces the original
hard-coded behaviour exactly. They exist so a local end-to-end run can exercise
the recovery flow more than five times an hour.

Note that `AUTH_RATE_LIMIT_MAX` does **not** relax this endpoint. That variable
drives `authLimiter`, mounted across `/api/auth`; password reset has its own
stricter limiter on top. Raising only `AUTH_RATE_LIMIT_MAX` and expecting the
recovery flow to be testable is a trap that has already cost one debugging
session.

For a local browser run:

```bash
cd backend
RATE_LIMIT_MAX=100000 \
AUTH_RATE_LIMIT_MAX=100000 \
PASSWORD_RESET_RATE_LIMIT_WINDOW_MS=900000 \
PASSWORD_RESET_RATE_LIMIT_MAX=100000 \
npm start
```

An invalid value falls back to the strict production default rather than
becoming permissive, matching how every other bounded integer in
`config/env.js` behaves. The limiter is never disabled and there is no IP
bypass: a high local value still counts requests, it just does not stop a test
suite mid-run.

The counter lives in an in-memory store, so restarting the backend clears it.


## Testing rule: a destructive auth test must own its account

Established by AUTH-018, which cost 128 failing assertions across unrelated
suites.

Shared fixtures (`createLocalPortalFixtures.js`, `createBreakGlassAdmin.js`)
may be **read** and signed in as. They must NOT be mutated by any test that
resets a password, rotates or consumes a single-use token, changes credentials,
changes a role or membership, triggers lockout behaviour, or destroys and
recreates identity state.

Two independent failure modes make this non-negotiable:

1. **Racing.** The backend stores one `reset_token` per user, so two suites
   minting a token for the same account race and the loser sees an invalid
   token. Such a test passes alone and fails in a parallel run.
2. **Destruction.** A successful reset changes that account's password. If the
   restore fails, every other suite that signs in as that fixture fails too,
   and retrying a wrong password can trip a per-account lockout that makes it
   worse.

Any destructive auth test must create its own disposable user, company or
workspace, act on that, clean it up reliably, and verify zero residue.
`tests/register-contract.spec.js` and `tests/reset-password.spec.js` both do
this; their teardown clears every table carrying `company_id`, discovered from
`information_schema`, before deleting the company and then the user.

Do not weaken this rule to make tests faster.
