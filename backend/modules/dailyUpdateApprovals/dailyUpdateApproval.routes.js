const express = require("express");
const router = express.Router();

const controller = require("./dailyUpdateApproval.controller");
const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");

router.use(authMiddleware);
router.use(roleMiddleware(["admin", "manager"]));

router.get("/", controller.getPendingApprovals);
router.post("/:id/approve", controller.approveDailyUpdate);
router.post("/:id/reject", controller.rejectDailyUpdate);

module.exports = router;