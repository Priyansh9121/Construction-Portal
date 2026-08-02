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
