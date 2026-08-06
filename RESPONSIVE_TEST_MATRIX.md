# Responsive Test Matrix

**Method:** real Chromium (Playwright), measuring
`documentElement.scrollWidth - clientWidth` at each width. `0` = no
horizontal overflow. Not inferred from a successful build.

**Last run:** 2026-08-06 · **344/344 passed**
(300 responsive/auth/portals/tables/activity/site-ops/worker/subcontractor + 44 axe)

**Reproduce:**

```bash
# 1. Create the local-only test admin (writes to the LOCAL dev database)
cd backend
BREAK_GLASS_ADMIN_EMAIL="$LOCAL_ADMIN_FIXTURE_EMAIL" \
BREAK_GLASS_ADMIN_PASSWORD="$LOCAL_ADMIN_FIXTURE_PASSWORD" \
BREAK_GLASS_ADMIN_COMPANY_ID=1 \
node scripts/createBreakGlassAdmin.js

# 2. Backend, with the rate limiter raised for the ~150 page loads the suite makes
cd backend && RATE_LIMIT_MAX=100000 AUTH_RATE_LIMIT_MAX=100000 npm start

# 3. Frontend
cd frontend && npm run dev

# 4. Tests
cd frontend && npx playwright test          # both suites
```

> **Safety.** `tests/authenticated.spec.js` signs in and walks the whole
> application. It refuses to start unless both `E2E_BASE_URL` and
> `E2E_API_URL` are localhost origins. It only reads — it submits no forms
> and creates, edits or deletes nothing.

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Verified in-browser, 0px overflow, asserted in CI-runnable test |
| 🅣 | Touch-target assertion passing (all controls ≥ 44px at 375px) |
| ⬜ | Not verified in-browser — see blockers |

---

## Authenticated routes — all verified in-browser

Every cell below was measured in Chromium with real data loaded. **Before**
values are from the pre-change baseline captured the same way.

| Route | 320 | 375 | 390 | 414 | 768 | 1024 | 1280 | 1440 | 1920 | 🅣 | Overflow before → after |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 359/304/289/265/45/282/154/74 → **0** |
| `/tenders` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 52/52/52/52/45 → **0** |
| `/tenders/:id` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 359/304/289/265/45/282/154/264/221 → **0** |
| `/payments` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 359/304/289/265/45/282/154/74 → **0** |
| `/invoices` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 359/304/289/265/285/282/154/74 → **0** |
| `/workers` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 359/304/289/265/285/282/154/74 → **0** |
| `/worker-money` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 359/304/289/265/45 → **0** |
| `/subcontractors` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 359/304/289/265/285/282/154/74 → **0** |
| `/daily-site-updates` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 359/304/289/265/285/282/154/74 → **0** |
| `/daily-update-approvals` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 359/304/289/265/45 → **0** |
| `/site-operations` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 52/52/52/52/45 → **0** |
| `/masters` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 52/52/52/52/45 → **0** |
| `/users` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 359/304/289/265/285/282/154/74 → **0** |
| `/activity` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 52/52/52/52/45 → **0** |
| `/reports` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 359/304/289/265/285/282/154/74 → **0** |
| `/settings` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 52/52/52/52/45 → **0** |

**Totals: 108 of 144 route×width combinations overflowed before. 0 do now.**

Touch targets: **15 of 16 routes had controls under 44px** before (down to
17px). All 16 pass now.

## Public routes — verified

| Route | 320 | 375 | 390 | 768 | 1024 | 1280 | 1440 | 1920 | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `/login` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Rebuilt on `AuthShell` |
| `/register` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Rebuilt on `AuthShell` |
| `/forgot-password` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Rebuilt on `AuthShell` |
| `/reset-password` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Rebuilt on `AuthShell` |

Each also asserts: shared shell present, exactly one `<h1>`, brand panel
hidden at 375px / visible at 1440px, submit full-width and ≥44px at 320px,
password toggle flips `type` + `aria-pressed` without overlapping the input,
and every input carries a visible label and an `autocomplete` attribute.

## Additional asserted behaviour

