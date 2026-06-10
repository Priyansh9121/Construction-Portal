const pool = require("../../database/pool");

exports.getSites = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM sites
       WHERE is_deleted = FALSE
       ORDER BY id DESC`
    );

    res.status(200).json({
      success: true,
      sites: result.rows,
    });
  } catch (error) {
    console.error("Get sites error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.createSite = async (req, res) => {
  try {
    const {
      company_id = null,
      site_type,
      site_name,
      address,
      status,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO sites
       (company_id, site_type, site_name, address, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [company_id, site_type, site_name, address, status]
    );

    res.status(201).json({
      success: true,
      site: result.rows[0],
    });
  } catch (error) {
    console.error("Create site error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.deleteSite = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBy = req.user?.id || null;

    const result = await pool.query(
      `UPDATE sites
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
        message: "Site not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Site deleted successfully",
    });
  } catch (error) {
    console.error("Delete site error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};