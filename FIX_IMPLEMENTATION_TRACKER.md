# Fix Implementation Tracker

Every actionable finding from `STALE_UNUSED_CODE_AUDIT.md`,
`DEPLOYMENT.md § Stale Code & Technical Debt`, `HANDOVER.md` and
`docs/repository-reference/findings.md`, with its final status.

**Baseline:** commit `9cb1aef`, branch `main`
**Verified at:** 2026-08-05

| Metric | Before | After |
|---|---|---|
| Backend tests | 215 passed (1 intermittent failure) | **222 passed, 0 failed** |
| Backend test files | 13 | 14 |
| Backend lint | **not configured** | **0 errors** |
| Frontend lint | 0 problems | 0 problems |
| Frontend build | passes | passes |
| Frontend entry chunk | 1,948.30 kB (561.87 kB gzip) | **456.00 kB (146.35 kB gzip)** |
| Tracked files | 249 | 246 |
| Tracked `.DS_Store` | 3 | **0** |
| `className` with no CSS rule | 0 | **0** |
| Orphan modules | 0 | **0** |
| Unused-export candidates | 52 | **45** |
| CI | none | **3-job GitHub Actions workflow** |

## Status counts

| Status | Count |
|---|---|
| FIXED | 26 |
| VERIFIED ALREADY FIXED | 4 |
| INTENTIONALLY RETAINED | 12 |
| BLOCKED | 2 |
| **Total** | **44** |

---

## A. Correctness and security

| ID | Finding | Files | Priority | Status | Verification | Notes |
|---|---|---|---|---|---|---|
| A-1 | Duplicate `useWorkers` state — register page held a private copy, so a new worker was invisible to Dashboard/Reports until reload | `App.jsx`, `AppRoutes.jsx`, `WorkersPage.jsx` | P1 | **FIXED** | lint + build pass; `useWorkers(user)` now appears once in `frontend/src` | Single instance in `App.jsx:76`, threaded as props. Same pattern as the tenders fix. |
| A-2 | Duplicate `useInvoices` state — same defect | `App.jsx`, `AppRoutes.jsx`, `InvoicesPage.jsx` | P1 | **FIXED** | as above | Single instance in `App.jsx:104`. |
| A-3 | Duplicate `useTenders` state | `App.jsx`, `AppRoutes.jsx`, `TendersPage.jsx` | P1 | **VERIFIED ALREADY FIXED** | `grep -c "useTenders(user)"` → 1 | Fixed in the session preceding this one. |
| A-4 | **NEW — not in the audit.** `DEFAULT_TIMEZONE=India/Kolkata` is not a valid IANA zone. `entryWindow.service.js:166` catches the `RangeError` and falls back to **UTC**, so the supervisor backdated-entry window resolved dates 5.5 h out — reintroducing F-13 through configuration | `config/env.js` | **P0** | **FIXED** | `tests/environmentTimezone.test.js`, 7 cases; reverting the guard fails 2 of them | Validates through `Intl`. **Throws in production**, warns + falls back to `Asia/Kolkata` elsewhere. |
| A-5 | `passwordResetLimiter` written but never mounted — the one endpoint that sends email ran on the general auth ceiling alone | `middleware/rateLimiter.js`, `modules/auth/auth.routes.js` | P2 | **FIXED** | `grep -n passwordResetLimiter auth.routes.js` → mounted at line 246; 222 tests pass | Wired rather than deleted: 5/hour beats 10/15 min for an enumeration and mail-bombing target. |
| A-6 | Failing test `masters.test.js › refuses a worker` (30 s timeout) | `tests/masters.test.js` | P2 | **VERIFIED ALREADY FIXED** | 222/222 pass in 16.6 s across 3 consecutive runs | **Not a code defect.** Root cause: the dev servers started earlier in the session (PIDs 67556/21856) were competing for CPU, and `createMember` does pure-JS bcrypt at cost 12. Timeout not raised; nothing skipped. |
| A-7 | Empty `catch {}` swallowed a cleanup failure in the RLS proof harness | `scripts/verifyTenantContext.js:197` | P3 | **FIXED** | backend lint clean (`no-empty`) | Now logs which scratch database was orphaned. |
| A-8 | F-14 — `worker_id`/`subcontractor_id` on a site log are not ownership-checked | `modules/siteLogs/siteLog.controller.js` | P2 | **BLOCKED** | — | See *Blocked* below. |
| A-9 | F-12 remaining action — subcontractor bank details in plain text | `modules/subcontractors/`, schema | P2 | **BLOCKED** | — | See *Blocked* below. |
| A-10 | F-15 — masters router documents looser access than it has; `requireOffice` applied twice | `modules/masters/master.routes.js`, `server.js` | P4 | **INTENTIONALLY RETAINED** | — | The duplicate check is defence in depth on a mount whose role list is most likely to diverge. Removing it saves nothing and loses a guard. The stale *comment* is the real issue and is recorded in the audit. |

