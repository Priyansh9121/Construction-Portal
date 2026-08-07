# UI v2 — Route Matrix

Migration and verification state for all 28 registered routes (24 screens +
4 redirects). Generated from `tools/ui_v2/route_inventory.py`; verification
columns are filled only from an actual run, never from expectation.

Legend — **Layer**: what the route currently renders on.
`v2` = individually designed · `shared` = inherits the UI v2 token, typography,
shell and data-surface layers but has not had its own design pass ·
`legacy` = untouched.

## Public

| Route | Layer | Widths verified | Motion modes | axe | Notes |
|---|---|---|---|---|---|
| `/login` | **v2** | 320·375·390·414·768·1024·1280·1440·1920 | normal + reduce | ✓ | Blueprint draws once; already-drawn under reduce |
| `/register` | shared | 320–1920 (auth suite) | normal | ✓ | Inherits AuthShell v2 |
| `/forgot-password` | shared | 320–1920 (auth suite) | normal | ✓ | Inherits AuthShell v2 |
| `/reset-password` | shared | 320–1920 (auth suite) | normal | ✓ | Inherits AuthShell v2 |

## Shell (applies to every authenticated route)

| Surface | Layer | Verified | Notes |
|---|---|---|---|
| Sidebar / drawer / active rail | **v2** | 390·768·1440 | Chrome plane; rail is transform-only |
| Topbar | **v2** | 390·768·1440 | Only surface with `backdrop-filter` |
| Account menu | **v2** | — | Shared dismiss helper |
| Notification panel | **v2** | 1440 | Escape + focus return verified (V2-I023) |
| Command palette | **v2** | 1440 | Chrome plane; glassmorphism removed |
| Route transitions | **v2** | 1440 + reduce + no-API | Only `.page-content` named (V2-I024) |

## Office routes — Phase 4

All currently on the **shared** layer: UI v2 tokens, typography, tables,
cards, panels, badges, tabs and dialogs. None has had an individual design
pass yet.

| Route | Layer | Group | Overflow | sub-44 | Console |
|---|---|---|---|---|---|
| `/dashboard` | **v2 — COMPLETE** | 1 | 0 @ all 9 widths × 2 motion modes | 0 | 0 |
| `/tenders` | shared | 2 | 0 @ 390/768/1440 | **1** (V2-I025) | 0 |
| `/tenders/:id` | shared | 2 | — | — | — |
| `/workers` | shared | 2 | — | — | — |
| `/subcontractors` | shared | 2 | — | — | — |
| `/payments` | **v2 — COMPLETE** | 3 | 0 @ all 9 widths × 2 motion modes | 0 | 0 |
| `/invoices` | shared | 3 | — | — | — |
| `/worker-money` | shared | 3 | — | — | — |
| `/daily-site-updates` | shared | 4 | — | — | — |
| `/daily-update-approvals` | shared | 4 | — | — | — |
| `/masters` | shared | 4 | — | — | — |
| `/users` | shared | 4 | — | — | — |
| `/reports` | shared | 4 | — | — | — |
| `/settings` | shared | 4 | — | — | — |

## Bespoke routes — Phase 5

| Route | Layer | Notes |
|---|---|---|
| `/activity` | shared | Date-grouped stream; keep disclosure semantics |
| `/site-operations` | shared | SITE-OPS-DATA-01 constraints apply |
| `/worker-portal` | shared | Assignment-first hierarchy; field readability |
| `/subcontractor-portal` | shared | Project-first; masked bank fields must stay unrendered |

## Redirects — no UI

`/projects` → `/tenders` · `/sites` → `/tenders` · `/sites/:id` · `/` · `*`

## Dashboard — Phase 4 Group 1 detail

Verified at 320·375·390·414·768·1024·1280·1440·1920 × normal + reduced motion:
overflow 0, sub-44px 0, console errors 0, failed requests 0. Height at 1440:
4,465 → 3,636px.

**Built:** tabbed recent activity (V2-I028), tiered metric grid (V2-I027),
hover-lift removal (V2-I030), v2 grid/section/chart-shell definitions (V2-I034).

**Completed this pass:** V2-I031 bullet ratio rows · V2-I032 executive
wrapper removed · V2-I033 skeleton loading. **V2-I029 withdrawn as a false
finding** — `DashboardHero` already implements the risk zone.

**Height:** 4,465 → **3,543px** at 1440 (−21%). Verified at all nine widths in
both motion modes: overflow 0, sub-44px 0, console errors 0, failed requests 0.

**Dashboard is COMPLETE.** Carried forward, not blocking: V2-I035 (zero given
a status tone) and V2-I036 (quick-action set per role).

## Gate at the time of writing

358 assertions · axe 44/44 · contrast 57/57 · lint clean · build clean ·
`git diff --check` clean · backend unchanged.
