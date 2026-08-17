# Business rules — transcribed from the handwritten notebooks

Extracted verbatim from `docs/ Construction portal master brief.md` §1 so the
rules live in the repository in their own right, per Phase A step 1. The
photographs on a phone were recorded as the single largest risk to the project.

Gujarati passages are rendered as meaning, not word-for-word. Lines marked
**[verify]** are where the handwriting was ambiguous.

Two **[verify]** items are answered by the implementation rather than by the
user — see `business-rules-gap.md`. They are left marked here because this file
is the record of what the notebook said, not of what the code decided.

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
