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
    const { tender_id, worker_id, notes, status } = req.body;

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
        message: "Worker is already assigned to this tender",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO tender_workers
      (tender_id, worker_id, assigned_by, notes, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        tender_id,
        worker_id,
        req.user?.id || null,
        notes || "",
        status || "active",
      ]
    );

    res.status(201).json({
      success: true,
      assignedWorker: result.rows[0],
    });
  } catch (error) {
    console.error("Assign tender worker error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeTenderWorker = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `
      UPDATE tender_workers
      SET is_deleted = TRUE,
          deleted_at = NOW(),
          deleted_by = $2
      WHERE id = $1
      `,
      [id, req.user?.id || null]
    );

    res.status(200).json({
      success: true,
      message: "Worker removed from tender",
    });
  } catch (error) {
    console.error("Remove tender worker error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};