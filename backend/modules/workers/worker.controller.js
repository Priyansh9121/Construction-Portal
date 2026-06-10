const pool = require("../../database/pool");

exports.getWorkers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM workers
       WHERE is_deleted = FALSE
       ORDER BY id DESC`
    );

    res.status(200).json({
      success: true,
      workers: result.rows,
    });
  } catch (error) {
    console.error("Get workers error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.createWorker = async (req, res) => {
  try {
    const {
      company_id = null,
      full_name,
      phone,
      salary,
      role,
      status,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO workers
       (company_id, full_name, phone, salary, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [company_id, full_name, phone, salary, role, status]
    );

    res.status(201).json({
      success: true,
      worker: result.rows[0],
    });
  } catch (error) {
    console.error("Create worker error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.deleteWorker = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBy = req.user?.id || null;

    const result = await pool.query(
      `UPDATE workers
       SET is_deleted = TRUE,
           deleted_at = NOW(),
           deleted_by = $2
       WHERE id = $1
       RETURNING *`,
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

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};