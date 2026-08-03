# Documentation pass — progress

Working notes for the repository-wide documentation and review pass.

The pass began as comments-only and was later extended to fixing verified
bugs. Outside the fixes recorded below and the code they touch, no logic,
naming, formatting or import order has been changed anywhere.

## Bug fixes applied

Six findings acted on. Every fix was verified by reverting it and
confirming the new tests fail.

| ID | Status | Fix | Tests |
|---|---|---|---|
| F-16 | Fixed | Dropped the non-existent `clients.is_deleted` filter from `validateClientOwnership` | `tenderClientValidation.test.js` — 6 |
| F-13 | Fixed | Timezone: `createSiteLog` uses `daysAgo()`. Permission: it now calls `checkEntryWindow`, so the rule lives in one place | `entryWindowTimezone.test.js` — 10, `entryWindowPermission.test.js` — 18 |
| F-12 | Fixed | List masks payment identifiers; new role-gated `GET /subcontractors/:id` for full details; audit redaction; frontend and CSV updated | `subcontractorFinancialAccess.test.js` — 21, plus 2 in `activityLog.test.js` |
| F-17 | Fixed | Five tender child queries now take and filter on `companyId` | `tenderCrossTenant.test.js` — 15 |
| F-10 | Partial | `subcontractors` routes `getById` (needed by F-12); workers and invoices still do not | covered by the F-12 suite |
| F-08 | Open | Re-flagged: the depth cap now also applies to payment identifiers | — |

Test count across the pass: **143 → 215**, all passing.

New test files: `tenderClientValidation`, `entryWindowTimezone`,
`entryWindowPermission`, `subcontractorFinancialAccess`,
`tenderCrossTenant`.

New source file: `backend/utils/maskSensitive.js`.

See `findings.md` for the structured records, including the two remaining
actions that need a product or infrastructure decision — encryption at rest
for subcontractor banking, and per-company timezone resolution in
`checkEntryWindow`.

## Conventions established

- **File-level block** at the very top of every file, before the imports,
  in the `|===|` banner style, headed `FILE PURPOSE`. Covers
  responsibilities, exports, used-by, depends-on, tables touched, API
  surface, frontend consumers, and any security or performance note.
- **Section banners** in the `|---|` style for grouped code.
- **Function docs** as `/** ... */` with Purpose / Parameters / Returns /
  Side effects / Business rules / Security / Performance, including only
  the headings that actually apply.
- **Inline block comments** before non-trivial logic, explaining *why*.
- Files that already carried good inline comments keep them; the pass adds
  the missing file block and fills in parameter and return documentation.
- Anything that looks wrong is recorded in `findings.md`. Six findings
  were subsequently acted on with regression tests; the rest are
  documented in place and left alone.

## Verification

Backend files are checked with `node --check` after editing. Frontend files
are checked with the project's ESLint config at the end of each directory.

## Completed

Earlier commits (already on `main`):
- `backend/middleware/rateLimiter.js`
- `backend/modules/payments/payment.hierarchy.js`
- all eight files in `backend/tests/`
- `backend/database/` migrations, `schema.sql`, snapshot
- `frontend/src/config/tenderDetailForms.js`
- `frontend/src/styles/pages/site-operations.css`

Uncommitted, from the pass in progress:
- `.gitignore`, `frontend/.gitignore`
- `backend/config/constants.js`, `supabase.js`
- `backend/database/README.md`, `check-database.js`, `pool.js`
- `backend/middleware/authMiddleware.js`, `errorHandler.js`,
  `requestLogger.js`, `roleMiddleware.js`
- `docs/repository-reference/` — findings, json-and-lock-files,
  generated-and-binary-files

This session:
- `backend/utils/financeCalculations.js`
- `backend/utils/asyncHandler.js`
- `backend/utils/activityLog.js`
- `backend/utils/requestContext.js`
- `backend/utils/scopedCrud.js`
- `backend/config/mailer.js`
- `backend/config/env.js`
- `backend/server.js`
- `backend/scripts/createBreakGlassAdmin.js`
- `backend/tests/helpers/testDb.js`
- `backend/modules/auth/` — routes, service, controller
- `backend/modules/health/` — controller, routes
- `backend/modules/companies/` — routes, controller, service
- `backend/modules/workers/` — controller, routes, worker.validation
- `backend/modules/subcontractors/` — controller, routes
- `backend/modules/invoices/` — controller, routes
- `backend/modules/sites/` — controller, routes
- `backend/modules/siteLogs/` — controller, routes
- `backend/modules/masters/` — controller, routes
- `backend/modules/tenders/` — **complete**: `tender.routes.js`,
  `tenderQueries.js`, `tender.service.js`, `tender.controller.js`,
  `tenderValidation.js` (~2,230 lines of documentation across the five)
