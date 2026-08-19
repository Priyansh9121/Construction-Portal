# Construction Portal — master brief

Supersedes `login-world-roadmap-and-agent-prompt.md`. That file covered only the
login world's export gap; this one covers the whole remaining project.

Everything in §1 is transcribed from the handwritten notebooks. Everything in §2
is a **hypothesis to verify**, not a diagnosis — the code was not read.

---

## 0. The most important finding — CORRECTED

> **Superseded 2026-08-17.** The original §0 claimed the notebook rules existed
> **nowhere in the repository**. That was wrong, and the correction changes the
> plan. Replaced with the Phase A gap-list finding; see
> `docs/business-rules-gap.md` for the full diff.

The notebooks are **already transcribed into the code**, in three places that
quote them directly:

| File | What it quotes |
|---|---|
| `modules/payments/payment.hierarchy.js` | *"Transcribed from the 'Add Payment' notebook. This is the server-side source of truth."* Reproduces the whole Income/Expense tree, including the 6-vs-3 asymmetry |
| `modules/siteOperations/entryWindow.service.js` | *"All of this must be added within 2 days… you have to call the company and take access."* |
| `modules/siteOperations/material.controller.js` | *"Keep an option to add the material photo from gallery OR direct camera."* |

`database/migrations/004_seed_reference_data.sql` carries the notebook's
Gujarati material names verbatim — `કપચી`, `રેતી`, `સિમેન્ટ`.

**What is actually built** (evidence in the gap list): the complete payment
taxonomy, driving both server validation and the rendered form so the two
cannot drift; the entry window with per-user, per-module, per-exact-date,
single-use access grants and explicit future-date refusal; camera-vs-gallery
photo provenance with live-capture corroboration; the three banking receipt
modes; the material section taxonomy; and the per-labourer ledger with trade
grouping and outstanding dues.

**What was genuinely missing** was not backend business logic. It was:

1. The rules living only in code comments and photographs, not as a document —
   now `docs/business-rules.md`.
2. **Worker portal login**, where the notebook and the code disagreed. Resolved
   2026-08-17 in favour of the code: one identity plus `worker_assignments`.
   See `business-rules.md` §1.11.
3. Frontend surfaces for rules the server already enforces.

**Consequence for the roadmap.** Phase E should be ordered against the gap list
rather than by file size: several routes need far less work than their size
suggests, because the server already carries the rule.

The original premise — that nobody knew how much was already built — was
correct. The premise that the rules were unrecorded was not.

---

## 1. Business rules, transcribed

Gujarati passages are rendered as meaning, not word-for-word. Lines marked
**[verify]** are where the handwriting was ambiguous and the user should confirm.

### 1.1 Add Payment — top level

Two sides: **Income** and **Expense**.

**Income** categories:

1. Personal tender
2. Subcontractor
3. Office
4. Company charge
5. TDS
6. GST Return

**Expense** categories:

1. Personal tender
2. Subcontract
3. Office / Company

Note the asymmetry: Income has six categories, Expense has three. This is
deliberate in the notebook, not an omission.

### 1.2 Income — Personal tender

Flow: *Personal tender → Select tender →* then one of:

**1.1 Investor**
Fields: Name · FD/site · Date · Amount · Cash/Bank · Interest %
Rule: interest accrues on the amount at the stated rate; the accrued interest
should be displayed. **[verify]** whether accrual is daily or monthly.

**1.2 Government bill**
Fields: Date · Amount · **GST Amount** (emphasised in the original)

### 1.3 Income — Subcontractor

Flow: *Subcontractor → Select tender →* same structure as Investor (1.1) and
Government bill (1.2).

### 1.4 Income — Office

Fields: Source (Name / Company Balance) · Type (Cash / Bank) · Date · Amount

### 1.5 Income — Company charge

Flow: *Company charge → Tender list*
Each tender in the list shows its charge percentage beside its name (1%, 3%, 5%).

Worked example from the notebook:

| Tender name | Bill | Percentage | Received (જમા) | Outstanding (બાકી) |
|---|---|---|---|---|
| BVN1460 | ₹12,000 | 2% | ₹240 | ₹0 |

Rule: a single tender receives 2–3 bills over time, in sequence.

Fields on the charge record: Amount of Bill · % of charge · Date ·
Charge Amount · GST received (મળેલ GST) · GST outstanding (બાકી GST)

### 1.6 Income — TDS

