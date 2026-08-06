# Stale & Unused Code Audit

> ## ⚠️ SUPERSEDED IN PART — remediation has since been applied
>
> This document records the repository **as audited at commit `9cb1aef`**.
> A remediation pass has since fixed 26 of its findings.
>
> **Read `FIX_IMPLEMENTATION_TRACKER.md` for the current status of every
> finding.** The counts in §1 below are the *pre-fix* baseline and are kept
> deliberately, so the two documents can be compared.
>
> ### What changed since this audit
>
> | Metric | This audit | Now |
> |---|---|---|
> | Backend tests | 215 (1 intermittent failure) | **222 passed, 0 failed** |
> | Backend lint | not configured | **0 errors** |
> | Frontend entry chunk | 1,948.30 kB | **456.00 kB** (77% smaller) |
> | Tracked files | 249 | 246 |
> | Tracked `.DS_Store` | 3 | 0 |
> | Unused-export candidates | 52 | 45 |
> | CI | none | 3-job workflow |
> | `backend/.env.example` | 0 bytes | 41 documented variables |
> | `migrations/README.md` | missing | written |
>
> ### Corrections to this audit, found while fixing it
>
> 1. **§6.5 overstated `tenderCalculations.js`.** It called the module's
>    "two main exports" uncalled and implied the module was unreachable. It
>    is not — `calculateTenderDetailsSummary` is imported by
>    `TenderDetailsPage.jsx:79` and is live. Only `getTenderValue` and
>    `calculateFinancePreview` were dead; those two were removed.
> 2. **§A-08 / M-03 mis-attributed the failing test.** `masters.test.js`
>    does not fail on a quiet machine — 222/222 pass in ~17 s across
>    repeated runs. The 30 s timeout was CPU contention from dev servers
>    running during the audit, not a code defect.
> 3. **A defect this audit missed entirely:** `DEFAULT_TIMEZONE` in
>    `backend/.env` is `India/Kolkata`, which is **not a valid IANA zone**.
>    `entryWindow.service.js:166` swallows the `RangeError` and falls back
>    to UTC, so the supervisor backdated-entry window was resolving dates
>    5.5 hours out — finding F-13 reintroduced through configuration.
>    Fixed in `config/env.js` with 7 regression tests.
>

**Repository:** `construction-portal`
**Branch:** `main` (working tree at commit `a6c8a01`)
**Date:** 2026-08-05
**Scope:** every tracked file except `node_modules/` and `.git/`
**Nature:** analysis and documentation only — no application source was modified.

---

# 1. Executive summary

## Repository statistics

| Metric | Count |
|---|---|
| Tracked files reviewed | **249** |
| Directories ignored | **2** (`node_modules/`, `.git/`) |
| JS / JSX / MJS / CJS modules analysed | 197 |
| Backend HTTP routes mapped | 145 |
| Distinct frontend API call sites mapped | 99 |
| Database tables in schema | 48 |
| Distinct CSS classes | 253 |

## Classification totals

| Classification | Files |
|---|---|
| ACTIVE | 200 |
| STALE | 18 |
| TEST ONLY | 14 |
| CONFIGURATION | 10 |
| MIGRATION (historical, keep) | 5 |
| ACTIVE BUT DUPLICATED | 2 |
| UNUSED (whole file, no reference) | **0** |
| NEEDS MANUAL REVIEW | 3 |

**There are no orphaned application modules.** Every one of the 197 JS/JSX
modules is reachable from an entry point. The 20 files with zero inbound
imports are all legitimate entry points (14 test files, 3 CLI scripts,
`main.jsx`, `vite.config.js`, `eslint.config.js`, `vitest.config.mjs`).

The dead weight in this repository is **not** whole files. It is unused
*exports*, stale *documentation*, unreferenced *CSS rules*, and backend
*endpoints with no consumer*.

## Highest-risk findings

| # | Finding | Severity | Evidence |
|---|---|---|---|
| **A-01** | `DEPLOYMENT.md` is **0 bytes in the working tree but 235 lines (7,691 B) in `HEAD`**. The committed guide — including the Supabase TLS/CA procedure — had been locally truncated and was one `git checkout` away from being lost | **High** (operational) | `wc -c` → `0`; `git show HEAD:DEPLOYMENT.md \| wc -l` → `235` |
| **A-02** | `backend/.env.example` is a **0-byte file**. All **37** backend environment variables read by code are absent from it | **High** (operational) | `wc -c backend/.env.example` → `0`; 37 names resolved from `config/env.js` |
| **A-03** | `backend/database/migrations/README.md` **does not exist**, but `HANDOVER.md:30` ("Run the migrations") and `backend/database/README.md:14,20` both instruct the reader to start there | **High** (operational) | `git ls-files` has no such path |
| **A-04** | The 002 baseline still creates `tender_workers` — the duplicate table migration 005 exists to drop. A fresh Supabase install rebuilds the dead table | **Medium** | `002_baseline_supabase.sql:1671` vs `005_drop_duplicate_assignment_table.sql:55` |
| **A-05** | `withTenant` / `tenantQuery` in `database/pool.js` have **zero callers**. RLS depends on the session variable they set | **Medium** | `grep -rn "\bwithTenant\b" backend frontend` → only `pool.js` |
| **A-06** | 5 tender-finance endpoints + 4 child `PUT` routes have **no frontend consumer**, and `tenderDetailsService.js:12` documents finance calls that do not exist in the file | **Medium** | Route map vs. `grep -nE "^export" tenderDetailsService.js` |
| **A-07** | `backend/database/snapshots/schema-production.sql` is referenced by `backend/database/README.md:15` and by `.gitignore` but is **not tracked** | **Medium** | `git ls-files` has no such path |
| **A-08** | 1 test fails (`masters.test.js › refuses a worker`, 30 s timeout); `HANDOVER.md` claims "143 passing" when the suite now has 215 tests | **Medium** | `npm test` → `1 failed | 214 passed (215)` |

---

# 2. Scope and method

## Directories reviewed

```
backend/          config, database, middleware, modules, scripts, tests, utils
backend/database/migrations/   5 SQL files
frontend/         public, src (api, components, config, contexts, hooks,
                  layouts, pages, routes, services, styles, templates, utils)
docs/repository-reference/
root              .gitignore, DEPLOYMENT.md, HANDOVER.md, render.yaml
```

## Directories ignored

| Path | Reason |
|---|---|
| `node_modules/` | Excluded by instruction |
| `.git/` | Excluded by instruction |

Confirmed: the file list was produced with `git ls-files`, which never
enumerates either path. `frontend/dist/` also exists on disk but is
**untracked** (gitignored build output) and therefore out of scope.

## Commands and checks run

| Check | Command | Result |
|---|---|---|
| File inventory | `git ls-files` | 249 files |
| Frontend lint | `npx eslint src/` (in `frontend/`) | **clean, 0 problems** |
| Frontend build | `npm run build` | **passes**, ~1.95 MB bundle |
| Backend tests | `npm test` (in `backend/`) | **214 passed, 1 failed** of 215 |
| Import graph | custom AST-ish scanner over 197 modules | 0 unresolved, 0 orphans |
| Unused exports | custom cross-file symbol scan | 52 candidates, verified individually |
| Route map | extracted 145 `router.*` mounts | compared to 99 frontend call sites |
| CSS usage | forward + reverse class scan | 57 forward candidates, **0 reverse** |
| Dependency usage | manifest vs. actual imports | 2 unused devDependencies |
| Env vars | whitespace-collapsed scan of `process.env` vs. templates | 37 read, 0 in backend template |
| TypeScript | *not configured* — no `tsconfig.json`, no `.ts` files | n/a |
| Backend lint | *not configured* — no ESLint config under `backend/` | **gap** |

## Limitations

1. **Backend has no linter.** There is no ESLint configuration under
   `backend/`, so unused imports and variables in 100+ backend modules are
   not mechanically detectable. Frontend findings are stronger than backend
   findings for that reason. This is itself a finding (see §10).
2. **No frontend test runner.** `frontend/eslint.config.js:17` states it
   outright: *"no test runner is configured"*. Frontend behaviour claims in
   this report rest on static analysis and a build, never on a passing test.
3. **Database objects were read from migration SQL, not from a live
   `information_schema` dump.** Table and column claims describe what the
   migrations create. A database that has drifted may differ.
4. **Dynamic class names were checked manually.** `status--${...}` and
   `badge--${...}` patterns are constructed at runtime; those CSS rules are
   *not* counted as unused (see §7).
5. **The single failing test was not diagnosed to root cause.** It times out
   rather than asserting wrongly, which points at rate limiting or database
   latency rather than a code defect, but that was not proven.
6. **Working-tree state differs from `HEAD` for `DEPLOYMENT.md`.** This audit
   initially read the empty working copy and drew the wrong conclusion; it
   was corrected after `git diff` revealed 147 deleted lines. Any future
   automated pass over this repository should compare against `HEAD`, not
   only the working tree.

---

# 3. Complete file inventory

All **249** tracked files. No file is omitted.

