# Fresh UI Issues Register

Every issue is recorded here **before** it is fixed. Nothing is silently
resolved.

**Classification key**

| Class | Meaning |
|---|---|
| **A** | Safe to fix during the auth visual implementation |
| **B** | Separate frontend cleanup, after auth |
| **C** | Needs security or business review; must not be touched by design work |
| **D** | Stale documentation only; no behaviour change |

**Status vocabulary:** Proposed · Accepted · Implemented · Verified · Rejected ·
Blocked · Needs Manual Decision · Intentionally Retained · False Positive

---

## AUTH-001 — RESOLVED BY EVIDENCE: registration is broken, and the role select is dead UI

| Field | Value |
|---|---|
| Class | **C** — behaviour and security review. Not a documentation issue. |
| Category | behaviour / security |
| Severity | **Critical** |
| Route | `/register` |
| Files | `frontend/src/pages/RegisterPage.jsx`, `backend/modules/auth/auth.controller.js` |
| Status | **Verified — resolved by Option A** |

**The question was: is the comment wrong, or the implementation? The answer is
the implementation.** Verified by reading the route binding and then by a live
probe against the running endpoint with exactly the payload the frontend
sends.

### Evidence

`POST /api/auth/register` binds to `authController.register`, which
destructures:

```
full_name, email, password, company_name, industry, currency_code, timezone
```

**There is no `role` in that list.** The handler creates an admin account, a
company, and an admin company membership, in one transaction. Its documented
business rule is explicit: *"The registrant always becomes an admin and the
company's owner. The request cannot ask for any other role."*

`RegisterPage` sends `{ full_name, email, password, role }`. It never sends
`company_name`.

Live probe, 2026-08-07, local stack:

```
POST /api/auth/register
{"full_name":"Probe Only","email":"…","password":"…","role":"worker"}

-> {"success":false,"message":"Company name is required."}
users created: 0
```

### Two defects, not one

1. **Self-service registration cannot succeed.** The backend requires
   `company_name`; the frontend has no such field and never sends one. Every
   submission returns 400. The route is non-functional in production.

2. **The role select is dead UI that misrepresents the outcome.** The backend
   ignores `role` entirely. A user choosing "Worker" is not creating a worker
   account. If registration were repaired by supplying `company_name` and
   nothing else, that same user would become an **administrator and the owner
   of a new company**. The control implies a least-privilege choice the API
   does not offer and has never honoured.

### Why this blocks the Register redesign

The Boundary C objective is to make Register "feel like creating access to a
workspace" and to treat role selection as "an important decision", with any
explanatory copy accurately reflecting current behaviour.

None of that can be done honestly while the form cannot submit and its most
prominent decision control has no effect. Accurate copy for the role field is
impossible to write, because the field does nothing. Polishing the surface
would make a broken, misleading flow more convincing.

### What was deliberately NOT done

Per the standing instruction that behaviour wins over comments and must not be
changed by design work:

- `company_name` was **not** added. That is a payload change.
- The role select was **not** removed. That is a behaviour change to a flow
  under review.
- No explanatory role copy was written, because none would be true.

### Options for the decision

- **A. Repair signup as owner/admin.** Add a company-name field, drop the role
  select, and align the UI with what the API does. Changes the payload;
  requires product sign-off.
- **B. Add worker/subcontractor self-signup on the backend.** Makes the
  existing UI truthful. A larger backend change and a real security decision,
  since it changes who may create accounts.
- **C. Remove public registration.** If accounts are meant to be created by an
  administrator through the Users screen, the route and its link should go.
- **D. Leave as is.** Not recommended: a permanently failing signup route
  remains linked from Login.

### DECISION: Option A, approved 2026-08-07

Align the frontend with the existing backend contract. Backend unchanged.

**Implemented.** The role selector is removed and `company_name` is added. The
form now submits exactly `{full_name, email, password, company_name}` — the
four fields the endpoint requires. `industry`, `currency_code` and `timezone`
are optional and server-defaulted, so they are deliberately not collected.

The security model is unchanged and now honestly represented: the registrant
becomes an administrator and the company's owner, a new company is created, no
role can be requested by the client, no existing company can be joined through
this form, and no worker, subcontractor or additional administrator is
self-provisioned. Those are still created through the authenticated company
workflows.

Copy states the real outcome: "Create your company workspace. You will become
its initial administrator." A hint under the company field tells anyone whose
firm already uses the portal to ask their administrator instead.

**Regression coverage added** in `tests/register-contract.spec.js`, driving the
real local backend rather than a mock, because mocking is what allowed the
contract to break unnoticed. Five tests assert that `company_name` is sent,
that `role` is not, that `company_id`/`owner_user_id`/`company_role`/admin
flags are never sent, that the payload contains exactly the four accepted
keys, that a successful signup authenticates and lands on the destination the
BACKEND chose, that a missing company name is caught before any request, that
a duplicate email surfaces the backend error, and that no role selector
exists. Each created workspace is removed in teardown.

---

## AUTH-001-HISTORICAL — original framing, superseded above

| Field | Value |
|---|---|
| Class | was **C + D** |
| Status | Superseded by the evidence recorded above |

**Description.** The file header states the registrant "always becomes the
company OWNER and an admin" and that "the form cannot request another role."
The implementation ships a role `<select>` offering only `worker` and
`subcontractor`, defaults to `worker`, validates membership of that pair, and
redirects worker → `/worker-portal`, subcontractor → `/subcontractor-portal`.

**Evidence.** `RegisterPage.jsx` lines 39-45 (default `role: "worker"`),
123-133 (validation), 168-192 (redirect), against lines 21-25 (the comment).

**User impact.** None visible today. The risk is to the *next* engineer: the
comment describes a materially different security posture from the code, and
someone trusting it could reason incorrectly about who can self-provision.

**Why it is class C as well as D.** Which of the two is correct is a product
and security question, not a documentation question. If the comment reflects
intent, self-service signup currently creates unprivileged accounts it was
never meant to. If the code is correct, the comment is simply wrong.

**Proposed solution.** Do not touch signup behaviour during the design
programme. Raise for security review. Correct the comment only once the
intended behaviour is confirmed.

---

## AUTH-002 — Two live auth stylesheets, 911 lines, overlapping selectors

