const express = require("express");

const router = express.Router();

const subcontractorPortalController = require("./subcontractorPortal.controller");

router.get("/me", subcontractorPortalController.getMyProfile);

router.get("/tenders", subcontractorPortalController.getMyTenders);

router.get("/tenders/:id", subcontractorPortalController.getMyTenderDetails);

module.exports = router;