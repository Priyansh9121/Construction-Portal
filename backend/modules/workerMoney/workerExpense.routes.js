const express = require("express");
const router = express.Router();

const expenseController = require("./workerExpense.controller");

router.get("/", expenseController.getExpenses);
router.post("/", expenseController.createExpense);
router.put("/:id", expenseController.updateExpense);
router.delete("/:id", expenseController.deleteExpense);

router.post("/:id/approve", expenseController.approveExpense);
router.post("/:id/reject", expenseController.rejectExpense);

module.exports = router;