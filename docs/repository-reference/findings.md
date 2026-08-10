# Findings

Things noticed while documenting the repository. Each entry records the
file, what looks wrong, and what it could cost.

Severity is about consequence, not certainty:

- **High** — wrong behaviour a user could hit, or a security weakness
- **Medium** — misleading or fragile; will bite eventually
- **Low** — tidiness, dead configuration, inconsistency

Status values:

- **Fixed** — corrected, with a regression test
- **Partially fixed** — the safe part done; the rest needs a decision
- **Open** — recorded, not changed
- **Requires product decision** — the correct behaviour is not inferable
  from the code

## Status index

| ID | Severity | Status | Summary |
|---|---|---|---|
| F-01 | Low | Open | `package.json` names a non-existent entry point |
| F-02 | Low | Open | `JWT_REFRESH_EXPIRES_IN` configured but never read |
| F-03 | Medium | Open | Variables the code reads are absent from `.env` |
| F-04 | Medium | Open | Two default timezones disagree |
| F-05 | Low | Open | Audit trail records outcomes, not changes |
| F-06 | Low | Open | Two Gujarati-language conventions coexist |
| F-07 | Medium | **Fixed** | Email templates escape user-supplied names |
| F-08 | Low | **Fixed** | `redact()` now fails closed below six levels |
| F-09 | Medium | Open | Membership and ownership changes not audited |
| F-10 | Low | **Partially fixed** | Subcontractors now routes `getById`; workers and invoices still do not |
| F-11 | Low | Open | Worker `status` default is unreachable |
| F-12 | High | **Fixed** | Bank details masked in list; full details role-gated; audit redacted |
| F-13 | Medium | **Fixed** | Backdating window: timezone AND permission consistency |
| F-14 | Low | **Fixed** | Site-log worker/subcontractor now ownership-checked |
| F-15 | Low | Open | Masters router documents an access rule it lacks |
| F-16 | High | **Fixed** | Tender + client returned a 500 |
| F-17 | Medium | **Fixed** | Five tender child queries now company-scoped |

---

## F-01 · `backend/package.json` names an entry point that does not exist

**Severity:** Low
**File:** `backend/package.json`

`"main": "index.js"`, but there is no `index.js`. The real entry point is
`server.js`, which is what `npm run dev` and Render's `startCommand` both
use.

Harmless today because nothing imports this package. It would matter the
moment anything did `require("backend")`, and it misleads a reader looking
for where the app starts.

---

## F-02 · `JWT_REFRESH_EXPIRES_IN` is configured but never read

**Severity:** Low
**File:** `backend/.env.example`

The variable is declared in the template and read nowhere in the codebase.
There is no refresh-token flow — `auth.service.js` issues a single access
token and `JWT_EXPIRES_IN` alone controls session length.

It suggests a refresh mechanism exists when none does.

---

## F-03 · Several variables the code reads are absent from `backend/.env`

**Severity:** Medium
**File:** `backend/.env`