| # | File | Lines | Classification | Purpose / Evidence | Action |
|---|---|---|---|---|---|
| 1 | `.gitignore` | 94 | CONFIGURATION | Non-JS tracked file | Keep |
| 2 | `DEPLOYMENT.md` | 0 | STALE | 0 bytes — tracked but empty | Populate (see report) |
| 3 | `HANDOVER.md` | 434 | STALE | Contains claims contradicted by the current tree | Update |
| 4 | `backend/.env.example` | 0 | STALE | 0 bytes — tracked but empty | Populate (see report) |
| 5 | `backend/config/constants.js` | 454 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 6 | `backend/config/env.js` | 913 | ACTIVE | Imported by 15 module(s) | Keep |
| 7 | `backend/config/mailer.js` | 557 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 8 | `backend/config/supabase.js` | 462 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 9 | `backend/database/.DS_Store` | 1 | STALE | macOS metadata; `.gitignore` lists `.DS_Store` but these predate the rule | Remove from index |
| 10 | `backend/database/README.md` | 103 | STALE | Contains claims contradicted by the current tree | Update |
| 11 | `backend/database/check-database.js` | 124 | ACTIVE | Entry point — invoked by a script/runtime, not imported | Keep |
| 12 | `backend/database/migrations/001_upgrade_schema.sql` | 786 | MIGRATION | Historical schema step; not imported by runtime code by design | Keep |
| 13 | `backend/database/migrations/002_baseline_supabase.sql` | 4422 | MIGRATION | Historical schema step; not imported by runtime code by design | Keep |
| 14 | `backend/database/migrations/003_supabase_rls.sql` | 388 | MIGRATION | Historical schema step; not imported by runtime code by design | Keep |
| 15 | `backend/database/migrations/004_seed_reference_data.sql` | 250 | MIGRATION | Historical schema step; not imported by runtime code by design | Keep |
| 16 | `backend/database/migrations/005_drop_duplicate_assignment_table.sql` | 71 | MIGRATION | Historical schema step; not imported by runtime code by design | Keep |
| 17 | `backend/database/pool.js` | 525 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 18 | `backend/database/tenantContext.js` | 107 | ACTIVE | Imported by 4 module(s) | Keep |
| 19 | `backend/middleware/authMiddleware.js` | 389 | ACTIVE | Imported by 2 module(s) | Keep |
| 20 | `backend/middleware/errorHandler.js` | 413 | ACTIVE | Imported by 1 module(s) | Keep |
| 21 | `backend/middleware/rateLimiter.js` | 155 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 22 | `backend/middleware/requestLogger.js` | 434 | ACTIVE | Imported by 1 module(s) | Keep |
| 23 | `backend/middleware/roleMiddleware.js` | 270 | ACTIVE | Imported by 7 module(s) | Keep |
| 24 | `backend/modules/README.md` | 53 | ACTIVE | Reference documentation | Keep |
| 25 | `backend/modules/auth/auth.controller.js` | 1790 | ACTIVE | Imported by 1 module(s) | Keep |
| 26 | `backend/modules/auth/auth.routes.js` | 505 | ACTIVE | Imported by 1 module(s) | Keep |
| 27 | `backend/modules/auth/auth.service.js` | 1512 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 28 | `backend/modules/companies/company.controller.js` | 565 | ACTIVE | Imported by 1 module(s) | Keep |
| 29 | `backend/modules/companies/company.routes.js` | 235 | ACTIVE | Imported by 1 module(s) | Keep |
| 30 | `backend/modules/companies/company.service.js` | 1533 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 31 | `backend/modules/dailyUpdateApprovals/dailyUpdateApproval.controller.js` | 454 | ACTIVE | Imported by 1 module(s) | Keep |
| 32 | `backend/modules/dailyUpdateApprovals/dailyUpdateApproval.routes.js` | 68 | ACTIVE | Imported by 1 module(s) | Keep |
| 33 | `backend/modules/health/health.controller.js` | 367 | ACTIVE | Imported by 1 module(s) | Keep |
| 34 | `backend/modules/health/health.routes.js` | 84 | ACTIVE | Imported by 1 module(s) | Keep |
| 35 | `backend/modules/invoices/invoice.controller.js` | 158 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 36 | `backend/modules/invoices/invoice.routes.js` | 112 | ACTIVE | Imported by 1 module(s) | Keep |
| 37 | `backend/modules/masters/master.controller.js` | 793 | ACTIVE | Imported by 1 module(s) | Keep |
| 38 | `backend/modules/masters/master.routes.js` | 207 | ACTIVE | Imported by 1 module(s) | Keep |
| 39 | `backend/modules/notifications/activity.controller.js` | 156 | ACTIVE | Imported by 1 module(s) | Keep |
| 40 | `backend/modules/notifications/activity.routes.js` | 49 | ACTIVE | Imported by 1 module(s) | Keep |
| 41 | `backend/modules/notifications/notification.controller.js` | 205 | ACTIVE | Imported by 1 module(s) | Keep |
| 42 | `backend/modules/notifications/notification.routes.js` | 60 | ACTIVE | Imported by 1 module(s) | Keep |
| 43 | `backend/modules/notifications/notification.service.js` | 165 | ACTIVE | Imported by 1 module(s) | Keep |
| 44 | `backend/modules/payments/.DS_Store` | 1 | STALE | macOS metadata; `.gitignore` lists `.DS_Store` but these predate the rule | Remove from index |
| 45 | `backend/modules/payments/payment.controller.js` | 1013 | ACTIVE | Imported by 1 module(s) | Keep |
| 46 | `backend/modules/payments/payment.hierarchy.js` | 797 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 47 | `backend/modules/payments/payment.routes.js` | 236 | ACTIVE | Imported by 1 module(s) | Keep |
| 48 | `backend/modules/payments/payment.service.js` | 807 | ACTIVE | Imported by 3 module(s) | Keep |
| 49 | `backend/modules/siteLogs/siteLog.controller.js` | 649 | ACTIVE | Imported by 1 module(s) | Keep |
| 50 | `backend/modules/siteLogs/siteLog.routes.js` | 93 | ACTIVE | Imported by 1 module(s) | Keep |
| 51 | `backend/modules/siteOperations/accessRequest.controller.js` | 484 | ACTIVE | Imported by 1 module(s) | Keep |
| 52 | `backend/modules/siteOperations/banking.controller.js` | 842 | ACTIVE | Imported by 1 module(s) | Keep |
| 53 | `backend/modules/siteOperations/entryWindow.service.js` | 441 | ACTIVE | Imported by 8 module(s) | Keep |
| 54 | `backend/modules/siteOperations/labour.controller.js` | 761 | ACTIVE | Imported by 1 module(s) | Keep |
| 55 | `backend/modules/siteOperations/material.controller.js` | 820 | ACTIVE | Imported by 1 module(s) | Keep |
| 56 | `backend/modules/siteOperations/siteOperations.routes.js` | 440 | ACTIVE | Imported by 1 module(s) | Keep |
| 57 | `backend/modules/sites/site.controller.js` | 623 | ACTIVE | Imported by 1 module(s) | Keep |
| 58 | `backend/modules/sites/site.routes.js` | 112 | ACTIVE | Imported by 1 module(s) | Keep |
| 59 | `backend/modules/subcontractorPortal/subcontractorPortal.controller.js` | 543 | ACTIVE | Imported by 1 module(s) | Keep |
| 60 | `backend/modules/subcontractorPortal/subcontractorPortal.routes.js` | 39 | ACTIVE | Imported by 1 module(s) | Keep |
| 61 | `backend/modules/subcontractors/subcontractor.controller.js` | 389 | ACTIVE | Imported by 1 module(s) | Keep |
| 62 | `backend/modules/subcontractors/subcontractor.routes.js` | 152 | ACTIVE | Imported by 1 module(s) | Keep |
| 63 | `backend/modules/tenders/tender.controller.js` | 1496 | ACTIVE | Imported by 1 module(s) | Keep |
| 64 | `backend/modules/tenders/tender.routes.js` | 799 | ACTIVE | Imported by 1 module(s) | Keep |
| 65 | `backend/modules/tenders/tender.service.js` | 2774 | ACTIVE | Imported by 1 module(s) | Keep |
| 66 | `backend/modules/tenders/tenderQueries.js` | 3620 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 67 | `backend/modules/tenders/tenderValidation.js` | 1848 | ACTIVE | Imported by 1 module(s) | Keep |
| 68 | `backend/modules/uploads/upload.controller.js` | 740 | ACTIVE | Imported by 1 module(s) | Keep |
| 69 | `backend/modules/uploads/upload.middleware.js` | 412 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 70 | `backend/modules/uploads/upload.routes.js` | 87 | ACTIVE | Imported by 1 module(s) | Keep |
| 71 | `backend/modules/workerMoney/workerAllocation.controller.js` | 572 | ACTIVE | Imported by 1 module(s) | Keep |
| 72 | `backend/modules/workerMoney/workerAllocation.routes.js` | 73 | ACTIVE | Imported by 1 module(s) | Keep |
| 73 | `backend/modules/workerMoney/workerExpense.controller.js` | 645 | ACTIVE | Imported by 1 module(s) | Keep |
| 74 | `backend/modules/workerMoney/workerExpense.routes.js` | 70 | ACTIVE | Imported by 1 module(s) | Keep |
| 75 | `backend/modules/workerPortal/workerPortal.controller.js` | 679 | ACTIVE | Imported by 1 module(s) | Keep |
| 76 | `backend/modules/workerPortal/workerPortal.routes.js` | 47 | ACTIVE | Imported by 1 module(s) | Keep |
| 77 | `backend/modules/workers/.DS_Store` | 1 | STALE | macOS metadata; `.gitignore` lists `.DS_Store` but these predate the rule | Remove from index |
| 78 | `backend/modules/workers/validations/worker.validation.js` | 107 | ACTIVE | Imported by 1 module(s) | Keep |
| 79 | `backend/modules/workers/worker.controller.js` | 218 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 80 | `backend/modules/workers/worker.routes.js` | 114 | ACTIVE | Imported by 1 module(s) | Keep |
| 81 | `backend/package-lock.json` | 3351 | CONFIGURATION | Lock file consumed by `npm ci` | Keep |
| 82 | `backend/package.json` | 34 | CONFIGURATION | Scripts + dependency manifest | Keep (see F-01) |
| 83 | `backend/scripts/createBreakGlassAdmin.js` | 374 | ACTIVE | Entry point — invoked by a script/runtime, not imported | Keep |
| 84 | `backend/scripts/verifyTenantContext.js` | 200 | ACTIVE | Entry point — invoked by a script/runtime, not imported | Keep |
| 85 | `backend/server.js` | 1272 | ACTIVE | Imported by 11 module(s) | Keep |
| 86 | `backend/tests/activityLog.test.js` | 286 | TEST ONLY | Run by `vitest run`; entry point, so zero inbound imports is expected | Keep |
| 87 | `backend/tests/entryWindowPermission.test.js` | 606 | TEST ONLY | Run by `vitest run`; entry point, so zero inbound imports is expected | Keep |
| 88 | `backend/tests/entryWindowTimezone.test.js` | 253 | TEST ONLY | Run by `vitest run`; entry point, so zero inbound imports is expected | Keep |
| 89 | `backend/tests/helpers/testDb.js` | 371 | TEST ONLY | Run by `vitest run`; entry point, so zero inbound imports is expected | Keep |
| 90 | `backend/tests/masters.test.js` | 186 | TEST ONLY | Run by `vitest run`; entry point, so zero inbound imports is expected | Keep |
| 91 | `backend/tests/notifications.test.js` | 206 | TEST ONLY | Run by `vitest run`; entry point, so zero inbound imports is expected | Keep |
| 92 | `backend/tests/paymentCalculations.test.js` | 406 | TEST ONLY | Run by `vitest run`; entry point, so zero inbound imports is expected | Keep |
| 93 | `backend/tests/portals.test.js` | 389 | TEST ONLY | Run by `vitest run`; entry point, so zero inbound imports is expected | Keep |
| 94 | `backend/tests/roleSeparation.test.js` | 295 | TEST ONLY | Run by `vitest run`; entry point, so zero inbound imports is expected | Keep |
| 95 | `backend/tests/subcontractorFinancialAccess.test.js` | 462 | TEST ONLY | Run by `vitest run`; entry point, so zero inbound imports is expected | Keep |
| 96 | `backend/tests/tenantIsolation.test.js` | 346 | TEST ONLY | Run by `vitest run`; entry point, so zero inbound imports is expected | Keep |
| 97 | `backend/tests/tenderChildResources.test.js` | 325 | TEST ONLY | Run by `vitest run`; entry point, so zero inbound imports is expected | Keep |
| 98 | `backend/tests/tenderClientValidation.test.js` | 326 | TEST ONLY | Run by `vitest run`; entry point, so zero inbound imports is expected | Keep |
| 99 | `backend/tests/tenderCrossTenant.test.js` | 329 | TEST ONLY | Run by `vitest run`; entry point, so zero inbound imports is expected | Keep |
| 100 | `backend/utils/activityLog.js` | 545 | ACTIVE | Imported by 8 module(s) | Keep |
| 101 | `backend/utils/asyncHandler.js` | 99 | ACTIVE | Imported by 23 module(s) | Keep |
| 102 | `backend/utils/financeCalculations.js` | 181 | ACTIVE | Imported by 1 module(s) | Keep |
| 103 | `backend/utils/maskSensitive.js` | 288 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 104 | `backend/utils/requestContext.js` | 916 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 105 | `backend/utils/scopedCrud.js` | 1003 | ACTIVE | Imported by 3 module(s) | Keep |
| 106 | `backend/vitest.config.mjs` | 42 | ACTIVE | Entry point — invoked by a script/runtime, not imported | Keep |
| 107 | `docs/repository-reference/.pass-status.txt` | 237 | STALE | Prior documentation pass; references files that no longer exist | Refresh or archive |
| 108 | `docs/repository-reference/findings.md` | 742 | STALE | Prior documentation pass; references files that no longer exist | Refresh or archive |
| 109 | `docs/repository-reference/generated-and-binary-files.md` | 111 | STALE | Prior documentation pass; references files that no longer exist | Refresh or archive |
| 110 | `docs/repository-reference/json-and-lock-files.md` | 205 | STALE | Prior documentation pass; references files that no longer exist | Refresh or archive |
| 111 | `docs/repository-reference/pass-progress.md` | 177 | STALE | Prior documentation pass; references files that no longer exist | Refresh or archive |
| 112 | `frontend/.env.example` | 69 | CONFIGURATION | Non-JS tracked file | Keep |
| 113 | `frontend/.gitignore` | 57 | CONFIGURATION | Non-JS tracked file | Keep |
| 114 | `frontend/README.md` | 17 | ACTIVE | Reference documentation | Keep |
| 115 | `frontend/eslint.config.js` | 47 | ACTIVE | Entry point — invoked by a script/runtime, not imported | Keep |
| 116 | `frontend/index.html` | 30 | CONFIGURATION | Non-JS tracked file | Keep |
| 117 | `frontend/package-lock.json` | 3634 | CONFIGURATION | Lock file consumed by `npm ci` | Keep |
| 118 | `frontend/package.json` | 36 | CONFIGURATION | Scripts + dependency manifest | Keep (see F-01) |
| 119 | `frontend/public/favicon.svg` | 9 | ACTIVE | Referenced from index.html / components | Keep |
| 120 | `frontend/public/icons.svg` | 37 | ACTIVE | Referenced from index.html / components | Keep |
| 121 | `frontend/src/App.jsx` | 727 | ACTIVE | Imported by 1 module(s) | Keep |
| 122 | `frontend/src/api/axiosClient.js` | 137 | ACTIVE | Imported by 21 module(s) | Keep |
| 123 | `frontend/src/components/AnimatedStatCard.jsx` | 80 | ACTIVE | Imported by 1 module(s) | Keep |
| 124 | `frontend/src/components/AppBackground.jsx` | 26 | ACTIVE | Imported by 1 module(s) | Keep |
| 125 | `frontend/src/components/ApprovalActionModal.jsx` | 75 | ACTIVE | Imported by 1 module(s) | Keep |
| 126 | `frontend/src/components/CommandPalette.jsx` | 130 | ACTIVE | Imported by 1 module(s) | Keep |
| 127 | `frontend/src/components/DashboardHero.jsx` | 71 | ACTIVE | Imported by 1 module(s) | Keep |
| 128 | `frontend/src/components/DeleteVerificationModal.jsx` | 138 | ACTIVE | Imported by 10 module(s) | Keep |
| 129 | `frontend/src/components/FloatingActionButton.jsx` | 73 | ACTIVE | Imported by 1 module(s) | Keep |
| 130 | `frontend/src/components/NotificationCenter.jsx` | 204 | ACTIVE | Imported by 1 module(s) | Keep |
| 131 | `frontend/src/components/PageTransition.jsx` | 33 | ACTIVE | Imported by 1 module(s) | Keep |
| 132 | `frontend/src/components/Sidebar.jsx` | 82 | ACTIVE | Imported by 1 module(s) | Keep |
| 133 | `frontend/src/components/Topbar.jsx` | 58 | ACTIVE | Imported by 1 module(s) | Keep |
| 134 | `frontend/src/components/charts/FinanceTrendChart.jsx` | 134 | ACTIVE | Imported by 2 module(s) | Keep |
| 135 | `frontend/src/components/export/DocumentExportButtons.jsx` | 76 | ACTIVE | Imported by 1 module(s) | Keep |
| 136 | `frontend/src/components/export/ExportButtons.jsx` | 102 | ACTIVE | Imported by 16 module(s) | Keep |
| 137 | `frontend/src/components/finance/FinanceFilters.jsx` | 86 | ACTIVE | Imported by 1 module(s) | Keep |
| 138 | `frontend/src/components/finance/FinanceOverview.jsx` | 134 | ACTIVE | Imported by 1 module(s) | Keep |
| 139 | `frontend/src/components/finance/FinanceRecordsTable.jsx` | 140 | ACTIVE | Imported by 1 module(s) | Keep |
| 140 | `frontend/src/components/finance/FinanceSummaryCards.jsx` | 76 | ACTIVE | Imported by 1 module(s) | Keep |
| 141 | `frontend/src/components/finance/FinanceTable.jsx` | 346 | ACTIVE | Imported by 1 module(s) | Keep |
| 142 | `frontend/src/components/finance/FinanceWizard.jsx` | 876 | ACTIVE | Imported by 1 module(s) | Keep |
| 143 | `frontend/src/components/finance/TenderSummaryCard.jsx` | 130 | ACTIVE | Imported by 1 module(s) | Keep |
| 144 | `frontend/src/components/payments/PaymentTabs.jsx` | 92 | ACTIVE | Imported by 1 module(s) | Keep |
| 145 | `frontend/src/components/tenderDetails/TenderBankingTab.jsx` | 338 | ACTIVE | Imported by 1 module(s) | Keep |
| 146 | `frontend/src/components/tenderDetails/TenderDailyProgressTab.jsx` | 166 | ACTIVE | Imported by 1 module(s) | Keep |
| 147 | `frontend/src/components/tenderDetails/TenderDocumentsTab.jsx` | 265 | ACTIVE | Imported by 1 module(s) | Keep |
| 148 | `frontend/src/components/tenderDetails/TenderFinanceTab.jsx` | 938 | ACTIVE | Imported by 1 module(s) | Keep |
| 149 | `frontend/src/components/tenderDetails/TenderMaterialsTab.jsx` | 336 | ACTIVE | Imported by 1 module(s) | Keep |
| 150 | `frontend/src/components/tenderDetails/TenderOverviewTab.jsx` | 364 | ACTIVE | Imported by 1 module(s) | Keep |
| 151 | `frontend/src/components/tenderDetails/TenderSitesTab.jsx` | 835 | ACTIVE | Imported by 1 module(s) | Keep |
| 152 | `frontend/src/components/tenderDetails/TenderSubcontractorsTab.jsx` | 328 | ACTIVE | Imported by 1 module(s) | Keep |
| 153 | `frontend/src/components/tenderDetails/TenderWorkersTab.jsx` | 253 | ACTIVE | Imported by 1 module(s) | Keep |
| 154 | `frontend/src/config/tenderDetailForms.js` | 38 | ACTIVE | Imported by 1 module(s) | Keep |
| 155 | `frontend/src/config/tenderDetailsTabs.js` | 52 | ACTIVE | Imported by 1 module(s) | Keep |
| 156 | `frontend/src/contexts/AuthProvider.jsx` | 167 | ACTIVE | Imported by 1 module(s) | Keep |
| 157 | `frontend/src/contexts/authContext.js` | 54 | ACTIVE | Imported by 15 module(s) | Keep |
| 158 | `frontend/src/hooks/useAsyncResource.js` | 151 | ACTIVE | Imported by 7 module(s) | Keep |
| 159 | `frontend/src/hooks/useCollection.js` | 177 | ACTIVE | Imported by 7 module(s) | Keep |
| 160 | `frontend/src/hooks/useFinanceStatistics.js` | 65 | ACTIVE | Imported by 1 module(s) | Keep |
| 161 | `frontend/src/hooks/useInvoices.js` | 68 | ACTIVE | Imported by 2 module(s) | Keep |
| 162 | `frontend/src/hooks/usePaymentManager.js` | 109 | ACTIVE | Imported by 1 module(s) | Keep |
| 163 | `frontend/src/hooks/usePaymentSections.js` | 139 | ACTIVE | Imported by 1 module(s) | Keep |
| 164 | `frontend/src/hooks/usePayments.js` | 94 | ACTIVE | Imported by 1 module(s) | Keep |
| 165 | `frontend/src/hooks/useSiteLogs.js` | 83 | ACTIVE | Imported by 1 module(s) | Keep |
| 166 | `frontend/src/hooks/useSiteOperations.js` | 454 | ACTIVE | Imported by 1 module(s) | Keep |
| 167 | `frontend/src/hooks/useSites.js` | 70 | ACTIVE | Imported by 1 module(s) | Keep |
| 168 | `frontend/src/hooks/useTenders.js` | 70 | ACTIVE | Imported by 1 module(s) | Keep |
| 169 | `frontend/src/hooks/useWorkerMoney.js` | 107 | ACTIVE | Imported by 1 module(s) | Keep |
| 170 | `frontend/src/hooks/useWorkers.js` | 69 | ACTIVE | Imported by 2 module(s) | Keep |
| 171 | `frontend/src/index.css` | 50 | ACTIVE | Imported via `frontend/src/index.css`; classes matched in JSX | Keep |
| 172 | `frontend/src/layouts/AppLayout.jsx` | 223 | ACTIVE | Imported by 1 module(s) | Keep |
| 173 | `frontend/src/main.jsx` | 115 | ACTIVE | Entry point — invoked by a script/runtime, not imported | Keep |
| 174 | `frontend/src/pages/ActivityPage.jsx` | 336 | ACTIVE | Imported by 1 module(s) | Keep |
| 175 | `frontend/src/pages/DailySiteUpdatesPage.jsx` | 1385 | ACTIVE | Imported by 1 module(s) | Keep |
| 176 | `frontend/src/pages/DailyUpdateApprovalsPage.jsx` | 1406 | ACTIVE | Imported by 1 module(s) | Keep |
| 177 | `frontend/src/pages/DashboardPage.jsx` | 1609 | ACTIVE | Imported by 1 module(s) | Keep |
| 178 | `frontend/src/pages/ForgotPasswordPage.jsx` | 188 | ACTIVE | Imported by 1 module(s) | Keep |
| 179 | `frontend/src/pages/InvoicesPage.jsx` | 973 | ACTIVE | Imported by 1 module(s) | Keep |
| 180 | `frontend/src/pages/LoginPage.jsx` | 246 | ACTIVE | Imported by 1 module(s) | Keep |
| 181 | `frontend/src/pages/MastersPage.jsx` | 712 | ACTIVE | Imported by 1 module(s) | Keep |
| 182 | `frontend/src/pages/PaymentsPage.jsx` | 512 | ACTIVE | Imported by 1 module(s) | Keep |
| 183 | `frontend/src/pages/RegisterPage.jsx` | 386 | ACTIVE | Imported by 1 module(s) | Keep |
| 184 | `frontend/src/pages/ReportsPage.jsx` | 1225 | ACTIVE | Imported by 1 module(s) | Keep |
| 185 | `frontend/src/pages/ResetPasswordPage.jsx` | 266 | ACTIVE | Imported by 1 module(s) | Keep |
| 186 | `frontend/src/pages/SettingsPage.jsx` | 2193 | ACTIVE | Imported by 1 module(s) | Keep |
| 187 | `frontend/src/pages/SiteOperationsPage.jsx` | 1457 | ACTIVE | Imported by 1 module(s) | Keep |
| 188 | `frontend/src/pages/SubcontractorPortalPage.jsx` | 2421 | ACTIVE | Imported by 1 module(s) | Keep |
| 189 | `frontend/src/pages/SubcontractorsPage.jsx` | 1754 | ACTIVE | Imported by 1 module(s) | Keep |
| 190 | `frontend/src/pages/TenderDetailsPage.jsx` | 1824 | ACTIVE | Imported by 1 module(s) | Keep |
| 191 | `frontend/src/pages/TendersPage.jsx` | 2487 | ACTIVE | Imported by 1 module(s) | Keep |
| 192 | `frontend/src/pages/UsersPage.jsx` | 1571 | ACTIVE | Imported by 1 module(s) | Keep |
| 193 | `frontend/src/pages/WorkerMoneyPage.jsx` | 2277 | ACTIVE | Imported by 1 module(s) | Keep |
| 194 | `frontend/src/pages/WorkerPortalPage.jsx` | 2620 | ACTIVE | Imported by 1 module(s) | Keep |
| 195 | `frontend/src/pages/WorkersPage.jsx` | 1217 | ACTIVE | Imported by 1 module(s) | Keep |
| 196 | `frontend/src/routes/AppRoutes.jsx` | 708 | ACTIVE | Imported by 1 module(s) | Keep |
| 197 | `frontend/src/routes/RoleRoute.jsx` | 117 | ACTIVE | Imported by 1 module(s) | Keep |
| 198 | `frontend/src/services/authService.js` | 40 | ACTIVE | Imported by 3 module(s) | Keep |
| 199 | `frontend/src/services/companyService.js` | 49 | ACTIVE | Imported by 1 module(s) | Keep |
| 200 | `frontend/src/services/dailyUpdateApprovalService.js` | 57 | ACTIVE | Imported by 1 module(s) | Keep |
| 201 | `frontend/src/services/invoiceService.js` | 47 | ACTIVE | Imported by 2 module(s) | Keep |
| 202 | `frontend/src/services/masterService.js` | 95 | ACTIVE | Imported by 1 module(s) | Keep |
| 203 | `frontend/src/services/notificationService.js` | 73 | ACTIVE | Imported by 2 module(s) | Keep |
| 204 | `frontend/src/services/paymentService.js` | 93 | ACTIVE | Imported by 4 module(s) | Keep |
| 205 | `frontend/src/services/siteLogService.js` | 40 | ACTIVE | Imported by 1 module(s) | Keep |
| 206 | `frontend/src/services/siteOperationsService.js` | 300 | ACTIVE | Imported by 2 module(s) | Keep |
| 207 | `frontend/src/services/siteService.js` | 40 | ACTIVE | Imported by 1 module(s) | Keep |
| 208 | `frontend/src/services/subcontractorPortalService.js` | 62 | ACTIVE | Imported by 1 module(s) | Keep |
| 209 | `frontend/src/services/subcontractorService.js` | 102 | ACTIVE | Imported by 3 module(s) | Keep |
| 210 | `frontend/src/services/tenderDetailsService.js` | 177 | ACTIVE BUT DUPLICATED | Second private `tenderPath()` helper duplicating the other service | Consolidate |
| 211 | `frontend/src/services/tenderService.js` | 501 | ACTIVE | Imported by 3 module(s) | Keep |
| 212 | `frontend/src/services/tenderWorkerService.js` | 75 | ACTIVE BUT DUPLICATED | Second private `tenderPath()` helper duplicating the other service | Consolidate |
| 213 | `frontend/src/services/uploadService.js` | 114 | ACTIVE | Imported by 5 module(s) | Keep |
| 214 | `frontend/src/services/userService.js` | 77 | ACTIVE | Imported by 3 module(s) | Keep |
| 215 | `frontend/src/services/workerMoneyService.js` | 169 | ACTIVE | Imported by 1 module(s) | Keep |
| 216 | `frontend/src/services/workerPortalService.js` | 75 | ACTIVE | Imported by 1 module(s) | Keep |
| 217 | `frontend/src/services/workerService.js` | 52 | ACTIVE | Imported by 3 module(s) | Keep |
| 218 | `frontend/src/styles/components/cards.css` | 99 | ACTIVE | Imported via `frontend/src/index.css`; classes matched in JSX | Keep |
| 219 | `frontend/src/styles/components/forms.css` | 209 | ACTIVE | Imported via `frontend/src/index.css`; classes matched in JSX | Keep |
| 220 | `frontend/src/styles/components/modal.css` | 35 | ACTIVE | Imported via `frontend/src/index.css`; classes matched in JSX | Keep |
| 221 | `frontend/src/styles/components/tables.css` | 149 | ACTIVE | Imported via `frontend/src/index.css`; classes matched in JSX | Keep |
| 222 | `frontend/src/styles/components/tabs.css` | 137 | ACTIVE | Imported via `frontend/src/index.css`; classes matched in JSX | Keep |
| 223 | `frontend/src/styles/core/animations.css` | 748 | STALE | Imported by index.css but contains rules with no matching className | Prune unused rules |
| 224 | `frontend/src/styles/core/global.css` | 77 | ACTIVE | Imported via `frontend/src/index.css`; classes matched in JSX | Keep |
| 225 | `frontend/src/styles/core/layout.css` | 145 | ACTIVE | Imported via `frontend/src/index.css`; classes matched in JSX | Keep |
| 226 | `frontend/src/styles/core/responsive.css` | 204 | ACTIVE | Imported via `frontend/src/index.css`; classes matched in JSX | Keep |
| 227 | `frontend/src/styles/core/utilities.css` | 90 | STALE | Imported by index.css but contains rules with no matching className | Prune unused rules |
| 228 | `frontend/src/styles/pages/auth.css` | 146 | STALE | Imported by index.css but contains rules with no matching className | Prune unused rules |
| 229 | `frontend/src/styles/pages/dashboard.css` | 150 | ACTIVE | Imported via `frontend/src/index.css`; classes matched in JSX | Keep |
| 230 | `frontend/src/styles/pages/payments.css` | 52 | ACTIVE | Imported via `frontend/src/index.css`; classes matched in JSX | Keep |
| 231 | `frontend/src/styles/pages/reports.css` | 57 | STALE | Imported by index.css but contains rules with no matching className | Prune unused rules |
| 232 | `frontend/src/styles/pages/settings.css` | 53 | ACTIVE | Imported via `frontend/src/index.css`; classes matched in JSX | Keep |
| 233 | `frontend/src/styles/pages/site-operations.css` | 316 | ACTIVE | Imported via `frontend/src/index.css`; classes matched in JSX | Keep |
| 234 | `frontend/src/styles/pages/subcontractor-portal.css` | 24 | ACTIVE | Imported via `frontend/src/index.css`; classes matched in JSX | Keep |
| 235 | `frontend/src/styles/pages/tender-details.css` | 37 | STALE | Imported by index.css but contains rules with no matching className | Prune unused rules |
| 236 | `frontend/src/styles/pages/tenders.css` | 35 | STALE | Imported by index.css but contains rules with no matching className | Prune unused rules |
| 237 | `frontend/src/styles/pages/worker-portal.css` | 60 | ACTIVE | Imported via `frontend/src/index.css`; classes matched in JSX | Keep |
| 238 | `frontend/src/templates/brandedExportTheme.js` | 63 | ACTIVE | Imported by 2 module(s) | Keep |
| 239 | `frontend/src/templates/subletBillTemplate.js` | 109 | ACTIVE | Imported by 1 module(s) | Keep |
| 240 | `frontend/src/utils/currency.js` | 126 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 241 | `frontend/src/utils/documentExportHelpers.js` | 466 | ACTIVE | Imported by 1 module(s) | Keep |
| 242 | `frontend/src/utils/exportHelpers.js` | 290 | ACTIVE | Imported by 1 module(s) | Keep |
| 243 | `frontend/src/utils/financeHelper.js` | 162 | ACTIVE | Imported by 5 module(s) | Keep |
| 244 | `frontend/src/utils/ledgerExportHelpers.js` | 424 | ACTIVE | Imported by 1 module(s) | Keep |
| 245 | `frontend/src/utils/roleAccess.js` | 32 | ACTIVE | Imported by 3 module(s) | Keep |
| 246 | `frontend/src/utils/tenderCalculations.js` | 136 | ACTIVE | Module is imported, but exports named symbols with no consumer (see §6) | Prune dead exports |
| 247 | `frontend/vercel.json` | 61 | CONFIGURATION | Non-JS tracked file | Keep |
| 248 | `frontend/vite.config.js` | 30 | ACTIVE | Entry point — invoked by a script/runtime, not imported | Keep |
| 249 | `render.yaml` | 141 | CONFIGURATION | Non-JS tracked file | Keep |
---

