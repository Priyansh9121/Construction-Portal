/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The URL map for /api/tenders — the largest router in the application.
|
| A tender is the central record of this product: a job won or bid for,
| with sites, workers, subcontractors, materials, banking, documents and
| finance all hanging off it. This router exposes the tender itself plus
| six child collections, each with the same four-verb shape.
|
| Endpoint summary:
|
|   Method Path                                Roles           Audited
|   ------ ----------------------------------- --------------  -------------
|   GET    /                                   any office      no
|   GET    /statistics                         any office      no
|   POST   /                                   admin, manager  tenders create
|   GET    /:id/details                        any office      no
|
|   GET    /:id/documents                      any office      no
|   POST   /:id/documents                      admin, manager  create
|   PUT    /:id/documents/:documentId          admin, manager  update
|   DELETE /:id/documents/:documentId          admin, manager  delete
|
|   GET    /:id/materials                      any office      no
|   POST   /:id/materials                      admin, manager  create
|   PUT    /:id/materials/:materialId          admin, manager  update
|   DELETE /:id/materials/:materialId          admin, manager  delete
|
|   GET    /:id/banking                        any office      no
|   POST   /:id/banking                        admin, manager  create
|   PUT    /:id/banking/:bankingId             admin, manager  update
|   DELETE /:id/banking/:bankingId             admin, manager  delete
|
|   GET    /:id/subcontractors                 any office      no
|   POST   /:id/subcontractors                 admin, manager  assign
|   PUT    /:id/subcontractors/:assignmentId   admin, manager  update
|   DELETE /:id/subcontractors/:assignmentId   admin, manager  remove
|
|   GET    /:id/workers                        any office      no
|   POST   /:id/workers                        admin, manager  assign
|   PUT    /:id/workers/:assignmentId          admin, manager  update
|   DELETE /:id/workers/:assignmentId          admin, manager  remove
|
|   GET    /:id/finance/summary                any office      no
|   GET    /:id/finance                        any office      no
|   POST   /:id/finance                        admin, manager  create
|   PUT    /:id/finance/:financeId             admin, manager  update
|   DELETE /:id/finance/:financeId             admin, manager  delete
|
|   POST   /:id/restore                        admin, manager  restore
|   GET    /:id                                any office      no
|   PUT    /:id                                admin, manager  update
|   DELETE /:id                                admin, manager  delete
|
| Two patterns run through the whole table:
|
|   Reads are open to anyone who reached this router; writes additionally
|   require requireTenderManagement. Since server.js already gates the
|   mount on admin-or-manager, that second check is currently equivalent —
|   it exists so the distinction survives if the mount is ever loosened.
|
|   Every write is audited under a module name naming the child collection
|   ("tender_documents", "worker_assignments"), so the Activity page can
|   distinguish editing a tender from editing one of its materials.
|
| ROUTE ORDERING — the thing most likely to break when adding a route:
|
|   Express matches in declaration order, and "/:id" matches any single
|   segment. So every literal path must be declared BEFORE the generic
|   "/:id" routes at the foot of the file:
|
|     "/statistics"       above "/:id"        or it reads tender "statistics"
|     "/:id/finance/summary" above "/:id/finance/:financeId"
|     "/:id/restore"      above "/:id"
|
|   The existing comments at those points say so. A new static route added
|   at the bottom of this file will be silently shadowed.
|
| Exports:
|   an Express router
|
| Used by:
|   backend/server.js, mounted at /api/tenders behind authMiddleware and
|   requireOffice
|
| Depends on:
|   ./tender.controller.js  every handler
|   middleware/roleMiddleware.js
|   utils/asyncHandler.js
|   utils/activityLog.js
|
| Database tables touched (through the controller and service):
|   tenders, tender_documents, tender_materials, tender_banking,
|   tender_subcontractors, worker_assignments, tender_finance_records,
|   plus sites, workers, subcontractors and payments for the detail views
|
| Frontend consumers:
|   frontend/src/services/tenderService.js and tenderDetailsService.js
|   -> useTenders.js -> TendersPage.jsx and TenderDetailsPage.jsx, whose
|   nine tabs map almost one-to-one onto the child collections above.
|
*/

const express = require("express");

const asyncHandler = require(
  "../../utils/asyncHandler"
);