Fields: Date · Amount

### 1.7 Income — GST Return

Fields: Date · Amount

### 1.8 Expense — Personal tender

Three sub-areas: **1.1 Supervisor** · **1.2 Site** · **1.3 Investor**

**1.2 Site** breaks into:

- **A. Order** — Select material · Name · Date · Amount · Detail · Quantity ·
  Collected GST
- **B. Salary**
- **C. Labour** — Name · Category · Detail · Date · Amount
- **D. GST** — Name · Amount · Detail · Collected GST
- **E. Other expense** — examples given: Division expense, Fuel, Fastag,
  Company charge, GST Pay

**1.3 Investor** — Name · FD/site side · Cash or Bank · Date · Amount · Detail

### 1.9 Expense — Subcontract

Flow: *Subcontract → Select tender →* two branches:

- **Investor** → same as 1.3
- **Government Bill** → pay into the subcontract company → **Generate Bill**

### 1.10 Expense — Office

A. Salary · B. PF · C. Tax · D. Other

### 1.11 Worker Portal — structure

Login: tender-scoped. A worker logs in with an ID and password **per tender**.
A company-level login is separate. **[verify]** whether one worker holds
multiple tender credentials or one credential granting access to several tenders.

After login, two branches: **Tender list** and **Personal Banking**.

Within a tender (Tender-A), four areas:

1. **Documents** — all tender-related documents as PDF, Word, or JPG.
   Sub-item B: photos of daily site progress.
2. **Material data**
3. **Banking**
4. **Labour work**

### 1.12 Worker Portal — Material data

Materials are grouped into sections (a main section, then items). Listed items:
colour, sand, cement, aggregate/grit (કપચી), firestone, tiles, iron/steel,
bricks, block, soil, other.

Rules:
- Daily quantities are added along with the bill.
- Photo upload must be available.

### 1.13 Worker Portal — the entry window

**This is the most operationally important rule in the notebooks.**

- Everything must be entered within **2 days**.
- One extra day of grace is allowed for daily expense entry. **[verify]** how
  this interacts with the 2-day rule — whether the grace day extends it to 3.
- To enter anything with a date older than that, the worker must call the
  company and be granted access.

Photo capture:
- Two options: gallery, or direct camera.
- **The system must record which was used**, and the company must be able to see
  whether a photo came from the camera or from the gallery.

That last rule is an anti-fraud control, and it has a real technical
consequence: on the web, a `capture` attribute on a file input is a *hint*, not
a guarantee. Verifying camera provenance needs EXIF inspection at minimum
(timestamp, absence of editing software tags) and even that is defeatable.
**Treat this as a signal, not proof, and say so in the UI.**

### 1.14 Worker Portal — Banking

A supervisor receives money three ways:

- into a bank account
- cash (રોકડા)
- cash against GST (GST પેટે રોકડા)

The supervisor records daily expenditure and any wages paid. Entry-window rules
from 1.13 apply.

### 1.15 Worker Portal — Labour work

- The supervisor adds the names of labourers working under him.
- Each labourer has an individual account showing daily payments.
- Labourers are grouped by trade — the examples given are colour work
  (કલરવાળી), plaster work (પ્લાસ્ટરવાળી).
- Clicking a labourer's name opens a small side panel showing that labourer's
  wage record.
- Outstanding dues must be visible, so the company can see what the supervisor
  has billed against each labourer.

---

## 2. The two reported bugs

Neither has been diagnosed against the code. These are ranked hypotheses and the
cheapest test for each.

### BUG-001 — Finance wizard, step 3: focus lost after one character

**Symptom:** typing one character in "enter details" moves focus out of the
field; the user must click back in.

This is a component-remount symptom, not an input symptom. The field is being
destroyed and recreated on every keystroke, so React cannot preserve focus.

Hypotheses, most likely first:

1. **A component is defined inside another component's body.** If `FinanceWizard`
   declares its step component (or a field wrapper) inside its own function,
   every render creates a *new component type*, so React unmounts the old tree
   and mounts a new one. This is the overwhelmingly common cause.
2. **A changing `key`.** If the field or its parent has a `key` derived from the
   value, or from `Date.now()`, or from an array index that shifts, React
   remounts on each change.
3. **Remounting from a parent effect** — an effect that sets state on every
   render, or a context value recreated inline (`value={{...}}`) causing
   consumers to re-render and a keyed child to remount.
