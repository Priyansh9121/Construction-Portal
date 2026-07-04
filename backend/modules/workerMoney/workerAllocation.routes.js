const express = require("express");
const router = express.Router();

const allocationController = require("./workerAllocation.controller");

router.get("/", allocationController.getAllocations);
router.post("/", allocationController.createAllocation);
router.put("/:id", allocationController.updateAllocation);
router.delete("/:id", allocationController.deleteAllocation);

router.post("/:id/approve", allocationController.approveAllocation);
router.post("/:id/reject", allocationController.rejectAllocation);

module.exports = router;