const roleMiddleware = require(
  "../../middleware/roleMiddleware"
);

const tenderController = require(
  "./tender.controller"
);

const {
  logActivity,
  ACTIVITY_ACTIONS,
} = require("../../utils/activityLog");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Access control
|--------------------------------------------------------------------------
|
| Authentication is applied once in server.js:
|
| app.use(
|   "/api/tenders",
|   authMiddleware,
|   tenderRoutes
| );
|
| Do not import or apply authMiddleware again in this file.
|
*/

/**
 * The write gate for this router.
 *
 * Applied to every POST, PUT and DELETE below, and to none of the GETs.
 *
 * Currently equivalent to the mount's own requireOffice — both accept
 * admin and manager — so it changes nothing today. It is kept because it
 * records the intended distinction between reading a tender and altering
 * one, and because it keeps the writes gated on their own terms if
 * /api/tenders is ever opened up to a wider set of readers.
 */
const requireTenderManagement =
  roleMiddleware(
    ["admin", "manager"],
    {
      source: "either",
    }
  );

/*
|--------------------------------------------------------------------------
| Tender register
|--------------------------------------------------------------------------
*/

/**
 * GET /api/tenders
 *
 * Auth:     required; office-only at the mount
 * Query:    filtering, search and pagination — see tenderQueries.js
 * Response: 200 { success, tenders, pagination }
 *
 * The tender register behind TendersPage.jsx.
 */
router.get(
  "/",
  asyncHandler(
    tenderController.getTenders
  )
);

/**
 * GET /api/tenders/statistics
 *
 * Auth:     required; office-only
 * Response: 200 { success, statistics }
 *
 * Aggregate counts and totals across the company's tenders, for the
 * dashboard cards.
 *
 * MUST stay above "/:id" — otherwise that route matches first and the
 * controller is asked for a tender whose id is "statistics".
 */
router.get(
  "/statistics",
  asyncHandler(
    tenderController.getTenderStatistics
  )
);

/**
 * POST /api/tenders
 *
 * Auth:     required
 * Roles:    admin, manager
 * Audited:  tenders / create
 * Response: 201 { success, tender }
 *           400 validation failed
 *
 * Validation lives in tenderValidation.js and runs inside the controller
 * rather than as route middleware, because several fields are validated
 * against each other.
 */
router.post(
  "/",
  requireTenderManagement,
  logActivity(
    "tenders",
    ACTIVITY_ACTIONS.CREATE
  ),
  asyncHandler(
    tenderController.createTender
  )
);

/*
|--------------------------------------------------------------------------
| Complete Tender details
|--------------------------------------------------------------------------
|
| GET /api/tenders/:id/details
|
| Auth:     required; office-only
| Response: 200 { success, ... } with the tender and every child
|           collection in one payload
|           404 no such live tender in this company
|
| The single request that populates TenderDetailsPage.jsx and all nine of
| its tabs. Without it the page would fire eight parallel requests on open;
| with it, switching tabs needs no network at all.
|
| The cost is a large response and several joins — see getTenderDetails in
| the controller.
|
*/

router.get(
  "/:id/details",
  asyncHandler(
    tenderController.getTenderDetails
  )
);

/*
|--------------------------------------------------------------------------
| Tender documents
|--------------------------------------------------------------------------
|
| Contracts, drawings, permits and photographs attached to a tender. Rows
| carry a name and a storage URL; the file itself is uploaded separately
| through /api/upload and only its URL is recorded here.
|
|   GET    /:id/documents                any office
|   POST   /:id/documents                admin, manager, audited create
|   PUT    /:id/documents/:documentId    admin, manager, audited update
|   DELETE /:id/documents/:documentId    admin, manager, audited delete
|
| The four-verb shape below repeats for all six child collections. In every
| case:
|
|   - :id is the parent tender, and is verified to belong to the caller's
|     company before the child is touched. A child id that exists under
|     another tender answers 404, so the nesting is enforced rather than
|     decorative — see tenderChildResources.test.js.
|   - Reads need only office access; writes need requireTenderManagement.
|   - Writes are audited under a collection-specific module name, so the
|     Activity page distinguishes "edited the tender" from "edited one of
|     its documents".
|
| Frontend: TenderDocumentsTab.jsx.
|
*/

