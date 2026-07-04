const express = require("express");

const router = express.Router();

const subcontractorPortalController = require("./subcontractorPortal.controller");

router.get("/me", subcontractorPortalController.getMyProfile);

router.get("/tenders", subcontractorPortalController.getMyTenders);

router.get("/tenders/:id", subcontractorPortalController.getMyTenderDetails);

router.post("/daily-updates", subcontractorPortalController.createMyDailyUpdate);

router.post("/documents", subcontractorPortalController.addMyTenderDocument);

module.exports = router;