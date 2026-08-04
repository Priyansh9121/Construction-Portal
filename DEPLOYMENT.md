# Deployment

## Why your Render deploy is failing

The boot sequence fails in two stages, and you clear them in order.

### Stage 1 — no configuration (fixed once the variables are set)

```
◇ injected env (0) from .env
Error: JWT_SECRET must contain at least 32 characters in production
```

`.env` used to be committed to the repository, which is how Render got its
configuration. It has been removed, because it was published in a public
repo along with the database password, the Supabase service-role key and
the JWT secret. Set the variables in the dashboard instead — see below.

Note that `injected env (0)` is printed by `dotenv` and is **not** an error
on Render. Render puts variables straight into the process environment, so
there is no `.env` file for `dotenv` to find and the count is legitimately
zero. The line stays in the log after everything is working.

### Stage 2 — TLS verification

```
Backend startup failed: Error: self-signed certificate in certificate chain
    at .../database/pool.js:175
  code: 'SELF_SIGNED_CERT_IN_CHAIN'
```

This one means the configuration arrived and the app got as far as opening
the database connection. Supabase does not use a publicly trusted
certificate. Its Postgres endpoint presents:

```
  leaf          CN=*.pooler.supabase.com
  intermediate  CN=Supabase Intermediate 2021 CA
  root          CN=Supabase Root 2021 CA      <- self-signed, not in any
                                                 public trust store
```

`DB_SSL=true` with no `DB_SSL_CA` verifies against the system trust store,
which does not contain that root, so the chain is rejected. **The fix is to
set `DB_SSL_CA`** — see step 2 below.

There is deliberately no escape hatch: `DB_SSL_REJECT_UNAUTHORIZED=false`
throws at startup when `NODE_ENV=production`, because an unverified TLS
connection is encrypted but not authenticated, and the whole point of
running TLS to the database is that it is both.

---

## Fix it in five minutes

### 1. Generate a secret

```bash
openssl rand -base64 48
```

### 2. Get the Supabase CA certificate

Supabase Dashboard → **Project Settings** → **Database** → **SSL
Configuration** → **Download certificate**. You get `prod-ca-2021.crt`,
which is the `Supabase Root 2021 CA` PEM.

Check you have the right file before pasting it anywhere:

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

That certificate expires **26 April 2031**. Nothing warns you; the deploy
just starts failing with the same `SELF_SIGNED_CERT_IN_CHAIN` error, so if
Supabase rotates the root before then, re-download and update the variable.

### 3. Set the variables in Render

Dashboard → your service → **Environment** → **Add Environment Variable**.

The minimum to boot:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | the string from step 1 |
| `DATABASE_URL` | your PostgreSQL connection string |
| `DB_SSL` | `true` |
| `DB_SSL_CA` | the **entire** contents of `prod-ca-2021.crt` from step 2, `BEGIN`/`END` lines included |
| `CORS_ORIGINS` | your frontend URL, e.g. `https://your-app.vercel.app` |

`DB_SSL_CA` is multi-line. Paste it into the value box as-is — Render keeps
the newlines. Do not convert them to `\n`; the PEM is handed to Node's TLS
layer verbatim and an escaped one will not parse.

Add these too, or the matching features stay broken:

| Key | Needed for |
|---|---|
| `FRONTEND_URL` | password-reset links pointing somewhere real |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET` | file uploads |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | password reset actually sending |

`backend/.env.example` documents every supported variable.

### 4. Set the service root

Render must build from `backend/`, not the repository root:

- **Root Directory**: `backend`
- **Build Command**: `npm ci`
- **Start Command**: `node server.js`
- **Health Check Path**: `/api/health`

### 5. Redeploy

Manual Deploy → **Clear build cache & deploy**.

You should see:

```
◇ injected env (0) from .env
Database connected: { database: '...', ... }
Construction Portal API running on port 10000
```

The `injected env (0)` line is expected and harmless — see Stage 1 above.

---

## Rotate the exposed credentials first

These were public in the GitHub repository. Removing the file does not
un-publish them — anything already cloned or indexed still has them.

- [ ] **Supabase service-role key** — Project Settings → API → roll. This one
      is the worst: it bypasses row-level security entirely.
- [ ] **Database password** — Project Settings → Database → reset, then
      update `DATABASE_URL` on Render.
- [ ] **JWT secret** — replace with the new one. Every existing session is
      signed out, which is the point.
- [ ] **Break-glass admin password** — change it, and leave
      `BREAK_GLASS_ADMIN_*` unset in every deployed environment.

---

## Using render.yaml instead

`render.yaml` at the repository root declares the service and every
variable. Render Dashboard → **New** → **Blueprint** → select this repo.

Variables marked `sync: false` still have to be entered once by hand —
that is deliberate, so secrets never live in the repository.

---

## Frontend (Vercel)

Root directory `frontend`. One variable:

```
VITE_API_URL=https://your-api.onrender.com/api
```

Every `VITE_*` value is compiled into the public JavaScript bundle. Never
put a secret there.

`frontend/vercel.json` already sets the security headers (CSP, HSTS,
X-Frame-Options, Permissions-Policy). `camera=(self)` is intentional — the
site-operations screen captures material photos directly from the camera.

---

## Database

Run the migrations before the first deploy against a new database. See
`backend/database/migrations/README.md`.

Short version:

- **Existing database** → `001_upgrade_schema.sql`, then `004_seed_reference_data.sql`
- **Fresh Supabase** → `002_baseline_supabase.sql`, `003_supabase_rls.sql`, `004_seed_reference_data.sql`

### Row-level security

`003` creates a `construction_app` role. **RLS does nothing until
`DATABASE_URL` points at that role** — the `postgres` superuser bypasses
every policy.

After running `003`:

```sql
ALTER ROLE construction_app WITH PASSWORD 'a-long-random-password';
```

Then set `DATABASE_URL` to connect as `construction_app`.

Application-level tenant filtering works either way; RLS is the second
layer that makes a forgotten `WHERE` clause return nothing instead of
everything.

---

## Free tier

Render's free web services sleep after inactivity, so the first request
after idle takes 30–50 seconds. Free PostgreSQL instances expire after 90
days. Neither matters for testing; both matter before real users.

---

## Checklist

- [ ] All four exposed credentials rotated
- [ ] Render environment variables set, service boots
- [ ] `DB_SSL_CA` holds the Supabase root CA, fingerprint checked
- [ ] Root directory is `backend`, health check is `/api/health`
- [ ] Migrations applied
- [ ] `DATABASE_URL` uses `construction_app` (so RLS is live)
- [ ] `CORS_ORIGINS` contains the real frontend URL
- [ ] SMTP configured, password reset tested end to end
- [ ] `VITE_API_URL` on Vercel points at the API
- [ ] `npm test` passes against the deployed database
