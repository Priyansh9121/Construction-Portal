/*
| FILE PURPOSE
|
| URL map for /api/worker-allocations — money advanced to workers.
|
| Office-only: server.js mounts this behind authMiddleware and
| requireOffice, which is why neither appears here. A worker sees their own
| allocations through /api/worker-portal instead.
|
| Every mutation is audited via logActivity — these are money records.
|
| Depends on: ./workerAllocation.controller.js, utils/asyncHandler.js,
|             utils/activityLog.js
| Tables: worker_allocations, workers, tenders, notifications
| Frontend: workerMoneyService.js -> useWorkerMoney.js -> WorkerMoneyPage
*/

const express = require("express");
const router = express.Router();

const allocationController = require("./workerAllocation.controller");

const {
  logActivity,
  ACTIVITY_ACTIONS,
} = require("../../utils/activityLog");

/*
|--------------------------------------------------------------------------
| Worker allocations
|--------------------------------------------------------------------------
|
| Authentication and the office role check are applied in server.js.
|
| Allocating, approving or withdrawing money is exactly what an audit trail
| exists for, so every mutation here is recorded.
|
*/

router.get("/", allocationController.getAllocations);

router.post(
  "/",
  logActivity("worker_allocations", ACTIVITY_ACTIONS.CREATE),
  allocationController.createAllocation
);

router.put(
  "/:id",
  logActivity("worker_allocations", ACTIVITY_ACTIONS.UPDATE),
  allocationController.updateAllocation
);

router.delete(
  "/:id",
  logActivity("worker_allocations", ACTIVITY_ACTIONS.DELETE),
  allocationController.deleteAllocation
);

router.post(
  "/:id/approve",
  logActivity("worker_allocations", ACTIVITY_ACTIONS.APPROVE),
  allocationController.approveAllocation
);

router.post(
  "/:id/reject",
  logActivity("worker_allocations", ACTIVITY_ACTIONS.REJECT),
  allocationController.rejectAllocation
);

module.exports = router;