| Field | Value |
|---|---|
| Class | **A** |
| Category | css-architecture |
| Severity | High |
| Route | all four auth routes |
| Files | `styles/pages/auth.css` (370), `styles/v2/pages/auth.css` (541) |
| Status | Proposed |

**Description.** Both define `.auth-shell`, `.auth-brand`, `.auth-card`,
`.auth-card-head`, `.auth-submit`, `.password-input-wrapper`,
`.password-toggle-btn`, `.auth-links`, `.auth-link`, `.error`,
`.auth-success`. Only cascade-layer order decides the winner.

**User impact.** None at runtime. High maintenance risk: an edit to the
apparently-obvious file may be silently overridden.

**Proposed solution.** Auth is the first route group fully migrated into the
new system. Both files are removed together once all four routes pass the gate
and their selectors are proven to have zero consumers.

---

## AUTH-003 — StructuralFrame is a literal construction blueprint

| Field | Value |
|---|---|
| Class | **A** |
| Category | visual-direction |
| Severity | High |
| Route | all four auth routes |
| Files | `components/auth/AuthShell.jsx:63-97`, `styles/v2/pages/auth.css` (`.auth-blueprint*`) |
| Status | Accepted |

**Description.** The auth supporting visual is a structural section: two
columns, three floor plates, a diagonal brace, a dimension line, node plates.

**Why it is an issue now.** The committed direction explicitly rejects
construction imagery, blueprint drawings, industrial texture and machinery
styling as visual identity. This is auth's only visual identity, so it must be
**replaced, not refined**.

**What must be preserved from it.** Its engineering discipline is exemplary
and the replacement inherits all of it: draws once with `both` fill and no
iteration, pure SVG geometry with no image request, inside an `aria-hidden`
container with `focusable="false"`, and a reduced-motion path that shows the
finished state immediately.

---

## AUTH-004 — Inconsistent password-reveal affordance

| Field | Value |
|---|---|
| Class | **A** |
| Category | interaction-consistency |
| Severity | Medium |
| Route | `/login`, `/register`, `/reset-password` |
| Files | `LoginPage.jsx:209-226`, `RegisterPage.jsx:281-301`, `ResetPasswordPage.jsx:221-232` |
| Status | Proposed |

**Description.** Login and Register use a `<button>` with `aria-label` and
`aria-pressed`. Reset uses a `<label class="checkbox-row">` wrapping a
checkbox that toggles *both* password fields at once.

**User impact.** Three password surfaces, two different mental models. The
checkbox is also the only one that reveals two fields from one control.

**Proposed solution.** See the recommendation in `FRESH_UI_MASTER_AUDIT.md`.
Presentation-only change; the underlying `showPassword` state and the
`type` swap stay identical.

---

## AUTH-005 — Login state ownership sits in App.jsx

| Field | Value |
|---|---|
| Class | **B** |
| Category | architecture |
| Severity | Medium |
| Route | `/login` |
| Files | `App.jsx:57-59, 163-208`, `LoginPage.jsx:32-39` |
| Status | Intentionally Retained (for the auth programme) |

**Description.** `email`, `password`, `message` and `handleLogin` live in
`App.jsx` and arrive as props. `App.jsx`'s own comment calls them "leftovers
from an inline login form."

**Decision.** The prop contract is preserved during the visual redesign. A
presentation change does not need it, and touching the real submit path while
redesigning is how auth regressions happen. Revisit as cleanup after auth.

---

## AUTH-006 — getHomePath / role branching triplicated

| Field | Value |
|---|---|
| Class | **B** |
| Category | duplication |
| Severity | Medium |
| Files | `RoleRoute.jsx:43-53`, `AppRoutes.jsx` (`getHomePath`), `RegisterPage.jsx:168-192` |
| Status | Proposed |

**Description.** Three independent implementations of "which home page does
this role get." They agree today. Nothing enforces that they keep agreeing.

**Proposed solution.** Consolidate into one exported helper. Behaviour
identical. Deferred to cleanup because it touches routing, not presentation.

---

## AUTH-007 — route-guard-loading uses inline styles

| Field | Value |
|---|---|
| Class | **A** |
| Category | design-system-bypass |
| Severity | Low |
| Files | `RoleRoute.jsx:78-94` |
| Status | Proposed |

**Description.** The guard's loading placeholder carries an inline `style`
object (`display`, `alignItems`, `justifyContent`, `minHeight: "60vh"`),
bypassing tokens entirely.

**Note.** Its semantics are correct and must survive: `role="status"` and
`aria-live="polite"`. Only the styling mechanism changes.

---

## AUTH-008 — Register markup diverges from its siblings

| Field | Value |
|---|---|
| Class | **A** |
| Category | structural-consistency |
| Severity | Low |
| Route | `/register` |
| Files | `RegisterPage.jsx:227-346` |
| Status | Proposed |

**Description.** Login, Forgot and Reset wrap each label+input in
`<div class="auth-field">`. Register does not; its labels and inputs are bare
children of the `<form>`. It is also the only auth route with a `<select>`.

---

## AUTH-009 — ?next= is captured but never surfaced

| Field | Value |
|---|---|
| Class | **A** (presentational only) |
| Category | opportunity / orientation |
| Severity | Low |
| Files | `axiosClient.js:117-122`, `LoginPage.jsx` (documented, unused) |
| Status | **Needs Manual Decision** |

**Description.** When a session expires mid-task, `axiosClient` redirects to
`/login?next=<path>`. Login documents this in its header but never shows it.
The user is bounced to sign-in with no indication that their place was kept.

**Why it matters to the direction.** "Where will this action take me" is a core
wayfinding question, and the answer already exists in the URL.

**Constraint.** Any label must be derived from a fixed allow-list of known
route paths mapped to human names. It must never echo the raw path, never
render a query string, and never alter redirect behaviour. An unrecognised
path renders no label at all.

---

## AUTH-011 — Status side-bar claimed an accessibility role it did not have

| Field | Value |
|---|---|
| Class | **A** |
| Category | accessibility / visual |
| Severity | Medium |
| Files | `styles/system/auth/auth.css` |
| Status | **Verified** (fixed in `2765857`) |

