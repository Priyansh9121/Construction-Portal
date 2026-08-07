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
