const pool = require("../../database/pool");

exports.getPendingApprovals = async (req, res) => {
  try {
    const { status = "pending" } = req.query;

    const allowedStatuses = ["pending", "approved", "rejected", "all"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid approval status.",
      });
    }

    const statusFilter = status === "all" ? "" : "WHERE dua.status = $1";
    const values = status === "all" ? [] : [status];

    const result = await pool.query(
      `
      SELECT
        dua.id,
        dua.worker_id,
        dua.site_id,
        dua.tender_id,
        dua.log_date,
        dua.notes,
        dua.photo_url,
        dua.reason,
        dua.status,
        dua.admin_comment,
        dua.requested_at,
        dua.approved_by,
        dua.approved_at,
        dua.rejected_by,
        dua.rejected_at,

        w.full_name AS worker_name,
        s.site_name,
        t.title AS tender_title
      FROM daily_update_approvals dua
      LEFT JOIN workers w ON w.id = dua.worker_id
      LEFT JOIN sites s ON s.id = dua.site_id
      LEFT JOIN tenders t ON t.id = dua.tender_id
      ${statusFilter}
      ORDER BY dua.requested_at DESC
      `,
      values
    );

    res.json({
      success: true,
      approvals: result.rows,
    });
  } catch (error) {
    console.error("Get approvals error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.approveDailyUpdate = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { admin_comment } = req.body;
    const adminId = req.user?.id || null;

    await client.query("BEGIN");

    const approvalResult = await client.query(
      `
      SELECT *
      FROM daily_update_approvals
      WHERE id = $1
      AND status = 'pending'
      FOR UPDATE
      `,
      [id]
    );

    if (approvalResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Pending approval not found.",
      });
    }

    const approval = approvalResult.rows[0];

    const insertResult = await client.query(
      `
      INSERT INTO daily_site_logs
      (
        site_id,
        tender_id,
        worker_id,
        log_date,
        notes,
        photo_url,
        created_by
      )
      VALUES
      ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        approval.site_id,
        approval.tender_id,
        approval.worker_id,
        approval.log_date,
        approval.notes || "",
        approval.photo_url || null,
        adminId,
      ]
    );

    const updateResult = await client.query(
      `
      UPDATE daily_update_approvals
      SET status = 'approved',
          approved_by = $2,
          approved_at = NOW(),
          admin_comment = $3
      WHERE id = $1
      RETURNING *
      `,
      [id, adminId, admin_comment || ""]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Daily update approved.",
      approval: updateResult.rows[0],
      update: insertResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Approve daily update error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  } finally {
    client.release();
  }
};

exports.rejectDailyUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_comment } = req.body;
    const adminId = req.user?.id || null;

    const result = await pool.query(
      `
      UPDATE daily_update_approvals
      SET status = 'rejected',
          rejected_by = $2,
          rejected_at = NOW(),
          admin_comment = $3
      WHERE id = $1
      AND status = 'pending'
      RETURNING *
      `,
      [id, adminId, admin_comment || ""]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pending approval not found.",
      });
    }

    res.json({
      success: true,
      message: "Daily update rejected.",
      approval: result.rows[0],
    });
  } catch (error) {
    console.error("Reject daily update error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};