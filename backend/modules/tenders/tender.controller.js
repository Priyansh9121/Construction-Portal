const pool = require("../../database/pool")

exports.getTenders = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM tenders ORDER BY id DESC");

    res.status(200).json({
      success: true,
      tenders: result.rows,
    });
  } catch (error) {
    console.error("Get tenders error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.createTender = async (req, res) => {
  try {
    const { company_id, site_id, title, status, due_date, description } =
      req.body;

    const result = await pool.query(
      `INSERT INTO tenders 
       (company_id, site_id, title, status, due_date, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [company_id, site_id, title, status, due_date, description]
    );

    res.status(201).json({
      success: true,
      tender: result.rows[0],
    });
  } catch (error) {
    console.error("Create tender error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.deleteTender = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM tenders WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tender not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Tender deleted successfully",
    });
  } catch (error) {
    console.error("Delete tender error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};