Read by the code but not present locally: `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `MAIL_FROM_NAME`,
`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`,
`SUPERVISOR_EDIT_WINDOW_DAYS`, `SUPERVISOR_BANKING_GRACE_DAYS`,
`DB_SSL_CA`, `FRONTEND_URL`, `RESET_TOKEN_TTL_MINUTES`.

All have defaults in `config/env.js`, so nothing fails. The consequences
locally:

- **Password reset does not send email.** `isConfigured` is false, so
  `mailer.js` logs the link to the console instead. Fine for development,
  but it means the flow is never exercised as a user would meet it.
- The supervisor entry-window rules run on their defaults (2 days, 1 grace
  day) rather than anything explicitly chosen.

---

## F-04 · Two default timezones disagree

**Severity:** Medium
**Files:** `backend/config/constants.js`, `backend/.env`

`DEFAULTS.COMPANY_TIMEZONE` is `Australia/Melbourne`. `DEFAULT_TIMEZONE` in
the environment is `Asia/Kolkata`.

The environment wins at registration, so in practice companies are created
in the right zone and the constant only applies to a company somehow created
without one. But the company timezone is what decides "today" for the
two-day backdated-entry rule, and a ten-and-a-half-hour disagreement between
two defaults for the same concept is a trap for whoever touches that logic
next.

---

## F-05 · The audit trail records outcomes, not changes

**Severity:** Low (design limitation, documented)
**File:** `backend/utils/activityLog.js`

`logActivity` wraps `res.json`, so it sees the record as it ended up and
never the previous value. `old_data` is therefore empty for a create or an
update, and `diff()` — which is written to compare a before/after pair and
is unit-tested — only ever receives an `after`.

The trail answers "who touched what, and what did it become", which is most
of the value. It cannot answer "what was it before". The Activity Log column
is labelled *Details* rather than *Change* to avoid overclaiming.

---

## F-06 · Two Gujarati-language conventions coexist for the same idea

**Severity:** Low
**Files:** `backend/database/migrations/001_upgrade_schema.sql`,
`backend/database/migrations/004_seed_reference_data.sql`

`material_catalog` carries both `name` and `name_local`, and `labour` carries
both `category` and `category_local`. The seed data fills `name_local` with
Gujarati but leaves `category_local` null, filling `labour_categories.name_local`
instead.

Two tables that could hold a localised label, one of which is populated and
one of which is not. Whoever builds a screen that reads `labour.category_local`
will find it empty.

---

## F-07 · Email templates interpolate user-controlled names unescaped

**Severity:** Medium
**File:** `backend/config/mailer.js`

`sendAccountInviteEmail` builds its HTML with `${fullName}` and
`${companyName}` inserted directly. Both come from database records that a
user supplied — a company name at registration, a full name when the
account was created.

A name containing `<b>` or an `<a href>` is delivered as live markup in the
recipient's mail client. Most clients strip `<script>`, so this is not
straightforwardly XSS, but it is enough to forge convincing content inside
a message the recipient trusts — a second "click here" link, for instance,
in an email that is genuinely from the portal.

`sendPasswordResetEmail` has the same pattern with `fullName`, though its
`greeting` is at least used in both the text and HTML parts.

The `layout` and `button` helpers already carry a comment noting they
interpolate unescaped and that safety depends on the call sites. These two
call sites are the exception to that assumption.

### Resolution

**Status:** Fixed.

`escapeHtml` was added to `config/mailer.js` and applied at the three call
sites that interpolate a user-supplied value: the reset greeting, and the
invite's name and company name. Ampersand is replaced first, so nothing is
double-escaped and a literal `&lt;` typed by a user survives as text.

`sendMail` now returns the composed `subject`, `text` and `html` alongside
`{ sent: false, logged: true }` when SMTP is unconfigured. The only caller
(`auth.controller.js`) ignores the return value entirely, so nothing
operational changed — but without it the escaping is unobservable in every
environment where SMTP is not set up, which is every test run. A test that
cannot observe what it asserts passes against the code it exists to catch.

**Regression coverage:** `tests/emailEscaping.test.js`, five cases. The two
template cases were confirmed to fail when the escaping is reverted.

---

## F-08 · `redact()` stops redacting below six levels of nesting

**Severity:** Low
**File:** `backend/utils/activityLog.js`

The depth guard returns the value untouched once `depth > 6`:

```js
if (depth > 6 || value == null) {
  return value;
}
```

For `null` that is right. For a deeply nested object it means the subtree is
written to `activity_logs` verbatim — including any key in `REDACTED_KEYS`
that happens to sit that deep.

No current payload nests anywhere near six levels, so nothing leaks today.
It is worth knowing that the cap fails open rather than closed: returning
`"[truncated]"` instead of `value` would fail the other way.

Worth rereading now that `REDACTED_KEYS` covers payment identifiers (F-12):
the depth cap applies to those too, so a deeply nested account number would
survive. Still not reachable by any current payload.

### Resolution

**Status:** Fixed.

The depth guard now returns `"[truncated]"` rather than the untouched subtree.
`null` is still returned as `null`, so an absent value stays distinguishable
from a truncated one.

Nothing reachable today nests past six levels. That is the argument for the
change rather than against it: the guard only ever executes on a shape nobody
anticipated, and an unanticipated shape is the one not to trust — particularly
now that `REDACTED_KEYS` covers payment identifiers.

**Regression coverage:** four cases in `tests/activityLog.test.js`. Two were
confirmed to fail when the guard is restored to failing open.

---

## F-09 · Company membership and ownership changes are not audited

**Severity:** Medium
**File:** `backend/modules/companies/company.routes.js`

None of the six routes in this module carry `logActivity`. The equivalent
operations under `/api/auth/users` all do — create, update, disable and
enable each write an `activity_logs` row.

So the audit trail records that a user's role changed when it was done
through the Users screen, but not when the same effect was achieved through
`PUT /api/company/members/:userId/role`. `POST /transfer-ownership` is the
starkest case: it moves the standing that gates admin creation, admin
promotion and ownership transfer itself, and leaves no trace.

`DELETE /members/:userId` is similarly silent about someone losing access to
a company.

The routes are correctly gated — this is not an access-control hole. It is
a gap in the record of who exercised that access.

---

## F-10 · Three registers export `getById` but never route it

**Severity:** Low
**Files:** `backend/modules/workers/`, `backend/modules/subcontractors/`,
`backend/modules/invoices/`

Each of these controllers exports all five handlers generated by
`createScopedCrud`, but their route files mount only four. None declares
`router.get("/:id", ...)`, so `GET /api/workers/:id`,
`/api/subcontractors/:id` and `/api/invoices/:id` all fall through to the
404 handler.

`sites/site.routes.js` is the one register that always mounted it, which is
what makes the omission look unintentional rather than a decision.

**Partially fixed.** `subcontractors` now routes `GET /:id`, added as part
of F-12 — the masked list needs somewhere to fetch full details from.
`workers` and `invoices` still do not. Nothing calls them, so those two
remain dead export surface rather than a break.

Nothing currently calls them — each screen lists its records and keeps the
row it needs — so this is dead export surface rather than a break. Worth
knowing before someone writes a frontend call against a detail endpoint
that reads as though it should exist.

---

## F-11 · The `status` default for a new worker is unreachable

**Severity:** Low
**Files:** `backend/modules/workers/validations/worker.validation.js`,
`backend/modules/workers/worker.controller.js`

The controller declares `defaults: { status: "active" }`, so a worker
created without a status would be active. But `validateWorker` runs first
and requires `status` to be present and truthy, rejecting the request with
400 before the factory ever applies its default.

The default is therefore dead configuration through the API. It would only
take effect if the validation middleware were removed from the route, or if
`status` were dropped from its required list.

Harmless — the frontend always sends a status — but the two files disagree
about whether the field is optional, and a reader of either one alone would
draw the wrong conclusion.

---

## F-12 · Subcontractor bank details are plain text, and the redaction list does not cover them

**Severity:** High
**Files:** `backend/modules/subcontractors/subcontractor.controller.js`,
`backend/utils/activityLog.js`

`subcontractors` stores `bank_name`, `account_name`, `account_number` and
`ifsc_code` as ordinary text columns. The file's own banner already notes
this and points at `worker_sensitive_details`, which holds the equivalent
worker data in encrypted columns — so the pattern exists and was simply not
applied here.

Two consequences beyond the storage itself:

**The list endpoint returns them all.** `createScopedCrud` selects `t.*`, so
`GET /api/subcontractors` puts every counterparty's account number in one
response. Any admin or manager can retrieve the company's full payment
details in a single request, and so can anything holding such a token.

**The redaction list would not catch them.** `REDACTED_KEYS` in
`activityLog.js` contains `encrypted_account_number` and `encrypted_bsb` —
the worker column names — but not `account_number`, `ifsc_code`,
`bank_name` or `account_name`. No route in this module calls `logActivity`
today, so nothing is being written. Adding one, which would otherwise be an
uncontroversial improvement, would begin copying account numbers into
`activity_logs` — a table that is retained longer and read more widely than
the register itself.

### Resolution

**Status:** Partially fixed.

**Affected files:**
- `backend/utils/activityLog.js` — `REDACTED_KEYS`
- `backend/tests/activityLog.test.js` — two cases added

**Fixed: the audit-trail leak.** Added `account_number`, `ifsc_code`, `bsb`
and `tfn` to `REDACTED_KEYS`.

This was worse than the original write-up suggested. It is not only a
hypothetical risk for `subcontractors`: **`tender_banking` is already
audited** — `tender.routes.js` calls `logActivity("tender_banking", ...)`
on create, update and delete — and those rows carry `account_number`. So
every tender banking change has been copying an account number into
`activity_logs`, a table retained longer and read more widely than the
record itself.

`bank_name` and `account_name` are deliberately **not** redacted. Neither
is usable without the identifiers above, and "the bank was changed from X
to Y" is exactly what an audit trail exists to answer — over-redacting
would make it useless for the case it is most needed in.

**Tests.** Two cases in `tests/activityLog.test.js`: one asserting the four
identifiers are stripped while the two descriptive fields survive, and one
on a realistic before/after diff of a banking record.

**Fixed: the list endpoint no longer returns full bank details.**

`GET /api/subcontractors` now masks the payment identifiers. Each row
carries `account_number_masked`, `ifsc_code_masked` and `has_bank_details`
in place of the raw values, which are deleted from the row entirely rather
than blanked.

Masking rules (`backend/utils/maskSensitive.js`):

| Field | Masked form | Note |
|---|---|---|
| `account_number` | `••••9012` | last 4; fully masked at ≤4 chars |
| `ifsc_code` | `••••1234` | branch suffix |
| `bsb` | `•••-456` | separators stripped first |
| `tfn` | *removed* | no masked form; never returned |
| `bank_name`, `account_name` | unchanged | not usable without the above, and what a person reads to recognise a counterparty |

Applied through a new `transformRow` hook on `createScopedCrud`, so it runs
on the list, create and update responses alike. Masking only the list would
have leaked the value back the moment a record was saved.

**Added: `GET /api/subcontractors/:id`.**

The only route that serves unmasked values. Requires the **administrator**
role — from either `users.role` or `company_users.role`, matching
`roleMiddleware`'s "either" source. A manager can manage the register but
not read payment credentials.

Order of checks matters and is asserted: **company scope first, role
second**. A cross-company id returns 404 even for a caller who would
otherwise be permitted, so the 403 cannot be used to discover which ids
exist in another tenant.

This also closes the subcontractors half of F-10.

**Frontend.**

- The list renders masked values.
- Opening the detail modal or the edit form fetches `GET /:id`.
- `clearFinancialDetails` releases the values whenever either closes, so
  full numbers never persist in shared state.
- 403 is handled as an expected outcome, not an error: the masked value
  stays on screen with a note, so a manager can tell "hidden from me" from
  "not on file".
- The banking fieldset is not rendered for a user who may not read the
  values, and those four fields are omitted from the submitted payload —
  so a manager's edit cannot blank an account number they were never
  shown. (The backend's `COALESCE` treats an absent field as unchanged.)
- Edit-form banking inputs start **empty**, not masked, until the fetch
  resolves. Seeding them from the masked row would write `••••9012` over
  the real number on save.

**CSV export.** Now carries name, business, phone, email, GST, bank name,
account name, status and `account_number_masked`. Full account number and
IFSC are gone. `ReportsPage` counted "Bank Details Available" from the raw
field and would have silently reported zero; it now uses
`has_bank_details`.

**Tests.** `backend/tests/subcontractorFinancialAccess.test.js`, 21 cases:
list masking, no raw value anywhere in the serialised payload, no TFN,
create and update responses masked, admin gets full details, manager gets
403, cross-company 404, non-existent 404, 404-before-403 ordering, audit
redaction, and the masking helpers at their boundaries.

Verified by removing `transformRow` — 4 of the 21 fail.

**Remaining action: encryption at rest.** The columns are still plain text
in the database. Matching `worker_sensitive_details` needs a key-management
decision and a migration for existing rows, so it is out of scope here. The
exposure that has been closed is the bulk one: no single request now
returns more than one counterparty's identifiers, and none returns them to
a non-administrator.

---

## F-13 · The backdating window is implemented twice

**Severity:** Medium
**Files:** `backend/modules/siteLogs/siteLog.controller.js`,
`backend/modules/siteOperations/entryWindow.service.js`

`entryWindow.service.js` exists to decide whether an entry may be recorded
for a given date. `createSiteLog` does not use it — it computes the same
rule inline with `new Date()` and `setHours(0,0,0,0)`.

The two are not equivalent. The inline version works in the **server's**
local timezone, whereas the company's timezone is what should decide when
"today" ends — that is the whole reason companies carry a `timezone`
column. On a UTC host serving a company in `Asia/Kolkata`, the two disagree
for five and a half hours every day, and a supervisor recording an evening
update can be told it is dated in the future.

The admin bypass also differs: this file checks `getUserRole(req) !==
"admin"`, reading `users.role` only. A user who is an admin via
`company_users.role` — which `roleMiddleware` accepts everywhere else — does
not get the bypass here.

### Resolution

**Status:** Fixed (date calculation). The role difference is left alone
deliberately — see Remaining action.

**Affected files:**
- `backend/modules/siteLogs/siteLog.controller.js` — `createSiteLog`
- `backend/tests/entryWindowTimezone.test.js` — new

**Fix.** Replaced the inline `new Date()` / `setHours(0,0,0,0)` arithmetic
with `daysAgo()` from `entryWindow.service.js`, the canonical helper written
for exactly this. It resolves "today" through `Intl.DateTimeFormat` in the
configured timezone, so it is correct across daylight-saving transitions —
which a fixed UTC offset would not be.

**A second defect fixed along the way.** The old arithmetic produced `NaN`
for an unparseable date, and every comparison against `NaN` is false, so
both the future check and the window check were skipped and the row was
inserted with whatever the client sent. `daysAgo()` returns `null` for bad
input and the handler now rejects it with a 400.

**Tests.** `backend/tests/entryWindowTimezone.test.js`, ten cases, all
using `vi.setSystemTime` so the boundaries are deterministic rather than
depending on when the suite runs:

- evening submission on the site's own day reads as 0 days old, not −1
  (the exact bug — the same date measured against UTC still reads −1)
- timezones behind UTC
- Melbourne across both AEDT and AEST, including a 13:30 UTC instant that a
  fixed-offset implementation must get wrong in one season
- unknown timezone falls back to UTC rather than throwing
- whole-day counting at the 2-day window boundary
- genuinely future dates
- no drift across a DST transition
- full timestamps as well as bare `YYYY-MM-DD`
- unusable input returns `null`, not `NaN`

**Fixed: the permission rule is now shared.**

`createSiteLog` no longer carries its own `role !== "admin"` check. It calls
`checkEntryWindow` exactly as the material, labour and banking controllers
do, so there is one implementation of the rule and no role name or grant
lookup anywhere in `siteLog.controller.js`.

The canonical rule, unchanged and now applied uniformly:

| Case | Outcome |
|---|---|
| Inside the window | allowed, no permission needed |
| Administrator | allowed (`viaRole`) |
| Manager | allowed (`viaRole`) |
| Valid grant for that exact user, module and date | allowed, grant returned for consumption |
| Expired / used / denied grant | refused, 403 |
| Grant for another date, module, user or company | refused, 403 |
| Ordinary worker, no grant | refused, 403 |
| Future date | refused, 400 — no role bypasses this |
| Unparseable date | refused, 400 |

Access was **not widened beyond what `entryWindow.service.js` already
permitted**. What changed is that daily updates now honour the same rule as
every other dated module: managers are recognised, and a granted access
request works. `consumeGrant` is called after a successful insert, so a
grant remains single-use here too.

Two dead imports (`SUPERVISOR_EDIT_WINDOW_DAYS`, `sendForbidden`) were
removed as part of the same change.

**Tests.** `backend/tests/entryWindowPermission.test.js`, 18 cases covering
every row of the table above plus company and grant-ownership boundaries,
and three HTTP cases asserting `createSiteLog` actually delegates — its
refusals now carry the machine-readable `reason` field that only
`checkEntryWindow` produces.

`entryWindowTimezone.test.js` (10 cases, including Melbourne across AEDT
and AEST) continues to pass unchanged.

Verified twice: removing `manager` from `WINDOW_EXEMPT_ROLES` fails the
manager test; reverting the response shape fails the two delegation tests.

**Remaining action:** `checkEntryWindow` still resolves dates against
`DEFAULT_TIMEZONE` from the environment rather than the company's own
`timezone` column. Correct for a single-region deployment, wrong for one
serving companies in several. Threading the company timezone through every
caller is a wider change; related to F-04, which records that the two
configured defaults already disagree.

---

## F-14 · `worker_id` and `subcontractor_id` on a site log are not ownership-checked

**Severity:** Low
**File:** `backend/modules/siteLogs/siteLog.controller.js`

`createSiteLog` verifies that `site_id` and `tender_id` belong to the
caller's company, using the two helpers written for that purpose. It does
not check `worker_id` or `subcontractor_id`, which are equally
client-supplied and go straight into the INSERT.

A caller can therefore record a log naming another company's worker. The
disclosure is contained — `getSiteLogs` joins `workers` and
`subcontractors` with a `company_id` condition, so the foreign name comes
back NULL rather than being revealed — but the row is written with a
cross-tenant reference, and the log then displays with no worker name at
all.

The fix is the same two lines already present for site and tender.

**Status:** Open. The fix is small, but it is an input-validation change on
a write path with no existing test coverage for those two fields, and it
was not part of the three findings prioritised for this pass.

---

### Resolution

**Status:** Fixed.

`createSiteLog` now checks `worker_id` and `subcontractor_id` against the
caller's company through `rowBelongsToCompany`, alongside the existing
`site_id` and `tender_id` checks. The table name comes from an internal
allow-list, never from input, and an unrecognised table fails closed.

Both answer **404**, matching the site and tender checks: a caller must not be
able to distinguish "that worker belongs to another company" from "that worker
does not exist", because the first answer confirms another company's record
exists.

There is no update handler for site logs, so the create path was the only one
to close.

**Regression coverage:** two cases in `tests/tenantIsolation.test.js` — Beta
attaching Alpha's worker, and Alpha's subcontractor, to Beta's own site. Both
were confirmed to fail when the fix is reverted.

Two side effects worth recording:

- The Beta fixtures are scoped to the `write endpoints` describe rather than
  the file-level `beforeAll`. Placing them globally gave Beta rows of its own
  and broke the stronger assertion in the describe above, that a brand-new
  company's lists are *empty*. That assertion was preserved rather than
  weakened.
- Two F-13 tests in `entryWindowPermission.test.js` were sending
  `worker_id: 1`, a literal belonging to no one, and passed only because
  ownership was unchecked. They now create a worker of their own company, so
  each request is legitimate in every respect except the date under test.

---

## F-15 · The masters router documents an access rule it does not have

**Severity:** Low
**Files:** `backend/modules/masters/master.routes.js`, `backend/server.js`

The banner in `master.routes.js` states:

> Reading is open to any authenticated user; writing is office-only, since
> these lists are shared reference data.

`server.js` mounts the router behind `requireOffice`, so reading is
office-only as well. A worker or subcontractor cannot call
`GET /api/masters/investors` at all.

Two consequences, neither harmful:

- The `requireOffice` applied to the three write routes is redundant. The
  same check has already run at the mount.
- The effective access is **stricter** than documented, not looser, so this
  is a stale comment rather than a hole. No non-office screen calls these
  endpoints, so nothing is broken by the discrepancy.

Worth resolving one way or the other, because a reader trusting the banner
would conclude that supplier and client lists are readable by site staff,
and might build a portal screen on that assumption.

---

## F-16 · Creating or updating a tender with a client fails with a 500

**Severity:** High
**File:** `backend/modules/tenders/tenderQueries.js` — `validateClientOwnership`

The query filters on a column that does not exist:

```sql
SELECT id FROM public.clients
WHERE id = $1 AND company_id = $2
  AND COALESCE(is_deleted, FALSE) = FALSE
