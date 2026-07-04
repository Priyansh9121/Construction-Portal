const pool = require("../../database/pool");

exports.getWorkers = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM workers
      WHERE COALESCE(is_deleted, FALSE) = FALSE
      ORDER BY id DESC
      `
    );

    res.status(200).json({
      success: true,
      workers: result.rows,
    });
  } catch (error) {
    console.error("Get workers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createWorker = async (req, res) => {
  try {
    const {
      company_id = null,
      user_id = null,
      full_name,
      phone,
      salary,
      role,
      status = "active",
    } = req.body;

    if (!full_name || !phone || !salary || !role) {
      return res.status(400).json({
        success: false,
        message: "Worker name, phone, salary and role are required.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO workers
      (company_id, user_id, full_name, phone, salary, role, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        company_id,
        user_id || null,
        full_name,
        phone,
        Number(salary || 0),
        role,
        status,
        req.user?.id || null,
      ]
    );

    res.status(201).json({
      success: true,
      worker: result.rows[0],
    });
  } catch (error) {
    console.error("Create worker error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

exports.updateWorker = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      user_id = null,
      full_name,
      phone,
      salary,
      role,
      status = "active",
    } = req.body;

    if (!full_name || !phone || !salary || !role) {
      return res.status(400).json({
        success: false,
        message: "Worker name, phone, salary and role are required.",
      });
    }

    const result = await pool.query(
      `
      UPDATE workers
      SET user_id = $1,
          full_name = $2,
          phone = $3,
          salary = $4,
          role = $5,
          status = $6,
          updated_at = NOW()
      WHERE id = $7
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [
        user_id || null,
        full_name,
        phone,
        Number(salary || 0),
        role,
        status,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    res.status(200).json({
      success: true,
      worker: result.rows[0],
    });
  } catch (error) {
    console.error("Update worker error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

exports.deleteWorker = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBy = req.user?.id || null;

    const result = await pool.query(
      `
      UPDATE workers
      SET is_deleted = TRUE,
          deleted_at = NOW(),
          deleted_by = $2,
          updated_at = NOW()
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [id, deletedBy]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Worker deleted successfully",
    });
  } catch (error) {
    console.error("Delete worker error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};