**Description.** Auth status messages carried a 3px coloured left border,
documented in the stylesheet as "a second, non-chromatic cue" supporting the
product rule that state is never signalled by colour alone. The border was
drawn in the same hue family as the message background and text, so it
conveyed nothing additional to a colour-blind reader. The design detector
separately flagged it as a side-tab accent, a generated-UI tell.

**Why it mattered.** A decorative stripe carrying a false accessibility
justification is worse than an unjustified stripe: it makes the codebase
assert a guarantee it is not delivering.

**Resolution.** Border removed, replaced by a 1px border in the status hue for
legibility only. The real cue is the message text, always present and
announced via `role="alert"` or `role="status"`. Comment corrected to state
the actual mechanism. Detector clean.

---

## AUTH-012 — Supporting panel inherited a dark plane and a grid

| Field | Value |
|---|---|
| Class | **A** |
| Category | visual / accessibility |
| Severity | High |
| Files | `styles/system/auth/auth.css` |
| Status | **Verified** (fixed in `bd6ff45`) |

**Description.** During the shared migration `.auth-brand` had `display` set
but not `background`, so the legacy dark chrome plane and its `::before` grid
still applied. The panel rendered near-black with a grid, and the supporting
text rendered dark-on-dark.

**User impact.** A live contrast failure, a dark surface contradicting the
confirmed outdoor-legibility rule, and a grid reading as the blueprint
vocabulary the direction rejects.

**How it was found.** Screenshot review. All 358 assertions passed while this
was on screen, which is why images are reviewed by eye rather than trusted to
automated checks.

---

## AUTH-013 — Register labels sat closer to the wrong field

| Field | Value |
|---|---|
| Class | **A** |
| Category | accessibility / visual |
| Severity | Medium |
| Route | `/register` |
| Files | `pages/RegisterPage.jsx` |
| Status | **Verified** (fixed in `bd6ff45`) |

**Description.** Register was the only auth route without `auth-field`
wrappers, so the form's uniform gap applied equally between every label and
every control. Each label sat nearer the field above it than its own input,
inverting the proximity relationship.

**Resolution.** Wrappers added, matching the three sibling routes. Markup
only; no behaviour, validation or payload change. Closes AUTH-008.

---

## AUTH-014 — Inline recovery link had no touch-target floor

| Field | Value |
|---|---|
| Class | **A** |
| Category | accessibility |
| Severity | Medium |
| Route | `/login` |
| Files | `styles/system/auth/auth.css` |
| Status | **Verified** (fixed in Boundary B) |

**Description.** Moving "Forgot password?" beside the password label
introduced `.auth-field__action`, initially styled as plain inline text with
no height floor. PRODUCT.md records 44 × 44 px as a tested guarantee.

**Resolution.** The label row carries `min-height: var(--ui-target-min)` and
the link is `inline-flex` at the same floor, so the target is real without
padding that would push the label off its line. Measured at 105 × 44.

---

## AUTH-009 — RESOLVED: ?next= orientation implemented safely

Superseding the earlier "Needs Manual Decision" status.

| Field | Value |
|---|---|
| Class | **A** (presentational only) |
| Status | **Verified** (Boundary B) |
| Files | `utils/authDestinations.js`, `pages/LoginPage.jsx` |

**Implementation.** `describeDestination` allow-lists exact paths against a
fixed table and returns a string from that table. Login renders it as its
subheading: `Continue to Payments.`

**Security properties, each verified at runtime by
`tools/fresh_ui/verify_login_pass.mjs`:**

- an allow-listed path names its destination;
- an unknown path falls back to the normal copy;
- **the raw parameter never reaches the DOM**, verified by injecting
  `/evil<script>x</script>` and asserting the substring is absent from
  `document.body.innerHTML`;
- an absolute URL such as `https://evil.example/dashboard` is refused;
- paths with extra segments, for example `/tenders/482`, do not match, so no
  record ID is ever disclosed.

**No routing change.** The helper performs no navigation and is consulted by
no routing decision. `axiosClient` still writes the parameter and `App.jsx`
still decides the destination, both untouched.

---

## AUTH-010 — Login and Register have no success state

| Field | Value |
|---|---|
| Class | **A** |
| Category | state-coverage |
| Severity | Low |
| Route | `/login`, `/register` |
| Status | Proposed |

**Description.** Both navigate away immediately on success. Forgot and Reset
both have a designed `role="status"` success message. There is currently no
confirmation moment on the two most-used auth routes.

**Constraint.** Any success treatment must not delay navigation. Security and
permission redirects stay immediate.


---

## AUTH-015 — Group labels failed contrast

| Field | Value |
|---|---|
| Class | **A** |
| Category | accessibility |
| Severity | Serious |
| Route | `/register` |
| Files | `styles/system/auth/auth.css` |
| Status | **Verified** (fixed in Boundary C) |

**Description.** `.auth-group__label` used `--ui-ink-faint`, measuring 3.50:1
against the canvas. axe rejected it at both mobile and desktop widths:
normal-size text needs 4.5:1.

**Root cause worth recording.** The token audit gates `--ui-ink-faint` at 3.0
with the justification "meta text, large or non-essential". These are 12px
labels, which are neither. The token was not wrong; the usage was. Changed to
`--ui-ink-muted`, 6.03:1.

**Also removed** a dead `id="register-group-you"` that no `aria-labelledby`
referenced.

---

## AUTH-016 — Contract test teardown left rows in the dev database

| Field | Value |
|---|---|
| Class | **A** |
| Category | technical debt / test hygiene |
| Severity | Medium |
| Files | `tests/register-contract.spec.js` |
| Status | **Verified** (fixed in Boundary C) |

**Description.** The first teardown deleted `company_users`, then the company,
then the user. Migration 004 seeds a materials catalog and labour categories
per company through a trigger, and many tables carry `company_id`, so the
company delete violated a foreign key, threw, and aborted the whole teardown.
Six users and six companies were left behind and had to be removed by hand.

**Resolution.** Teardown now clears every table carrying `company_id`,
discovered from `information_schema` rather than hard-coded, then the company,
the membership and the user in that order. Verified: zero residue after a full
run.


---

## AUTH-017 — passwordResetLimiter made verification impossible

