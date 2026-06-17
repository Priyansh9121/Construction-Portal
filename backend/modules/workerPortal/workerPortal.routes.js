const express = require("express");

const router = express.Router();

const workerPortalController = require("./workerPortal.controller");

/*
|--------------------------------------------------------------------------
| Worker Portal Routes
|--------------------------------------------------------------------------
| These routes are only for logged-in workers.
|
| Final URL examples:
| GET  /api/worker-portal/me
| GET  /api/worker-portal/assignments
| GET  /api/worker-portal/daily-updates
| POST /api/worker-portal/daily-updates
*/

router.get("/me", workerPortalController.getMyProfile);

router.get("/assignments", workerPortalController.getMyAssignments);

router.get("/daily-updates", workerPortalController.getMyDailyUpdates);

router.post("/daily-updates", workerPortalController.createMyDailyUpdate);

router.get(
    "/tenders/:id/documents",
    workerPortalController.getMyTenderDocuments
  );

router.get(
    "/tenders/:id/documents",
    workerPortalController.getMyTenderDocuments
);

module.exports = router;