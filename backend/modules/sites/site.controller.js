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

exports.getSiteById = async (req, res) => {
  try {
    const { id } = req.params;

    const siteResult = await pool.query(
      `
      SELECT *
      FROM sites
      WHERE id = $1
      AND is_deleted = FALSE
      `,
      [id]
    );

    if (siteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Site not found",
      });
    }

    const tendersResult = await pool.query(
      `
      SELECT *
      FROM tenders
      WHERE site_id = $1
      AND is_deleted = FALSE
      ORDER BY id DESC
      `,
      [id]
    );

    res.status(200).json({
      success: true,
      site: siteResult.rows[0],
      tenders: tendersResult.rows,
    });
  } catch (error) {
    console.error("Get site by id error:", error);

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

exports.updateSite = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      site_type,
      site_name,
      address,
      status,
    } = req.body;

    const result = await pool.query(
      `UPDATE sites
       SET site_type = $1,
           site_name = $2,
           address = $3,
           status = $4
       WHERE id = $5
       AND is_deleted = FALSE
       RETURNING *`,
      [
        site_type,
        site_name,
        address,
        status,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Site not found",
      });
    }

    res.status(200).json({
      success: true,
      site: result.rows[0],
    });
  } catch (error) {
    console.error("Update site error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};