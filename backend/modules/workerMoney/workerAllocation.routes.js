const express = require("express");
const router = express.Router();

const allocationController = require("./workerAllocation.controller");

router.get("/", allocationController.getAllocations);
router.post("/", allocationController.createAllocation);
router.delete("/:id", allocationController.deleteAllocation);

module.exports = router;