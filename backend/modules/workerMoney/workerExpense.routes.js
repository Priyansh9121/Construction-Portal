const express = require("express");
const router = express.Router();

const expenseController = require("./workerExpense.controller");

const {
  logActivity,
  ACTIVITY_ACTIONS,
} = require("../../utils/activityLog");

/*
|--------------------------------------------------------------------------
| Worker expenses
|--------------------------------------------------------------------------
|
| Authentication and the office role check are applied in server.js.
|
| Every state change here moves money or signs off on money already spent,
| so all of them are recorded in the audit trail.
|
*/

router.get("/", expenseController.getExpenses);

router.post(
  "/",
  logActivity("worker_expenses", ACTIVITY_ACTIONS.CREATE),
  expenseController.createExpense
);

router.put(
  "/:id",
  logActivity("worker_expenses", ACTIVITY_ACTIONS.UPDATE),
  expenseController.updateExpense
);

router.delete(
  "/:id",
  logActivity("worker_expenses", ACTIVITY_ACTIONS.DELETE),
  expenseController.deleteExpense
);

router.post(
  "/:id/approve",
  logActivity("worker_expenses", ACTIVITY_ACTIONS.APPROVE),
  expenseController.approveExpense
);

router.post(
  "/:id/reject",
  logActivity("worker_expenses", ACTIVITY_ACTIONS.REJECT),
  expenseController.rejectExpense
);

module.exports = router;