LIMIT 1
```

`clients` has no `is_deleted` column — it carries `status` instead. Two
other places in this same file already say so in comments:

- `TENDER_BASE_FROM`: *"clients has no is_deleted column; it uses a status
  field instead. Filtering on the missing column raised 42703 and broke
  every query built on TENDER_BASE_FROM"*
- `countTenders`: *"See TENDER_BASE_FROM: clients has no is_deleted column."*

Both of those joins were corrected. This one was missed.

**Verified**, not inferred. Running the statement against the development
database returns:

```
42703 - column "is_deleted" does not exist
```

**Failure path.** `tender.service.js:325` calls this from `validateClient`,
which runs on both the create and the update path. So:

- `POST /api/tenders` with a `client_id` → 500
- `PUT /api/tenders/:id` with a `client_id` → 500
- Either without a `client_id` → fine

The `if (!clientId) return true;` guard is why this has gone unnoticed: the
query is only reached when a client is actually selected, so any tender
created without one works normally.

### Resolution

**Status:** Fixed.

**Affected files:**
- `backend/modules/tenders/tenderQueries.js` — `validateClientOwnership`
- `backend/tests/tenderClientValidation.test.js` — new

**Re-verified before fixing.** Checked against `002_baseline_supabase.sql`,
every subsequent migration (no `ALTER TABLE clients` adds the column), and
`information_schema.columns` on the live database. `clients` has:

```
id, company_id, name, phone, email, address,
gst_number, status (default 'active'), created_at, updated_at
```

No `is_deleted`. Confirmed.

**Fix.** Dropped the `COALESCE(is_deleted, FALSE) = FALSE` condition,
keeping `id` and `company_id`. This matches the two sibling corrections
already made in the same file for `TENDER_BASE_FROM` and `countTenders`.

**Deliberately not replaced with `status = 'active'.** Three reasons, all
recorded in the code comment:

1. The function checks *ownership*, as its name says. Client lifecycle is a
   different question and no caller asks it here.
2. It would be new behaviour, not restored behaviour — the condition never
   once evaluated successfully, so there is no prior semantics to preserve.
3. It would break a real workflow. The frontend returns the whole tender on
   update including `client_id`, so editing any field of a tender whose
   client had since been archived would start failing with 404.

If archived clients should be un-selectable for *new* tenders, that rule
belongs on the create path alone, not in a validator shared with update.

**Tests.** `backend/tests/tenderClientValidation.test.js`, six cases:
create with a client, update with a client, reject a cross-company client,
reject a non-existent client, accept an archived same-company client
(pinning the decision above), and create with no client.

**Verified the test catches the bug.** Reverting the fix makes 5 of the 6
fail; restoring it makes all 6 pass. The one that passes either way is the
no-client case, which never reached the query.

**Remaining action:** none.

---

## F-17 · Five tender child queries are not company-scoped

**Finding ID:** F-17
**Severity:** Medium (latent — not currently exploitable)
**Status:** Open — documented in place, not changed
**Affected files:** `backend/modules/tenders/tenderQueries.js`

**Description.** Every query in `tenderQueries.js` takes a `companyId` and
puts it in the WHERE clause — except five:

- `getTenderDocuments`
- `getTenderMaterials`
- `getTenderBanking`
- `getTenderFinanceRecords`
- `getTenderFinanceSummary`

