const express = require("express");

const notificationController = require("./notification.controller");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Notifications
|--------------------------------------------------------------------------
|
| Authentication is applied in server.js. Notifications are per-user, and
| the controller scopes every query to the caller, so one member cannot
| read another's queue.
|
| The audit trail used to be bolted onto the end of this file as a second
| router exported after module.exports had already been assigned. It now
| lives in activity.routes.js.
|
*/

router.get(
  "/",
  notificationController.list
);

router.post(
  "/read-all",
  notificationController.markAllRead
);

router.post(
  "/:id/read",
  notificationController.markRead
);

module.exports = router;
