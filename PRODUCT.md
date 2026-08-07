# Product

<!-- impeccable:product-schema 1 -->

> Written 2026-08-07 at the start of the fresh frontend design programme.
> Every fact below is either confirmed by the user, or verified against the
> running code and database. Items neither confirmed nor verifiable are
> listed under **Open decisions** rather than guessed at.

## Platform

web

Field roles reach the product through mobile web on phones and tablets. There
is no native application and no native wrapper, so the platform stays `web`;
the field constraints are recorded under Operating Context, not as a native
design language.

## Users

Seven roles use the product, across two very different scenes.

**Office, at a desk, on a large screen, with stable connectivity:**

- **Company owners and administrators** — governance, users, company settings,
  the investor and master registers. `admin` role.
- **Project managers** — tenders and their child records, sites, subcontractor
  assignment, approvals. `manager` role.
- **Finance and office support staff** — payments, invoices, worker money,
  reports, exports. Also `admin` / `manager`.

**Field, outdoors, on a phone or tablet, with weak connectivity:**

- **Site supervisors / field operators** — daily site updates, material
  entries, labour ledger, supervisor banking, photo capture, expense records,
  backdated-entry access requests.
- **Workers (labourers)** — the Worker Portal: their assignment, their daily
  update, their allocations and outstanding balance. `worker` role.
- **Subcontractors** — the Subcontractor Portal: their project, their
  submitted work, their documents and bills. `subcontractor` role.

### Priority persona for design trade-offs

Confirmed by the user. When an interaction or accessibility requirement
conflicts between roles, resolve it in this order:

1. Site supervisor / field operator (phone or tablet, outdoors)
2. Worker using the Worker Portal
3. Subcontractor using the Subcontractor Portal
4. Finance and project staff
5. Company administrator / owner

This governs **interaction and accessibility only**. For financial accuracy,
permissions, governance and ownership rules the company owner/administrator
remains authoritative.

The user stated the trade-off rules explicitly:

- legibility over visual subtlety
- large targets over compact controls
- obvious actions over hidden menus
- light data surfaces over dark ones
- reliable feedback over decorative animation
- fast completion over visual spectacle

This does not mean every screen should look like a field screen. It means the
field screen wins the argument when there is one.

## Product Purpose

An operational platform for running a construction business end to end:
tenders and their commercial detail, the workforce, subcontractors, site
activity, money in and out, compliance evidence and the audit trail.

It replaces a paper site notebook and a set of spreadsheets. Success is that
what happened on site today is recorded accurately at the source, by the
person who saw it, on the day it happened — and that the office can rely on
it without re-keying or reconciliation.

## Positioning

The product's distinguishing mechanism is that it treats **site-recorded data
as evidence rather than as data entry.** A neighbouring construction admin
tool could copy the registers; it could not truthfully copy the controls that
make the record trustworthy:

- **The two-day rule.** Backdating beyond the window is blocked. A supervisor
  must request access; the request stays blocked while pending; the office
  grants it; the grant is single-use and the next backdated entry is blocked
  again.
- **Photo provenance.** Camera capture versus gallery upload is recorded and
  corroborated against the claimed capture time, so the office can tell a live
  site photo from a re-upload.
- **The labour ledger.** A per-labourer account with half days and a running
  outstanding balance, reconciled against what was actually paid.
- **Supervisor float.** Money issued to a supervisor is tracked through three
  routes (bank, cash, GST cash) with the receipts that fund it, so the float
  can rise as well as fall.
- **One source for the money tree.** The income/expense hierarchy is served
  from the API, so the form and the server's validation cannot drift apart.

These are derived from a real site notebook and were verified end to end
against a live server. They are the reason the product is believable to a
contractor, and they are **untouchable** (user-confirmed).

## Operating Context

- **Two scenes, one product.** Office desktop work is dense, comparative and
  reconciliation-shaped. Field work is single-task, time-critical and hostile:
  glare, noise, gloves, weak connectivity, limited attention.
