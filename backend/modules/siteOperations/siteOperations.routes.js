/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The URL map for /api/site-operations — the supervisor-facing surface.
| Four related areas in one router: material received on site, the labour
| ledger, the supervisor's banking float, and the access requests that let
| a late entry through.
|
| This is the ONLY module where the office and site staff share the same
| paths. Every other mount is gated wholesale — office-only, worker-only,
| subcontractor-only. Here a supervisor and an administrator use the same
| endpoints with different permissions, so the role checks are applied per
| route rather than at the mount.
|
| THE PATTERN, which is the thing to understand about this file:
|
|   Recording is open to anyone authenticated. A supervisor records what
|   happened on site — material arrived, labour worked, money was spent.
|
|   Approving is office-only. The person who recorded an entry must not be
|   the person who approves it, or the approval means nothing.
|
| So: GET and POST of an entry carry no role check; every /approve,
| /reject, /grant and /deny carries requireOffice. Issuing banking funds is
| the one creation that is also office-only — see the comment there.
|
| Endpoint summary:
|
|   Method Path                                    Roles
|   ------ --------------------------------------- --------------
|   GET    /materials/catalog                      any authenticated
|   GET    /materials/summary                      any authenticated
|   GET    /materials                              any authenticated
|   POST   /materials                              any authenticated
|   DELETE /materials/:id                          any authenticated
|   POST   /materials/:id/approve                  admin, manager
|   POST   /materials/:id/reject                   admin, manager
|
|   GET    /labour/categories                      any authenticated
|   GET    /labour                                 any authenticated
|   POST   /labour                                 any authenticated
|   GET    /labour/:id/ledger                      any authenticated
|   POST   /labour/:id/entries                     any authenticated
|   PUT    /labour/:id                             any authenticated
|   DELETE /labour/:id                             any authenticated
|
|   GET    /banking/summary                        any authenticated
|   GET    /banking/receipts                       any authenticated
|   POST   /banking/receipts                       admin, manager
|   GET    /banking/expenses                       any authenticated
|   POST   /banking/expenses                       any authenticated
|   POST   /banking/expenses/:id/approve           admin, manager
|   POST   /banking/expenses/:id/reject            admin, manager
|
|   GET    /access-requests                        any authenticated
|   POST   /access-requests                        any authenticated
|   POST   /access-requests/:id/grant              admin, manager
|   POST   /access-requests/:id/deny               admin, manager
|
| "Any authenticated" is bounded by the mount: server.js applies
| authMiddleware but no role gate, so workers and subcontractors CAN reach
| these paths. Each controller scopes its reads and writes to the caller's
| company, and the entry-window rules apply to everyone who is not office.
|
| ROUTE ORDERING:
|   Literal paths are declared before parameter ones — /materials/catalog
|   and /materials/summary above /materials, /labour/categories above
|   /labour/:id. Express matches in declaration order, so reversing any of
|   those would make the literal path unreachable.
|
| Exports:
|   an Express router
|
| Used by:
|   backend/server.js, mounted at /api/site-operations
|
| Depends on:
|   ./material.controller.js, ./labour.controller.js,
|   ./banking.controller.js, ./accessRequest.controller.js
|   middleware/roleMiddleware.js, utils/asyncHandler.js
|
|   All four controllers share ./entryWindow.service.js, which decides
|   whether an entry may be recorded for a given date.
|
| Database tables touched (through the controllers):
|   material_entries, material_catalog, labour, labour_entries,
|   labour_categories, supervisor_banking, banking_expenses,
|   entry_access_requests, plus sites and tenders for ownership checks
|
| Frontend consumers:
|   frontend/src/services/siteOperationsService.js -> useSiteOperations.js
|   -> SiteOperationsPage.jsx
|
| Note:
|   No logActivity on any route here, so site-operations entries and their
|   approvals are not written to the audit trail — even though approval is
|   exactly the kind of act an audit trail exists to record. The approval
|   decision IS captured on the row itself (approved_by, approved_at).
|
*/

const express = require("express");

const asyncHandler = require("../../utils/asyncHandler");

const roleMiddleware = require("../../middleware/roleMiddleware");

const materialController = require("./material.controller");
const labourController = require("./labour.controller");
const bankingController = require("./banking.controller");
const accessRequestController = require("./accessRequest.controller");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Site operations
|--------------------------------------------------------------------------
|
| The supervisor-facing surface described in the site notebook: material
| received on site, the labour ledger, the supervisor's banking float, and
| the access requests that let a late entry through.
|
| Authentication is applied once in server.js. These routes add role checks
| only where the action is reserved for the office.
|
*/

/**
 * The approval gate.
 *
 * Applied only to the actions reserved for the office: approving or
 * rejecting an entry, issuing banking funds, and granting or denying an
 * access request.
 *
 * Unlike most modules, this one is NOT office-gated at the mount — site
 * staff need to reach the recording endpoints — so this is a real check
 * rather than a redundant second one. It is the separation between
 * recording what happened and authorising it.
 */
const requireOffice = roleMiddleware(
  ["admin", "manager"],
  { source: "either" }
);

/*
|--------------------------------------------------------------------------
| Materials
|--------------------------------------------------------------------------
|
| Deliveries received on site: what arrived, how much, from whom.
|
| Distinct from the tender materials under /api/tenders/:id/materials,
| which are the PLAN — quantities and rates estimated when the job was
| priced. These are the record of what actually turned up. Nothing
| reconciles the two.
|
| /catalog serves material_catalog, the reference list of material names
| a supervisor picks from. /summary aggregates entries for the site view.
| Both are declared above /materials so the parameter route cannot
| capture them.
|
| Recording is open; approving is office-only.
|
*/

