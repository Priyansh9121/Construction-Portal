# /site-operations — analysis before redesign

Phase E, Tier 1, route 1. **No JSX or CSS written.** The workflow that was to
produce this stalled with four agents started and none returned; the journal held
no results, so this was done directly.

---

## The headline, because it changes the ordering premise

**This is largely a visual migration.** Of the ten §1.12–§1.15 rules this screen
carries, **eight are already surfaced**, one is surfaced but unreachable on the
device that matters, and **one is genuinely absent**.

That one is real and it is the operational failure the tier was ordered around:

> **The entry-window boundary is invisible until it is crossed.** No date input
> carries a `min`. The context card reports *"3 days ago"* in neutral text. No
> helper text anywhere states that material and labour close at 2 days. A
> supervisor picks a date, fills the form, uploads a photo, submits — and only
> then learns the entry was never going to be accepted.

That justifies doing something here. It does **not** justify a full rebuild
ahead of every other route on rule-completeness grounds, and the plan's claim
that this screen has "the most business rules per screen, all needing a surface"
was too generous. It has the most rules; most of them are already surfaced.

**If the tier ordering rested on that premise, it needs revisiting.** The
counter-argument for keeping it first is now different and weaker: it has zero
v2 dependence, so it is the cheapest route to migrate, and it is the one where a
missing surface has operational rather than cosmetic consequence.

---

## 1. What this screen is for

The supervisor surface for a construction site: **what was bought, who worked,
and what money moved**, recorded against a date.

Its own header states the sharing model, and the code matches it:

> *"The one screen office staff and supervisors share. Recording is open to any
> authenticated user; approving, granting access and issuing banking funds are
> office-only, enforced per route by the backend. The page hides those controls
> for non-office users, but the backend is what actually refuses them."*

So it is two audiences in one screen: a **supervisor on a phone at a site**
recording today's work, and **office staff on a desktop** approving it, granting
back-dated access and issuing funds. The `isOffice` prop switches the second set
on. Field roles reach it on phones, which is the constrained case and the case
that matters.

Everything it records is dated, and every dated write goes through the §1.13
entry window.

## 2. The rules it must surface

| Rule | Server enforces (file) | Surfaced today? | What the surface needs |
|---|---|---|---|
| §1.12 material sections | `material.controller.js` | **yes** | `<optgroup>` per section, `SiteOperationsPage.jsx:402-404` |
| §1.12 taxonomy incl. Gujarati `name_local` | `004_seed_reference_data.sql` | **yes** | rendered as `name (name_local)`, `:408` |
| §1.12 daily quantity with the bill | `material.controller.js` | **yes** | quantity + amount on the form |
| §1.12 photo upload | `material.controller.js` | **yes** | camera and gallery buttons, `:328-340` |
| **§1.13 the 2-day window** | `entryWindow.service.js:391-394` | **NO** | see below — the one real gap |
| §1.13 grace day, **banking only** | `entryWindow.service.js:391-393` — banking gets `EDIT_WINDOW + GRACE`, everything else `EDIT_WINDOW` | **no** | the window differs per module and nothing says so |
| §1.13 future dates refused | `entryWindow.service.js:382` `FUTURE_DATE` | **yes, proactively** | `max={todayLocal()}` on all four date inputs |
| §1.13 access grant for older dates | `entryWindow.service.js:437` `ACCESS_REQUIRED` | **yes, reactively** | `handleBlocked` `:122-133` → `AccessPrompt` `:243` |
| §1.13 camera vs gallery recorded | `material.controller.js:126-160` | **yes** | badge, `:591-598` |
| §1.13 company can see which, corroborated | `LIVE_CAPTURE_TOLERANCE_MS`, `photo_is_verified` | **yes, but tooltip-only** | see below |
| §1.14 three receipt modes | `banking.controller.js` | **yes** | `bank` / `cash` / `gst_cash`, `:1191-1193` |
| §1.15 per-labourer ledger | `labour.controller.js` | **yes** | `useLabourLedger(selectedId)` `:639` |
| §1.15 trade grouping | `category` + `category_local` | **yes** | `:767` renders `category_local \|\| category` |
| §1.15 outstanding dues | ledger carries outstanding | **yes** | `:769` |

### The one genuinely absent surface

The window is **2 days**, or **3 for banking** — `SUPERVISOR_EDIT_WINDOW_DAYS`
plus `SUPERVISOR_BANKING_GRACE_DAYS` (`entryWindow.service.js:391-394`).

Nothing in the UI expresses it:

- **No `min` on any date input.** All four carry `max={todayLocal()}` and stop
  at the future end only (`:422`, `:816`, `:1055`, `:1174`).
- **The context card is neutral about it.** `SiteOpsContext.jsx:72` renders
  `` `${dayDelta} days ago` `` with no notion that 3 days ago is already closed
  for material and labour.
- **No helper text** states the window, and the per-module difference — banking
  gets a third day, nothing else does — is invisible.

