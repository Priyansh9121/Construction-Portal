const express = require("express");
const router = express.Router();

const tenderWorkerController = require("./tenderWorker.controller");

router.get("/:tenderId", tenderWorkerController.getTenderWorkers);
router.post("/", tenderWorkerController.assignWorkerToTender);
router.delete("/:id", tenderWorkerController.removeTenderWorker);

module.exports = router;