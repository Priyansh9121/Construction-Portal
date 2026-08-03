/*
| FILE PURPOSE
|
| URL map for /api/subcontractor-portal — a subcontractor's own view.
|
| Mounted by server.js behind authMiddleware and a role gate of
| admin + subcontractor.
|
| Same caveat as the worker portal: the gate proves the caller is a
| subcontractor, not which one. The controller resolves their own record
| and filters every read through tender_subcontractors, so a tender they
| are not assigned to is invisible.
|
| Note "/tenders/:id" is declared after "/tenders" — both are literal
| prefixes, so ordering is safe here, but a new static sibling would need
| to go above the parameter route.
|
| Depends on: ./subcontractorPortal.controller.js, utils/asyncHandler.js
| Tables: subcontractors, tender_subcontractors, tenders, tender_documents
| Frontend: subcontractorPortalService.js -> SubcontractorPortalPage.jsx
*/

const express = require("express");

const router = express.Router();

const subcontractorPortalController = require("./subcontractorPortal.controller");

router.get("/me", subcontractorPortalController.getMyProfile);

router.get("/tenders", subcontractorPortalController.getMyTenders);

router.get("/tenders/:id", subcontractorPortalController.getMyTenderDetails);

router.post("/daily-updates", subcontractorPortalController.createMyDailyUpdate);

router.post("/documents", subcontractorPortalController.addMyTenderDocument);

module.exports = router;