| Field | Value |
|---|---|
| Class | **A** (narrowly authorised backend testability change) |
| Category | environment / testability |
| Severity | Medium |
| Files | `backend/config/env.js`, `backend/middleware/rateLimiter.js` |
| Status | **Verified** (Boundary D) |

**Description.** `POST /auth/forgot-password` is guarded by
`passwordResetLimiter`, not `authLimiter`. Its window and limit were
hard-coded at 60 minutes and 5 requests, reading no environment variable, so
`AUTH_RATE_LIMIT_MAX=100000` could not relax it. Any automated coverage of the
recovery flow exhausted the budget and then failed for an hour.

**Two misdiagnoses this caused, both recorded so they are not repeated.** The
429s were first attributed to `authLimiter`, and then to a backend that had
not been restarted. Neither was true: the process on `:5051` already carried
`AUTH_RATE_LIMIT_MAX=100000` and had been running since the previous day. The
limiter's own source comment notes it "existed and was never mounted", which
is why it had not bitten before.

**Resolution, authorised and deliberately narrow.**
`PASSWORD_RESET_RATE_LIMIT_WINDOW_MS` and `PASSWORD_RESET_RATE_LIMIT_MAX` are
read through the project's standard `parseInteger`, defaulting to exactly the
previous hard-coded values. With both absent, production behaviour is
unchanged. The limiter is never disabled, there is no IP bypass, and the
endpoint, middleware ordering and 429 response are untouched.

**Deviation from the brief, disclosed rather than silently chosen.** The
instruction asked that invalid production values "fail loudly". The project's
`parseInteger` returns the fallback instead, and that policy is applied to
every bounded integer in `config/env.js`. For a limiter the fallback is the
*stricter* production value, so a typo fails in the secure direction: the
endpoint keeps 5-per-hour rather than becoming unbounded. Making these two
variables throw would make them the only rate-limit settings that do. The
established pattern was kept.

**Coverage.** `backend/tests/passwordResetRateLimit.test.js`, 12 tests:
defaults remain 60 minutes and 5 requests, valid overrides are honoured,
invalid values of every shape fall back to the strict default, and the limiter
is never disabled. Documented in `backend/.env.example` and `DEPLOYMENT.md`,
including the trap that `AUTH_RATE_LIMIT_MAX` does not relax this endpoint.


---

## AUTH-018 — Reset tests mutated a shared fixture and raced its token

| Field | Value |
|---|---|
| Class | **A** |
| Category | test defect |
| Severity | **High** — it broke 128 assertions across unrelated suites |
| Files | `frontend/tests/reset-password.spec.js` |
| Status | **Verified** (fixed in Boundary E) |

**Description.** The end-to-end reset test minted a reset token for a shared
fixture account. Two independent failures followed.

1. **Token race.** The backend stores ONE `reset_token` per user.
   `forgot-password.spec.js` also mints a token for the admin fixture, so in a
   parallel run whichever suite ran second overwrote the other's token and the
   first failed with an invalid token. The test passed in isolation and failed
   in the full run, which is the signature of a shared-state race.

2. **Fixture destruction.** A successful reset *changes that account's
   password*. Switching to the worker fixture moved the problem rather than
   solving it: the restore in `afterAll` then failed, because four parallel
   workers each retried a wrong password and tripped a per-account
   failed-login lockout. The worker fixture was left unusable and **128
   assertions failed** across the portal, a11y and table suites, none of which
   had anything to do with this change.

**Recovery.** The fixture was restored with the documented
`createLocalPortalFixtures.js` seed script and the backend restarted to clear
the lockout counter. All three fixtures verified logging in afterwards.

**Resolution.** The suite now **owns its own account**: it registers a
throwaway workspace, resets that account, and deletes it in teardown, clearing
every `company_id` table before the company exactly as
`register-contract.spec.js` does. A throwaway account cannot collide with
another suite and cannot be left broken.

**The general lesson, recorded because it will recur.** Any test that performs
a destructive or single-use operation on an account must own that account.
Shared fixtures are safe to read and to sign in as; they are not safe to
mutate.

---

## AUTH-019 — Reset used one visibility control for two password fields

| Field | Value |
|---|---|
| Class | **A** |
| Category | accessibility / interaction-consistency |
| Severity | Medium |
| Route | `/reset-password` |
| Status | **Verified** (fixed in Boundary E) |

**Description.** A single checkbox revealed both the new password and its
confirmation, so a user unsure only of the confirmation had to expose the
password too. It was also the only auth route not using the button pattern
with `aria-pressed`.

**Resolution.** Each field has its own in-field toggle with an accurate
`aria-label`, `aria-pressed`, keyboard activation and a 44px target. Revealing
one never reveals the other, values survive toggling and focus stays on the
control. Closes AUTH-004; Login, Register and Reset now share one pattern.


---

## AUTH-020 — Auth password-control rules leaked into UsersPage

| Field | Value |
|---|---|
| Class | **A** |
| Category | visual / cross-route regression |
| Severity | Medium |
| Files | `styles/system/auth/auth.css`, `styles/components/forms.css` |
| Status | **Verified** (fixed in Boundary F) |

**Description.** `.password-input-wrapper` and `.password-toggle-btn` are NOT
auth-only: `UsersPage.jsx` renders both for setting a colleague's password.
The Boundary A rules defined them unscoped in the system layer, which wins on
layer order, so from Boundary A onward they silently restyled a route that has
not been migrated.

**How it was found.** The Boundary F consumer audit, which classifies each
legacy selector by whether anything OUTSIDE the auth group references it. Grep
alone would have reported them as auth selectors; the audit's scope check is
what caught it.

**Resolution.** The system's copies are scoped to `.auth-shell`. The shared
rules moved out of the deleted `styles/pages/auth.css` into
`styles/components/forms.css`, where a shared form control belongs, so
UsersPage keeps its own styling until it is migrated.

---

## AUTH-002 — CLOSED: legacy auth stylesheets removed

Both `styles/pages/auth.css` (370 lines) and `styles/v2/pages/auth.css` (541
lines) are **deleted**, along with their imports. 911 lines of competing auth
CSS are gone and the four auth routes now have exactly one styling system.

Removal was evidence-based, not grep-based, using
`tools/fresh_ui/auth_css_audit.py`, which classified all 23 legacy selectors
against static references, test references and whether each was auth-scoped:

- **16** auth-scoped and already defined in the current system: deleted.
- **3** referenced outside auth (`.error`, `.password-input-wrapper`,
  `.password-toggle-btn`): the two password-control selectors were preserved
  by moving their rules to `styles/components/forms.css` (AUTH-020);
  `.error` inside auth was scoped as `.auth-card .error` and went with the
  rest, while the generic `.error` lives in `foundation.css` and is untouched.
- **4** with no reference (`.auth-blueprint`, `.auth-blueprint__detail`,
  `.auth-blueprint__frame`, `.auth-brand-mark`): the retired StructuralFrame's
  styling, deleted with it.

Re-running the audit now reports **0 legacy selectors**.

---

## AUTH-007 — CLOSED: route guard presentation migrated

`RoleRoute`'s inline `style` object is gone. The loading state is a quiet line
of text in the design system, faded in after 240ms so a fast verification
shows nothing at all. Deliberately not a spinner and not a progress bar.
`role="status"` and `aria-live="polite"` are preserved exactly, and no gating
logic, redirect or `getHomePath` behaviour was touched.

---

## AUTH-021 — Backend rate-limit test could not be linted

| Field | Value |
|---|---|
| Class | **A** |
| Category | test defect |
| Severity | Low |
| Files | `backend/tests/passwordResetRateLimit.test.js` |
| Status | **Verified** (fixed in Boundary F) |

**Description.** The test was written with ESM `import`, which vitest accepted
but eslint rejected: the backend is CommonJS via `sourceType: "commonjs"`.
Converting to `require("vitest")` then failed at runtime, because vitest
cannot be required from CommonJS.

**Resolution.** Neither. `vitest.config.mjs` sets `globals: true`, so
`describe`, `it`, `expect` and `vi` arrive as globals and the file stays
CommonJS like every other backend file, satisfying both tools. Backend lint is
clean and all 234 tests pass.


---

# SHELL PROGRAMME — DISCOVERY FINDINGS

Recorded before any shell implementation. The behavioural read of the shell
components is **incomplete**; what follows is the mechanical dependency
evidence, which is complete and verified.

---

## SHELL-001 — The V2 shell teardown is asymmetric, and `.v2-root` is a trap

| Field | Value |
|---|---|
| Class | **B** (shell programme) |
| Category | architecture |
| Severity | **High** — it would produce a half-styled shell |
| Files | `layouts/AppLayout.jsx`, `styles/v2/shell/app-shell.css`, `styles/v2/shell/overlays.css` |
| Status | **Proposed** |

**The shell components reference exactly one V2 class:** `v2-root`, on
`AppLayout`. There are no other `v2-*` class names anywhere in `AppLayout`,
`Sidebar`, `Topbar`, `CommandPalette` or `NotificationCenter`.

That makes removing `.v2-root` look like a clean single-line teardown. **It is
not**, because the two V2 shell stylesheets are scoped differently:

| Sheet | Lines | Scoping | Effect of removing `.v2-root` |
|---|---|---|---|
| `v2/shell/overlays.css` | 374 | Scoped: `.v2-root .command-backdrop`, `.v2-root .command-modal`, … | **All 374 lines stop applying instantly** |
| `v2/shell/app-shell.css` | 620 | **Unscoped**: bare `.app-layout`, `.sidebar`, `.main-content`, `.skip-link`, … | **Keeps applying** |

So deleting one class silently strips the command palette and notification
centre back to V1 styling while the sidebar, layout and skip link keep their
V2 appearance. The shell would be visibly half-migrated with no test failure
to signal it, because the specs assert behaviour rather than appearance.

**Consequence for boundaries.** Overlay styling and shell-frame styling are
NOT separable via `.v2-root`. Either the overlays and the frame migrate
together, or `.v2-root` stays until both are done.

---

## SHELL-002 — V1 and V2 both define the shell's bare selectors

| Field | Value |
|---|---|
| Class | **B** |
| Category | css-architecture |
| Severity | Medium |
| Files | `styles/core/shell.css` (585 lines), `styles/v2/shell/app-shell.css` (620) |
| Status | **Proposed** |

`styles/core/shell.css` defines 33 top-level rules for the same unprefixed
selectors V2 redefines (`.sidebar`, `.app-layout`, `.main-content`, `.topbar`,
`.skip-link`). Neither is scoped to a route group, so **both apply to every
authenticated page**, with layer order deciding the winner.

This is the same shape as the auth debt, but larger: 1,205 lines across two
systems for one subsystem, and unlike auth these selectors are structural, so a
mistake reflows every business route at once.

---

## SHELL-003 — Unscoped shell selectors are a restyling hazard for 20+ routes

| Field | Value |
|---|---|
| Class | **B** |
| Category | cross-route regression risk |
| Severity | **High** |
| Status | **Proposed** |

AUTH-020 already proved this failure mode once: `.password-input-wrapper` was
assumed auth-only, defined unscoped in a later layer, and silently restyled
`UsersPage` for four boundaries before an audit caught it.

The shell's surface area is far larger. `.app-layout`, `.main-content`,
`.page-content` and `.sidebar` wrap **every** authenticated route, all of which
still run V1/V2 presentation. Any new unscoped rule on those selectors, or any
bare element rule inside the shell layer, changes 20+ unmigrated pages at once.

**Required mitigation before shell implementation begins:** a computed-style
diff on representative unmigrated routes, captured before and after, plus
screenshots. Test counts will not detect this.

---

## SHELL-004 — 252 `--v2-*` token references in shell CSS

| Field | Value |
|---|---|
| Class | **B** |
| Category | technical debt |
| Severity | Medium |
| Status | **Proposed** |

`v2/shell/app-shell.css` makes 156 `--v2-*` token references and
`overlays.css` makes 96. Those tokens live in `v2/core/tokens.css`, which must
survive because unmigrated business routes depend on it.

So the shell migration removes shell *rules*, not the V2 token layer. V2 tokens
retire only when the last business route does.

---

## Shell test contracts that must survive

Behavioural, in `authenticated.spec.js`, and none depend on V2 names:

- drawer opens, **traps focus**, closes on Escape, **restores focus**
- drawer links are **out of the tab order while closed**
- the toggle is hidden once the sidebar is permanent
- notification panel: Escape closes, focus returns to the trigger
- Escape with nothing open does not disturb the page
- **a modal surface outranks the notification panel for Escape** — overlay
  precedence is already a deliberate, tested contract
- drawer Escape still works at 768px
- sidebar navigation reaches the route and content stays usable

`useDismissableOverlay.js` (113 lines) appears to own this precedence and is
the first file to read in the behavioural pass.

---

## Proposed atomic boundaries, derived from the evidence above

The obvious A–E split in the brief does **not** survive SHELL-001. Revised:

| Boundary | Scope | Why it is atomic |
|---|---|---|
| **S-A** | Shell frame **and** overlays together: `AppLayout`, `Sidebar`, `Topbar`, `CommandPalette`, `NotificationCenter`, plus removal of `.v2-root` and both V2 shell sheets | `.v2-root` cannot be removed for one and not the other (SHELL-001) |
| **S-B** | Mobile drawer model, only if it changes shape rather than styling | Separable only if S-A keeps the current drawer contract intact |
| **S-C** | Route transitions | Genuinely separable: no shared CSS, and policy lives in one place |
| **S-D** | `styles/core/shell.css` removal | Last, once no consumer remains (SHELL-002) |

**S-A is large and cannot be split.** It touches five components and roughly
1,000 lines of CSS in one pass. It must not be started without the budget to
finish it.


---

## SHELL-005 — `.command-backdrop` and `.modal-backdrop` are behavioural contracts, not style hooks

| Field | Value |
|---|---|
| Class | **B** (shell programme) |
| Category | behaviour / architecture |
| Severity | **High** |
| Files | `hooks/useDismissableOverlay.js:49,91` |
| Status | **Proposed** — must not be solved during discovery |

**Description.** `useDismissableOverlay.js` arbitrates Escape between four
listeners: the command palette (window), the mobile drawer (document), the
account menu and the notification panel. Two rules resolve them.

1. A module-scoped stack of open overlays, each holding an **object identity
   token** rather than an index, so closing out of order stays correct. Only
   the most recently opened dropdown responds to Escape.
2. **A modal surface outranks every dropdown**, detected by a literal DOM
   query:

```js
const MODAL_SURFACES = ".command-backdrop, .modal-backdrop";
...
if (document.querySelector(MODAL_SURFACES)) {
  return;   // let the modal own the key
}
```

Rule 2 is a class-selector check *by design*: the source comment states it was
chosen so the palette's and drawer's own handlers stay completely untouched.

**Why this is High.** These two class names look like styling hooks and would
be renamed without a second thought during a shell restyle. If either is
renamed or dropped, `document.querySelector` silently returns null, rule 2
stops firing, and **one Escape closes an underlying notification or account
overlay while a modal is still open.** Nothing throws. The only thing standing
between that and production is a single existing assertion,
`authenticated.spec.js:417` — *"a modal surface outranks the notification panel
for Escape"*.

**Consequence for S-A.** Overlay styling and overlay behaviour are entangled
through class names, which reinforces SHELL-001: the overlays cannot be
restyled independently of their behaviour.

**Recommendation, to be decided in the implementation session, not now.**
Either:

- **Preserve both class names verbatim through S-A** — the low-risk option; or
- **Deliberately separate the behavioural hook from styling**, for example a
  `data-modal-surface` attribute queried instead of a class, and add tests
  covering each overlay pairing rather than relying on the single existing
  assertion.

Choosing the second option without adding those tests would be strictly worse
than leaving it alone.


---

## SHELL-006 — S-A is divisible; only the `.v2-root` removal is atomic

| Field | Value |
|---|---|
| Class | **B** |
| Category | architecture / planning correction |
| Severity | Medium |
| Status | **Verified** |

**Correction to SHELL-001's consequence.** SHELL-001 established that removing
`.v2-root` breaks overlay styling while leaving frame styling active, and the
conclusion drawn was that the whole shell must migrate as one indivisible S-A.

That conclusion was too strong. The atomicity applies to the **removal**, not
to the migration. New system-layer rules do not require `.v2-root` to go,
because layer order already gives them precedence over both legacy sheets.

So S-A divides into independently shippable, independently verifiable units,
with the removal last:

| Unit | Scope | State |
|---|---|---|
| **S-A1** | Sidebar and drawer styling | **Done** |
| S-A2 | Topbar | pending |
| S-A3 | Overlays: command palette, notifications, account menu | pending |
| S-A4 | Frame: `.app-layout`, `.main-content`, `.page-content`, skip link | pending |
| S-A5 | `.v2-root` removal plus deletion of both V2 shell sheets | pending, atomic, last |

Each of S-A1 to S-A4 leaves the application fully functional, because the
legacy sheets stay in place underneath until S-A5.

---

## SHELL-007 — The active nav item inherited an amber bar

| Field | Value |
|---|---|
| Class | **A** |
| Category | visual / semantic |
| Severity | Medium |
| Files | `styles/core/shell.css:205`, `styles/system/shell/sidebar.css` |
| Status | **Verified** (fixed in S-A1) |

**Description.** `core/shell.css:205` paints the current nav item with
`box-shadow: inset 3px 0 0 var(--identity-mark)` — an amber bar. The new
sidebar set `box-shadow: none` on `.sidebar` but not on `.sidebar-link`, so the
amber bar survived underneath the new accent mark.

**Why it matters beyond appearance.** Amber is the warning status in this
product and DESIGN_SYSTEM.md states it is never a brand or decorative colour.
An amber bar on the current route reads as a warning on whatever page the user
is standing on.

`core/shell.css:213` likewise recolours the focus ring to the identity amber;
that is now overridden to the accent, consistent with every other control.

**How it was found.** Screenshot review at 1440. All 370 assertions passed with
the amber bar on screen. This is the third time visual review has caught a
defect the suite could not (AUTH-012, AUTH-013, now SHELL-007), and the second
time the cause was a property left unset while the legacy sheet still applied.


---

## SHELL-008 — Overriding a legacy rule means owning its media queries too

| Field | Value |
|---|---|
| Class | **A** |
| Category | responsive / regression |
| Severity | Medium |
| Files | `styles/system/shell/topbar.css` |
| Status | **Verified** (fixed in S-A2) |