# 4. Confirmed unused files

**Whole files with no reference: none.** Every tracked module resolves from
an entry point. Two tracked files are *empty*, which is a different problem:

| File | Why it is a finding | Searches performed | Safe to delete? | Confidence |
|---|---|---|---|---|
| `DEPLOYMENT.md` | **0 bytes in the working tree only.** `git show HEAD:DEPLOYMENT.md` returns 235 lines, committed in `65abd2f` and extended in `73b558f`. The working copy had been emptied without committing, so `HANDOVER.md:28`'s pointer resolved to nothing locally. | `wc -c`, `git show HEAD:`, `git log --stat -- DEPLOYMENT.md` | **No.** The committed content was recovered and merged into the rewritten guide. | High |
| `backend/.env.example` | 0 bytes. `.gitignore:24` deliberately re-includes `!.env.example` to keep a template; the template has no content. `HANDOVER.md` lists `.env.example` under "What was built". | `wc -c`, `grep -oE "^[A-Z_]+"` → 0 names | **No — populate instead.** | High |

## Files that *look* unused but are not

Recorded so a future pass does not delete them:

| File | Why it appears unused | Why it is required |
|---|---|---|
| `backend/database/migrations/*.sql` (5) | No runtime code imports them | Historical schema steps, applied by `psql`. Never delete a migration. |
| `backend/scripts/verifyTenantContext.js` | Zero inbound imports | Documented in `HANDOVER.md` as the mandatory pre-deploy RLS check: `node scripts/verifyTenantContext.js` |
| `backend/scripts/createBreakGlassAdmin.js` | Zero inbound imports | Manual CLI recovery tool; `BREAK_GLASS_ADMIN_*` vars exist in `backend/.env` |
| `backend/database/check-database.js` | Zero inbound imports | Manual diagnostic CLI |
| `backend/tests/**` (14) | Zero inbound imports | Entry points for `vitest run` |
| `frontend/src/main.jsx` | Zero inbound imports | The Vite entry, referenced from `frontend/index.html` |
| `frontend/vite.config.js`, `eslint.config.js`, `backend/vitest.config.mjs` | Zero inbound imports | Tool configuration, loaded by name |
| `frontend/public/favicon.svg`, `icons.svg` | Not imported by any module | Vite `public/` assets, served by path |