| Check | Result |
|---|---|
| Drawer opens; `aria-expanded` flips | ✅ |
| Focus moves **into the drawer panel** (not the scrim) on open | ✅ — was landing on the scrim; fixed |
| Escape closes the drawer | ✅ |
| Focus returns to the toggle on close | ✅ |
| Closed drawer is `inert` (not tabbable) | ✅ — was documented but never implemented |
| Toggle hidden at ≥ 1024px, sidebar visible | ✅ — regressed mid-work, caught, fixed |
| Current route carries `aria-current="page"` | ✅ — was explicitly disabled; fixed |
| Visible focus ring on first Tab | ✅ |
| Zero console errors across all 16 routes | ✅ |
| Zero failed network requests across all 16 routes | ✅ |

---

## Portal routes — BLOCKER RESOLVED, now verified

The previous pass could not reach these. `backend/scripts/createLocalPortalFixtures.js`
now creates both accounts with the linked records the controllers actually
require (verified against the SQL in `workerPortal.controller.js` and
`subcontractorPortal.controller.js`, not assumed).

| Route | 320 | 375 | 390 | 414 | 768 | 1024 | 1280 | 1440 | 1920 | 🅣 | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/worker-portal` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **Restructured** — assignment-first hierarchy asserted at all 9 widths |
| `/subcontractor-portal` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **Restructured** — project-first hierarchy asserted at all 9 widths; masked bank fields asserted absent across all five sections |

Both also assert that **an admin is still rejected**, so a presentation change
can never widen who reaches a portal.

Fixture creation and cleanup:

```bash
cd backend
LOCAL_WORKER_FIXTURE_PASSWORD='…' \
LOCAL_SUBCONTRACTOR_FIXTURE_PASSWORD='…' \
node scripts/createLocalPortalFixtures.js

# afterwards
node scripts/createLocalPortalFixtures.js --cleanup
```

The script refuses to run when `NODE_ENV=production` or when `DATABASE_URL`
is not a localhost host, and will only ever modify its own two fixture
addresses.

---

## Accessibility — axe-core

`npm run test:a11y` runs axe against **22 routes × 2 widths = 44 checks**,
tagged `wcag2a, wcag2aa, wcag21a, wcag21aa`.

**Result: 44/44 pass, with zero documented exceptions.**

Violations found and fixed:

| Rule | Impact | Nodes | Routes | Fix |
|---|---|---|---|---|
| `scrollable-region-focusable` | serious | 19 | 13 | Scrolling table wrappers had no keyboard access — `tabIndex={0}` added to all 49 wrappers |
| `color-contrast` | serious | 10 | 6 | `--text-muted` was slate-500 at **4.34:1**, under the 4.5 floor. Whole text scale moved one stop darker |
| `label` | critical | 8 | 4 | Unlabelled date and file inputs |
| `select-name` | critical | 6 | 2 | Unlabelled filter selects |

### Measured contrast after the token change

Against `--bg-page` (#f1f5f9):

| Token | Value | Ratio | Verdict |
|---|---|---|---|
| `--text-primary` | slate-900 | ~15.6:1 | AAA |
| `--text-secondary` | slate-700 | ~10.0:1 | AAA |
| `--text-muted` | slate-600 | ~6.6:1 | AA (was 4.34 — failing) |

---

## Scope completed vs outstanding

### Verified complete

- Zero horizontal overflow, 16 authenticated + 4 public routes, 9 widths
- 44px touch-target floor across all 16 authenticated routes
- Drawer keyboard behaviour, `inert`, `aria-current`, focus management
- Grouped sidebar navigation with icons and identity footer
- Dashboard opening block replaced with an operational attention panel
- Palette corrected (brand/warning colour collision resolved)

### Also complete

- **All 9 card-suitable registers** use mobile cards (was 0)
- **Activity Log** rebuilt as a date-grouped stream with expandable metadata
- **Portal fixtures** created; both portals verified at 9 widths
- **axe** 44/44 with zero exceptions
- **No fixture passwords** remain in tracked source

### Site Operations — date-only workspace

Verified at 390 / 768 / 1440: context card, four always-visible modules,
roving-tabindex keyboard navigation, labelled tab panel, one-column mobile
forms, both photo inputs preserved, 0 overflow, 0 sub-44px controls.

Tender/site selectors are deliberately absent and asserted absent — see
SITE-OPS-DATA-01 in UI_UX_AUDIT.md.

### Outstanding — see UI_UX_AUDIT.md §9

- ~~Auth page visual redesign~~ — **done**, shared `AuthShell` in use
- ~~Worker Portal restructure~~ — **done**, see UI_UX_AUDIT.md §8e
- ~~Subcontractor Portal restructure~~ — **done**, see UI_UX_AUDIT.md §8f
- Remaining shared component extraction