**Description.** The new topbar set `.sidebar-toggle { display: inline-flex }`
unconditionally. The legacy sheet hides that button at 1024px and above, where
the sidebar is permanent and the drawer it controls does not exist. Setting
`display` in a later layer beat the legacy rule at every width, so the toggle
reappeared on desktop.

**How it was found.** `authenticated.spec.js:322`, *"toggle is hidden once the
sidebar is permanent"*. This is the first shell defect a test caught rather
than a screenshot, because it is a behavioural contract rather than an
appearance one.

**The generalised lesson**, now twice demonstrated with SHELL-007: overriding
one property of a legacy rule means taking responsibility for **all** of that
rule's behaviour, including its media queries and its state variants. A
property left unset stays legacy; a property set unconditionally destroys a
legacy conditional. Both directions are traps.


---

## SHELL-009 — Overriding one inset left the opposite legacy inset in force

| Field | Value |
|---|---|
| Class | **A** |
| Category | responsive / regression |
| Severity | Medium |
| Files | `styles/system/shell/notifications.css` |
| Status | **Verified** (fixed in S-A3b) |

**Description.** The new notification panel set `inset-inline-end: 0` but not
`inset-inline-start`. The legacy sheet sets `left` on the same element, so both
insets stayed in force, stretching the panel across its anchor and pushing it
**226px past the right edge at 768px**, with matching document overflow.

**How it was found.** The targeted notification probe, which measures the
panel's rect against the viewport at three widths. The responsive shell probe
did not catch it because the panel only exists while open.

**Resolution.** `inset-inline-start: auto` stated explicitly. This is the third
instance of SHELL-008's rule: overriding part of a legacy rule means owning the
rest of it. The three faces so far are an unset property (SHELL-007), an
unconditionally set property destroying a legacy media query (SHELL-008), and
now one side of a paired property leaving its opposite active.

---

## SHELL-010 — A probe produced a false negative on Escape

| Field | Value |
|---|---|
| Class | **A** |
| Category | test defect |
| Severity | Low |
| Files | `tools/fresh_ui/notification_probe.mjs` |
| Status | **Verified** (fixed in S-A3b) |

**Description.** The first version of the notification probe pressed Escape
with focus still on the trigger and reported six failures across widths and
motion modes. `authenticated.spec.js:371` and `:417`, which drive the real
interaction including modal precedence, both pass.

The probe was wrong, not the application. It was checked against the suite
before anything was changed, so no working behaviour was "fixed".

**Resolution.** The Escape and focus-restoration assertions were removed from
the probe rather than patched. That contract belongs to the suite, which
exercises it properly; a second, worse implementation of the same check is a
liability. The probe keeps what it is uniquely able to measure: panel geometry
against the viewport while open.


---

## SHELL-011 — The command palette has no dialog semantics

| Field | Value |
|---|---|
| Class | **B** (needs a JSX change, own unit) |
| Category | accessibility |
| Severity | **High** |
| Files | `components/CommandPalette.jsx` |
| Status | **Proposed** — deliberately NOT fixed in S-A3c |

**Description.** `.command-modal` is a modal surface that traps the user's
attention behind a full-viewport backdrop, but it carries no `role="dialog"`,
no `aria-modal`, and no accessible name. A screen-reader user is given no
signal that a dialog opened.

Three further gaps in the same component:

- **No result navigation.** Only Ctrl/Cmd+K and Escape are handled. There is no
  ArrowUp/ArrowDown movement and no Enter activation; results are reachable
  only by Tab or pointer.
- **No selected state.** Because nothing tracks a selection, there is no
  "what happens if I press Enter" affordance. S-A3c styles hover and
  `:focus-visible` identically so Tab movement is at least visible, but that is
  a mitigation, not the contract.
- **No focus trap or focus restoration**, so Tab can leave the dialog.

**Why it was not fixed here.** S-A3c is a CSS unit. All four gaps require
changing `CommandPalette.jsx`, which changes keyboard behaviour and needs its
own tests. Bundling them into a styling pass would have shipped untested
interaction changes.

**Recommendation.** A dedicated unit: add dialog semantics, arrow-key
selection with a real selected state, Enter activation, focus trap and
restoration, plus tests for each. The styling in
`styles/system/shell/command-palette.css` already anticipates a selected row.

---

## SHELL-012 — The palette's Framer animation ignores prefers-reduced-motion

| Field | Value |
|---|---|
| Class | **B** (needs a JSX change) |
| Category | accessibility / motion |
| Severity | Medium |
| Files | `components/CommandPalette.jsx` |
| Status | **Proposed** — deliberately NOT fixed in S-A3c |

**Description.** The modal's entrance and exit are inline Framer Motion props
(`initial`/`animate`/`exit`, 0.22s, translating 35px and scaling from 0.94).
Framer does not apply `prefers-reduced-motion` to explicit props, so a user who
has asked for reduced motion still gets a scaling, travelling dialog. The
project's own rule is that reduced motion is a designed mode, not a disabled
one, and this surface currently has no such mode.

**Consequence proven at runtime.** Because the entrance is a transform,
`getBoundingClientRect()` reports the SCALED box while it runs. The first
version of the palette probe waited 120ms in reduced mode against a 220ms
animation and reported result rows as **43px** when they are **44px**, and
reported Escape as failing when it works. Both were measurement artifacts of
this gap.

**Why it was not fixed here.** The stylesheet cannot reach a Framer prop, and
overriding it with `!important` would fight the library rather than fix the
component. The correct fix is `useReducedMotion()` inside the component,
which belongs with SHELL-011's unit.

**Probe corrected**, not the app: it now waits 500ms in both modes and 600ms
after Escape, and the reasoning is recorded in the file.


---

## SHELL-013 — The palette inherited a glassmorphic backdrop blur

| Field | Value |
|---|---|
| Class | **A** |
| Category | visual / performance |
| Severity | Medium |
| Files | `styles/system/shell/command-palette.css` |
| Status | **Verified** (fixed in S-A3c) |

**Description.** The new palette sheet set the backdrop's `background` but not
its `backdrop-filter`, so the legacy blur survived:
`core/shell.css:357` applies `blur(10px)` and `v2/shell/overlays.css:50`
applies `blur(3px)`. The whole application rendered blurred behind the palette.

