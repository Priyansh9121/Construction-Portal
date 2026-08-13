# JSON configuration, annotated

Five files in this repository are strict JSON, which has no comment syntax.
npm rejects a `package.json` containing `//`, and Vercel rejects a
`vercel.json` containing one — so annotating them in place would break
`npm install` and deployment respectively. They are documented here instead.

| File | Purpose |
|---|---|
| `backend/package.json` | API manifest: scripts and dependencies |
| `frontend/package.json` | SPA manifest: scripts and dependencies |
| `backend/package-lock.json` | Exact resolved backend dependency tree |
| `frontend/package-lock.json` | Exact resolved frontend dependency tree |
| `frontend/vercel.json` | Vercel routing, security headers, caching |

---

## backend/package.json

### Metadata

| Field | Value | Meaning |
|---|---|---|
| `name` | `backend` | Package name. Never published, so it only has to be unique locally. |
| `version` | `1.0.0` | Not used for anything — nothing installs this package. |
| `main` | `index.js` | The conventional entry point. **Misleading:** there is no `index.js`; the real entry is `server.js`, which is what `npm run dev` and Render's `startCommand` both run. |
| `type` | `commonjs` | The backend uses `require`/`module.exports`. This is why the Vitest config file is named `.mjs` — it needs ESM, and the `.mjs` extension overrides this setting for that one file. |
| `license` | `ISC` | Scaffold default. |

### Scripts

```
npm run dev          nodemon server.js
```
Development server. `nodemon` watches the source tree and restarts Node on
every save. Use this rather than `node server.js` so the process belongs to
your terminal and survives across sessions.

```
npm test             vitest run
```
Runs every suite in `backend/tests/` once and exits — 17 files, 249 tests as
of 2026-08-10. **These tests hit
a real PostgreSQL database** — the one in `DATABASE_URL` — creating and then
deleting companies namespaced by a per-process run marker. Do not point it
at production.

```
npm run test:watch   vitest
```
The same suites in watch mode, re-running the affected files on save.

### Dependencies (runtime — installed in production)

| Package | Why it is here |
|---|---|
| `express` | The HTTP framework. Version 5, which matters: it leaves `req.body` **undefined** rather than `{}` when a request carries no body, so `server.js` normalises it in middleware. |
| `pg` | PostgreSQL driver. `database/pool.js` wraps it, sets the connection pool bounds, and overrides the `DATE` type parser so calendar dates do not get shifted by a timezone. |
| `bcryptjs` | Password hashing at cost 12. Pure JavaScript rather than the native `bcrypt`, so there is no build toolchain to install on the deploy host. Cost 12 is deliberately slow, which is also why the login endpoint is rate limited. |
| `jsonwebtoken` | Signs and verifies the access tokens. The payload carries `id`, `email`, `role`, `company_id` and `tv` (token version) — the last is compared against `users.token_version` so a password change invalidates tokens already issued. |
| `cors` | Cross-origin headers. The frontend is served from a different origin (Vercel) than the API (Render), so the browser will not talk to it without these. The allowlist comes from `CORS_ORIGINS`. |
| `helmet` | Security response headers — CSP, HSTS, `X-Content-Type-Options`, referrer policy. Configured strictly in `server.js` because this API returns JSON only and never renders a document. |
| `express-rate-limit` | Two limiters: a broad one across `/api`, and a tight one on the credential endpoints. Without the second, bcrypt at cost 12 turns an unauthenticated endpoint into a cheap way to saturate the CPU. |
| `dotenv` | Loads `backend/.env` into `process.env` at startup. On Render the variables come from the dashboard instead and this does nothing. |
| `multer` | Multipart form parsing for uploads. Used in `modules/uploads/upload.middleware.js`, held in memory and streamed on to Supabase Storage rather than written to disk. |
| `@supabase/supabase-js` | Supabase client, used **only** for Storage — uploading and removing files. The database is reached directly through `pg`, not through this client. |
| `nodemailer` | SMTP transport for password-reset email. Without `SMTP_*` configured, `config/mailer.js` logs the link to the console in development and refuses to start in production. |

### Dependencies (development — not installed in production)

| Package | Why it is here |
|---|---|
| `nodemon` | Restart-on-save for `npm run dev`. Never imported; it is a CLI wrapper. |
| `vitest` | Test runner. Configured in `vitest.config.mjs`. |
| `supertest` | Drives the Express app in-process for the tests — no port is bound, so the suites can run alongside a live dev server. |

---

## frontend/package.json

### Metadata

| Field | Value | Meaning |
|---|---|---|
| `name` | `frontend` | Local only. |
| `private` | `true` | Guards against an accidental `npm publish`. |
| `version` | `0.0.0` | Unused; the app is deployed, not published. |
| `type` | `module` | ESM. This is why `import`/`export` work without a build step in the config files. |

### Scripts

```
npm run dev        vite
```
Development server with hot module replacement, on port 5173. That origin is
what `CORS_ORIGINS` in the backend `.env` has to allow.

```
npm run build      vite build
```
Production bundle into `dist/`. Vercel runs this itself on deploy.

```
npm run preview    vite preview
```
Serves the built `dist/` locally — useful for checking a production build
before pushing, since the dev server and the bundle can behave differently.

```
npm run lint       eslint .
```
Currently reports zero problems. The config is `eslint.config.js`.

### Dependencies (runtime — bundled into the app)