router.get(
  "/:id/documents",
  asyncHandler(
    tenderController.getDocuments
  )
);

router.post(
  "/:id/documents",
  requireTenderManagement,
  logActivity(
    "tender_documents",
    ACTIVITY_ACTIONS.CREATE
  ),
  asyncHandler(
    tenderController.createDocument
  )
);

router.put(
  "/:id/documents/:documentId",
  requireTenderManagement,
  logActivity(
    "tender_documents",
    ACTIVITY_ACTIONS.UPDATE
  ),
  asyncHandler(
    tenderController.updateDocument
  )
);

router.delete(
  "/:id/documents/:documentId",
  requireTenderManagement,
  logActivity(
    "tender_documents",
    ACTIVITY_ACTIONS.DELETE
  ),
  asyncHandler(
    tenderController.deleteDocument
  )
);

/*
|--------------------------------------------------------------------------
| Tender materials
|--------------------------------------------------------------------------
|
| What the job needs and what it cost: quantities, rates and suppliers,
| planned at the tender level.
|
|   GET    /:id/materials                any office
|   POST   /:id/materials                admin, manager, audited create
|   PUT    /:id/materials/:materialId    admin, manager, audited update
|   DELETE /:id/materials/:materialId    admin, manager, audited delete
|
| Distinct from the material entries under /api/site-operations, which
| record deliveries actually received on site by a supervisor. This
| collection is the plan; that one is the record of what arrived.
|
| Frontend: TenderMaterialsTab.jsx.
|
*/

router.get(
  "/:id/materials",
  asyncHandler(
    tenderController.getMaterials
  )
);

router.post(
  "/:id/materials",
  requireTenderManagement,
  logActivity(
    "tender_materials",
    ACTIVITY_ACTIONS.CREATE
  ),
  asyncHandler(
    tenderController.createMaterial
  )
);

router.put(
  "/:id/materials/:materialId",
  requireTenderManagement,
  logActivity(
    "tender_materials",
    ACTIVITY_ACTIONS.UPDATE
  ),
  asyncHandler(
    tenderController.updateMaterial
  )
);

router.delete(
  "/:id/materials/:materialId",
  requireTenderManagement,
  logActivity(
    "tender_materials",
    ACTIVITY_ACTIONS.DELETE
  ),
  asyncHandler(
    tenderController.deleteMaterial
  )
);

/*
|--------------------------------------------------------------------------
| Tender banking
|--------------------------------------------------------------------------
|
| Bank guarantees, security deposits and EMD held against a tender — the
| money tied up in winning and holding the job, as opposed to the money
| earned from it.
|
|   GET    /:id/banking                any office
|   POST   /:id/banking                admin, manager, audited create
|   PUT    /:id/banking/:bankingId     admin, manager, audited update
|   DELETE /:id/banking/:bankingId     admin, manager, audited delete
|
| Distinct again from the supervisor banking float under
| /api/site-operations, which tracks cash issued to a site.
|
| Frontend: TenderBankingTab.jsx.
|
*/

router.get(
  "/:id/banking",
  asyncHandler(
    tenderController.getBanking
  )
);

router.post(
  "/:id/banking",
  requireTenderManagement,
  logActivity(
    "tender_banking",
    ACTIVITY_ACTIONS.CREATE
  ),
  asyncHandler(
    tenderController.createBanking
  )
);

router.put(
  "/:id/banking/:bankingId",
  requireTenderManagement,
  logActivity(
    "tender_banking",
    ACTIVITY_ACTIONS.UPDATE
  ),
  asyncHandler(
    tenderController.updateBanking
  )
);

router.delete(
  "/:id/banking/:bankingId",
  requireTenderManagement,
  logActivity(
    "tender_banking",
    ACTIVITY_ACTIONS.DELETE
  ),
  asyncHandler(
    tenderController.deleteBanking
  )
);

