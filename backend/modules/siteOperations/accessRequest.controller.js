const pool = require("../../database/pool");

const asyncHandler = require("../../utils/asyncHandler");

const {
  requireCompanyId,
  getUserId,
  getUserRole,
  requireParamId,
  sendNotFound,
  cleanText,
} = require("../../utils/requestContext");

const {
  MODULES,
  daysAgo,
} = require("./entryWindow.service");

const {
  notify,
  notifyRole,
  TYPES,
} = require("../notifications/notification.service");

/*
|--------------------------------------------------------------------------
| Backdated entry access requests
|--------------------------------------------------------------------------
|
| From the notebook (p.03 / p.04):
|
|   "To add a bill with a date older than 2 days you have to call the
|    company and take access."
|
| This turns that phone call into a tracked request: the supervisor asks for
| a specific date and module, an admin grants or denies it, and the grant is
| time-boxed and single-use. entryWindow.service consumes it when the entry
| it authorised is written.
|
*/

const VALID_MODULES = new Set(
  Object.values(MODULES)
);

/**
 * How long a grant stays usable once approved.
 *
 * Long enough for the supervisor to finish entering, short enough that a
 * forgotten grant does not become a standing exemption.
 */
const DEFAULT_GRANT_HOURS = 24;

const isReviewer = (req) =>
  ["admin", "manager"].includes(
    String(
      getUserRole(req) || ""
    ).toLowerCase()
  );

