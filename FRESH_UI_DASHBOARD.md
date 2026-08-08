# Dashboard — design thesis

Pre-implementation analysis of `src/pages/DashboardPage.jsx` (1831 lines),
`DashboardHero.jsx`, `AnimatedStatCard.jsx`, `FinanceTrendChart.jsx`.

No code written yet. This is step 10 of the required design thinking.

---

## What is on the page today

Thirteen sections, in order: attention hero · "Jump to" + export · 4 primary
metric cards · 8 secondary metric cards · Today's Finance (3 tiles) · Project
Portfolio (4 tiles) · finance trend chart · Finance Health · Invoice Health ·
Project Status · Operational Capacity · recent-activity tabs (6 tables) ·
Suggested Next Actions (6 rows).

**19 figures above the fold. ~40 on the page.**

---

## 1. Duplicated metrics

Income, expense and profit each appear **three times** as equal-weight peers,
differing only in timeframe:

| concept | appears as |
|---|---|
| income | Total Income · Month Income · Today's Income |
| expense | Total Expense · Month Expense · Today's Expense |
| profit | Net Profit · Month Profit · Today's Net |

The page has no concept of time granularity, so it renders the cross-product of
`{metric × timeframe}` as sibling cards.

Also duplicated: running tenders (primary card + Project Portfolio), completed
tenders (Portfolio + Project Status ratio), pending tenders (hero + Portfolio),
**overdue tenders three times** (hero + Portfolio + Next Actions), due-soon
tenders twice, pending invoices twice, overdue invoices twice.

## 2. Duplicated workflows

Counting distinct entry points to the same destination:

- **invoices — 5**: hero, Next Actions ×2, Invoice Health, Recent Invoices
- **tenders — 8**: hero, Jump to, Portfolio, Project Status, Next Actions ×2,
  Upcoming Tenders, Recent Tenders
- **payments — 3**: Today's Finance, Finance Health, Recent Payments

Eight routes to one register is not convenience; it is the absence of a
decision about where that job belongs.

## 3. Repeated hierarchy

`.section-title-row` (h2 + muted sentence + right-aligned link) repeats
**ten times**, identically. Ten panels of the same box, same header, same
weight. The tenth panel is as loud as the first, so the page has no shape and
scanning is linear rather than hierarchical.

## 4. Colour communicating fact instead of state

- `highlight-success` on **Today's Income** — income is a fact, not a success
- `highlight-danger` on **Today's Expense** — spending money is normal business
- `highlight-success/danger` on **Today's Net** — colouring the *sign of a
  number*
- `highlight-success` on **Running** and `highlight-warning` on **Pending**
  tenders — both are ordinary lifecycle states, neither is good or a warning

**Defect found in `getStatusClass` (line 159).** It greens a known list, reds a
known list, and returns `badge yellow` for *everything else*. An unrecognised
status silently renders as amber caution. Colour is assigned by fallback rather
than meaning.

Net effect: red and amber are spent on bookkeeping, so when something is
genuinely overdue there is no colour left that means it.

## 5. Panels that exist because dashboards have panels

- **Finance Health, Invoice Health, Project Status, Operational Capacity** —
  four bordered panels holding ~5 percentages between them. Four boxes of
  chrome for five numbers.
- **"Jump to"** — a zone heading, for one link.
- **Finance trend chart** — the only chart, present largely because a dashboard
  is expected to have one. It must earn its place or go.

## 6. Metrics derivable from other metrics on the same screen

`netProfit` = income − expense · `monthProfit` = monthIncome − monthExpense ·
Today's Net = todayIncome − todayExpense · `profitMargin` = netProfit ÷ income ·
`expenseRatio` = expense ÷ income · `inactiveWorkers` = total − active ·
`inactiveSites` = total − active · `tenderCompletionRate` = completed ÷ total ·
`invoiceCollectionRate` = paid ÷ total.

**Nine of roughly nineteen headline figures are arithmetic restatements of
figures already on screen.**

## 7. Decisions the Dashboard actually supports

Essentially one: *"is anything overdue?"* — via the hero, which is the single
strongest element on the page. Weakly, a second: *"open a register."*

## 8. Decisions it fails to support

- **Which** invoice or tender needs me — it reports counts, never the item
- **Can we cover wages this week?** — "Cash Position" is a lifetime aggregate
  with no time horizon, so it cannot answer a liquidity question
- **Which site or tender is losing money** — no per-project profitability,
  though payments carry site linkage
- **What changed since I last looked** — no delta, no trend, on any figure.
  The page cannot distinguish a good week from a bad one
- **Who is waiting on me** — the product has a *Daily Update Approvals*
  workflow, and the Dashboard never mentions it. The one place the user is a
  genuine bottleneck is invisible

---

## Thesis

> The Dashboard should stop reporting the company's totals and start running
> the user's day.

