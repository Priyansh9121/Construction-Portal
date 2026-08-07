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

## AUTH-001 — RegisterPage header comment contradicts its implementation

| Field | Value |
|---|---|
| Class | **C + D** |
| Category | documentation / security-review |
| Severity | High |
| Route | `/register` |
| Files | `frontend/src/pages/RegisterPage.jsx:21-25` |
| Status | **Needs Manual Decision** |

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
