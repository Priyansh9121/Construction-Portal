/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The READ side of the audit trail. Writing is utils/activityLog.js,
| attached as middleware to the mutating routes.
|
| Responsibilities:
|   - List activity_logs rows for the caller's company
|   - Apply the allow-listed filters (module, action, user, date range)
|   - Join user names so the trail reads as people rather than ids
|
| Exports:
|   getActivity (and any siblings listed at the foot of the file)
|
| Used by:
|   ./activity.routes.js, mounted by server.js at /api/activity
|
| Depends on:
|   database/pool.js, utils/asyncHandler.js, utils/requestContext.js
|
| Database tables touched:
|   activity_logs  SELECT
|   users          joined for the actor's name
|
| Frontend consumers:
|   frontend/src/pages/ActivityPage.jsx
|
| Security:
|   Scoped to the caller's company, so one tenant cannot read another's
|   history. This is an office view — the admin restriction is applied on
|   the route, not here.
|
|   The rows themselves were redacted on the way IN by activityLog.js, so
|   this endpoint cannot expose a password hash or an account number even
|   if one were somehow written. See F-12.
|
| Note:
|   old_data is empty for creates and updates, because logActivity can only
|   observe the response. The Activity page column is labelled "Details"
|   rather than "Change" to avoid overclaiming. See F-05.
|
*/

const pool = require("../../database/pool");

const asyncHandler = require("../../utils/asyncHandler");

const {
  requireCompanyId,
} = require("../../utils/requestContext");

/*
|--------------------------------------------------------------------------
| Activity log
|--------------------------------------------------------------------------
|
| The read side of the audit trail. Writing is handled by
| utils/activityLog.js, which is attached to the mutating routes.
|
| This is an office view: it exposes who did what across the whole company,
| so the role check lives on the route.
|
*/

const FILTERS = [
  ["module", "a.module"],
  ["action", "a.action"],
  ["user_id", "a.user_id"],
  ["record_id", "a.record_id"],
];

/*
|--------------------------------------------------------------------------
| GET /api/activity
|--------------------------------------------------------------------------
*/
exports.list = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const conditions = [
      "a.company_id = $1",
    ];

    const values = [companyId];

    FILTERS.forEach(
      ([key, column]) => {
        if (!req.query[key]) return;

        values.push(req.query[key]);

        conditions.push(
          `${column} = $${values.length}`
        );
      }
    );

    const limit = Math.min(
      Number(req.query.limit) || 100,
      500
    );

    const offset = Math.max(
      Number(req.query.offset) || 0,
      0
    );

    values.push(limit, offset);

    const result = await pool.query(
      `
      SELECT
        a.id,
        a.action,
        a.module,
        a.record_id,
        a.entity_type,
        a.old_data,
        a.new_data,
        a.ip_address,
        a.created_at,
        a.user_id,
        u.full_name AS user_name,
        u.email     AS user_email,
        COUNT(*) OVER () AS total_count
      FROM activity_logs a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
      `,
      values
    );

    return res.status(200).json({
      success: true,
      activity: result.rows,
      pagination: {
        limit,
        offset,
        total: Number(
          result.rows[0]
            ?.total_count || 0
        ),
      },
    });
  }
);
