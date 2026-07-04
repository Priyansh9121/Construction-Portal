const pool = require("../../database/pool");

exports.getAllocations = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        wa.id,
        wa.worker_id,
        w.full_name AS worker_name,
        wa.allocated_amount,
        wa.purpose,
        wa.approval_status,
        wa.admin_comment,
        wa.allocated_by,
        wa.approved_by,
        wa.approved_at,
        wa.created_at
      FROM worker_allocations wa
      LEFT JOIN workers w ON wa.worker_id = w.id
      WHERE COALESCE(wa.is_deleted, FALSE) = FALSE
      ORDER BY wa.id DESC
    `);

    res.status(200).json({
      success: true,
      allocations: result.rows,
    });
  } catch (error) {
    console.error("Get allocations error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createAllocation = async (req, res) => {
  try {
    const { worker_id, allocated_amount, purpose } = req.body;

    if (!worker_id || !allocated_amount) {
      return res.status(400).json({
        success: false,
        message: "Worker and allocated amount are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO worker_allocations
      (worker_id, allocated_amount, purpose, allocated_by, approval_status)
      VALUES ($1, $2, $3, $4, 'approved')
      RETURNING *
      `,
      [worker_id, allocated_amount, purpose || "", req.user?.id || null]
    );

    res.status(201).json({
      success: true,
      allocation: result.rows[0],
    });
  } catch (error) {
    console.error("Create allocation error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateAllocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { worker_id, allocated_amount, purpose } = req.body;

    const result = await pool.query(
      `
      UPDATE worker_allocations
      SET worker_id = $1,
          allocated_amount = $2,
          purpose = $3,
          updated_at = NOW()
      WHERE id = $4
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [worker_id, allocated_amount, purpose || "", id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Allocation not found",
      });
    }

    res.status(200).json({
      success: true,
      allocation: result.rows[0],
    });
  } catch (error) {
    console.error("Update allocation error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteAllocation = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE worker_allocations
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
        message: "Allocation not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Allocation deleted successfully",
    });
  } catch (error) {
    console.error("Delete allocation error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.approveAllocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_comment } = req.body;

    const result = await pool.query(
      `
      UPDATE worker_allocations
      SET approval_status = 'approved',
          admin_comment = $2,
          approved_by = $3,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [id, admin_comment || "", req.user?.id || null]
    );

    res.status(200).json({
      success: true,
      allocation: result.rows[0],
    });
  } catch (error) {
    console.error("Approve allocation error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.rejectAllocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_comment } = req.body;

    const result = await pool.query(
      `
      UPDATE worker_allocations
      SET approval_status = 'rejected',
          admin_comment = $2,
          approved_by = $3,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [id, admin_comment || "", req.user?.id || null]
    );

    res.status(200).json({
      success: true,
      allocation: result.rows[0],
    });
  } catch (error) {
    console.error("Reject allocation error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};