These filter on `tender_id` alone. Called with a tender id from another
tenant, they would return that tenant's documents, materials, banking rows
and financial totals.

`getTenderSubcontractors` and `getTenderWorkers`, sitting alongside them and
serving the same page, *do* take `companyId` — which is what makes the
omission look accidental rather than considered.

**Evidence.** `getTenderFinanceSummary` signature and WHERE clause:

```js
const getTenderFinanceSummary = async ({ tenderId, client = pool }) => {
  ...
  WHERE tender_id = $1
    AND COALESCE(is_deleted, FALSE) = FALSE
```

**Impact today: none.** Both call paths prove ownership first:

- `tender.service.js` calls `prepareChildOperation({ tenderId, companyId })`,
  which runs `ensureTenderExists` and throws 404 when the tender is not the
  caller's.
- `getCompleteTenderDetails` awaits `getTenderById({ tenderId, companyId })`
  and returns `null` before issuing any child query.

So the guarantee is real, but it is a property of the **call sites**, not of
the queries. A new caller that forgets the check — or a refactor that moves
the tender read into the `Promise.all` alongside the children — would open
cross-tenant reads with no visible change to these functions.

### Resolution

**Status:** Fixed.

**Affected files:**
- `backend/modules/tenders/tenderQueries.js` — the five queries
- `backend/modules/tenders/tender.service.js` — five call sites
- `backend/tests/tenderCrossTenant.test.js` — new

