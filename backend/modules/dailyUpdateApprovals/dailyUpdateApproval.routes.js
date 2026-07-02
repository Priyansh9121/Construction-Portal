const express = require("express");
const router = express.Router();

const controller = require("./dailyUpdateApproval.controller");

router.get("/", controller.getPendingApprovals);
router.post("/:id/approve", controller.approveDailyUpdate);
router.post("/:id/reject", controller.rejectDailyUpdate);

module.exports = router;