/*
|--------------------------------------------------------------------------
| Tender subcontractors
|--------------------------------------------------------------------------
|
| Which subcontractors are engaged on this tender, for what scope of work
| and what agreed amount.
|
|   GET    /:id/subcontractors                    any office
|   POST   /:id/subcontractors                    admin, manager, ASSIGN
|   PUT    /:id/subcontractors/:assignmentId      admin, manager, UPDATE
|   DELETE /:id/subcontractors/:assignmentId      admin, manager, REMOVE
|
| Note the audit actions: ASSIGN and REMOVE rather than CREATE and DELETE.
| These rows are assignments joining two existing records, not records in
| their own right, and the audit trail reads better for it — "assigned
| Acme Plumbing to tender 14" rather than "created tender_subcontractor 92".
|
| This is also what makes a tender visible in the subcontractor's own
| portal: /api/subcontractor-portal reads these assignment rows to decide
| which tenders a subcontractor may see.
|
| Frontend: TenderSubcontractorsTab.jsx.
|
*/

router.get(
  "/:id/subcontractors",
  asyncHandler(
    tenderController.getSubcontractors
  )
);

router.post(
  "/:id/subcontractors",
  requireTenderManagement,
  logActivity(
    "tender_subcontractors",
    ACTIVITY_ACTIONS.ASSIGN
  ),
  asyncHandler(
    tenderController.assignSubcontractor
  )
);

router.put(
  "/:id/subcontractors/:assignmentId",
  requireTenderManagement,
  logActivity(
    "tender_subcontractors",
    ACTIVITY_ACTIONS.UPDATE
  ),
  asyncHandler(
    tenderController.updateSubcontractor
  )
);

router.delete(
  "/:id/subcontractors/:assignmentId",
  requireTenderManagement,
  logActivity(
    "tender_subcontractors",
    ACTIVITY_ACTIONS.REMOVE
  ),
  asyncHandler(
    tenderController.removeSubcontractor
  )
);

/*
|--------------------------------------------------------------------------
| Tender worker assignments
|--------------------------------------------------------------------------
|
| Which workers are on this tender, in what role and over what dates.
|
|   GET    /:id/workers                     any office
|   POST   /:id/workers                     admin, manager, ASSIGN
|   PUT    /:id/workers/:assignmentId       admin, manager, UPDATE
|   DELETE /:id/workers/:assignmentId       admin, manager, REMOVE
|
| Audited under "worker_assignments" — the table name — rather than
| "tender_workers", unlike the other five collections which are named after
| the URL segment. A small inconsistency in the Activity page's module
| column; the rows are otherwise identical in shape.
|
| These assignments are what /api/worker-portal reads to decide which
| tenders a worker can see, and what the worker-money screens use to
| attribute allocations and expenses to a job.
|
| Frontend: TenderWorkersTab.jsx.
|
*/

router.get(
  "/:id/workers",
  asyncHandler(
    tenderController.getWorkers
  )
);

router.post(
  "/:id/workers",
  requireTenderManagement,
  logActivity(
    "worker_assignments",
    ACTIVITY_ACTIONS.ASSIGN
  ),
  asyncHandler(
    tenderController.assignWorker
  )
);

router.put(
  "/:id/workers/:assignmentId",
  requireTenderManagement,
  logActivity(
    "worker_assignments",
    ACTIVITY_ACTIONS.UPDATE
  ),
  asyncHandler(
    tenderController.updateWorker
  )
);

router.delete(
  "/:id/workers/:assignmentId",
  requireTenderManagement,
  logActivity(
    "worker_assignments",
    ACTIVITY_ACTIONS.REMOVE
  ),
  asyncHandler(
    tenderController.removeWorker
  )
);

/*
|--------------------------------------------------------------------------
| Tender finance
|--------------------------------------------------------------------------
|
| Keep /finance/summary before any future /finance/:financeId GET route.
|
| Government bills, GST returns, company charges and TDS recorded against
| a tender. The one child collection with real arithmetic behind it —
| utils/financeCalculations.js derives the totals and outstanding balances
| from whatever the client supplies.
|
|   GET    /:id/finance/summary           any office
|   GET    /:id/finance                   any office
|   POST   /:id/finance                   admin, manager, audited create
|   PUT    /:id/finance/:financeId        admin, manager, audited update
|   DELETE /:id/finance/:financeId        admin, manager, audited delete
|
| The ordering warning above is real and currently latent: there is no
| GET /:id/finance/:financeId today, but adding one below the summary route
| would be fine, while adding it ABOVE would capture "summary" as a finance
| id.
|
| Note the Finance TAB on the tender detail page reads payments rather than
| these records — see the note in frontend/src/config/tenderDetailForms.js.
| These endpoints back the finance figures shown elsewhere on the page.
|
*/