4. Controlled/uncontrolled flip-flop — value going `undefined` → string, which
   causes a warning and, in some wrappers, a remount.

**Cheapest test:** put `useEffect(() => console.log('MOUNT'), [])` in the step
component. If it logs on every keystroke, it is a remount; hypotheses 1–3.
If it logs once, it is focus being stolen — look for `.focus()`, `autoFocus`,
or a scroll/refocus effect instead.

Note this is a class of bug, not one instance. `FinanceWizard.jsx` is 20K and
the same pattern may exist in the other wizards. Fix the cause, then grep for
the pattern repository-wide.

### BUG-002 — Worker added via User Management cannot log into the worker portal

**Symptom:** a worker added from the tender/worker side can log in to the worker
portal. The same worker added through User Management cannot.

Two creation paths are writing different things. Given §1.11 — worker portal
login is **tender-scoped**, with an ID and password *per tender* — the likely
gap is that User Management creates an application user (role, company) but not
the tender-scoped portal credential and tender assignment.

Hypotheses:

1. **Different tables.** User Management writes a user record; the worker portal
   authenticates against a worker/portal-credential record. The two paths never
   converge. Check whether `workerPortal` authenticates against the same table
   `UsersPage` writes to.
2. **Missing tender assignment.** The record exists but has no row linking it to
   a tender, so a tender-scoped login finds nothing to log in to.
3. **Missing portal credential.** No ID/password pair was generated, because
   only the worker-side path generates one.
4. **Tenant context.** `database/tenantContext.js` and the RLS policies in
   `003_supabase_rls.sql` mean a row created without the right company context
   can exist but be invisible to the portal query.

**Cheapest test:** create one worker each way, then diff the resulting database
rows across every table the two paths touch. The difference *is* the bug. Do
this before reading any controller code — it converts a code-reading problem
into a five-minute data comparison.

`backend/scripts/createLocalPortalFixtures.js` already exists and probably shows
what a *working* portal worker looks like. Read it first; it may encode the
answer.

---

## 3. The login world

### 3.1 The target

Point-of-view camera on a construction building, inside a dense CBD
(NYC / Melbourne scale), with live weather, walking people, moving clouds, sun
by day and moon by night, driven by Ahmedabad local time, with randomised
conditions including rain. A full transition from login into the dashboard.

### 3.2 What already exists

More than half of it, at source:

- **three.js runtime**, lazily imported, 133 kB gzip, never gating auth
- **The hero building** — seven levels, per-level construction state
- **Context city** — near/mid/far detail tiers, service cores, windows
- **Sun position** — `environment.js` already uses SunCalc on Asia/Kolkata
- **Clouds** — a source cloud system scaffolded
- **Street** — five surface identities plus markings
- **People** — a `login-site-people` layer and a `worker` swappable kind
- **Camera** — `camera.js`, written as "a body standing in the site"

What is genuinely missing: weather, moon, animated people, rain, and the
login→dashboard traversal. And, above all, **none of the recent work is in the
browser** — see §4.

### 3.3 Recommended free technologies

All of these are free for commercial use. Licences noted where they matter.

| Need | Use | Why |
|---|---|---|
| Renderer | **three.js** (MIT) — already in use | Keep it. Do not move to Unity/Unreal WebGL: tens of MB of runtime, long startup, and it would break the "never gates authentication" invariant outright. |
| Asset optimisation | **gltf-transform** (MIT, npm) | The direct fix for the 12 MB street layer. Does Draco/meshopt compression, texture resize, WebP/KTX2 conversion, dedup, and instancing from one CLI. This is the highest-value tool on the list. |
| Alternative compressor | **gltfpack** / meshoptimizer (MIT) | Simpler than gltf-transform if only geometry compression is wanted. |
| GPU texture format | **KTX2 / Basis Universal** via `toktx`, loaded with three's `KTX2Loader` | Stays compressed *in VRAM*, not just on the wire. Matters much more on the phones the field roles use. |
| Sun and moon | **SunCalc** (BSD) — already a dependency | Gives sun altitude/azimuth *and* moon position and phase. The moon requirement is already satisfied by a library you have. |
| Live weather | **Open-Meteo** | Free, no API key, no signup, commercial use permitted, and it returns current conditions plus a WMO weather code for Ahmedabad. Preferred over OpenWeatherMap, which needs a key and rate-limits the free tier. |
| Sky | three's `Sky` shader (`examples/jsm/objects/Sky.js`) or the existing `sky.js` | Preetham scattering, free with three. |
| Clouds | Billboard/impostor clouds, or low-resolution 3D-noise raymarching | True volumetric raymarching is a mobile-killer. Impostors read as real at login-page distances. |
| Rain / snow | Instanced `Points` with a scrolling shader, plus a wet-surface roughness change | The wetness is what sells rain, more than the droplets. |
| Walking people | **Vertex Animation Textures (VAT)** baked in Blender | The key technique. Skeletal animation on dozens of characters is expensive; VAT bakes the animation into a texture so thousands of instances run from one instanced draw call and one shader. You already have a Blender pipeline to bake it in. |
| Perf instrumentation | `stats.js`, `renderer.info`, plus your existing `perf_bisect.mjs` | Already have the hard part. |
| Post-processing | `postprocessing` (pmndrs, MIT) or three's `EffectComposer` | Use sparingly; bloom and SSAO are the usual mobile budget killers. |