The consequence is asymmetric and that is why it matters. A refusal costs a
supervisor the whole entry: the date, the material, the quantity, the amount and
a photo they may have taken specifically for it. On a phone, at a site, that is
work genuinely lost, and the recovery path — request access, wait for the office
to grant it — is slow by design because it is an anti-fraud control.

**This must not be fixed by widening the window or by making the date freely
editable.** The surface has to make the boundary visible *before* effort is
spent, and route the user to the existing access request when they are outside
it.

### The surface that exists but not on the device that matters

`photo_is_verified` — the server's corroboration of a camera claim against
capture time — is rendered as a **`title` attribute** (`:592-596`):

    title={m.photo_is_verified
      ? "Camera capture, timestamp corroborated"
      : "Source not corroborated"}

A `title` tooltip requires hover. **On a touch device it is unreachable**, so an
office user reviewing entries on a phone sees a bare source badge and an
unexplained ✓. The distinction the brief insists on — that this is a signal and
not proof — is carried entirely in text nobody on a phone can read.

The supervisor-side badge has the opposite problem: it asserts **"Taken now"**
(`:543-546`) as fact, with no caveat at all.

## 3. What the legacy markup does

`SiteOperationsPage.jsx`, 1,477 lines, one component import.

| Lines | Block |
|---|---|
| 55 | `TABS` — material, labour, banking, access |
| 72 | `SiteOperationsPage` — tab state, shared fetch, `handleBlocked` |
| 122-133 | `handleBlocked` — turns `ACCESS_REQUIRED` into `AccessPrompt` |
| 243 | `AccessPrompt` |
| 280 | `MaterialTab` — form, photo capture, office-facing log with provenance |
| 637 | `LabourTab` — labourer register, ledger, work entry |
| 882 | `BankingTab` — receipts, expenses, the three modes |
| 1358 | `DecideCell` — approve / reject |
| 1392 | `AccessTab` — grant and review access requests |

**Zero v2 dependence**, verified by `tools/ui_v2/v2_dependence.mjs` and by hand:
it imports only `components/siteOperations/SiteOpsContext`, which uses its own
`ops-*` vocabulary. Its styling is `styles/pages/site-operations.css`, 553 lines
declaring 11 `ops-*` classes, and that file dies with the migration.

That makes it the cheapest route in Tier 1 to migrate — nothing to unwind.

## 4. What the system already provides, and what it does not

**Provides:**

- `system/core/money.css` — `.ui-money` with `__symbol`, `__digits`,
  `__fraction`, `__sign`. Directly reusable for every amount on this screen.
- `system/activity/activity.css` — a **list-with-filters** pattern:
  `ledger`, `ledger__head`, `ledger__title`, `ledger__scope`, `ledger__filters`,
  `ledger__filter`, `ledger__body`, `ledger__state`, `ledger__stale`,
  `ledger__cap`, `ledger__failure`. This is the closest existing analogue to a
  materials/banking log and should be the starting point rather than a new one.
- `system/core/material.css` — the surface idiom, as **data attributes**:
  `[data-material="raised" | "inset" | "ground"]`, with shadow and radius tokens.
- `system/core/finance.css` — income/expense/profit series tokens.
- `system/foundation/` — structure, type, interaction.

**An idiom note that matters:** the system styles **data attributes**, not only
classes — `data-material`, `data-tone`, `data-state`, `data-active`,
`data-size`. A redesign that reaches for new class names instead of these
attributes will diverge from the system while appearing to use it.

**Does not provide** — and this is where the authoring risk sits:

1. **A tab/module switcher.** `ModuleTabs` is bespoke. `activity.css` has
   filters, not tabs.
2. **A photo capture-and-preview control** with a provenance badge.
3. **Any date-boundary / window messaging pattern.** Nothing in the system
   expresses "you may enter dates between X and Y, and here is why". This is the
   most important new thing, and it has no precedent to copy.
4. **An approve/reject affordance** (`DecideCell`).

## 5. Proposed shape

Sections in render order. Where a choice is art direction rather than mechanics,
it is marked **[AD]** and is yours, not mine.

1. **Page head** — title, subtitle, and the site/date context currently in
   `SiteOpsContextCard`. Uses the `ledger__head` / `ledger__title` /
   `ledger__scope` pattern.

2. **The date-and-window control** — the new authoring, and the point of this
   migration. The date input gains a `min` derived from the active module's
   window, and states the boundary in text before anything is typed. When the
   user needs a date outside it, this is where the access request is offered,
   rather than after a failed submit.
   **[AD]** How prominent this is — a permanent line under the date, or
   something that only appears near the boundary — is a judgement about how much
   the screen should talk about a rule that applies most of the time.

3. **Module switcher** — material / labour / banking / access, `data-active` on
   the selected one. Access stays office-only.
   **[AD]** Whether four peer tabs is still right, given access is office-only
   and the other three are the supervisor's daily work.

4. **The active module's recording form** — `[data-material="inset"]`, fields
   per the existing taxonomy, `.ui-money` for amounts, `name_local` preserved.

