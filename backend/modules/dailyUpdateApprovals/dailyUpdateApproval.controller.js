/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The office's approval queue for daily site updates submitted by workers
| and supervisors through the worker portal.
|
| The two ways a daily update reaches the system are deliberately
| different:
|
|   /api/worker-portal      a worker submits; it lands here for approval
|   /api/site-logs          the office records directly; no approval
|
| So this module is the control on updates the office did not write
| itself.
|
| Responsibilities:
|   - List pending and decided updates for the caller's company
|   - Approve or reject an update, recording who decided and when
|   - Notify the submitter of the outcome
|
| Exports:
|   see module.exports at the foot of the file
|
| Used by:
|   ./dailyUpdateApproval.routes.js, mounted at
|   /api/daily-update-approvals
|
| Depends on:
|   database/pool.js, utils/asyncHandler.js, utils/requestContext.js
|   modules/notifications/notification.service.js
|
| Database tables touched:
|   daily_site_logs  SELECT, UPDATE (approval state)
|   sites, workers, tenders  joined for display names
|   notifications    INSERT, via the notification service
|
| API surface:
|   Office-only. server.js gates the mount on admin and manager, spelled
|   out inline there rather than reusing requireOffice — see the note in
|   server.js for why.
|
| Frontend consumers:
|   dailyUpdateApprovalService.js -> DailyUpdateApprovalsPage.jsx
|
| Audited:
|   Yes — logActivity is attached in the route file. Approvals are exactly
|   the kind of decision the audit trail exists to record.
|
| Security:
|   Every statement is company-scoped. The role gate is what enforces the
|   separation that gives approval its meaning: the person who submitted an
|   update cannot be the person who approves it, because submitting happens
|   in the worker portal and approving happens here.
|
*/

const pool = require("../../database/pool");

const asyncHandler = require("../../utils/asyncHandler");

const {
  requireCompanyId,
  getUserId,
  requireParamId,
  sendNotFound,
  cleanText,
} = require("../../utils/requestContext");

const {
  APPROVAL_STATUS,
} = require("../../config/constants");

/*
|--------------------------------------------------------------------------
| Tenant scoping
|--------------------------------------------------------------------------
|
| Every statement filters on company_id.
|
| Previously approveDailyUpdate selected the pending row by id alone. Because
| approval copies the record into daily_site_logs, an admin of one company
| could approve another company's submission and thereby write a row into
| that company's site history. The company filter is now part of the locking
| SELECT, so a mismatched row is simply not found.
|
*/

const ALLOWED_LIST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "all",
];

