# Finance visual language — audit and proposal (F-01)

Audit of every shared finance visual component, and a proposed language that can
serve Dashboard, Payments, Finance and Reports without spending status colour on
bookkeeping.

**This is an audit. No component was redesigned and no source behaviour was
changed.**

---

## 1. Component inventory and route consumers

| component | consumed by | routes reached |
|---|---|---|
| `charts/FinanceTrendChart` | `DashboardPage`, `PaymentsPage`, (referenced by `FinanceOverview`) | **Dashboard, Payments** |
| `finance/FinanceSummaryCards` | `FinanceOverview`, `TenderFinanceTab` | **Payments, Tender details** |
| `finance/FinanceOverview` | `PaymentsPage` | Payments |
| `finance/FinanceTable` | `PaymentsPage` | Payments |
| `finance/FinanceRecordsTable` | `TenderFinanceTab` | Tender details |
| `finance/FinanceFilters` | `FinanceOverview`, `FinanceTable` | Payments |
| `finance/FinanceWizard` | `PaymentsPage`, `usePaymentSections` | Payments |
| `finance/TenderSummaryCard` | `FinanceWizard` | Payments |
| `hooks/useFinanceStatistics` | `DashboardPage`, `PaymentsPage`, `FinanceOverview`, `FinanceSummaryCards` | Dashboard, Payments, Tender details |
| `utils/financeHelper` | `FinanceOverview`, `FinanceTable`, `FinanceWizard`, `TenderSummaryCard`, `PaymentsPage` | Payments |

**Two components cross route boundaries and are therefore the whole problem:**
`FinanceTrendChart` (Dashboard + Payments) and `FinanceSummaryCards` (Payments +
Tender details). Everything else is Payments-local.

`useFinanceStatistics` returns **numbers only** — `balance`, `gstPending`,
`companyChargePending`, `recordCount`. It carries no tone, colour or status.
That is worth stating plainly: the data layer is already clean. Every semantic
conflict below is introduced in presentation, so fixing it requires no change to
calculation and no backend involvement.

There is **no** shared colour helper, legend component or chart utility. Colour
is hard-coded at each call site, which is why the same concept is expressed three
different ways.

---

## 2. Current colour usage

### `FinanceTrendChart` (DASH-004)

Nine hard-coded literals across gradients and strokes:

| series | colour | measured |
|---|---|---|
| income | `#16a34a` | chroma 0.865, **hue 142 — 0° from status-success** |
| expense | `#dc2626` | chroma 0.827, **hue 0 — 0° from status-danger** |
| profit | `#2563eb` | chroma 0.843, **hue 221 — 3° from status-info** |

All three sit *exactly* on a status hue. This is not "close to"; it is the same
hue family, at full chroma.

### `FinanceSummaryCards`

Worse, because the mapping is conditional and therefore reads as judgement:

```jsx
<div className="card highlight-success">      // income
<div className="card highlight-danger">       // expense
<div className={netProfit >= 0 ? "highlight-success" : "highlight-danger"}>
<div className={gstLeft > 0 ? "highlight-warning" : "highlight-success"}>
<div className={companyChargeLeft > 0 ? "highlight-danger" : "highlight-success"}>
```

Having outstanding GST is painted **amber**. Having outstanding company charge is
painted **red**. Owing nothing is painted **green**.

Those are ordinary accounting states on a normal trading day. A company that has
correctly collected GST it has not yet remitted is not in a warning condition —
it is operating normally. The card tells it otherwise, on two routes.

---

## 3. The semantic conflict, stated precisely

The three colours are used in **two mutually exclusive roles in the same
product**:

- **As category identity** — `FinanceTrendChart`, `FinanceSummaryCards`:
  green *means* income, red *means* expense.
- **As operational status** — the design system's own tokens, and D1/D2/D3 of the
  Dashboard: red means overdue, amber means needs attention, green means resolved.

These cannot both be true. And because identity claimed the palette first on
those routes, **status has nowhere left to go**: on the Payments page an overdue
item and an ordinary expense are the same red, so the one signal that should
interrupt the user is indistinguishable from the most common row on the screen.

### Which is it: identity, status, brand, or accident?

**Accidental convention, inherited.** Evidence:

1. It is not brand — the product's accent is indigo `#5d28c8`, and green/red
   appear nowhere in the brand surface.
2. It is not status — nothing about income is a *success*; the same green is
   applied unconditionally regardless of amount, timing or health.
3. It is not a considered identity system — the values are hard-coded per call
   site with no shared constant, and the trend chart's blue for profit does not
   match `FinanceSummaryCards`, which has no profit colour at all.
4. The colours are the Tailwind 600 defaults (`#16a34a`, `#dc2626`, `#2563eb`),
   which is the signature of a default reached for rather than a decision made.

The accounting convention it imitates — red for negative — is a *print* convention
for signed numbers, not a category convention. Income and expense are both
positive quantities of opposite direction, and the sign is already carried by the
axis and the label.

---

## 4. Can one language serve all four routes?

**Yes.** The constraint is satisfiable, and the reason is that finance series need
to be *distinguishable*, not *evaluated*. Distinguishability can come from hue
distance, lightness, and stroke treatment — none of which requires the status
palette.

The proposal below is measured against three rules:

1. every series ≥ 3.0:1 against white (non-text graphic minimum)
2. any series with real chroma must sit ≥ 30° from every status hue
3. a near-neutral carries no hue identity at all, so it cannot collide

### Proposed ramp

| role | token | value | measured |
|---|---|---|---|
| series 1 — income | `--ui-indigo-700` | `#4c1fa6` | chroma 0.813, **10.22:1**, nearest status *info* at **36°** |
| series 2 — expense | `--ui-neutral-600` | `#5f6461` | chroma **0.050 — neutral**, **6.03:1** |
| derived — profit | `--ui-ink-strong` | `#1a1917` | chroma 0.115 — neutral, 17.57:1 |

Both series also clear the sunken ground `#f6f6f4`: income 9.45:1, expense 5.57:1.

This is the pattern D2 already ships and screenshots confirmed works: money in is
strong accent, money out is a neutral step down, and the precise figure is always
printed beside the graphic.

### Two corrections found while deriving this

**A first candidate ramp failed its own test.** `indigo-700 / neutral-400 /
indigo-500` gave income-vs-profit separation of **1.64:1** — visually
indistinguishable — and `neutral-400` measured 2.34:1 against white, under the
3.0 floor. Recorded because the failure is the useful part: three *areas* is one
too many for a palette that has given up two-thirds of the hue wheel.

**The hue-collision test itself is wrong for near-greys.** `#5f6461` reports hue
144°, 2° from status-success, which looks like a hard collision. It is an
artefact: at chroma 0.050 the hue angle is numerically unstable and perceptually
absent. Any hue test applied to finance colours **must gate on chroma first**
(floor ≈ 0.15). `tools/fresh_ui/token_audit.py` shares this weakness; it has not
mattered yet because it only tests saturated accent candidates, but it would
misreport a neutral series colour. Recorded as **FIN-001** below.

### Profit should not be a third series

`profit = income − expense`. On a chart already drawing both, profit is *the gap
between them* — rendering it as a third filled area draws the same information
twice and forces a third colour into a palette that does not have room for one.

Recommendation: two areas, and profit as a thin derived line in ink, or omitted
entirely. This is the same finding as D2's "nine of nineteen figures are
arithmetic restatements", applied to a chart.

---

## 5. Shared rules

Separate the concerns that are currently fused:

| concern | expressed by | never expressed by |
|---|---|---|
| **series identity** | accent ramp + neutral steps; stroke style (solid / dashed) | status hues |
| **status** | `--ui-status-*` — overdue, blocked, rejected, attention | series colour |
| **interaction (hover)** | opacity of non-hovered series, tooltip | hue change |
| **selection** | stroke weight + label emphasis | hue change |
| **focus** | `--ui-focus` ring, system-wide | anything series-specific |

Additional rules:

1. **Never colour alone.** Every series carries a direct label or legend text;
   every status carries a word. Both must survive greyscale.
2. **Facts are neutral.** Amount, category and date are facts. Only a genuine
   operational condition earns a status colour.
3. **No conditional tone on a normal accounting state.** Outstanding GST is not a
   warning; unpaid company charge is not a danger.
4. **Colour is declared once**, as tokens, not per call site. There is currently
   no shared finance colour module — creating one is a precondition for any
   migration, otherwise the next chart repeats this.
5. **Chroma before hue** in any automated colour check.

---

## 6. Migration order

Ordered so that no unmigrated route changes appearance, per the standing rule and
the DASH-008 precedent, where an unconditional change to a shared component
leaked onto Payments.

**F-02 — tokens only.** Add `--ui-series-*` to the system token layer. No
component consumes them yet. Zero visual change; verifiable by the token audit
and an unchanged leak probe.

**F-03 — `FinanceTrendChart`, opt-in.** Add a `palette` prop defaulting to the
current colours. Dashboard passes the new palette; Payments does not. Dashboard
migrates, Payments stays byte-identical. This mirrors the `emptyState` prop
already added for DASH-008 and closes DASH-004 for the Dashboard.

**F-04 — Payments route group.** Migrate `FinanceOverview`, `FinanceTable`,
`FinanceFilters`, `FinanceWizard`, `TenderSummaryCard`, and switch
`FinanceTrendChart`'s default palette. Remove the opt-in prop once both callers
pass the same thing.

**F-05 — `FinanceSummaryCards`.** Deferred to last deliberately: it is shared
with Tender details, so it cannot move until that route group is ready, and it
carries the conditional-tone defect that needs the most copy review.

**F-06 — Reports.** Not yet audited; it was outside this unit's scope. Audit
before assuming the ramp fits.

Only F-02 is safe to implement without touching a route group.

---

## 7. Issues raised

**DASH-004** — `FinanceTrendChart` green/red/blue collide exactly with status
hues. Confirmed with measurement. Owner: F-03.

**FIN-001** — hue-collision checking is invalid for near-neutral colours. Any
check must gate on chroma (floor ≈ 0.15) before comparing hue angles.
`tools/fresh_ui/token_audit.py` has this weakness latent. Owner: F-02.

**FIN-002** — `FinanceSummaryCards` paints ordinary accounting states as
warnings: outstanding GST amber, outstanding company charge red, owing nothing
green. Present on Payments and Tender details. Owner: F-05.

**FIN-003** — no shared finance colour module exists; every call site hard-codes
literals. This is the reason the same concept is expressed three inconsistent
ways, and why the next chart would repeat it. Owner: F-02.