## Tracked junk

| File | Evidence | Action |
|---|---|---|
| `backend/database/.DS_Store` | macOS Finder metadata | `git rm --cached` |
| `backend/modules/payments/.DS_Store` | ditto | `git rm --cached` |
| `backend/modules/workers/.DS_Store` | ditto | `git rm --cached` |

`.gitignore:71` already lists `.DS_Store` and its own comment admits it:
*"Several are still tracked from before this rule existed."* Three remain.

---

# 5. Confirmed stale code

## S-01 · `backend/server.js:40` — comment names a script that does not exist

**Stale text:** `npm run dev / npm start — Render's startCommand runs this file`

**Reality:** `backend/package.json` declares only `dev`, `test`,
`test:watch`. There is **no `start` script**. `render.yaml:24` uses
`startCommand: node server.js` directly.

**Action:** correct the comment, or add a `start` script. Nothing is broken
today — Render does not invoke `npm start`.

## S-02 · `backend/server.js:676-688` — an import deliberately left unused

```js
const tenderRoutes = require("./modules/tenders/tender.routes");   // line 131
...
app.use("/api/tenders", authMiddleware, requireOffice,
  require("./modules/tenders/tender.routes"));                     // line 685
```

The file's own comment concedes it: *"the top-level import is simply unused
for this one mount. Left as it is; this pass does not change code."*
`tenderRoutes` is bound and never read. Three other mounts do the same
inline-require thing (`siteOperations`, `masters`, `notifications`,
`activity`) but those have **no** top-level import, so only `tenderRoutes`
is genuinely dead.