/*
|--------------------------------------------------------------------------
| GET /api/site-operations/access-requests
|--------------------------------------------------------------------------
*/
exports.getRequests = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const conditions = [
      "ar.company_id = $1",
    ];

    const values = [companyId];

    // Supervisors see only their own requests.
    if (!isReviewer(req)) {
      values.push(getUserId(req));

      conditions.push(
        `ar.requested_by = $${values.length}`
      );
    }

    if (req.query.status) {
      values.push(req.query.status);

      conditions.push(
        `ar.status = $${values.length}`
      );
    }

    if (req.query.module) {
      values.push(req.query.module);

      conditions.push(
        `ar.module = $${values.length}`
      );
    }

    const result = await pool.query(
      `
      SELECT
        ar.id,
        ar.module,
        ar.target_date,
        ar.reason,
        ar.status,
        ar.admin_comment,
        ar.expires_at,
        ar.used_at,
        ar.created_at,
        ar.reviewed_at,
        ar.requested_by,
        requester.full_name AS requested_by_name,
        ar.reviewed_by,
        reviewer.full_name  AS reviewed_by_name,
        ar.tender_id,
        t.title AS tender_title,
        -- Surfaced so the reviewer sees how stale the entry actually is.
        (CURRENT_DATE - ar.target_date) AS days_old
      FROM entry_access_requests ar
      LEFT JOIN users requester ON requester.id = ar.requested_by
      LEFT JOIN users reviewer  ON reviewer.id  = ar.reviewed_by
      LEFT JOIN tenders t
        ON t.id = ar.tender_id AND t.company_id = ar.company_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        CASE WHEN ar.status = 'pending' THEN 0 ELSE 1 END,
        ar.created_at DESC
      LIMIT 200
      `,
      values
    );

    return res.status(200).json({
      success: true,
      requests: result.rows,
    });
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/site-operations/access-requests
|--------------------------------------------------------------------------
*/
exports.createRequest = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const {
      module,
      target_date,
      reason,
      tender_id = null,
      site_id = null,
    } = req.body;

    if (!module || !target_date) {
      return res.status(400).json({
        success: false,
        message:
          "Module and target date are required.",
      });
    }

    if (!VALID_MODULES.has(module)) {
      return res.status(400).json({
        success: false,
        message: `Module must be one of: ${[
          ...VALID_MODULES,
        ].join(", ")}.`,
      });
    }

    const age = daysAgo(target_date);

    if (age === null || age < 0) {
      return res.status(400).json({
        success: false,
        message:
          "Access can only be requested for a past date.",
      });
    }

    // Collapse repeat requests for the same date rather than creating a
    // queue of duplicates for the reviewer to work through.
    const existing = await pool.query(
      `
      SELECT id, status
      FROM entry_access_requests
      WHERE company_id = $1
        AND requested_by = $2
        AND module = $3
        AND target_date = $4
        AND status IN ('pending', 'granted')
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
      `,
      [
        companyId,
        getUserId(req),
        module,
        target_date,
      ]
    );

    if (existing.rows.length > 0) {
      return res.status(200).json({
        success: true,
        message:
          existing.rows[0]
            .status === "granted"
            ? "Access has already been granted for this date."
            : "A request for this date is already awaiting review.",
        request: existing.rows[0],
        duplicate: true,
      });
    }

    const result = await pool.query(
      `
      INSERT INTO entry_access_requests
      (
        company_id, requested_by, tender_id, site_id,
        module, target_date, reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        companyId,
        getUserId(req),
        tender_id,
        site_id,
        module,
        target_date,
        cleanText(reason),
      ]
    );

    // Tell the office there is something to review. Not awaited — the
    // supervisor should not wait on a notification insert, and a failure
    // here must not fail their request.
    notifyRole({
      companyId,
      title: "Backdated entry access requested",
      message: `${
        req.user?.full_name ||
        "A supervisor"
      } is asking to record a ${module} entry for ${target_date} (${age} days old).`,
      type: TYPES.ACCESS_REQUEST,
      link: "/daily-update-approvals",
      metadata: {
        request_id:
          result.rows[0].id,
        module,
        target_date,
        days_old: age,
      },
    });

    return res.status(201).json({
      success: true,
      message:
        "Access request submitted. The office will review it.",
      request: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/site-operations/access-requests/:id/grant
|--------------------------------------------------------------------------
*/
exports.grantRequest = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const requestId = requireParamId(
      req,
      res,
      "id",
      "access request"
    );

    if (!requestId) return;

    const hours =
      Number(req.body.hours) ||
      DEFAULT_GRANT_HOURS;

    const result = await pool.query(
      `
      UPDATE entry_access_requests
      SET status = 'granted',
          reviewed_by = $2,
          reviewed_at = NOW(),
          admin_comment = $3,
          expires_at = NOW() + ($4 || ' hours')::INTERVAL,
          updated_at = NOW()
      WHERE id = $1
        AND company_id = $5
        AND status = 'pending'
      RETURNING *
      `,
      [
        requestId,
        getUserId(req),
        cleanText(
          req.body.admin_comment
        ),
        String(
          Math.min(
            Math.max(hours, 1),
            168
          )
        ),
        companyId,
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Pending access request"
      );
    }

    const granted = result.rows[0];

    // Tell the requester they can now enter the record.
    notify({
      companyId,
      userId: granted.requested_by,
      title: "Access granted",
      message: `You can now record your ${granted.module} entry for ${granted.target_date}. This access expires shortly, so enter it now.`,
      type: TYPES.ACCESS_GRANTED,
      metadata: {
        request_id: granted.id,
        module: granted.module,
        target_date:
          granted.target_date,
        expires_at:
          granted.expires_at,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Access granted until ${new Date(
        granted.expires_at
      ).toLocaleString()}.`,
      request: granted,
    });
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/site-operations/access-requests/:id/deny
|--------------------------------------------------------------------------
*/
exports.denyRequest = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const requestId = requireParamId(
      req,
      res,
      "id",
      "access request"
    );

    if (!requestId) return;

    const result = await pool.query(
      `
      UPDATE entry_access_requests
      SET status = 'denied',
          reviewed_by = $2,
          reviewed_at = NOW(),
          admin_comment = $3,
          updated_at = NOW()
      WHERE id = $1
        AND company_id = $4
        AND status = 'pending'
      RETURNING *
      `,
      [
        requestId,
        getUserId(req),
        cleanText(
          req.body.admin_comment
        ),
        companyId,
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Pending access request"
      );
    }

    return res.status(200).json({
      success: true,
      message: "Access request denied.",
      request: result.rows[0],
    });
  }
);