## B. Operational documentation

| ID | Finding | Files | Priority | Status | Verification | Notes |
|---|---|---|---|---|---|---|
| B-1 | `backend/.env.example` empty (0 bytes) — all 37 read variables undocumented | `backend/.env.example` | P1 | **FIXED** | Script diff of `config/env.js` reads vs template: **0 missing** | 41 entries, every one commented, `[REQUIRED]`/`[PROD]`/`[OPTIONAL]` marked. **No secrets** — verified by scan. |
| B-2 | `backend/database/migrations/README.md` missing, though `HANDOVER.md:30` and `database/README.md` both point at it | new file | P1 | **FIXED** | File exists; both pointers now resolve | Documents fresh vs existing paths, **why 005 must run after 002**, backup/restore, `construction_app`, RLS verification, rollback limits. |
| B-3 | `DEPLOYMENT.md` empty in working tree (235 lines in `HEAD`) | `DEPLOYMENT.md` | P1 | **FIXED** | `git show HEAD:DEPLOYMENT.md` content recovered and merged | Committed TLS/CA procedure preserved; guide rewritten around it. |
| B-4 | `database/README.md` lists `schema.sql` and `snapshots/schema-production.sql`, neither tracked | `backend/database/README.md` | P2 | **FIXED** | `git ls-files` — no such paths; rows removed | |
| B-5 | `.gitignore:96` refers to "the tracked `schema-production.sql`" | `.gitignore` | P4 | **FIXED** | comment corrected | |
| B-6 | `HANDOVER.md` "143 passing" | `HANDOVER.md` | P3 | **FIXED** | now 222, with a note that the count has grown | |
| B-7 | `HANDOVER.md` "Four migration files" (there are five) | `HANDOVER.md` | P3 | **FIXED** | corrected to five | |
| B-8 | `HANDOVER.md` "Dead exports 30 → 0" | `HANDOVER.md` | P3 | **FIXED** | changed to "see note"; audit carries the real figure (45) | |
| B-9 | `HANDOVER.md` lists `site_inspections`/`site_3d_models` as unused | `HANDOVER.md` | P4 | **INTENTIONALLY RETAINED** | `upload.controller.js:222-231` references both | Correction recorded in the audit §9.2 rather than rewriting the historical narrative, which is a point-in-time record. |
| B-10 | `frontend/.env.example` contains a second contradictory copy of its own header | `frontend/.env.example` | P4 | **INTENTIONALLY RETAINED** | — | Cosmetic duplication in a template that works. Recorded in audit S-04; not worth a change that could disturb a file people copy verbatim. |
| B-11 | `tenderDetailsService.js:5-12` banner documents workers + finance endpoints the file does not call | `tenderDetailsService.js` | P4 | **INTENTIONALLY RETAINED** | — | Left for the same reason as B-10 — recorded, low value. |
| B-12 | `server.js:40` references a non-existent `npm start` | `backend/package.json` | P4 | **FIXED** | `npm run start` now exists | Resolved by *adding* the script rather than editing the comment; Render still uses `node server.js`. |
| B-13 | F-01 — `package.json` `"main": "index.js"`, no such file | `backend/package.json` | P4 | **FIXED** | `"main": "server.js"` | |

## C. Static analysis and CI

| ID | Finding | Files | Priority | Status | Verification | Notes |
|---|---|---|---|---|---|---|
| C-1 | No backend linter — ~100 modules unchecked | `backend/eslint.config.js` | P2 | **FIXED** | `npm run lint` → **0 errors** | CommonJS + Node globals; Vitest globals for `tests/**`. Found 8 real issues on first run. |
| C-2 | No CI | `.github/workflows/ci.yml` | P2 | **FIXED** | Parsed with PyYAML: 3 jobs, valid | `frontend` (lint+build), `backend-lint`, `backend-tests` against an **ephemeral Postgres service container**. No secrets; `DATABASE_URL` hard-coded to localhost so production can never be targeted. |
| C-3 | No frontend test runner | — | P3 | **BLOCKED → INTENTIONALLY RETAINED** | — | Adding Vitest + Testing Library is a new toolchain and dependency set. The two defects it would cover (A-1, A-2) are structural — one hook instance — and are verified by lint + build + the single-instance grep. Recorded as future work rather than half-added. |

## D. Dead code