- `backend/modules/payments/` — **complete**: `payment.routes.js`,
  `payment.service.js`, `payment.controller.js`
  (`payment.hierarchy.js` was already done in an earlier commit)

- `backend/modules/siteOperations/` — routes, entryWindow.service, and the
  material, labour, banking and accessRequest controllers
- `backend/modules/notifications/`, `workerMoney/`, `workerPortal/`,
  `subcontractorPortal/`, `uploads/`, `dailyUpdateApprovals/`
- `backend/middleware/rateLimiter.js`, `backend/vitest.config.mjs`
- **All of `frontend/`** — main, App, AppRoutes, RoleRoute, AuthProvider,
  authContext, axiosClient, AppLayout; 20 services; 13 hooks; 22 pages;
  31 components; 7 utils; 2 templates; 2 config; 20 stylesheets;
  index.html, both SVGs, vite.config.js, eslint.config.js

## Status: complete

Every eligible file in the repository has been processed. The scan below
returns nothing:

```bash
git ls-files | grep -vE '\.DS_Store$|package-lock\.json$' | while read -r f; do
  [ -f "$f" ] || continue
  first=$(grep -m1 -vE '^[[:space:]]*$' "$f" 2>/dev/null)
  case "$f" in
    *.js|*.jsx|*.mjs|*.css) case "$first" in "/*"*|"//"*|"*"*) ;; *) echo "TODO $f";; esac;;
    *.sql) case "$first" in "--"*|"/*"*) ;; *) echo "TODO $f";; esac;;
    *.html|*.svg) case "$first" in "<!--"*|"<!doctype"*) ;; *) echo "TODO $f";; esac;;
    *.yaml|*.yml|*.example|*.gitignore) case "$first" in "#"*) ;; *) echo "TODO $f";; esac;;
  esac
done
```

### Coverage

| Area | Files | State |
|---|---|---|
| `backend/` | 75 modified + 12 already done | complete |
| `frontend/src/` | 130 | complete |
| Config, deployment, markdown | included above | complete |
| `package-lock.json` x2 | 2 | documented in `json-and-lock-files.md`; strict JSON takes no comments |
| `.DS_Store` x13 | 13 | binary, documented in `generated-and-binary-files.md` |

### Verification run at completion

- `node --check` on every backend `.js` / `.mjs` — all pass
- `npm test` (backend) — 13 files, **215 tests, all passing**
- `npm run lint` (frontend) — clean
- `npm run build` (frontend) — succeeds
- No typecheck or frontend test runner is configured in this project
- `node_modules` untouched; no `.env` tracked
- No real bank details or TFNs anywhere in the source tree or the built
  bundle; the only sample values are obviously-synthetic fixtures inside
  two test files

## Findings raised so far

F-01 to F-06 from the earlier pass, plus:

- **F-07** email templates interpolate user-controlled names unescaped
- **F-08** `redact()` fails open below six levels of nesting
- **F-09** company membership and ownership changes are not audited
- **F-10** three registers export `getById` but never route it
- **F-11** the `status` default for a new worker is unreachable
- **F-12** subcontractor bank details are plain text, and the redaction
  list does not cover them *(High)*
- **F-13** the backdating window is implemented twice, inconsistently
- **F-14** site-log `worker_id` / `subcontractor_id` are not
  ownership-checked
- **F-15** the masters router documents an access rule it does not have
- **F-16** creating or updating a tender with a client fails with a 500
  *(High — verified against the database, not inferred)* — **fixed**
- **F-17** five tender child queries are not company-scoped; safe today
  only because both call sites check ownership first

F-12, F-13 and F-16 have been fixed — see the table at the top and the
structured records in `findings.md`. The remainder are documented in place
and deliberately not changed; each records why.