- **The day is the unit.** Site updates, material entries, labour and banking
  are all recorded per day, and the calendar date is the spine of the record.
  Dates are calendar dates, returned as `YYYY-MM-DD` strings deliberately.
- **Approval is a real workflow stage.** Material entries, supervisor expenses
  and worker allocations are recorded *pending* and must be decided. A pending
  allocation cannot be spent.
- **Money carries GST throughout.** Bills, rates, material entries and the
  payment tree all handle GST as a first-class part of the figure, not a
  footnote. Investor interest accrues per day.
- **Currency is INR.** Figures are rupees; the notebook's worked examples are
  the regression tests.
- **Evidence is attached, not described.** Documents, photos and bills hang
  off tenders, sites, workers and subcontractors.
- **The audit trail records outcomes, not diffs.** It sees what a record
  became, not a before/after pair. The column is labelled Details rather than
  Change for that reason.

## Capabilities and Constraints

### Functional surface (verified from source)

28 registered routes, 22 page files, 0 unregistered routes.

- **Public:** Login, Register, Forgot Password, Reset Password.
- **Office:** Dashboard, Tenders, Tender Details (9 tabs — overview, finance,
  documents, materials, banking, sites, subcontractors, workers, daily
  progress), Payments, Invoices, Workers, Worker Money, Subcontractors, Daily
  Site Updates, Daily Update Approvals, Masters (investors, suppliers,
  clients, investor statement), Users, Activity Log, Reports, Settings.
- **Shared office + supervisor:** Site Operations.
- **Portals:** Worker Portal, Subcontractor Portal.

### Authority model — must be preserved exactly

- `company_id` comes from the session, never the request body.
- Authentication is not authorisation. Office registers sit behind
  `requireOffice` (admin and manager). The frontend's `canLoadAdminData`
  mirrors it only to avoid pointless 403s; the backend is authoritative.
- Each role has a different landing page, so `/` means something different
  per role.
- Row-level security exists (migration 003) and is only live when
  `DATABASE_URL` connects as `construction_app`. Tenant context is bound via
  `AsyncLocalStorage` and issued as `SET LOCAL`.
- `company_id` is NOT NULL on 35 tables.
- Subcontractor bank account numbers and IFSC are never rendered to the
  portal. Masked-data behaviour is a tested guarantee.

### Technical constraints on the redesign (user-set)

- **No new runtime dependency without explicit approval.**
- **No Tailwind. No shadcn.** The design system is hand-authored CSS.
- Backend source, API endpoints, payloads, response assumptions,
  authentication, tokens, route URLs, redirects, role routing, RBAC, tenant
  isolation, RLS, schema, migrations, financial calculations, approval logic,
  validation, upload and masking behaviour are all frozen.
- Every existing route, action, form, filter, export, table, mobile card,
  modal, dialog, menu, tab, disclosure, upload, permission branch, loading
  state, error state and empty state must remain available. Presentation may
  change completely; behaviour may not.
- Business logic stays in pages, hooks and services — never in visual
  components.

### Known technical state (2026-08-07 baseline)

- Lint clean. Production build passes. 314 Playwright assertions pass, 44 axe
  checks pass, 57 gated contrast pairs pass.
- No code splitting problem remains at the route level (19 of 28 routes are
  lazy), but three vendor chunks dominate: export theming (713 kB), charts
  (363 kB), html2canvas (200 kB).
- Eight pages exceed 1,000 lines.
- Pagination exists in the API; the screens request everything.
- Two npm advisories are accepted as non-applicable, with reasoning recorded
  in HANDOVER.md.

### Terminology

Tender (the project/contract), site, sublet (subcontracted work), labour
category, material entry, allocation, supervisor float, daily update,
approval queue, master data, break-glass admin.

## Brand Commitments

- The product is currently named **Construction Portal** in the SPA title and
  in the seed company row. Whether that is the final name is an open decision.
- The only identity asset in the repository is `public/favicon.svg`. There is
  no logo, wordmark or brand guideline on hand.
