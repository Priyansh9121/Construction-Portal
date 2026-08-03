/*
| FILE PURPOSE
|
| URL map for /api/daily-update-approvals — the office's approval queue for
| daily updates submitted through the worker portal.
|
| Office-only: server.js gates the mount on admin and manager, spelled out
| inline there rather than reusing requireOffice. That gate is what gives
| approval its meaning — submitting happens in the worker portal, approving
| happens here, so the two cannot be the same person.
|
| Every decision is audited via logActivity.
|
| Depends on: ./dailyUpdateApproval.controller.js, utils/asyncHandler.js,
|             utils/activityLog.js
| Tables: daily_site_logs, sites, workers, tenders, notifications
| Frontend: dailyUpdateApprovalService.js -> DailyUpdateApprovalsPage.jsx
*/

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
