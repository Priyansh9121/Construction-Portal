/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The read side of notifications: a user's own queue, and marking items
| read.
|
| Responsibilities:
|   - List the caller's notifications
|   - Report the unread count for the header badge
|   - Mark one, or all, as read
|
| Exports:
|   see module.exports at the foot of the file
|
| Used by:
|   ./notification.routes.js, mounted by server.js at /api/notifications
|
| Depends on:
|   database/pool.js, utils/asyncHandler.js, utils/requestContext.js
|
| Database tables touched:
|   notifications  SELECT, UPDATE (read flags)
|
| Frontend consumers:
|   notificationService.js -> NotificationCenter.jsx, polled for the
|   unread badge in Topbar.jsx
|
| Security:
|   Notifications are PER USER, not per company, so every statement filters
|   on the authenticated user id as well as the company. That is why this
|   module is mounted without a role gate — every role has notifications —
|   and why the user filter is the real access control here.
|
|   Marking as read is likewise scoped to the caller, so one user cannot
|   clear another's queue.
|
*/

const pool = require("../../database/pool");

const asyncHandler = require("../../utils/asyncHandler");

const {
  requireCompanyId,
  getUserId,
  requireParamId,
  sendNotFound,
} = require("../../utils/requestContext");

/*
|--------------------------------------------------------------------------
| Notifications
|--------------------------------------------------------------------------
|
| The notifications table existed with nothing writing to or reading from
| it, while the frontend already renders a NotificationCenter component.
|
| Notifications are per-user within a company. The read endpoints scope to
| the caller so one user cannot read another's queue, even inside the same
| company.
|
*/

/*
|--------------------------------------------------------------------------
| GET /api/notifications
|--------------------------------------------------------------------------
*/
exports.list = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const conditions = [
      "company_id = $1",
      "user_id = $2",
    ];

    const values = [
      companyId,
      getUserId(req),
    ];

    if (
      req.query.unread === "true"
    ) {
      conditions.push(
        "is_read = FALSE"
      );
    }

    const limit = Math.min(
      Number(req.query.limit) || 50,
      200
    );

    values.push(limit);

    const result = await pool.query(
      `
      SELECT
        id, title, message, notification_type,
        link, metadata, is_read, read_at, created_at
      FROM notifications
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${values.length}
      `,
      values
    );

    const unread = await pool.query(
      `
      SELECT COUNT(*)::INT AS unread_count
      FROM notifications
      WHERE company_id = $1 AND user_id = $2 AND is_read = FALSE
      `,
      [companyId, getUserId(req)]
    );

    return res.status(200).json({
      success: true,
      notifications: result.rows,
      unread_count:
        unread.rows[0].unread_count,
    });
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/notifications/:id/read
|--------------------------------------------------------------------------
*/
exports.markRead = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const id = requireParamId(
      req,
      res,
      "id",
      "notification"
    );

    if (!id) return;

    const result = await pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE, read_at = NOW()
      WHERE id = $1 AND company_id = $2 AND user_id = $3
      RETURNING id
      `,
      [id, companyId, getUserId(req)]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Notification"
      );
    }

    return res.status(200).json({
      success: true,
    });
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/notifications/read-all
|--------------------------------------------------------------------------
*/
exports.markAllRead = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const result = await pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE, read_at = NOW()
      WHERE company_id = $1 AND user_id = $2 AND is_read = FALSE
      `,
      [companyId, getUserId(req)]
    );

    return res.status(200).json({
      success: true,
      marked: result.rowCount,
    });
  }
);