5. **Photo capture** (material only) — camera and gallery, preview, and a
   provenance badge that states what it is: a claim plus whether the timestamp
   corroborates it. **Not a tooltip** — the caveat must be readable on a phone.
   **[AD]** The exact wording. "Taken now" is an assertion; something like
   "Camera · time matches" is a claim with its evidence, and the brief requires
   the UI to say it is a signal, not proof.

6. **The log** — `ledger__body`, one row per entry, `.ui-money` amounts,
   provenance badge, and `DecideCell` for office users.

7. **Empty and failure states** — `ledger__state`, `ledger__failure`.

## 6. Risks and open questions, ranked

1. **The tier premise is weaker than the plan claimed.** Eight of ten rules are
   already surfaced. Do you still want `/site-operations` first? It is the
   cheapest to migrate (zero v2 dependence) and the only one with an operational
   rather than cosmetic gap — but it is not the rule-completeness case the plan
   made.
2. **The window surface is new authoring with no precedent in the system**, and
   it touches an entry-window control. I will not change what the window *is*;
   the question is only how it is shown, and I want the shape agreed before it
   is built.
3. **Photo provenance wording is a product decision** — how strongly the UI
   asserts a camera claim, given the brief requires it to read as a signal
   rather than proof.
4. **The banking grace day is invisible.** Banking gets three days, everything
   else two. Should the UI state the per-module difference, or is that detail
   the office's business rather than the supervisor's?
5. **`title`-only corroboration is an accessibility and mobile defect**, not
   just a redesign nicety. Worth fixing regardless of whether this route is
   migrated now.

---

# CORRECTION — the analysis above rests on a premise that is false

Added after a parallel analysis surfaced it, then verified by hand. **The
headline finding of this document — that a supervisor loses their work to an
invisible entry window — cannot happen on this route.**

## The defect is the composition, not any one of the three

Three role sets, written in three places by three different concerns, are
**byte-identical**:

| where | what it decides | the set |
|---|---|---|
| `frontend/src/routes/AppRoutes.jsx:122-127` | who may open `/site-operations` | `["admin", "manager"]` |
| `frontend/src/pages/SiteOperationsPage.jsx:86-92` | `isOffice`, which reveals approve / grant / issue | `["admin", "manager"]` |
| `backend/modules/siteOperations/entryWindow.service.js:136` | `WINDOW_EXEMPT_ROLES` | `{admin, manager}` |

Each is defensible alone. Composed, they produce a screen where:

1. **A supervisor cannot open the page.** The router admits only office roles.
2. **Every `isOffice &&` branch is unconditionally true**, and every implicit
   non-office branch is unreachable code.
3. **The entry window can never fire for anyone who can see the screen**, because
   the set that may enter is exactly the set that is exempt.

So the §1.13 anti-fraud control this screen is built around is, on this screen,
inert — and the elaborate `ACCESS_REQUIRED` → `AccessPrompt` → grant flow at
`SiteOperationsPage.jsx:122-133`, `:243`, `:1392` is unreachable in production
for every user who can load it.

**No single one of the three is the bug.** Each is a reasonable local decision.
The defect only exists in their composition, which is why reading any one file —
including this page's own header, which says it is "the one screen office staff
and supervisors share" — gives no hint of it. That header is what I reasoned
from, and it is the ninth instance of a comment that is not evidence.

## The six other corrections, each verified independently

| Claimed above | Actually |
|---|---|
| all four date inputs cap at today | **three do**; the receipt date input has no `max` |
| the window could be shown in the UI | **`windowDays` never reaches the client** — `entryWindow.service.js:439` computes it, no controller relays it. A window control needs a backend change first |
| §1.12 sections cleanly surfaced | `<optgroup>` labels render **raw machine codes** — `aggregate`, `binder`, `road` |
| §1.15 trade grouping surfaced | the roster is a **flat list**; the backend supports a `category` filter the UI never uses |
| approve/reject is complete | `admin_comment` is plumbed end to end but the page calls with two arguments, so it is **always empty** |
| photo provenance surfaced | **material only** — `banking.controller.js` never calls `assessPhoto` |

## What this changes

- **The window control is not designed here.** On this route it would surface a
  rule that cannot fire for anyone who can see it. §1.13's real surface belongs
  wherever supervisors actually record — `/worker-portal`, if the data agrees.
- **The gate is not to be changed.** Whether supervisors should reach
  `/site-operations` is a product decision, pending the role census.
- **Tier 1's ordering is on hold**, because both justifications for this route
  leading it are gone.

## The question the data must answer

Which role does a real supervisor hold? Three answers, three different
consequences:

- **`manager`** — then `WINDOW_EXEMPT_ROLES` exempts exactly the people who
  record, and **§1.13's entry window applies to nobody in production.** That is
  a far larger finding than any redesign.
- **`worker`** — the rule bites on `/worker-portal`, and Tier 1 should lead
  there.
- **nobody records site work at all** — the area is unexercised, and ordering
  should weight routes people actually use.