| Package | Why it is here |
|---|---|
| `react`, `react-dom` | The UI library. Version 19. |
| `react-router-dom` | Client-side routing. Every route is declared in `src/routes/AppRoutes.jsx`. See the advisory note in HANDOVER.md — the current one concerns RSC mode, which this app does not use. |
| `axios` | HTTP client. `src/api/axiosClient.js` is the single configured instance: it attaches the bearer token and clears storage on a 401. |
| `react-hot-toast` | Toast notifications, used for every success and failure message. |
| `framer-motion` | Animation. Page transitions and the notification panel. |
| `recharts` | The finance trend chart on the dashboard. |
| `jspdf` + `jspdf-autotable` | PDF export. `jspdf` draws the page, `jspdf-autotable` lays out the tables. Used by the export buttons and the bill templates. |
| `xlsx` | Spreadsheet export. **Write-only here** — the only calls are `aoa_to_sheet`, `book_new`, `book_append_sheet`, `encode/decode_cell` and `writeFile`. The open advisories are all in the parser, which this app never reaches. |

### Dependencies (development — not shipped)

| Package | Why it is here |
|---|---|
| `vite` | Build tool and dev server. |
| `@vitejs/plugin-react` | React fast refresh and JSX transform for Vite. |
| `eslint` | Linter. |
| `@eslint/js` | ESLint's own recommended rule set. |
| `eslint-plugin-react-hooks` | The rules of hooks, plus the newer `set-state-in-effect` and `refs` rules. Several real bugs in this codebase were found by these. |
| `eslint-plugin-react-refresh` | Warns when a module exports something other than components, which breaks fast refresh. This is why the auth context and its provider live in separate files. |
| `globals` | Supplies the browser global names to ESLint so `window` and `document` are not flagged as undefined. |
| `@types/react`, `@types/react-dom` | TypeScript declarations. Never imported — the editor reads them for autocomplete and inline documentation in plain JavaScript files. |

---

## The lock files

`backend/package-lock.json` and `frontend/package-lock.json` record the exact
version and integrity hash of every package in the tree, including transitive
ones. They are generated, roughly 8,000 and 40,000 lines respectively, and
should never be hand-edited.

- **Commit them.** They are what makes an install reproducible.
- `npm ci` installs strictly from the lock file and fails if it disagrees
  with `package.json`. This is what Render and Vercel run.
- `npm install` may *update* the lock file. That is fine locally; it means a
  lock file change in a diff is expected whenever a dependency moves.
- Each entry carries an `integrity` hash (SRI). npm verifies the downloaded
  tarball against it, so a tampered package fails the install.

---

## frontend/vercel.json

### `rewrites`

```
/(.*)  ->  /index.html
```

This is what makes a single-page app work on a static host. React Router
owns the URL, but the server has no file at `/tenders/42` — without this
rewrite a refresh or a pasted link would 404. Every path is served
`index.html` and the router takes over in the browser.

### `headers` — applied to every response

| Header | What it does here |
|---|---|
| `Content-Security-Policy` | See below. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` — tells browsers to use HTTPS for this domain for a year, including subdomains, and opts into the preload list. |
| `X-Content-Type-Options: nosniff` | Stops the browser guessing a response's type, which is how a text file gets executed as script. |
| `X-Frame-Options: DENY` | No framing at all. Belt to `frame-ancestors`' braces, for older browsers. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` — sends the full URL within the site, only the origin to other HTTPS sites, and nothing when downgrading to HTTP. Keeps record ids out of third-party logs. |
| `Permissions-Policy` | `camera=(self)` because Site Operations takes photos on the phone; everything else — microphone, payment, USB, motion sensors — is switched off. `geolocation=(self)` is allowed for site work. |
| `X-DNS-Prefetch-Control: off` | Stops the browser resolving hostnames found in the page ahead of time. |

### The Content-Security-Policy, directive by directive

| Directive | Effect |
|---|---|
| `default-src 'self'` | Nothing loads from anywhere but this origin unless a directive below widens it. |
| `script-src 'self' 'wasm-unsafe-eval'` | No inline scripts and no third-party scripts. This is the directive that actually blunts XSS. `'wasm-unsafe-eval'` permits WebAssembly compilation **and nothing else** — `eval()` and `new Function()` stay blocked, which is why it is not `'unsafe-eval'`. It is required because the Login world's GLB layers are meshopt-compressed and meshopt decodes through WASM; without it every layer fetches cleanly and then fails to decode. See DEPLOYMENT.md → "`script-src` must keep `'wasm-unsafe-eval'`". |
| `style-src 'self' 'unsafe-inline'` | Inline styles are allowed because the animation library sets them on elements directly. |
| `img-src 'self' data: blob: https:` | `data:` for inline SVG, `blob:` for the local preview of a photo before upload, `https:` for images served from Supabase Storage. |
| `font-src 'self' data:` | Local fonts only. |
| `connect-src` | Where `fetch`/XHR may go: this origin, any Supabase project, any Vercel preview deployment, and `http://localhost:5051` for local development against the real API. |
| `frame-ancestors 'none'` | This app may not be embedded in an iframe — clickjacking defence. |
| `base-uri 'self'` | Stops injected markup rewriting the document base and redirecting every relative URL. |
| `form-action 'self'` | Forms cannot post to another origin. |
| `object-src 'none'` | No Flash, no applets, no `<embed>`. |
| `upgrade-insecure-requests` | Rewrites any `http://` subresource to `https://`. |

### `headers` — caching

| Path | Cache-Control | Why |
|---|---|---|
| `/assets/(.*)` | `public, max-age=31536000, immutable` | Vite fingerprints these filenames with a content hash, so a changed file gets a new name. They can be cached for a year and never revalidated. |
| `/index.html` | `no-cache, no-store, must-revalidate` | This one file must never be cached, because it is what points at the current fingerprinted bundle. Cache it and a returning user keeps loading the previous release. |
