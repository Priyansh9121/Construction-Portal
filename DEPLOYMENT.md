# Deployment

## Why your Render deploy is failing

```
◇ injected env (0) from .env
Error: JWT_SECRET must contain at least 32 characters in production
```

`injected env (0)` is the important line — **no environment variables
reached the process at all.**

`.env` used to be committed to the repository, which is how Render got its
configuration. It has been removed, because it was published in a public
repo along with the database password, the Supabase service-role key and
the JWT secret.

So the app is behaving correctly: it refuses to start rather than run with
no secret. You just need to give Render the configuration that used to come
from the committed file.

---

## Fix it in five minutes

### 1. Generate a secret

```bash
openssl rand -base64 48
```

### 2. Set the variables in Render

Dashboard → your service → **Environment** → **Add Environment Variable**.

The minimum to boot:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | the string from step 1 |
| `DATABASE_URL` | your PostgreSQL connection string |
| `DB_SSL` | `true` |
| `CORS_ORIGINS` | your frontend URL, e.g. `https://your-app.vercel.app` |

Add these too, or the matching features stay broken:

| Key | Needed for |
|---|---|
| `FRONTEND_URL` | password-reset links pointing somewhere real |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET` | file uploads |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | password reset actually sending |

`backend/.env.example` documents every supported variable.

### 3. Set the service root

Render must build from `backend/`, not the repository root:

- **Root Directory**: `backend`
- **Build Command**: `npm ci`
- **Start Command**: `node server.js`
- **Health Check Path**: `/api/health`

### 4. Redeploy

Manual Deploy → **Clear build cache & deploy**.

You should see:

```
Database connected: { database: '...', ... }
Construction Portal API running on port 10000
```

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
- [ ] Root directory is `backend`, health check is `/api/health`
- [ ] Migrations applied
- [ ] `DATABASE_URL` uses `construction_app` (so RLS is live)
- [ ] `CORS_ORIGINS` contains the real frontend URL
- [ ] SMTP configured, password reset tested end to end
- [ ] `VITE_API_URL` on Vercel points at the API
- [ ] `npm test` passes against the deployed database