It currently answers *"what are the numbers?"* — a question nobody opens an
application to ask. It should answer **"what needs me, what changed, and is
anything wrong?"**

Three principles:

**1. Items, not counts.** "3 overdue invoices" is a fact that forces a second
navigation. *"Sharma & Co — ₹1.2L — 12 days overdue"* is a decision the user can
act on in place. The register already loads the rows; the Dashboard has them in
props and throws them away to render a number.

**2. One timeframe, chosen — not all three, stacked.** Timeframe becomes a
control on a metric, not a reason to triple the cards. One primary figure with
its movement, not twelve peers.

**3. Colour returns to meaning.** Facts are neutral. Red and amber are reserved
for overdue, blocked and awaiting-me. Every current status colour is removed
except where it marks genuine operational state.

**Role awareness.** Only `admin` and `manager` reach this page; portal roles
render outside `AppLayout`. Approvals are admin-only (`AdminLayout`), so
approval emphasis must follow the same rule as `config/navigation.js` — reusing
that policy, not inventing a second one.

**Honest data.** Every figure is derived client-side from rows `App.jsx` already
fetched, plus one local subcontractor request. There is no server aggregate and
no historical series. The design must not imply precision or recency the data
does not have, and must not fabricate backend capability.

---

## Decomposition

Replaces the suggested D1–D6. The unit that changes the page's *shape* comes
first, because every later unit inherits it.

- **D1 — The lead.** Attention becomes the page's spine: real items with
  identity and amount, not counts. Absorbs Suggested Next Actions, which is the
  same idea rendered worse and 900 lines lower. Admin additionally sees pending
  approvals.
- **D2 — Position.** Collapse 12 cards + Today's Finance into one primary
  figure with movement and a small supporting set. Timeframe as a control.
  Removes the nine derived restatements.
- **D3 — Pipeline.** Merge Project Portfolio, Project Status and Upcoming
  Tenders into one view of work in flight.
- **D4 — Activity.** Rebuild the six recent tables as one changelog answering
  "what changed", not six paginated registers.
- **D5 — First run.** Zero data produces guidance, never twelve ₹0 cards.
- **D6 — Motion and polish.**

Each ships independently, leaves the page functional, and passes the full gate.

---

# D3 — Pipeline thesis

## Inventory

Three sections currently express pipeline.

**Project Portfolio** — 4 filled status tiles: Running (green), Pending
(amber), Completed (neutral), Overdue (red).

**Project Status** — 9 table rows: Total Tenders, Running, Pending,
Completed/Passed, Due Soon, Overdue, Completion Rate (a `RatioRow`), Running
Tender Value, Total Estimated Value.

**Upcoming Tenders** — a 4-column table of `dueSoonTenders.slice(0, 6)`:
title, status badge, due date, value.

## Duplicated counts

Running ×2 · Pending ×2 · Completed ×3 (two counts plus a completion-rate
ratio) · Overdue ×2 · Due Soon ×2. Three separate "View Tenders" / "View all"
links to the same register.

## The finding that decides the design

**D1 already renders, as objects, everything "Upcoming Tenders" renders as a
table.** The attention spine selects overdue tenders, tenders due within 7
days, and tenders awaiting submission. `dueSoonTenders` is *precisely* the
"due within 7 days" set. So the Upcoming Tenders panel is a strictly worse
duplicate of a section 900 pixels above it — same rows, less identity, no
action, and a status badge whose colour is assigned by fallback.

Project Portfolio's Pending tile duplicates D1's awaiting-submission item, and
its Overdue tile duplicates D1's overdue items.

So the split is not "D1 gets some tenders and D3 gets others". It is:

> **D1 owns work that needs intervention. D3 owns work that is moving normally.**

Which leaves D3 a genuinely distinct and currently unanswered question: what is
actually *running* right now, and what is coming after the urgent horizon?

## What D3 shows

**Active** — running tenders as objects. These appear nowhere in D1, because
running-and-not-late is not attention-worthy. `progress_percent` is a real
source field, so progress is shown from data rather than inferred.

**Next up** — tenders with a due date beyond D1's 7-day horizon. Explicitly the
complement of the attention window, so no tender is ever in both sections.

**Committed value** — the sum of running estimated value, as compact context in
the header rather than as its own tile.

## What D3 deletes

Project Portfolio, Project Status and Upcoming Tenders in full. Completed
counts and the completion-rate ratio go with them: completion is history, it
supports no decision on this page, and the tender register already holds it.

## Colour

No filled status tiles. Running and pending are ordinary lifecycle states and
render neutrally. D3 introduces no status colour at all — every item it shows
is, by construction, not late. Anything that *is* late is in D1, where the
colour means something.

## Ordering

Deterministic, documented: soonest due date first; undated last; estimated
value breaks ties, larger first.
