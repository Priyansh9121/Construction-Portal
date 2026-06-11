const express = require("express");
const router = express.Router();

const subcontractorController = require("./subcontractor.controller");

router.get("/", subcontractorController.getSubcontractors);
router.post("/", subcontractorController.createSubcontractor);
router.put("/:id", subcontractorController.updateSubcontractor);
router.delete("/:id", subcontractorController.deleteSubcontractor);

module.exports = router;