**Action:** use the binding at line 685. One-line change, zero behaviour
delta (both resolve to the same cached module).

## S-03 · `frontend/src/services/tenderDetailsService.js:5-12` — banner documents endpoints the file does not call

The header claims:

```
 * - GET/POST/PUT/DELETE /tenders/:id/documents
 * - GET/POST/PUT/DELETE /tenders/:id/materials
 * - GET/POST/PUT/DELETE /tenders/:id/banking
 * - GET/POST/PUT/DELETE /tenders/:id/subcontractors
 * - GET/POST/PUT/DELETE /tenders/:id/workers
 * - GET/POST/PUT/DELETE /tenders/:id/finance
```

Actual exports (`grep -nE "^export (const|function)"`):

| Claimed | Actually exported |
|---|---|
| documents GET/POST/PUT/DELETE | `addTenderDocument`, `deleteTenderDocument` — **no PUT** |
| materials GET/POST/PUT/DELETE | `addTenderMaterial`, `deleteTenderMaterial` — **no PUT** |
| banking GET/POST/PUT/DELETE | `addTenderBanking`, `deleteTenderBanking` — **no PUT** |
| subcontractors | `assign`, `update`, `remove` — complete |
| workers | **not in this file** — lives in `tenderWorkerService.js` |
| finance | **absent entirely** |

**Action:** correct the banner to match the file.

## S-04 · `frontend/.env.example:42-59` — the template contains a second, contradictory copy of its own header

Line 5: `# .env is gitignored; this file is the tracked template.`
Line 58: `# This file is gitignored; .env.example is the tracked template.`

Lines 42-59 duplicate lines 1-17 with `.env`'s wording. It reads as though
the real `.env` was pasted into the template. The file also ships a
production URL (`VITE_API_URL=https://construction-portal-backend-...`) as
its default, which contradicts the local-development framing of lines 19-21.

## S-05 · `frontend/src/styles/pages/auth.css:121-143` — superseded password-input styles

| Selector | Status |
|---|---|
| `.password-input-wrapper`, `.password-toggle-btn` (`tabs.css:73-96`) | **ACTIVE** — matches `className="password-toggle-btn"` in `LoginPage.jsx:195`, `RegisterPage.jsx:292`, `UsersPage.jsx:1005` |
| `.password-input-row`, `.password-toggle-button` (`auth.css:121-143`) | **STALE** — the older `-button` naming; zero JSX matches |

Two naming conventions for one control; only one is wired. (Separately: the
live rules live in `tabs.css`, which has nothing to do with tabs.)

## S-06 · `docs/repository-reference/.pass-status.txt` — index out of sync with the tree

Lists **3 files that do not exist**:
`backend/database/migrations/README.md`, `backend/database/schema.sql`,
`backend/database/snapshots/schema-production.sql`.

Omits **at least 6 files that do exist**: `backend/scripts/verifyTenantContext.js`,
`backend/utils/maskSensitive.js`, `backend/tests/entryWindowPermission.test.js`,
`entryWindowTimezone.test.js`, `subcontractorFinancialAccess.test.js`,
`tenderClientValidation.test.js`, `tenderCrossTenant.test.js`.

Also: 160 of its ~220 entries are still marked `TODO`, so the pass it tracks
was never completed.

## S-07 · `docs/repository-reference/findings.md:59-68` (F-02) — evidence no longer holds

F-02 states *"`JWT_REFRESH_EXPIRES_IN` … is declared in the template"*,
naming `backend/.env.example`. That file is now empty, so the variable is
declared nowhere. The finding's conclusion (there is no refresh flow) is
still correct; its evidence is not.

## S-08 · `frontend/src/routes/AppRoutes.jsx:406-423` — legacy redirects

`/sites` and `/sites/:id` both `<Navigate to="/tenders" replace />`. The
standalone Sites page was removed; `Sidebar.jsx:39` documents the decision.
These are intentional compatibility shims — **keep** — but note that
`/sites/:id` discards the id, so a bookmarked site link lands on the
register rather than that site.

---

# 6. Unused exports, imports, variables, and functions

52 exported symbols have no reference in any other tracked file. Verified
individually with `grep -rn "\bSYMBOL\b" backend frontend`. Comment-only
matches were excluded.

## 6.1 Highest value — dead infrastructure

| File | Symbol | Type | Evidence | Action |
|---|---|---|---|---|
| `backend/database/pool.js` | `withTenant` | function | 0 refs outside `pool.js`. `HANDOVER.md` confirms: *"written as 'the only supported way' to set that variable and then never called"* | **Verify before removal** — see §9 |
| `backend/database/pool.js` | `tenantQuery` | function | 0 refs outside `pool.js` | Verify before removal |
| `backend/middleware/rateLimiter.js` | `passwordResetLimiter` | middleware | 0 refs. `server.js` mounts only `apiLimiter` and `authLimiter` | Wire it to `/auth/forgot-password` **or** delete |
| `backend/config/mailer.js` | `sendAccountInviteEmail` | function | 0 refs. Carries the unescaped-HTML defect F-07 | Delete, or wire and fix F-07 |
| `backend/config/mailer.js` | `checkMailConnection`, `sendMail` | function | 0 refs | Review |
| `backend/config/supabase.js` | `createSignedFileUrl`, `getStorageBucketClient`, `getSupabaseClient`, `getStorageBucket`, `isStorageConfigured` | function | 0 external refs | Review — signed URLs are a plausible future need |

`passwordResetLimiter` is the notable one: a rate limiter written for the
password-reset path and never mounted. `POST /api/auth/forgot-password` is
covered by `authLimiter` at the mount (`server.js:535`), so the endpoint is
not unprotected — but the dedicated limiter is dead.

## 6.2 Controllers exporting handlers with no route (extends F-10)

