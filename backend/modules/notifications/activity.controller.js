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
