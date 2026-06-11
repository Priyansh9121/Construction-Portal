const express = require("express");
const router = express.Router();

const tenderDetailsController = require("./tenderDetails.controller");

router.get("/:id", tenderDetailsController.getTenderDetails);

router.post("/documents", tenderDetailsController.addDocument);
router.delete("/documents/:documentId", tenderDetailsController.deleteDocument);

router.post("/materials", tenderDetailsController.addMaterial);
router.delete("/materials/:materialId", tenderDetailsController.deleteMaterial);

router.post("/banking", tenderDetailsController.addBanking);
router.delete("/banking/:bankingId", tenderDetailsController.deleteBanking);

router.put(
  "/subcontractors/:tenderSubcontractorId",
  tenderDetailsController.updateTenderSubcontractor
);

router.post("/subcontractors", tenderDetailsController.assignSubcontractor);
router.delete(
  "/subcontractors/:tenderSubcontractorId",
  tenderDetailsController.removeSubcontractor
);

module.exports = router;