- **Bilingual English + Gujarati interface is a confirmed requirement.**
  Gujarati is not decorative here: the seeded materials catalog and labour
  categories carry Gujarati names because that is what the site actually
  calls them. No i18n layer exists in the frontend today, so this is a
  commitment future work must design toward — script coverage in the type
  ramp, label growth, line length and mixed-script alignment — rather than a
  behaviour that currently ships.

## Evidence on Hand

- **A real site notebook.** The source of the material entry model, the
  two-day rule, the labour ledger, supervisor banking and the Add Payment
  tree. Its worked examples are committed as regression tests
  (`backend/tests/paymentCalculations.test.js`).
- **A working local stack.** Postgres 18.4, 47 tables, seeded fixtures for
  admin, worker and subcontractor roles (`backend/scripts/`).
- **A tested backend.** 222 backend tests including tenant isolation, role
  separation, portals, activity log, notifications and money maths.
- **A browser suite.** 143 `expect()` assertions across responsive,
  authenticated, portals and axe specs, covering nine widths.
- **Two typefaces already self-hosted:** IBM Plex Sans variable, latin and
  latin-ext (`frontend/public/fonts/`, 66 kB total). No webfont network
  request.
- **Prior audits** — `UI_UX_AUDIT.md`, `COMPLETE_CODEBASE_AUDIT.md`,
  `STALE_UNUSED_CODE_AUDIT.md`, `RESPONSIVE_TEST_MATRIX.md`, and the archived
  UI v2 experiment's findings.

**Absences future work must not fabricate:** there are no customers, no
testimonials, no case studies, no press, no pricing, no published benchmarks,
no logo and no marketing copy. Nothing in this product may imply otherwise.

## Product Principles

1. **The record must be trustworthy at the source.** Anything that makes a
   site entry easier to falsify, or harder to make honestly, is a regression —
   regardless of how much better it looks.
2. **The field wins the trade-off; the office wins the authority.** Design
   interaction and accessibility for the supervisor outdoors; keep financial,
   permission and governance decisions with the owner.
3. **Density is a feature, scanability is the constraint.** Office users came
   for the rows. Compressing data is right; making it unreadable is not.
4. **Money and permissions have one source each.** The payment tree comes from
   the API; authorisation comes from the backend. The interface never
   re-implements either, and never implies an authority it does not have.
5. **Show state, never imply it.** Every status carries a text label as well
   as a hue; a zero figure never reads as success; pending is visibly pending.

## Accessibility & Inclusion

- **WCAG 2.2 AA or better**, verified rather than asserted. axe runs against
  every route at desktop and mobile width, and rules are not suppressed to
  manufacture a pass.
- **Outdoor legibility is an accessibility requirement here, not a
  preference.** Light data surfaces are preferred over dark ones for field
  screens; glare and sunlight are the real operating condition.
- **Touch targets ≥ 44 × 44 px**, tested at nine widths.
- **Gloved, one-handed, interrupted use** is the field norm. Hidden menus and
  precision gestures are inappropriate for primary field actions.
- **Never signal state by colour alone.** Existing tested guarantee.
- **Reduced motion must remain fully polished**, not merely functional.
- **Mixed-script rendering (Latin + Gujarati)** must stay legible at every
  size, per the bilingual commitment above.

## Open decisions

Recorded rather than invented. The user was asked and the round was
interrupted before these were answered.

- **Tenancy intent.** The schema is unambiguously multi-tenant (`companies`,
  `company_id` NOT NULL on 35 tables, RLS policies, a per-company seeding
  trigger). What is *not* established is whether multiple construction firms
  are genuinely expected to sign up, or whether multi-tenancy exists as a
  safety structure around a single firm. This changes onboarding, empty
  states, company switching and how much the interface may assume about one
  company's data.
- **Product name and identity.** Whether "Construction Portal" is the final
  name, and whether a real company name, logo or mark exists that the product
  must carry.
- **Bilingual scope.** Confirmed as required; not yet established whether it
  applies to every screen or to field-role screens first.