// GET /api/site-operations/materials/catalog
router.get(
  "/materials/catalog",
  asyncHandler(
    materialController.getCatalog
  )
);

// GET /api/site-operations/materials/summary
router.get(
  "/materials/summary",
  asyncHandler(
    materialController.getSummary
  )
);

// GET /api/site-operations/materials
router.get(
  "/materials",
  asyncHandler(
    materialController.getEntries
  )
);

// POST /api/site-operations/materials
router.post(
  "/materials",
  asyncHandler(
    materialController.createEntry
  )
);

// DELETE /api/site-operations/materials/:id
router.delete(
  "/materials/:id",
  asyncHandler(
    materialController.deleteEntry
  )
);

// Approval is the office's call, not the supervisor's.
router.post(
  "/materials/:id/approve",
  requireOffice,
  asyncHandler(
    materialController.approveEntry
  )
);

router.post(
  "/materials/:id/reject",
  requireOffice,
  asyncHandler(
    materialController.rejectEntry
  )
);

/*
|--------------------------------------------------------------------------
| Labour
|--------------------------------------------------------------------------
|
| The labour ledger: gangs or individuals working a site, and the daily
| entries recorded against each.
|
| A two-level structure, unlike materials. A `labour` row is the person or
| gang; `labour/:id/entries` are the days they worked. /ledger returns the
| running account for one labour record — days worked, amounts due and
| paid.
|
| Note this whole section has NO office-only routes. Labour entries are
| not part of the approve/reject workflow that materials and banking
| expenses use; a supervisor records and amends them directly, bounded
| only by the entry window.
|
*/

// GET /api/site-operations/labour/categories
router.get(
  "/labour/categories",
  asyncHandler(
    labourController.getCategories
  )
);

// GET /api/site-operations/labour
router.get(
  "/labour",
  asyncHandler(
    labourController.getLabour
  )
);

// POST /api/site-operations/labour
router.post(
  "/labour",
  asyncHandler(
    labourController.createLabour
  )
);

// GET /api/site-operations/labour/:id/ledger
router.get(
  "/labour/:id/ledger",
  asyncHandler(
    labourController.getLedger
  )
);

// POST /api/site-operations/labour/:id/entries
router.post(
  "/labour/:id/entries",
  asyncHandler(
    labourController.createWorkEntry
  )
);

// PUT /api/site-operations/labour/:id
router.put(
  "/labour/:id",
  asyncHandler(
    labourController.updateLabour
  )
);

// DELETE /api/site-operations/labour/:id
router.delete(
  "/labour/:id",
  asyncHandler(
    labourController.deleteLabour
  )
);

/*
|--------------------------------------------------------------------------
| Banking
|--------------------------------------------------------------------------
|
| The supervisor's cash float: money issued to them by the office, and
| what they spent it on.
|
| Two sides that must not be recorded by the same person:
|
|   receipts   money IN to the supervisor. Office-only to create — see
|              the comment on that route.
|   expenses   money OUT, recorded by the supervisor, then approved or
|              rejected by the office.
|
| That asymmetry is the reconciliation. A supervisor who could record
| their own incoming funds could account for any expenditure.
|
| Banking also has a longer entry window than the other modules —
| SUPERVISOR_EDIT_WINDOW_DAYS plus SUPERVISOR_BANKING_GRACE_DAYS — because
| the notes allow one extra day for it. See entryWindow.service.js.
|
| Distinct from tender banking under /api/tenders/:id/banking, which
| tracks guarantees and deposits rather than site cash.
|
*/

// GET /api/site-operations/banking/summary
router.get(
  "/banking/summary",
  asyncHandler(
    bankingController.getSummary
  )
);

// GET /api/site-operations/banking/receipts
router.get(
  "/banking/receipts",
  asyncHandler(
    bankingController.getReceipts
  )
);

// Issuing funds to a supervisor is an office action — a supervisor
// recording their own incoming money would defeat the reconciliation.
router.post(
  "/banking/receipts",
  requireOffice,
  asyncHandler(
    bankingController.createReceipt
  )
);

// GET /api/site-operations/banking/expenses
router.get(
  "/banking/expenses",
  asyncHandler(
    bankingController.getExpenses
  )
);

// POST /api/site-operations/banking/expenses
router.post(
  "/banking/expenses",
  asyncHandler(
    bankingController.createExpense
  )
);

router.post(
  "/banking/expenses/:id/approve",
  requireOffice,
  asyncHandler(
    bankingController.approveExpense
  )
);

router.post(
  "/banking/expenses/:id/reject",
  requireOffice,
  asyncHandler(
    bankingController.rejectExpense
  )
);

/*
|--------------------------------------------------------------------------
| Access requests
|--------------------------------------------------------------------------
|
| The escape hatch for the entry window.
|
| From the notes: "To add a bill with a date older than 2 days you have to
| call the company and take access." This is that call, made a record —
| a supervisor requests permission for one specific date and module, and
| the office grants or denies it.
|
| A granted request is checked by entryWindow.service.js when the late
| entry is finally submitted, and then CONSUMED, so one grant authorises
| one entry rather than opening the date indefinitely.
|
| Requesting is open; granting is office-only, which is the whole point.
|
*/

// GET /api/site-operations/access-requests
router.get(
  "/access-requests",
  asyncHandler(
    accessRequestController.getRequests
  )
);

// POST /api/site-operations/access-requests
router.post(
  "/access-requests",
  asyncHandler(
    accessRequestController.createRequest
  )
);

router.post(
  "/access-requests/:id/grant",
  requireOffice,
  asyncHandler(
    accessRequestController.grantRequest
  )
);

router.post(
  "/access-requests/:id/deny",
  requireOffice,
  asyncHandler(
    accessRequestController.denyRequest
  )
);

module.exports = router;
