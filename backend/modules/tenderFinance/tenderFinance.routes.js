const express = require("express");
const router = express.Router();

const tenderFinanceController = require("./tenderFinance.controller");

router.get("/tender/:tenderId", tenderFinanceController.getFinanceRecords);

router.get(
  "/summary/:tenderId",
  tenderFinanceController.getTenderFinanceSummary
);

router.post("/", tenderFinanceController.createFinanceRecord);

router.put("/:id", tenderFinanceController.updateFinanceRecord);

router.delete("/:id", tenderFinanceController.deleteFinanceRecord);

module.exports = router;