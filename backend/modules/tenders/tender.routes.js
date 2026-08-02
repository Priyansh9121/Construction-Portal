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

router.get(
  "/",
  asyncHandler(
    tenderController.getTenders
  )
);

router.get(
  "/statistics",
  asyncHandler(
    tenderController.getTenderStatistics
  )
);

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
    "tender_workers",
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
    "tender_workers",
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
    "tender_workers",
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
*/

router.get(
  "/:id",
  asyncHandler(
    tenderController.getTenderById
  )
);

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