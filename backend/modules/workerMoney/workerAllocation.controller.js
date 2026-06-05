const pool = require("../../database/pool")

exports.getAllocations = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        wa.id,
        wa.worker_id,
        w.full_name AS worker_name,
        wa.allocated_amount,
        wa.purpose,
        wa.allocated_by,
        wa.created_at
      FROM worker_allocations wa
      LEFT JOIN workers w ON wa.worker_id = w.id
      ORDER BY wa.id DESC
    `);

    res.status(200).json({
      success: true,
      allocations: result.rows,
    });
  } catch (error) {
    console.error("Get allocations error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.createAllocation = async (req, res) => {
  try {
    const { worker_id, allocated_amount, purpose, allocated_by } = req.body;

    const result = await pool.query(
      `INSERT INTO worker_allocations
       (worker_id, allocated_amount, purpose, allocated_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [worker_id, allocated_amount, purpose, allocated_by]
    );

    res.status(201).json({
      success: true,
      allocation: result.rows[0],
    });
  } catch (error) {
    console.error("Create allocation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.deleteAllocation = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM worker_allocations WHERE id = $1 RETURNING *",
      [id]
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
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};