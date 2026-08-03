/*
| FILE PURPOSE
|
| URL map for /api/activity — the read side of the audit trail.
|
| Mounted by server.js behind authMiddleware only; the admin restriction is
| applied here in the route file rather than at the mount.
|
| Depends on: ./activity.controller.js, middleware/roleMiddleware.js,
|             utils/asyncHandler.js
| Tables: activity_logs, users
| Frontend: ActivityPage.jsx
|
| The rows served here were redacted on the way in by utils/activityLog.js,
| so this endpoint cannot expose a credential or an account number. See
| F-12.
*/

const express = require("express");

const roleMiddleware = require("../../middleware/roleMiddleware");

const activityController = require("./activity.controller");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Activity log
|--------------------------------------------------------------------------
|
| Mounted at /api/activity. Authentication is applied in server.js.
|
| Reading the trail shows who did what across the whole company, so it is
| restricted to the office rather than to any authenticated member.
|
*/

router.get(
  "/",
  roleMiddleware(
    ["admin", "manager"],
    { source: "either" }
  ),
  activityController.list
);

module.exports = router;
