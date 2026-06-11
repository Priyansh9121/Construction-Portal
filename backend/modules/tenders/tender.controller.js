const pool = require("../../database/pool");

exports.getTenders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM tenders
       WHERE is_deleted = FALSE
       ORDER BY id DESC`
    );

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
    const {
      company_id = null,
      site_id = null,
      title,
      status,
      due_date,
      description,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO tenders
       (company_id, site_id, title, status, due_date, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        company_id,
        site_id,
        title,
        status,
        due_date,
        description,
      ]
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

    const deletedBy = req.user?.id || null;

    const result = await pool.query(
      `UPDATE tenders
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

exports.updateTender = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      status,
      due_date,
      description,
      site_id,
    } = req.body;

    const result = await pool.query(
      `UPDATE tenders
       SET title = $1,
           status = $2,
           due_date = $3,
           description = $4,
           site_id = $5
       WHERE id = $6
       AND is_deleted = FALSE
       RETURNING *`,
      [
        title,
        status,
        due_date,
        description,
        site_id || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tender not found",
      });
    }

    res.status(200).json({
      success: true,
      tender: result.rows[0],
    });
  } catch (error) {
    console.error("Update tender error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};