### 3.4 Three constraints worth stating plainly

**The invariant beats the vision.** Nothing above may delay, block or fail a
sign-in. The weather fetch in particular must be fire-and-forget with a cached
last-known value and a sensible default — never awaited before render.

**Mobile is the constrained case, and it is the case that matters.** Field roles
reach this product on phones. A NYC-scale city with live people and rain is a
desktop experience. Build explicit tiers: phones get a reduced city, fewer
people, no volumetric cloud, no post-processing. The existing
`portrait ? l.mobile : true` filter is the seam this hangs off, and it currently
does nothing useful because every layer is flagged `mobile: true`.

**Budget before features.** The world is already ~16 MB in export with none of
the new features. Adding weather and animated crowds to an asset pipeline that
cannot yet ship is spending against an overdrawn account. §4 orders this.

---

## 4. Revised roadmap

Ordered by what unblocks what. Phase A is small and blocks nothing else being
trustworthy. Phase E is the largest body of work in the project.

### Phase A — Capture the specification *(do first, half a day)*

1. Transcribe the notebooks into `docs/business-rules.md`, including the
   **[verify]** markers from §1.
2. Diff each rule against the implementation. Produce
   `docs/business-rules-gap.md`: for every rule — *implemented*, *partial*,
   *absent*, with the file that implements it.
3. Resolve the **[verify]** items with the user.

Nothing else should start before this. Every later phase depends on knowing
which of these rules is already built.

### Phase B — The two bugs

Per §2. Diff-the-database first for BUG-002, mount-log first for BUG-001. When
each is fixed, add a Playwright spec to `frontend/tests/` so it cannot regress —
the repository's existing habit is that every claim has a probe, and these
should follow it.

### Phase C — Ship the login world that already exists

From the earlier brief, still correct and still blocking:

1. **Resolve the texture question.** Four of five layers export with zero
   textures while `tools/blender/bake_materials.py` and `prep_web_textures.py`
   both exist. Either those steps were never run, or the materials were
   flattened silently. Check the two scripts before writing anything new.
2. **Add a byte gate** to the export, kept categorically separate from the
   correctness assertions in `validate()`.
3. **Compress.** Geometry alone is 5.72 MB; gltf-transform is the tool.
4. **Fix the layer split** so `mobile: true` means something.
5. **Ship it, and look at it in a browser.** `deploy_parity.mjs` and
   `csp_repro.mjs` already exist and are the right gate — larger assets are
   exactly what trips a CSP or delivery issue.

### Phase D — Land the branch

168 commits. Verify auth, shell, Dashboard, then merge to `main`.

### Phase E — PAUSED 2026-08-19

A production census found the system has **never been used** — one company, six
users, zero tenders/sites/workers/payments, empty `activity_logs`. Three
consecutive attempts to order the route programme came back flat (a11y 44/44,
gap list 32-of-36 implemented, and no usage at all), because there is nothing to
order against.

Superseded for now by `docs/first-tender-walkthrough.md`. Phase E resumes once
one real tender has been through the system and there is a usage signal.

Two blockers that walkthrough found, both needing a production data change:
**migration 004 was never applied** (`material_catalog` and `labour_categories`
are empty, so material entry is impossible), and **every existing worker login is
unlinked** (`workers` is empty), which is BUG-002's state.

### Phase E — The remaining route programme *(the largest phase)*

