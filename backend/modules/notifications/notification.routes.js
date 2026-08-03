/*
| FILE PURPOSE
|
| URL map for /api/notifications — a user's own notification queue.
|
|   GET  /            list the caller's notifications
|   GET  /unread-count  the header badge figure
|   PUT  /:id/read    mark one read
|   PUT  /read-all    mark all read
|
| Mounted by server.js behind authMiddleware with NO role gate: every role
| has notifications. Access control is by USER, applied in the controller —
| every statement filters on the authenticated user id, so one user cannot
| read or clear another's queue.
|
| Depends on: ./notification.controller.js, utils/asyncHandler.js
| Tables: notifications
| Frontend: notificationService.js -> NotificationCenter.jsx, Topbar.jsx
|
| See the route declarations below for the authoritative list of paths.
*/

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
