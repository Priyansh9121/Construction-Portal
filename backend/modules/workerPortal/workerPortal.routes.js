const express = require("express");

const router = express.Router();

const workerPortalController = require("./workerPortal.controller");

router.get("/me", workerPortalController.getMyProfile);

router.get("/assignments", workerPortalController.getMyAssignments);

router.get("/daily-updates", workerPortalController.getMyDailyUpdates);

router.post("/daily-updates", workerPortalController.createMyDailyUpdate);

router.get(
  "/tenders/:id/documents",
  workerPortalController.getMyTenderDocuments
);

module.exports = router;