Twenty-two page components, roughly 600 KB of JSX. `WorkerPortalPage` is 60 KB,
`SettingsPage` 52 KB, `SubcontractorPortalPage` 53 KB, `TendersPage` 52 KB,
`WorkerMoneyPage` 51 KB.

Use `tools/ui_v2/route_inventory.py` and `css_inventory.py` — both already
exist. `css_inventory.py` also settles the three coexisting style generations
(`core/`, `v2/`, `system/`), which is migration residue that may still ship.

Order by the gap list from Phase A, not by file size. A route with missing
business rules matters more than a route that merely looks old.

### Phase F — The login world's new capabilities

Weather, moon, animated crowds, rain, login→dashboard traversal. Per §3.
**Only after Phase C ships.** Each is its own unit with its own budget.

---

## 5. Agent prompt

Copy everything below the line.

---

You are working on the Construction Portal at
`/Users/priyanshranpura/construction-portal`, branch `redesign/ui-foundation`.
Read `docs/construction-portal-master-brief.md` first — it is your specification.

### Hard invariants — never violate these

1. **The world never gates authentication.** Nothing in the 3D world may delay,
   block or fail a sign-in. If WebGL is unavailable, or a weather API is slow or
   down, the form behaves identically. Never `await` a network call before the
   auth form is usable.
2. **Authored assets are an upgrade, never a dependency.** `loadAssets` must
   never reject. A missing or broken GLB degrades one object, not the scene.
3. **The form stays ordinary DOM** — real focus, real autofill, real
   screen-reader output. Nothing about the form moves into WebGL.
4. **Never leave production assets overwritten.** If you re-export, capture to a
   scratch directory and `git restore -- frontend/public/world/assets/`
   immediately. Verify the tree is clean before continuing.
5. **Respect the entry-window rules** (§1.13). They are anti-fraud controls, not
   UI conveniences. Never widen a window, bypass an access request, or make a
   date field freely editable because it is more convenient.

### Method — this matters more than speed

- **Measure before you diagnose.** This project has a recorded history of
  rendering catching wrong diagnoses three separate times. Assume your first
  hypothesis is wrong until an artifact says otherwise.
- **Inventory before you build.** This repository's answer to most problems
  already exists as a script. Before writing any tool, search `tools/` —
  `bake_materials.py`, `prep_web_textures.py`, `route_inventory.py`,
  `css_inventory.py`, `deploy_parity.mjs`, `csp_repro.mjs`, and about forty
  probes in `tools/fresh_ui/` are already there. The same applies to the
  backend: much of the worker portal specification may already be implemented in
  `modules/siteOperations/`.
- **For BUG-002, diff the database before reading code.** Create one worker each
  way, compare the resulting rows across every table both paths touch. The
  difference is the bug.
- **Do not reason from an unverified premise.** If a claim is not in the
  repository or in a measurement you just took, say you have no record of it
  rather than building on it.
- **Prefer the cheap gate.** The ten-view render matrix costs 2 m 29 s. Use it
  as pass/fail, not as a last resort.
- **Report negative results.** "Measured X, changed nothing because of it" is a
  complete and valuable outcome. Never manufacture a change to justify a step.

### Order of work

Phase A (capture the specification) → Phase B (the two bugs) → Phase C (ship the
login world that exists) → Phase D (merge) → Phase E (routes) → Phase F (new
world features). Do not skip ahead. Phase F in particular must not start before
Phase C has put current assets in a browser.

### Recording

- Append findings to `docs/phase3-login-continuation.md`.
- Match the existing commit voice: declarative, and where a finding contradicted
  the plan, say so in the subject — e.g. *"Close the context opening grid, and
  find it was the shared shader"*, *"Measure the render cost, and build no
  diagnostic preset because of it"*.
- One logical change per commit. Leave the tree clean.
- Every bug fixed gets a Playwright spec in `frontend/tests/` so it cannot
  regress.

### Stop and ask the user when

- A **[verify]** item in the business rules blocks you.
- The material export finding shows silent flattening rather than deliberate
  constants — that is a pipeline defect and changes the plan.
- You need to set a budget number. Propose one with reasoning; never adopt one
  silently.
- A business rule in the notebook conflicts with what the code already does.
  The notebook is the user's intent, but the code may encode a later decision —
  do not assume which one wins.
- Any change would touch the auth form, the route guard, the loader's failure
  behaviour, or an entry-window control.

**Start with Phase A, step 1.** Write no feature code until the gap list exists.