**Why it matters beyond taste.** A full-viewport `backdrop-filter` forces a
whole-screen repaint every frame on the phones this product targets, and it
buys nothing once the palette surface itself is opaque. The brief also rules
out glassmorphism explicitly.

**How it was found.** Screenshot review at 1440. All 370 assertions passed with
the blur on screen, and the palette probe passed too — geometry and semantics
were correct, only the appearance was wrong.

**Resolution.** `backdrop-filter: none` stated explicitly, with the
`-webkit-` prefix for Safari. Fourth instance of SHELL-008: an unset property
stays legacy.


---

## SHELL-014 — Frame selectors are shell-only, which narrows the S-A4 risk

| Field | Value |
|---|---|
| Class | **B** |
| Category | architecture / planning |
| Severity | Informational |
| Status | **Verified** (measured in S-A4c) |

`.app-layout`, `.main-content`, `.page-content` and `.skip-link` were each
searched across the frontend. **None is used as a class by any business page**;
all four appear only in `AppLayout.jsx`.

That materially narrows SHELL-003 for the remaining frame work. The danger is
no longer that a business page renders one of these classes, but that a frame
rule reaches page content through **geometry** (width, gutters, offsets) or
through a **descendant or bare element rule**. Those are different failure
modes and need a different check: the leak probe's computed-style diff catches
descendant styling, but a deliberate geometry change is expected and must be
classified rather than flagged.

**Consequence for the remaining subunits.** S-A4a (`.app-layout`,
`.main-content`) and S-A4b (`.page-content`, gutters and width policy) still
need a before/after comparison, but it must distinguish intended frame geometry
from unintended descendant restyling. The current probe reports both as
"no change" only because S-A4c altered neither.

---

## S-A4 SUBDIVISION

S-A4 was split on the dependency evidence above rather than shipped whole:

| Subunit | Scope | State |
|---|---|---|
| **S-A4c** | `.skip-link` | **Done** — changes no page geometry, so it ships alone |
| S-A4a | `.app-layout`, `.main-content` — sidebar and topbar offsets | pending |
| S-A4b | `.page-content` — gutters, width policy | pending |

S-A4c was taken first precisely because it is the only part of the frame with
**zero** effect on page layout, so it carries none of the SHELL-003 risk the
other two do.


---

## SHELL-015 — The leak probe could not distinguish intended geometry from leakage

| Field | Value |
|---|---|
| Class | **A** |
| Category | tooling / verification |
| Severity | **High** — it would have blocked or falsely cleared the frame units |
| Files | `tools/fresh_ui/shell_leak_probe.mjs` |
| Status | **Verified** (fixed before S-A4a) |

**Description.** The original probe treated ANY computed-style difference on a
business page as leakage. That was right while the shell units changed only
navigation and overlays, which must not move page content at all. It becomes
wrong for the frame units, where changing the sidebar offset or the content
gutter is the entire purpose.

An instrument that flags intended change alongside real defects trains its
reader to ignore it, which is worse than having no instrument.

**Resolution.** Results are now classified and reported separately:

- **A. Frame geometry** — the rects of `.app-layout`, `.main-content` and
  `.page-content`, plus the viewport. Reported as information; never a
  failure.
- **B. Descendant style** — computed visual properties of nine representative
  page components. Any difference is a failure and exits non-zero.

The split is deliberately narrow: bucket A is three named elements and the
viewport, nothing else. Widening it to silence a finding would defeat the
instrument.

**One deliberate exclusion, stated rather than hidden.** Element width and
height are not sampled. A narrower content column reflows a table or card to a
different size with no style having changed, and that is geometry, not
leakage. Colour, type, border, radius, shadow, spacing and opacity ARE
sampled, because none of those can change from reflow alone.

**Validated by negative control, not by assumption.** A deliberate
`.app-layout button { border-radius: 13px }` was injected. The probe reported
`FAIL` with 5 route/component differences naming the exact property, then the
control was reverted and the probe returned to PASS. A detector that has never
been shown to detect anything is not evidence.

**Fresh baseline captured** at `c1bb6cf` and committed to
`tools/fresh_ui/baselines/shell-c1bb6cf.json`. The previous reference predated
S-A1 through S-A4c and would have reported every intended shell change as a
finding. Samples genuinely absent on a route are recorded as `"absent"` and
compared as such, so a component disappearing is caught, rather than being
silently substituted.


---

## SHELL-016 — Inherited properties on the shell root leaked into every page

| Field | Value |
|---|---|
| Class | **A** |
| Category | cascade / leakage |
| Severity | **High** |
| Files | `styles/system/shell/app-layout.css` |
| Status | **Verified** (fixed within S-A4a1) |

**Description.** The first version of the migrated `.app-layout` set
`color: var(--ui-ink)` and `font-family: var(--ui-font-sans)`. Both are
**inherited** properties, so they cascaded into every descendant that does not
declare its own — which is most components on the five unmigrated routes.

**Measured impact.** 41 descendant style differences: card `color` changed from
`rgb(13, 16, 23)` to `rgb(47, 46, 42)`, and the resolved font stack changed on
buttons, inputs, selects, headings and cards across Dashboard, Tenders,
Payments, Users and Site Operations.

**How it was found.** The frame-aware leak probe rebuilt immediately before
this unit (SHELL-015). Bucket B reported all 41 and failed. The negative
control run had already proven the probe detects real changes, so the finding
was trusted rather than second-guessed.

**Note on my own reasoning.** The file's original comment asserted "inherited
text colour only; pages that set their own are unaffected". That was true and
irrelevant: the question is what happens to pages that DON'T set their own, and
most do not. A plausible-sounding justification in a comment is not evidence.

**Resolution.** The authenticated root now owns only NON-inherited properties
while pages remain unmigrated: `display`, `grid-template-columns`,
`min-height` and `background`. Typography and text colour move with the pages
themselves, not ahead of them.

**Generalised rule for the remaining frame units.** A shell selector that
wraps unmigrated content may set non-inherited properties freely, but must not
set `color`, `font-family`, `font-size`, `line-height`, `letter-spacing`,
`text-align`, `visibility` or any other inherited property until the content
inside it has been migrated.