| File | Symbol | Evidence |
|---|---|---|
| `backend/modules/workers/worker.controller.js` | `getWorkerById` | Exported; `worker.routes.js` mounts only `/`, `POST /`, `PUT /:id`, `DELETE /:id`. `GET /api/workers/:id` 404s. |
| `backend/modules/invoices/invoice.controller.js` | `getInvoiceById` | Same shape; `GET /api/invoices/:id` 404s. |

`subcontractors` was fixed under F-12; `sites` always routed it. These two
remain dead export surface.

## 6.3 Query and validation helpers

| File | Symbol | Evidence |
|---|---|---|
| `backend/modules/tenders/tenderQueries.js` | `getTenderDailyUpdates` | 0 refs. `tender.service.js` never calls it; the daily-progress tab reads from `/details`. |
| `backend/utils/requestContext.js` | `getCompanyId`, `requireText`, `companyRecordExists`, `tenderExists`, `siteExists`, `workerExists`, `subcontractorExists`, `sendServerError` | 8 of the module's exports have no external caller |
| `backend/modules/companies/company.service.js` | `normaliseCompanyStatus`, `normaliseCompanyPayload`, `getCompanyById`, `getCompanyMembership` | 0 external refs |
| `backend/modules/auth/auth.service.js` | `createBaseUser`, `createCompanyMembership` | 0 external refs |
| `backend/modules/uploads/upload.middleware.js` | `uploadSingleFile`, `handleUploadErrors`, `getFileExtension`, `ALLOWED_MIME_TYPES`, `MIME_EXTENSION_MAP` | 0 external refs (several are used *within* the file) |
| `backend/utils/maskSensitive.js` | `MASK_CHARACTER`, `SENSITIVE_FINANCIAL_FIELDS` | Constants exported alongside the used masking functions |
| `backend/modules/payments/payment.hierarchy.js` | `SCOPES` | 0 external refs |
| `backend/tests/helpers/testDb.js` | `RUN_ID` | Exported; no test imports it |

> **Caution:** several of these are *internal* helpers that happen to be
> exported. Removing the `export`/`module.exports` entry is safe; removing
> the function body is not, unless it is also unused inside its own file.
> That distinction was **not** verified per-symbol and must be checked
> before any deletion.

## 6.4 Unused constants

`backend/config/constants.js` exports 8 constant groups with no consumer:
`INSPECTION_STATUS`, `MILESTONE_STATUS`, `NOTIFICATION_TYPES`,
`COMMENT_MODULES`, `PAYMENT_TYPES`, `PAYMENT_MODES`, `PAYMENT_DIRECTIONS`,
`CURRENCY_CODES`.

Three of these — `INSPECTION_STATUS`, `MILESTONE_STATUS`, `COMMENT_MODULES` —
correspond to the future tables `site_inspections`, `tender_milestones`,
`comments` (§9). Classify as **FUTURE**, not stale.

`PAYMENT_TYPES` / `PAYMENT_MODES` / `PAYMENT_DIRECTIONS` are a different
case: the payment tree is served live from `GET /api/payments/hierarchy`
(`payment.hierarchy.js`), which `HANDOVER.md` describes as the fix for
having *"the Add Payment tree … twice"*. These constants are a **residue of
the version that was replaced** — the same duplication, one layer down.

## 6.5 Frontend unused exports

| File | Symbol | Evidence |
|---|---|---|
| `frontend/src/utils/currency.js` | `getCurrencyCode`, `getCurrencyConfig`, `getCurrencySymbol`, `formatCurrencyWithoutDecimals` | 0 refs. Only `formatCurrency` is consumed. |
| `frontend/src/utils/tenderCalculations.js` | `getTenderValue`, `calculateFinancePreview` | 0 refs anywhere in `frontend/src` |

`frontend/src/utils/tenderCalculations.js` is the strongest frontend
candidate: a 
module whose two main exports are both uncalled.

## 6.6 Unused imports and variables

**Frontend: none.** `npx eslint src/` reports 0 problems, and
`js.configs.recommended` includes `no-unused-vars`. This is mechanically
verified, not asserted.

**Backend: not mechanically checkable.** There is no ESLint configuration
under `backend/`. The one instance found by inspection is `tenderRoutes`
(S-02). Others may exist; adding a backend linter is the recommendation
(§10), not a manual sweep.

---

# 7. Duplicate implementations

## D-01 · Two `tenderPath()` helpers · **ACTIVE BUT DUPLICATED**

| File | Line | Body |
|---|---|---|
| `frontend/src/services/tenderDetailsService.js` | 50 | `` `/tenders/${id}${suffix}` `` |
| `frontend/src/services/tenderWorkerService.js` | 42 | `` `/tenders/${id}/workers${suffix}` `` |

Both validate with the same `Number(tenderId)` / `Number.isNaN` guard and
throw the same message, *"A valid tender ID is required."* The second is the
first with `/workers` baked in.

**Active:** both. **Risk of drift:** the validation rule is written twice, so
a change to id handling must be made in two places. **Recommendation:**
export `tenderPath` from `tenderDetailsService.js` and have the worker
service compose it.

## D-02 · Two collection-hook instances per register · **FIXED THIS SESSION**

`App.jsx` and the register pages each called the same collection hook,
giving two independent copies of one list. Repaired for tenders earlier in
this session (single `useTenders` instance in `App.jsx`, threaded through
`AppRoutes` into `TendersPage`).

**Still duplicated — same defect, not yet fixed:**

| Page | Duplicate call | App-level copy | Consumers of the stale copy |
|---|---|---|---|
| `frontend/src/pages/WorkersPage.jsx:55` | `useWorkers(user)` | `App.jsx:74` | `AppRoutes.jsx:316, 469, 535, 641` |
| `frontend/src/pages/InvoicesPage.jsx:48` | `useInvoices(user)` | `App.jsx:97` | `AppRoutes.jsx:319, 644` |

**Consequence:** adding a worker or an invoice refreshes only that page's
copy. Dashboard and Reports keep showing the list as it stood at login until
a full browser reload, because `useCollection` re-fetches only when
`${user.id}:${user.role}` changes (`useCollection.js:85-87, 145-149`).

**Recommendation:** apply the tenders fix to both. This is a correctness
bug, not just tidiness.

## D-03 · Three export-helper modules

| File | Lines | Importers |
|---|---|---|
| `frontend/src/utils/exportHelpers.js` | 289 | `financeHelper.js`, `ExportButtons.jsx` |
| `frontend/src/utils/documentExportHelpers.js` | 465 | `DocumentExportButtons.jsx`, `subletBillTemplate.js`, `brandedExportTheme.js` |
| `frontend/src/utils/ledgerExportHelpers.js` | 423 | `TenderFinanceTab.jsx` |

All three are **reachable** — unlike the "three CSV exporters, one reachable"
state `HANDOVER.md` records, which was resolved. They remain 1,177 lines
across three modules doing PDF/XLSX export with jsPDF + xlsx in each.

**Classification: ACTIVE, overlapping.** Not stale. Consolidation is a
refactor with real regression risk (three different output formats), so it
is listed under *Refactor*, not *Safe now*.

## D-04 · Payment hierarchy constants vs. the live API

See §6.4. `PAYMENT_TYPES` / `PAYMENT_MODES` / `PAYMENT_DIRECTIONS` in
`config/constants.js` duplicate, statically, what `payment.hierarchy.js`
serves dynamically over `GET /api/payments/hierarchy`. The dynamic version
is authoritative and is what the form now reads.

## D-05 · Duplicate role gate at the masters mount

`server.js:741-748` mounts `/api/masters` behind `requireOffice`, and
`master.routes.js` applies `requireOffice` again on its three write routes.
The second check can never fail if the first passed. Recorded as F-15;
still open. Harmless, but the router's banner documents *looser* access than
it has.

---

# 8. Unreachable frontend and backend paths

## 8.1 Backend routes with no internal consumer

Marked **"No internal consumer found"** — not "unused". These may be called
by external tooling; there is no evidence either way.

| Route | Evidence |
|---|---|
| `GET /api/tenders/:id/finance` | No caller. `tenderDetailsService.js` exports no finance function. |
| `POST /api/tenders/:id/finance` | idem |
| `PUT /api/tenders/:id/finance/:financeId` | idem |
| `DELETE /api/tenders/:id/finance/:financeId` | idem |
| `GET /api/tenders/:id/finance/summary` | idem |
| `PUT /api/tenders/:id/documents/:documentId` | Service exports add + delete only |
| `PUT /api/tenders/:id/materials/:materialId` | idem |
| `PUT /api/tenders/:id/banking/:bankingId` | idem |
| `PUT /api/tenders/:id/workers/:assignmentId` | `tenderWorkerService.js` exports get/assign/remove only |
| `GET /api/upload`, `GET /api/upload/:id`, `DELETE /api/upload/:id` | No caller. `HANDOVER.md` agrees: *"A file manager … have no caller."* |
| `PUT /api/company`, `PUT /api/company/members/:userId/role`, `DELETE /api/company/members/:userId`, `POST /api/company/transfer-ownership` | No screen. `HANDOVER.md`: *"all work and have no screen."* |
| `GET /api/tenders/statistics` | 1 reference in the frontend; verify it is a live call path |
| `PUT`/`DELETE /api/site-operations/labour/:id`, `DELETE /api/site-operations/materials/:id` | `HANDOVER.md`: *"A supervisor who mistypes an entry cannot correct it; the delete and update endpoints exist."* |
| `GET /api/site-operations/materials/summary` | No caller found |

