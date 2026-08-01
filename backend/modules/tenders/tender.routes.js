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
  asyncHandler(
    tenderController.createDocument
  )
);

router.put(
  "/:id/documents/:documentId",
  requireTenderManagement,
  asyncHandler(
    tenderController.updateDocument
  )
);

router.delete(
  "/:id/documents/:documentId",
  requireTenderManagement,
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
  asyncHandler(
    tenderController.createMaterial
  )
);

router.put(
  "/:id/materials/:materialId",
  requireTenderManagement,
  asyncHandler(
    tenderController.updateMaterial
  )
);

router.delete(
  "/:id/materials/:materialId",
  requireTenderManagement,
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
  asyncHandler(
    tenderController.createBanking
  )
);

router.put(
  "/:id/banking/:bankingId",
  requireTenderManagement,
  asyncHandler(
    tenderController.updateBanking
  )
);

router.delete(
  "/:id/banking/:bankingId",
  requireTenderManagement,
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
  asyncHandler(
    tenderController.assignSubcontractor
  )
);

router.put(
  "/:id/subcontractors/:assignmentId",
  requireTenderManagement,
  asyncHandler(
    tenderController.updateSubcontractor
  )
);

router.delete(
  "/:id/subcontractors/:assignmentId",
  requireTenderManagement,
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
  asyncHandler(
    tenderController.assignWorker
  )
);

router.put(
  "/:id/workers/:assignmentId",
  requireTenderManagement,
  asyncHandler(
    tenderController.updateWorker
  )
);

router.delete(
  "/:id/workers/:assignmentId",
  requireTenderManagement,
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
  asyncHandler(
    tenderController.createFinanceRecord
  )
);

router.put(
  "/:id/finance/:financeId",
  requireTenderManagement,
  asyncHandler(
    tenderController.updateFinanceRecord
  )
);

router.delete(
  "/:id/finance/:financeId",
  requireTenderManagement,
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
  asyncHandler(
    tenderController.updateTender
  )
);

router.delete(
  "/:id",
  requireTenderManagement,
  asyncHandler(
    tenderController.deleteTender
  )
);

module.exports = router;