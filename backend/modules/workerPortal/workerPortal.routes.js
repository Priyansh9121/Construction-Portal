/*
| FILE PURPOSE
|
| URL map for /api/worker-portal — a worker's own view of themselves.
|
| Mounted by server.js behind authMiddleware and a role gate of
| admin + worker. Manager is deliberately absent: a manager has the full
| registers and no reason to act through the worker portal. Admin is
| retained for support.
|
| IMPORTANT: the role gate proves the caller is a worker, not WHICH worker.
| Every handler in the controller resolves the caller's own worker record
| from their user id and filters on it. See the security note there.
|
| Depends on: ./workerPortal.controller.js, utils/asyncHandler.js
| Tables: workers, worker_assignments, daily_site_logs,
|         worker_allocations, worker_expenses, tenders, sites
| Frontend: workerPortalService.js -> WorkerPortalPage.jsx
|
| Daily updates submitted here go to modules/dailyUpdateApprovals for the
| office to approve.
*/

const express = require("express");

const router = express.Router();

const workerPortalController = require("./workerPortal.controller");

router.get("/me", workerPortalController.getMyProfile);

router.get("/assignments", workerPortalController.getMyAssignments);

router.get("/daily-updates", workerPortalController.getMyDailyUpdates);

router.post("/daily-updates", workerPortalController.createMyDailyUpdate);

router.get(
  "/tenders/:id/documents",
  workerPortalController.getMyTenderDocuments
);

router.get("/money", workerPortalController.getMyMoney);

router.post("/expenses", workerPortalController.createMyExpense);

module.exports = router;