**Note:** the four `PUT` gaps and the finance block are the same shape as the
faults `HANDOVER.md` describes finding last pass ("an endpoint and a screen
that disagreed"). The direction is the safe one here — an endpoint with no
screen, rather than a screen with no endpoint — but the drift has returned.

## 8.2 Backend routes with no frontend caller — but a legitimate reason

| Route | Why it is fine |
|---|---|
| `GET /`, `GET /api/test` | Liveness probes, documented in `server.js:466-516` |
| `GET /api/health`, `/api/health/ready` | `render.yaml:26` sets `healthCheckPath: /api/health` |
| `GET /api/auth/me` | 3 references in `frontend/src` |

## 8.3 Frontend routes not reachable from navigation

| Route | Status |
|---|---|
| `/projects`, `/projects/:id` | Intentional alias → `/tenders`. Keep. |
| `/sites`, `/sites/:id` | Legacy redirect → `/tenders` (S-08). Keep; `:id` is discarded. |
| `/worker-portal`, `/subcontractor-portal` | Not in the sidebar **by design** — role landing pages via `getHomePath()` in `RoleRoute.jsx`. Reachable. |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Public routes, reached when unauthenticated. |

**No orphaned page components.** All 22 files in `frontend/src/pages/` are
mounted in `AppRoutes.jsx`.

## 8.4 Components that cannot render

None found. Every component in `frontend/src/components/` has at least one
inbound import.

---

# 9. Database findings

## 9.1 Tables with no code consumer

Verified by `grep -rn "\btable_name\b"` across `backend/modules`,
`backend/utils`, `backend/config`, excluding comment-only matches.

| Table | Consumer? | Classification |
|---|---|---|
| `ai_conversations` | none | **FUTURE** (pgvector embeddings) |
| `ai_insights` | none | **FUTURE** |
| `inventory_items` | none | **FUTURE** |
| `inventory_transactions` | none | **FUTURE** |
| `tender_milestones` | none | **FUTURE** — `MILESTONE_STATUS` constant exists |
| `site_model_annotations` | none | **FUTURE** |
| `tags` | none | **FUTURE** |
| `tag_assignments` | none | **FUTURE** |
| `saved_reports` | none | **FUTURE** |
| `user_settings` | none | **FUTURE** |
| `comments` | none (prose matches only) | **FUTURE** — `COMMENT_MODULES` constant exists |
| `worker_sensitive_details` | none (prose matches only) | **FUTURE / security-relevant** |

**Do not drop any of these.** They are schema ahead of code. `HANDOVER.md`
reaches the same conclusion: *"dropping them destroys design intent — so
they are reported, not removed."*

`worker_sensitive_details` is the one to act on rather than remove: it has
encrypted columns for bank details while `subcontractors` stores account
numbers in plain text (F-12, partially fixed — encryption at rest is the
remaining action).

## 9.2 Correction to prior documentation

`HANDOVER.md` lists `site_inspections` and `site_3d_models` among the
"still-unused tables". **That is no longer accurate.** Both are referenced
in `backend/modules/uploads/upload.controller.js:222-231` as entries in the
upload ownership allow-list:

```js
inspection: { table: "site_inspections",  companyColumn: "company_id" },
model:      { table: "site_3d_models",    companyColumn: "company_id" },
```

They have no CRUD module, but they do have a consumer.

## 9.3 Migrations superseded by later migrations

| Object | Created by | Dropped by | Problem |
|---|---|---|---|
| `public.tender_workers` | `001_upgrade_schema.sql` | `005_drop_duplicate_assignment_table.sql:55` | **`002_baseline_supabase.sql:1671` recreates it** — along with `tender_workers_id_seq` (:1697) and `trg_tender_workers_updated_at` |

**Consequence.** 002 is the baseline for a *fresh* Supabase project. Building
from 002 → 003 → 004 produces a database containing the exact duplicate
table that 005 exists to remove. Anyone following the documented fresh-install
path must also run 005, and nothing currently says so — because the file that
would say it, `migrations/README.md`, does not exist (A-03).

**Do not edit 002 to remove the table.** It is a generated `pg_dump` baseline
and its value is that it reproduces a known-good state. The fix belongs in
the migration README: *run 005 after 004 on fresh installs too.*

## 9.4 Historical migration objects — keep

All 5 migration files are **MIGRATION / historical**. None should be deleted
or marked unused for lacking a runtime import. Recorded for completeness:

| File | Lines | Contents |
|---|---|---|
| `001_upgrade_schema.sql` | 785 | 2 missing tables, `company_id` on 8 tables, 7 operational tables |
| `002_baseline_supabase.sql` | 4,421 | Full baseline: 48 tables, 11 unique indexes, 1 view (`tender_site_counts`), triggers |
| `003_supabase_rls.sql` | 387 | `construction_app` role + RLS policies |
| `004_seed_reference_data.sql` | 249 | 24 materials, 13 labour categories, seeding trigger |
| `005_drop_duplicate_assignment_table.sql` | 70 | Conditional, non-destructive drop of `tender_workers` |

## 9.5 RLS policies that are not in force

`003_supabase_rls.sql` creates `CREATE ROLE construction_app` and a
`tenant_isolation` policy per table. Live evidence from the running dev
server:

```
[database] Connected as a role that BYPASSES row-level security (postgres).
The migration 003 policies have no effect; tenant isolation rests entirely
on the WHERE clauses in the application.
```

**Classification: FUTURE / not-yet-active**, not stale. The policies are
correct and dormant. They activate only when `DATABASE_URL` uses
`construction_app`.

This is what makes A-05 (`withTenant` uncalled) worth attention rather than
mere tidiness — see the risk note in §12.

## 9.6 Columns never referenced

**Not fully verified — NEEDS MANUAL REVIEW.** Column-level usage requires
parsing every SQL string against `information_schema`, which was out of reach
of static analysis here. Two column-level facts *were* confirmed from
existing documentation and code:

- `labour.category_local` is created but never populated; the seed fills
  `labour_categories.name_local` instead (F-06). A screen reading
  `labour.category_local` finds it empty.
- `clients` has **no** `is_deleted` column (F-16, fixed). Any new query
  filtering on it will raise `42703`.

---

# 10. Dependency and configuration findings

## 10.1 Unused npm packages

| Package | Manifest | Evidence | Action |
|---|---|---|---|
| `@types/react` | `frontend/package.json` devDependencies | No `tsconfig.json`, no `.ts`/`.tsx` file in the repo. `.gitignore:52` says *"No TypeScript here yet."* | **Safe to remove** |
| `@types/react-dom` | idem | idem | **Safe to remove** |

All other 24 packages are used. `nodemon` shows no import but is used as a
CLI in `"dev": "nodemon server.js"` — **not** unused.

## 10.2 npm scripts

| Script | Status |
|---|---|
| `backend`: `dev`, `test`, `test:watch` | All valid |
| `frontend`: `dev`, `build`, `lint`, `preview` | All valid |
| **missing** `backend`: `start` | `server.js:40` references `npm start`; it does not exist (S-01). Render does not need it. |

## 10.3 `backend/package.json` — `"main": "index.js"`

`backend/index.js` does not exist. The real entry is `server.js`. Recorded as
F-01, still open. Harmless (nothing `require`s this package) but misleading.

## 10.4 Environment variables

**Read by backend code: 37 variables.**

```
ALLOWED_UPLOAD_FOLDERS  AUTH_RATE_LIMIT_MAX  CORS_ORIGINS  DATABASE_URL
DB_APPLICATION_NAME  DB_CONNECTION_TIMEOUT_MS  DB_IDLE_TIMEOUT_MS
DB_POOL_MAX  DB_POOL_MIN  DB_QUERY_TIMEOUT_MS  DB_SSL  DB_SSL_CA
DB_SSL_REJECT_UNAUTHORIZED  DB_STATEMENT_TIMEOUT_MS  DEFAULT_CURRENCY
DEFAULT_TIMEZONE  FRONTEND_URL  JWT_EXPIRES_IN  JWT_SECRET  MAIL_FROM
MAIL_FROM_NAME  MAX_UPLOAD_SIZE_MB  NODE_ENV  PORT  RATE_LIMIT_MAX
RATE_LIMIT_WINDOW_MS  RESET_TOKEN_TTL_MINUTES  SMTP_HOST  SMTP_PASSWORD
SMTP_PORT  SMTP_SECURE  SMTP_USER  SUPABASE_BUCKET
SUPABASE_SERVICE_ROLE_KEY  SUPABASE_URL  SUPERVISOR_BANKING_GRACE_DAYS
SUPERVISOR_EDIT_WINDOW_DAYS
```

Only three files touch `process.env` at all — `config/env.js` (37 of them),
`scripts/verifyTenantContext.js` (2) and `utils/requestContext.js` (1). That
matches the design stated in `config/env.js:6`: *"The single place the
backend reads process.env."*

**Missing from `backend/.env.example`: all 37.** The template is empty (A-02).
This is the single largest configuration gap in the repository.

### Method note — a false finding was corrected here

A first pass using `grep -oE "process\.env\.[A-Z_]+"` found only 23
variables and appeared to show that `SUPABASE_SERVICE_ROLE_KEY`,
`ALLOWED_UPLOAD_FOLDERS`, `AUTH_RATE_LIMIT_MAX`, `RESET_TOKEN_TTL_MINUTES`
and the `SUPERVISOR_*` pair were set in `render.yaml` but never read — which
would have been a serious deployment defect.

**That conclusion was wrong.** This codebase formats property access across
lines:

```js
const AUTH_RATE_LIMIT_MAX =
  readPositiveInteger(
    process.env
      .AUTH_RATE_LIMIT_MAX,
```

A line-anchored regex cannot see `process.env` and `.AUTH_RATE_LIMIT_MAX` as
one expression. Re-running with whitespace collapsed found all 37. Recorded
because the same trap will catch the next automated scan of this repository.

**Genuinely read nowhere:**

| Variable | Evidence | Note |
|---|---|---|
| `JWT_REFRESH_EXPIRES_IN` | Absent from the 37-name list above | No refresh-token flow exists — confirms F-02 |
| `BASE_URL` | Absent from the list; set in `render.yaml` and `backend/.env` | Verify before removing from the blueprint |
| `BREAK_GLASS_ADMIN_EMAIL` / `_PASSWORD` / `_COMPANY_ID` | Present in `backend/.env`; not in the scan | `scripts/createBreakGlassAdmin.js` did not register as a `process.env` reader — **NEEDS MANUAL REVIEW**, do not remove |

## 10.5 Frontend environment variables

Only two are read: `import.meta.env.VITE_API_URL` and `import.meta.env.DEV`.
`VITE_API_URL` is present in `frontend/.env.example`. **No gap.**

## 10.6 Deployment configuration

| File | Status | Note |
|---|---|---|
| `render.yaml` | **ACTIVE, current** | `startCommand: node server.js`, `healthCheckPath: /api/health`, `rootDir: backend`. Secrets correctly `sync: false`. Break-glass vars deliberately unset. |
| `frontend/vercel.json` | **ACTIVE, current** | SPA rewrite + CSP. `connect-src` lists the Render origin and both localhost forms. |
| Docker files | **none** | No `Dockerfile` or `docker-compose.yml` tracked. |
| CI/CD | **none** | No `.github/workflows/`. Tests and lint are manual. |

**No conflicting configuration found.** `render.yaml` sets `PORT: 10000`
while commenting *"Render supplies PORT"* — harmless, but the value is
redundant with the platform's own injection.

## 10.7 Missing tooling

| Gap | Consequence |
|---|---|
| No ESLint config under `backend/` | Unused imports/variables in ~100 backend modules are undetectable. Directly limits this audit (§2). |
| No frontend test runner | `eslint.config.js:17` states it. No regression net on the UI. |
| No CI workflow | Nothing enforces lint/test before a push. |

---

# 11. Documentation mismatches

| # | Document | Claim | Code evidence | Verdict |
|---|---|---|---|---|
| M-01 | `HANDOVER.md:28` | "See **DEPLOYMENT.md** — it takes five minutes." | The file was 0 bytes in the working tree; 235 lines in `HEAD` | **Was locally broken; now resolved** |
| M-02 | `HANDOVER.md:30` | "`backend/database/migrations/README.md` says which files to run" | File not tracked | **Broken pointer** |
| M-03 | `HANDOVER.md` "Tests" | "143 passing" | `npm test` → 215 tests, 214 pass, 1 fail | **Stale count** |
| M-04 | `HANDOVER.md` "Database" | "Four migration files" | There are **5** (005 is described later in the same document) | **Internally inconsistent** |
| M-05 | `HANDOVER.md` "Security" | "`.env.example`" listed under "What was built" | `backend/.env.example` is 0 bytes | **Overstated** |
| M-06 | `HANDOVER.md` "Still-unused tables" | Lists `site_inspections`, `site_3d_models` | Both referenced in `upload.controller.js:222-231` | **Now inaccurate** |
| M-07 | `HANDOVER.md` audit table | "Dead exports 30 → 0" | 52 unused-export candidates found; ≥20 verified with 0 refs | **No longer true** |
| M-08 | `HANDOVER.md` audit table | "`className` with no CSS rule 9 → 0" | Reverse scan: **0 of 121** tokens lack a rule | **Still true — verified** |
| M-09 | `HANDOVER.md` audit table | "Orphan files 14 → 0" | Import graph: **0 orphans** | **Still true — verified** |
| M-10 | `backend/database/README.md:15` | Describes `snapshots/schema-production.sql` | Not tracked | **Broken pointer** |
| M-11 | `backend/database/README.md:14,20` | "Start with `migrations/README.md`" | Not tracked | **Broken pointer** |
| M-12 | `server.js:40` | "npm run dev / npm start" | No `start` script | **Stale** |
| M-13 | `tenderDetailsService.js:5-12` | Documents workers + finance endpoints | Neither is in the file | **Stale** (S-03) |
| M-14 | `findings.md` F-02 | "declared in the template" | Template is empty | **Evidence void** (S-07) |
| M-15 | `master.routes.js` banner | "Reading is open to any authenticated user" | Mounted behind `requireOffice` | **Stale** (F-15, open) |
| M-16 | `.pass-status.txt` | Indexes 3 non-existent files; omits ≥6 real ones; 160 entries still `TODO` | `git ls-files` | **Stale index** (S-06) |
| M-17 | `.gitignore:96` | "alongside the tracked `database/snapshots/schema-production.sql`" | Not tracked | **Stale comment** |
| M-18 | `frontend/.env.example:5` vs `:58` | Two contradictory statements about which file is gitignored | Same file | **Self-contradictory** (S-04) |

`HANDOVER.md` is the most valuable document in the repository and also the
one most out of date. Its analytical content (what was wrong, why, what the
fixes were) remains sound; its **counts, file pointers and status tables**
have drifted.

---

# 12. Recommended cleanup plan

## Safe now — no behaviour change, no verification needed

| # | Action | Files | Effort |
|---|---|---|---|
| 1 | Restore + expand `DEPLOYMENT.md` (recovered from `HEAD`, merged with new material) | root | **done by this audit** |
| 2 | Populate `backend/.env.example` with all 37 read variables (names only, no values) | 1 | 15 min |
| 3 | `git rm --cached` the 3 `.DS_Store` files | 3 | 2 min |
| 4 | Remove `@types/react`, `@types/react-dom` | `frontend/package.json` | 5 min |
| 5 | Fix the stale comment at `server.js:40` | 1 | 2 min |
| 6 | Correct the banner at `tenderDetailsService.js:5-12` | 1 | 5 min |
| 7 | Use the `tenderRoutes` binding at `server.js:685` | 1 | 2 min |
| 8 | Update `HANDOVER.md` counts (M-03, M-04, M-05, M-06, M-07) | 1 | 20 min |
| 9 | Delete the stale duplicate block `frontend/.env.example:42-59` | 1 | 5 min |
| 10 | Remove `.password-input-row` / `.password-toggle-button` from `auth.css:121-143` | 1 | 5 min |

## Verify before removal

| # | Action | Why verification is needed |
|---|---|---|
| 11 | Restore or recreate `backend/database/migrations/README.md` | Two documents point at it; **decide the fresh-install order first**, including whether 005 runs after 004 (§9.3) |
| 12 | `withTenant` / `tenantQuery` (§6.1) | **Do not delete casually.** They set the RLS session variable. `authMiddleware` + `tenantContext.js` now do this via `AsyncLocalStorage`, so they *appear* redundant — confirm that path covers every query before removing the fallback |
| 13 | `passwordResetLimiter` | Decide: wire to `/auth/forgot-password`, or delete |
| 14 | The 8 `requestContext.js` exports, 4 `company.service.js`, 2 `auth.service.js` | Confirm each is unused *inside its own file* too, not merely un-exported-to |
| 15 | `getWorkerById`, `getInvoiceById` | Either route them (matching `sites`/`subcontractors`) or drop the exports |
| 16 | The 5 tender-finance endpoints | Product decision: build the screen, or remove the routes |
| 17 | `tenderCalculations.js` exports | Confirm no dynamic reference before removing |
| 18 | ~46 unused CSS classes | Re-verify each against dynamic construction (§7 lists the 11 known dynamic ones) |
| 19 | `BASE_URL` and the `BREAK_GLASS_ADMIN_*` trio (§10.4) | Confirm the read path before removing either from `render.yaml` or `.env` |

## Refactor — real work, real payoff

| # | Action | Rationale |
|---|---|---|
| 20 | **Fix the duplicate hook instances in `WorkersPage` and `InvoicesPage`** (D-02) | This is a live correctness bug, not tidiness. Highest-value item in this list. |
| 21 | Add an ESLint config to `backend/` | Removes the largest blind spot in this audit |
| 22 | Consolidate the two `tenderPath()` helpers (D-01) | Prevents drift in id validation |
| 23 | Add a CI workflow running lint + tests | Nothing currently enforces either |
| 24 | Investigate the failing `masters.test.js` case | A red suite trains people to ignore red suites |
| 25 | Consider consolidating the 3 export-helper modules (D-03) | 1,177 lines, overlapping concerns — but genuine regression risk |

## Keep intentionally — do not remove

- All 5 migration files, including 001's `tender_workers` creation.
- `003_supabase_rls.sql` policies (dormant, not dead).
- The 12 future tables in §9.1.
- `INSPECTION_STATUS`, `MILESTONE_STATUS`, `COMMENT_MODULES` constants.
- `/projects`, `/projects/:id`, `/sites`, `/sites/:id` redirects.
- `backend/scripts/verifyTenantContext.js` — mandatory pre-deploy check.
- `backend/scripts/createBreakGlassAdmin.js`, `database/check-database.js`.
- `GET /`, `GET /api/test`, `/api/health*`.

## Do not remove without a product decision

- Company administration endpoints (no screen, fully working).
- Upload file-manager endpoints (no screen, fully working).
- Material/labour edit + delete endpoints (no screen).

## Priority order

1. **Operational (blocks a deploy):** items 1, 2, 11 — a new developer
   currently cannot deploy or configure this project from the documentation.
2. **Correctness:** item 20 — stale lists shown to users.
3. **Security posture:** item 12 (understand it), plus F-12's remaining
   encryption-at-rest action.
4. **Maintenance burden:** items 21, 23, 24.
5. **Tidiness:** everything else.

---

# 13. Final verification checklist

Run after any cleanup. Each command is read-only except where noted.

```bash
# --- Structure -----------------------------------------------------------
git ls-files | wc -l                    # expect 249 (minus any removed)
git ls-files | grep DS_Store            # expect empty after cleanup
find . -name node_modules -prune -o -size 0 -type f -print   # no 0-byte tracked files

# --- Frontend ------------------------------------------------------------
cd frontend
npm run lint                            # expect 0 problems
npm run build                           # expect success
grep -rn "useWorkers(user)\|useInvoices(user)" src | wc -l   # expect 1 each after D-02 fix

# --- Backend -------------------------------------------------------------
cd ../backend
npm test                                # expect 215/215 after the masters fix
node -e "require('./server.js')" && echo "server loads"

# --- RLS (MANDATORY before repointing DATABASE_URL) ----------------------
node scripts/verifyTenantContext.js     # must exit 0

# --- Route/consumer drift ------------------------------------------------
# Re-run the checks that made this audit; see docs for the scanners.
grep -rn "process.env\." --include=*.js . | sed 's/.*process\.env\.\([A-Z_]*\).*/\1/' \
  | sort -u > /tmp/read.txt
grep -oE "^[A-Z_]+" .env.example | sort -u > /tmp/declared.txt
comm -23 /tmp/read.txt /tmp/declared.txt   # expect empty
```

## Manual checks

- [ ] `DEPLOYMENT.md` still matches `render.yaml` and `vercel.json`.
- [ ] `backend/.env.example` lists every variable `config/env.js` reads.
- [ ] Migration README states the fresh-install order **including 005**.
- [ ] Adding a worker on Workers appears in Dashboard without a reload.
- [ ] Adding an invoice on Invoices appears in Reports without a reload.
- [ ] `HANDOVER.md` counts match reality.

---

# 14. Needs manual review

| Item | Why it could not be settled |
|---|---|
| Database **column**-level usage (§9.6) | Requires diffing every SQL string against a live `information_schema`; static analysis cannot resolve `SELECT t.*` |
| `BREAK_GLASS_ADMIN_*` read path (§10.4) | `scripts/createBreakGlassAdmin.js` did not register as a `process.env` reader, yet the variables exist and the script is documented as a recovery tool |
| Backend unused imports/variables | No linter configured; a manual sweep of ~100 modules was out of scope and would be unreliable |

---

*End of audit. No application source was modified in producing this report.
The only files written were `STALE_UNUSED_CODE_AUDIT.md` and `DEPLOYMENT.md`.*