**Fix.** All five now accept `companyId` and filter on it directly. Every
child table carries a `NOT NULL company_id` (verified against
`information_schema`), so the scope is a plain `AND company_id = $2` rather
than a join through the parent tender — one condition, no extra query.

Callers updated: the five `tender.service.js` functions and the five
internal calls inside `getCompleteTenderDetails`.

**The ownership check in the service was kept.** It is not redundant. The
query filter is the *guarantee*; `prepareChildOperation` is what produces
the **404** that tells a caller the tender is not theirs. Without it a
cross-tenant request would return an empty collection and a 200, which
reads as "this tender has no documents" rather than "this is not your
tender".

**Tests.** `backend/tests/tenderCrossTenant.test.js`, 15 cases in two
groups:

- **HTTP** — company B asks for company A's tender through all seven child
  endpoints plus `/details` and the tender itself; every one must be 404.
  Plus a control proving company A can still read its own.
- **Query** — each of the five functions called *directly* with a
  mismatched `companyId`, bypassing the service entirely.

The second group is the one that matters. An HTTP-only suite would stay
green after a revert, because the caller's check would still refuse —
proving nothing about the query. Verified: reverting the materials scoping
fails exactly one query-layer test.

**Remaining action:** none.

---

*(Further findings are appended as the documentation pass continues.)*