router.get(
  "/:id/finance/summary",
  asyncHandler(
    tenderController.getFinanceSummary
  )
);

router.get(
  "/:id/finance",
  asyncHandler(
    tenderController.getFinanceRecords
  )
);

router.post(
  "/:id/finance",
  requireTenderManagement,
  logActivity(
    "tender_finance",
    ACTIVITY_ACTIONS.CREATE
  ),
  asyncHandler(
    tenderController.createFinanceRecord
  )
);

router.put(
  "/:id/finance/:financeId",
  requireTenderManagement,
  logActivity(
    "tender_finance",
    ACTIVITY_ACTIONS.UPDATE
  ),
  asyncHandler(
    tenderController.updateFinanceRecord
  )
);

router.delete(
  "/:id/finance/:financeId",
  requireTenderManagement,
  logActivity(
    "tender_finance",
    ACTIVITY_ACTIONS.DELETE
  ),
  asyncHandler(
    tenderController.deleteFinanceRecord
  )
);

/*
|--------------------------------------------------------------------------
| Tender restore
|--------------------------------------------------------------------------
|
| Keep this before the generic /:id routes.
|
| POST /api/tenders/:id/restore
|
| Auth:     required
| Roles:    admin, manager
| Audited:  tenders / RESTORE
| Response: 200 { success, tender }
|           404 no such soft-deleted tender in this company
|
| Undoes a soft delete by clearing is_deleted. The counterpart to
| DELETE /:id, and the reason tenders are soft-deleted rather than removed:
| a tender carries sites, payments and assignments, so deleting one in
| error must be recoverable.
|
| Note this is the only child path that is a POST to a literal segment
| rather than a collection, which is why it needs its own ordering note —
| "/:id/restore" would still match before "/:id", but the comment guards
| against it being moved below.
|
*/

router.post(
  "/:id/restore",
  requireTenderManagement,
  logActivity(
    "tenders",
    ACTIVITY_ACTIONS.RESTORE
  ),
  asyncHandler(
    tenderController.restoreTender
  )
);

/*
|--------------------------------------------------------------------------
| Core Tender record
|--------------------------------------------------------------------------
|
| Generic /:id routes remain last so static child paths are evaluated first.
|
| This placement is load-bearing, not stylistic. "/:id" matches any single
| segment, so declared earlier it would swallow "/statistics" and turn
| every child collection path into a 404. Anything new and literal goes
| ABOVE this banner.
|
|   GET    /:id    any office      read one tender
|   PUT    /:id    admin, manager  update, audited
|   DELETE /:id    admin, manager  soft delete, audited
|
*/

/**
 * GET /api/tenders/:id
 *
 * Auth:     required; office-only
 * Response: 200 { success, tender }
 *           404 no such live tender in this company
 *
 * The tender row alone. Use /:id/details when the child collections are
 * needed too.
 */
router.get(
  "/:id",
  asyncHandler(
    tenderController.getTenderById
  )
);

/**
 * PUT /api/tenders/:id
 *
 * Auth:     required
 * Roles:    admin, manager
 * Audited:  tenders / update
 * Response: 200 { success, tender }
 *           400 validation failed
 *           404 no such live tender in this company
 *
 * Edits the tender record itself. Child collections have their own
 * endpoints and are not touched here.
 */
router.put(
  "/:id",
  requireTenderManagement,
  logActivity(
    "tenders",
    ACTIVITY_ACTIONS.UPDATE
  ),
  asyncHandler(
    tenderController.updateTender
  )
);

/**
 * DELETE /api/tenders/:id
 *
 * Auth:     required
 * Roles:    admin, manager
 * Audited:  tenders / delete
 * Response: 200 { success, message }
 *           404 no such live tender in this company
 *
 * A soft delete — the row is flagged, not removed, because sites,
 * payments, assignments and finance records all reference it. Reversible
 * through POST /:id/restore.
 */
router.delete(
  "/:id",
  requireTenderManagement,
  logActivity(
    "tenders",
    ACTIVITY_ACTIONS.DELETE
  ),
  asyncHandler(
    tenderController.deleteTender
  )
);

module.exports = router;