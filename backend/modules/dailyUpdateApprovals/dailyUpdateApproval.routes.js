const express = require("express");
const router = express.Router();

const controller = require("./dailyUpdateApproval.controller");

const {
  logActivity,
  ACTIVITY_ACTIONS,
} = require("../../utils/activityLog");

/*
|--------------------------------------------------------------------------
| Daily update approvals
|--------------------------------------------------------------------------
|
| Authentication and the admin/manager check are applied once in server.js:
|
|     app.use("/api/daily-update-approvals", authMiddleware,
|             roleMiddleware(["admin", "manager"], ...), dailyUpdateApprovalRoutes)
|
| This file used to repeat both, so every request verified its JWT twice.
|
| Approving an update writes it into a site's permanent history, so both
| decisions are recorded in the audit trail.
|
*/

router.get("/", controller.getPendingApprovals);

router.post(
  "/:id/approve",
  logActivity(
    "daily_update_approvals",
    ACTIVITY_ACTIONS.APPROVE
  ),
  controller.approveDailyUpdate
);

router.post(
  "/:id/reject",
  logActivity(
    "daily_update_approvals",
    ACTIVITY_ACTIONS.REJECT
  ),
  controller.rejectDailyUpdate
);

module.exports = router;
