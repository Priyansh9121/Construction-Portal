const express = require("express");
const router = express.Router();

const workerController = require("./worker.controller");
const validateWorker = require("./validations/worker.validation");

router.get("/", workerController.getWorkers);
router.post("/", validateWorker, workerController.createWorker);
router.put("/:id", validateWorker, workerController.updateWorker);
router.delete("/:id", workerController.deleteWorker);

module.exports = router;