| ID | Finding | Files | Priority | Status | Verification | Notes |
|---|---|---|---|---|---|---|
| D-1 | `tenderRoutes` imported then re-required inline | `server.js:131,685` | P3 | **FIXED** | backend lint clean; 222 tests pass | Mount now uses the binding. |
| D-2 | `NODE_ENV` destructured but unused | `config/mailer.js:60` | P3 | **FIXED** | lint clean | Found by the new linter, not the audit. |
| D-3 | `getTenderValue`, `calculateFinancePreview` uncalled | `utils/tenderCalculations.js` | P3 | **FIXED** | 0 references in `frontend/src`; build passes | **Audit correction:** the audit implied the module was unreachable. It is not — `calculateTenderDetailsSummary` is imported by `TenderDetailsPage.jsx:79` and was kept. |
| D-4 | `getCurrencySymbol`, `formatCurrencyWithoutDecimals` uncalled; `getCurrencyCode`/`getCurrencyConfig` exported with no consumer | `utils/currency.js` | P3 | **FIXED** | 0 external references; 81 for `formatCurrency` | The two fully-dead functions removed; the two internal helpers **kept** but un-exported — they are called by `formatCurrency`. |
| D-5 | Stale `.password-input-row` / `.password-toggle-button` CSS | `styles/pages/auth.css:121-146` | P4 | **FIXED** | no JSX reference; reverse CSS scan still **0** | Live rules are `.password-toggle-btn` in `tabs.css`. |
| D-6 | 3 tracked `.DS_Store` | `backend/**` | P3 | **FIXED** | `git ls-files \| grep -c DS_Store` → **0** | `git rm --cached`. |
| D-7 | `@types/react`, `@types/react-dom` with no TypeScript in repo | `frontend/package.json` | P3 | **FIXED** | `npm uninstall`; build passes | No `tsconfig.json`, no `.ts` file. |
| D-8 | `getWorkerById`, `getInvoiceById` exported, never routed (F-10) | `worker.controller.js`, `invoice.controller.js` | P3 | **INTENTIONALLY RETAINED** | — | Two options were routing them (adds API surface = new behaviour) or deleting them. Both change something the brief says not to change silently. Left as documented dead export surface; F-10 stays open. |
| D-9 | `getTenderDailyUpdates` uncalled | `tenderQueries.js` | P3 | **INTENTIONALLY RETAINED** | 3 in-file occurrences | Needs per-symbol in-file verification in a 3,620-line query module. Low value, non-zero risk. |
| D-10 | 8 unused `requestContext.js` exports, 4 in `company.service.js`, 2 in `auth.service.js`, 5 in `upload.middleware.js` | backend | P3 | **INTENTIONALLY RETAINED** | — | Same reasoning as D-9: several are used *inside* their own file, so only the `export` is dead. Removing an export is safe; removing a body is not, and the two need separate per-symbol verification that was not done. |
| D-11 | 8 unused constant groups incl. the `PAYMENT_*` trio duplicating `GET /api/payments/hierarchy` | `config/constants.js` | P3 | **INTENTIONALLY RETAINED** | — | `INSPECTION_STATUS`, `MILESTONE_STATUS`, `COMMENT_MODULES` map to future tables and must stay. The `PAYMENT_*` trio is a genuine leftover but sits in a frozen object other code destructures; deferred. |
| D-12 | `withTenant` / `tenantQuery` have zero callers | `database/pool.js` | P2 | **INTENTIONALLY RETAINED** | `grep -rn "\bwithTenant\b"` → only `pool.js` | **Deliberately not removed.** They relate to RLS session context. `authMiddleware` + `tenantContext.js` cover this via `AsyncLocalStorage` today, but RLS is not yet live (the API still connects as `postgres`), so the path is unproven in production. Removing a tenant-isolation helper before RLS is switched on is the wrong order. |
| D-13 | ~46 unused CSS classes | `frontend/src/styles/**` | P4 | **INTENTIONALLY RETAINED** | 11 verified dynamic (`status--${...}`, `badge--${...}`) | Only the verified-stale `auth.css` block was removed (D-5). The rest need per-class dynamic-construction checks; the reverse invariant (**0** classNames without a rule) is what actually protects rendering, and it still holds. |

## E. Duplicates

| ID | Finding | Files | Priority | Status | Verification | Notes |
|---|---|---|---|---|---|---|
| E-1 | Two `tenderPath()` helpers with identical validation | `tenderDetailsService.js`, `tenderWorkerService.js` | P3 | **FIXED** | Differential test across 9 inputs incl. all invalid forms → **identical behaviour**; build passes | Canonical helper exported; worker service composes it as `workerPath`. *A recursion bug introduced during the rename was caught by this verification and fixed.* |
| E-2 | Three export-helper modules, 1,177 lines | `utils/*ExportHelpers.js` | P4 | **INTENTIONALLY RETAINED** | all three reachable | Three different output formats (PDF ledger, branded document, spreadsheet). Consolidation is a large generic abstraction with real regression risk and no test cover. |
| E-3 | F-04 — two default timezones disagree by 10.5 h | `config/constants.js`, `config/env.js` | P2 | **FIXED** | `environmentTimezone.test.js` asserts they agree | Both now `Asia/Kolkata` / `INR`. A test pins the agreement so they cannot drift apart again. |

