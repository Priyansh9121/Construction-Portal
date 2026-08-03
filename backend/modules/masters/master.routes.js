/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The URL map for /api/masters — the three reference registers plus the
| investor statement.
|
| Endpoint summary:
|
|   Method Path                          Effective auth   Controller
|   ------ ----------------------------- ---------------  -----------
|   GET    /investors/:id/statement       admin, manager  getInvestorStatement
|   GET    /:master                       admin, manager  list
|   POST   /:master                       admin, manager  create
|   PUT    /:master/:id                   admin, manager  update
|   DELETE /:master/:id                   admin, manager  archive
|
| Mount:
|   server.js mounts this at /api/masters behind authMiddleware AND
|   requireOffice. That gate applies to the whole router, which is why the
|   "effective auth" column above is the same for every row — including the
|   two GETs that carry no requireOffice of their own.
|
|   See the note on the banner below: the intent recorded there and the
|   actual mount do not agree.
|
| Route ordering:
|   "/investors/:id/statement" MUST stay above "/:master". Express matches
|   in declaration order, and "/:master" would otherwise capture
|   "investors" and treat the rest of the path as unmatched.
|
| Exports:
|   an Express router
|
| Used by:
|   backend/server.js
|
| Depends on:
|   ./master.controller.js
|   middleware/roleMiddleware.js
|   utils/asyncHandler.js
|
| Database tables touched:
|   investors, suppliers, clients, payments, tenders
|
| Frontend consumers:
|   frontend/src/services/masterService.js -> MastersPage.jsx, and the
|   counterparty pickers on the payment forms.
|
| Note:
|   No logActivity on any route, so changes to reference data are not
|   audited — consistent with the other registers.
|
*/

const express = require("express");

const asyncHandler = require("../../utils/asyncHandler");

const roleMiddleware = require("../../middleware/roleMiddleware");

const masterController = require("./master.controller");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Master data
|--------------------------------------------------------------------------
|
|   GET    /api/masters/investors
|   GET    /api/masters/suppliers
|   GET    /api/masters/clients
|   POST   /api/masters/:master
|   PUT    /api/masters/:master/:id
|   DELETE /api/masters/:master/:id
|
|   GET    /api/masters/investors/:id/statement
|
| The :master segment is checked against an allowlist inside the controller
| before it reaches any SQL.
|
| Reading is open to any authenticated user; writing is office-only, since
| these lists are shared reference data.
|
| ---------------------------------------------------------------------
| The paragraph above describes the intent, not the current behaviour.
|
| server.js mounts this whole router behind requireOffice, so reading is
| office-only too — a worker or subcontractor cannot reach GET /:master at
| all. The requireOffice applied to the three write routes below is
| therefore redundant: the same check has already passed at the mount.
|
| Nothing is broken by this. The effective access is stricter than the
| comment claims, not looser, and no frontend screen outside the office
| calls these endpoints. Recorded as F-15 in
| docs/repository-reference/findings.md.
| ---------------------------------------------------------------------
|
*/

/*
 * Redundant in practice — see above — but harmless, and worth leaving in
 * place: it keeps the write routes correctly gated on their own terms, so
 * the module stays safe if it is ever mounted without the outer gate.
 */
const requireOffice = roleMiddleware(
  ["admin", "manager"],
  { source: "either" }
);

/**
 * GET /api/masters/investors/:id/statement
 *
 * Auth:     required; office-only via the mount
 * Params:   :id — an investor in the caller's company
 * Response: 200 { success, investor, entries, summary }
 *           404 no such investor in this company
 *
 * Everything taken from and returned to one investor, with interest
 * accrued to today.
 *
 * Declared before the generic list route so it is not shadowed by
 * "/:master" — Express matches in declaration order, and "/:master" would
 * otherwise treat "investors" as the master key and never reach this.
 */
router.get(
  "/investors/:id/statement",
  asyncHandler(
    masterController.getInvestorStatement
  )
);

/**
 * GET /api/masters/:master
 *
 * Auth:     required; office-only via the mount, despite carrying no
 *           requireOffice of its own — see F-15
 * Params:   :master — investors, suppliers or clients
 * Query:    ?status= ?search=
 * Response: 200 { success, [collection], items }
 *           404 unknown master type
 *
 * Capped at 500 rows, ordered by name, unpaginated.
 */
router.get(
  "/:master",
  asyncHandler(masterController.list)
);

/**
 * POST /api/masters/:master
 *
 * Auth:     required
 * Roles:    admin, manager
 * Body:     name required; the rest optional
 * Response: 201 { success, item }
 *           400 name is missing
 *           404 unknown master type
 */
router.post(
  "/:master",
  requireOffice,
  asyncHandler(masterController.create)
);

/**
 * PUT /api/masters/:master/:id
 *
 * Auth:     required
 * Roles:    admin, manager
 * Response: 200 { success, item }
 *           404 unknown master type, or no such row in this company
 *
 * Partial: omitted fields keep their stored values. Also the way an
 * archived record is reactivated, since status is an ordinary writable
 * column.
 */
router.put(
  "/:master/:id",
  requireOffice,
  asyncHandler(masterController.update)
);

/**
 * DELETE /api/masters/:master/:id
 *
 * Auth:     required
 * Roles:    admin, manager
 * Response: 200 { success, message }
 *           404 unknown master type, or no such row in this company
 *
 * Archives rather than deletes — these tables have no is_deleted column,
 * so the handler sets status to 'inactive'. Historic payments continue to
 * resolve to a named row.
 */
router.delete(
  "/:master/:id",
  requireOffice,
  asyncHandler(
    masterController.archive
  )
);

module.exports = router;