/*
|--------------------------------------------------------------------------
| GET /api/daily-update-approvals
|--------------------------------------------------------------------------
*/
exports.getPendingApprovals =
  asyncHandler(async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const {
      status = "pending",
    } = req.query;

    if (
      !ALLOWED_LIST_STATUSES.includes(
        status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid approval status.",
      });
    }

    const conditions = [
      "dua.company_id = $1",
      "COALESCE(dua.is_deleted, FALSE) = FALSE",
    ];

    const values = [companyId];

    if (status !== "all") {
      values.push(status);

      conditions.push(
        `dua.status = $${values.length}`
      );
    }

    const limit = Math.min(
      Number(req.query.limit) ||
        100,
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
        dua.id,
        dua.worker_id,
        dua.subcontractor_id,
        dua.site_id,
        dua.tender_id,
        dua.log_date,
        dua.notes,
        dua.photo_url,
        dua.photo_source,
        dua.photo_captured_at,
        dua.reason,
        dua.status,
        dua.admin_comment,
        dua.requested_at,
        dua.approved_by,
        dua.approved_at,
        dua.rejected_by,
        dua.rejected_at,

        w.full_name  AS worker_name,
        sc.full_name AS subcontractor_name,
        s.site_name,
        t.title      AS tender_title,

        COUNT(*) OVER () AS total_count
      FROM daily_update_approvals dua
      LEFT JOIN workers w
        ON w.id = dua.worker_id
       AND w.company_id = dua.company_id
      LEFT JOIN subcontractors sc
        ON sc.id = dua.subcontractor_id
       AND sc.company_id = dua.company_id
      LEFT JOIN sites s
        ON s.id = dua.site_id
       AND s.company_id = dua.company_id
      LEFT JOIN tenders t
        ON t.id = dua.tender_id
       AND t.company_id = dua.company_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY dua.requested_at DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
      `,
      values
    );

    return res.json({
      success: true,
      approvals: result.rows,
      pagination: {
        limit,
        offset,
        total: Number(
          result.rows[0]
            ?.total_count || 0
        ),
      },
    });
  });

/*
|--------------------------------------------------------------------------
| POST /api/daily-update-approvals/:id/approve
|--------------------------------------------------------------------------
|
| Runs in a transaction: the pending row is locked, copied into
| daily_site_logs, and marked approved. Either all three happen or none do.
|
*/
exports.approveDailyUpdate =
  asyncHandler(async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const approvalId =
      requireParamId(
        req,
        res,
        "id",
        "approval"
      );

    if (!approvalId) {
      return;
    }

    const adminId = getUserId(req);

    const adminComment = cleanText(
      req.body.admin_comment
    );

    const client =
      await pool.connect();

    try {
      await client.query("BEGIN");

      // The company filter is inside the locking SELECT, so another
      // company's row is never even locked.
      const approvalResult =
        await client.query(
          `
          SELECT *
          FROM daily_update_approvals
          WHERE id = $1
            AND company_id = $2
            AND status = $3
            AND COALESCE(is_deleted, FALSE) = FALSE
          FOR UPDATE
          `,
          [
            approvalId,
            companyId,
            APPROVAL_STATUS.PENDING ||
              "pending",
          ]
        );

      if (
        approvalResult.rows
          .length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return sendNotFound(
          res,
          "Pending approval"
        );
      }

      const approval =
        approvalResult.rows[0];

      const insertResult =
        await client.query(
          `
          INSERT INTO daily_site_logs
          (
            company_id,
            site_id,
            tender_id,
            worker_id,
            subcontractor_id,
            log_date,
            notes,
            photo_url,
            created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
          `,
          [
            companyId,
            approval.site_id,
            approval.tender_id,
            approval.worker_id ||
              null,
            approval.subcontractor_id ||
              null,
            approval.log_date,
            approval.notes || "",
            approval.photo_url ||
              null,
            adminId,
          ]
        );

      const updateResult =
        await client.query(
          `
          UPDATE daily_update_approvals
          SET status = 'approved',
              approved_by = $2,
              approved_at = NOW(),
              reviewed_by = $2,
              reviewed_at = NOW(),
              admin_comment = $3,
              approved_log_id = $4,
              updated_at = NOW()
          WHERE id = $1
            AND company_id = $5
          RETURNING *
          `,
          [
            approvalId,
            adminId,
            adminComment,
            insertResult.rows[0].id,
            companyId,
          ]
        );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message:
          "Daily update approved.",
        approval:
          updateResult.rows[0],
        update:
          insertResult.rows[0],
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (rollbackError) {
        console.error(
          "Rollback failed while approving daily update:",
          rollbackError.message
        );
      }

      // Forward to the central error handler rather than leaking
      // error.message to the client.
      throw error;
    } finally {
      client.release();
    }
  });

/*
|--------------------------------------------------------------------------
| POST /api/daily-update-approvals/:id/reject
|--------------------------------------------------------------------------
*/
exports.rejectDailyUpdate =
  asyncHandler(async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const approvalId =
      requireParamId(
        req,
        res,
        "id",
        "approval"
      );

    if (!approvalId) {
      return;
    }

    const result = await pool.query(
      `
      UPDATE daily_update_approvals
      SET status = 'rejected',
          rejected_by = $2,
          rejected_at = NOW(),
          reviewed_by = $2,
          reviewed_at = NOW(),
          admin_comment = $3,
          updated_at = NOW()
      WHERE id = $1
        AND company_id = $4
        AND status = 'pending'
        AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [
        approvalId,
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
        "Pending approval"
      );
    }

    return res.json({
      success: true,
      message:
        "Daily update rejected.",
      approval: result.rows[0],
    });
  });
