const pool = require("../../database/pool");

exports.getTenderWorkers = async (req, res) => {
  try {
    const { tenderId } = req.params;

    const result = await pool.query(
      `
      SELECT
        tw.id,
        tw.tender_id,
        tw.worker_id,
        tw.notes,
        tw.status,
        tw.created_at,
        w.full_name,
        w.phone,
        w.role
      FROM tender_workers tw
      INNER JOIN workers w ON w.id = tw.worker_id
      WHERE tw.tender_id = $1
      AND COALESCE(tw.is_deleted, FALSE) = FALSE
      AND COALESCE(w.is_deleted, FALSE) = FALSE
      ORDER BY tw.id DESC
      `,
      [tenderId]
    );

    res.status(200).json({
      success: true,
      workers: result.rows,
    });
  } catch (error) {
    console.error("Get tender workers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.assignWorkerToTender = async (req, res) => {
  try {
    const { tender_id, worker_id, notes, status = "active" } = req.body;

    if (!tender_id || !worker_id) {
      return res.status(400).json({
        success: false,
        message: "Tender and worker are required.",
      });
    }

    const tenderCheck = await pool.query(
      `
      SELECT id
      FROM tenders
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      `,
      [tender_id]
    );

    if (tenderCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tender not found.",
      });
    }

    const workerCheck = await pool.query(
      `
      SELECT id
      FROM workers
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      `,
      [worker_id]
    );

    if (workerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Worker not found.",
      });
    }

    const exists = await pool.query(
      `
      SELECT id
      FROM tender_workers
      WHERE tender_id = $1
      AND worker_id = $2
      AND COALESCE(is_deleted, FALSE) = FALSE
      `,
      [tender_id, worker_id]
    );

    if (exists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Worker is already assigned to this tender.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO tender_workers
      (tender_id, worker_id, assigned_by, notes, status, is_deleted)
      VALUES ($1, $2, $3, $4, $5, FALSE)
      RETURNING *
      `,
      [
        tender_id,
        worker_id,
        req.user?.id || null,
        notes || "",
        status,
      ]
    );

    res.status(201).json({
      success: true,
      assignedWorker: result.rows[0],
    });
  } catch (error) {
    console.error("Assign tender worker error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

exports.updateTenderWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, status = "active" } = req.body;

    const result = await pool.query(
      `
      UPDATE tender_workers
      SET notes = $1,
          status = $2,
          updated_at = NOW()
      WHERE id = $3
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [notes || "", status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tender worker assignment not found.",
      });
    }

    res.status(200).json({
      success: true,
      assignedWorker: result.rows[0],
    });
  } catch (error) {
    console.error("Update tender worker error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeTenderWorker = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE tender_workers
      SET is_deleted = TRUE,
          deleted_at = NOW(),
          deleted_by = $2,
          updated_at = NOW()
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [id, req.user?.id || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tender worker assignment not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Worker removed from tender",
    });
  } catch (error) {
    console.error("Remove tender worker error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};