## F. Performance

| ID | Finding | Files | Priority | Status | Verification | Notes |
|---|---|---|---|---|---|---|
| F-1 | Entry bundle 1,948 kB, no code splitting | `routes/AppRoutes.jsx`, `styles/core/layout.css` | P2 | **FIXED** | Measured before/after; dev server serves the rewritten module (HTTP 200) | 19 authenticated pages moved to `React.lazy` behind a `<Suspense>` boundary. **456.00 kB (146.35 kB gzip)** — a **77% cut**. Auth pages stay eager. |
| F-2 | Eight pages exceed 1,000 lines | `frontend/src/pages/**` | P4 | **INTENTIONALLY RETAINED** | — | Splitting them is an architectural rewrite with no frontend test cover. F-1 addressed the actual user-facing cost. |
| F-3 | API paginates; screens request everything | frontend | P4 | **INTENTIONALLY RETAINED** | — | Product-visible behaviour change. |

## G. Database

| ID | Finding | Files | Priority | Status | Verification | Notes |
|---|---|---|---|---|---|---|
| G-1 | 002 baseline recreates `tender_workers`, which 005 drops | `migrations/002`, `005` | P2 | **FIXED (documented)** | `migrations/README.md` + `DEPLOYMENT.md` both state 005 runs on fresh installs; CI applies it | **Migration files unchanged by design** — a `pg_dump` baseline that may already be applied must not be rewritten. |
| G-2 | 12 tables with no code consumer | schema | P3 | **INTENTIONALLY RETAINED** | — | Classified **FUTURE**. Dropping destroys design intent. No migration created. |
| G-3 | RLS policies dormant (API connects as `postgres`) | `migrations/003` | P2 | **INTENTIONALLY RETAINED** | Server logs the warning on boot | Switching roles is a production operation with a silent failure mode. Documented with the mandatory `verifyTenantContext.js` gate. **Not** changed from a script. |
| G-4 | Column-level usage unverified | schema | P4 | **BLOCKED** | — | See *Blocked* below. |

---

## Blocked

### BL-1 · F-14 — site-log worker/subcontractor ownership check

**Blocker.** `createSiteLog` validates `site_id` and `tender_id` against the
caller's company but not `worker_id`/`subcontractor_id`. The fix is two
lines mirroring the existing helpers — but it is an input-validation change
on a write path with **no existing test coverage for those two fields**, and
writing that coverage means seeding two companies and a cross-tenant worker.

**Attempted.** Located the call site and the two helpers that would be
reused (`workerExists`, `subcontractorExists` in `utils/requestContext.js` —
both currently unused exports, D-10).

**Evidence.** Disclosure is already contained: `getSiteLogs` joins `workers`
and `subcontractors` with a `company_id` condition, so a foreign name
returns NULL rather than leaking. The row is still written with a
cross-tenant reference.

**Manual next step.** Add the two `companyRecordExists` calls, then extend
`tenantIsolation.test.js` with a case posting another company's `worker_id`
and asserting 404 — not just that the name is hidden.

### BL-2 · F-12 remaining action — encrypt subcontractor bank details at rest

**Blocker.** Requires a key-management decision (where the key lives, how it
rotates) and a migration for existing rows. Both are outside what can be
decided from the code.

**Evidence.** `worker_sensitive_details` already has the encrypted-column
pattern; `subcontractors` stores `account_number`/`ifsc_code` as plain text.
The bulk exposure is already closed — the list endpoint masks, and
`GET /:id` is admin-only.

**Manual next step.** Decide key storage, then a forward-only migration
adding encrypted columns, backfilling, and dropping the plain-text ones.

### BL-3 · G-4 · Column-level usage

**Blocker.** Requires diffing every SQL string against a live
`information_schema`; `SELECT t.*` cannot be resolved statically.

**Manual next step.** Run the app against a logging proxy and collect the
columns actually referenced, or use `pg_stat_statements`.

---

## Not changed, deliberately

- **`backend/.env`** — contains the invalid `DEFAULT_TIMEZONE=India/Kolkata`
  that A-4 uncovered. It is gitignored local configuration and not mine to
  edit. The code now warns loudly and falls back correctly, but
  **the value should be corrected by hand to `Asia/Kolkata`.**
- **All 5 migration files** — historical, forward-only.
- **Endpoints with no frontend consumer** — company administration, the
  upload file manager, tender finance, site-operations edit/delete. Working
  and possibly externally used; removal is a product decision.
