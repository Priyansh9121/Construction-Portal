const pool = require("../../database/pool");

exports.getSites = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM sites
      WHERE COALESCE(is_deleted, FALSE) = FALSE
      ORDER BY id DESC
      `
    );

    res.status(200).json({
      success: true,
      sites: result.rows,
    });
  } catch (error) {
    console.error("Get sites error:", error);
    res.status(500).json({ success: false, message: "Server error" });
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
      AND COALESCE(is_deleted, FALSE) = FALSE
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
      AND COALESCE(is_deleted, FALSE) = FALSE
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
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createSite = async (req, res) => {
  try {
    const {
      company_id = null,
      site_type,
      site_name,
      address,
      status = "active",
    } = req.body;

    if (!site_type || !site_name || !address) {
      return res.status(400).json({
        success: false,
        message: "Site type, site name and address are required.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO sites
      (company_id, site_type, site_name, address, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        company_id,
        site_type,
        site_name,
        address,
        status,
        req.user?.id || null,
      ]
    );

    res.status(201).json({
      success: true,
      site: result.rows[0],
    });
  } catch (error) {
    console.error("Create site error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

exports.updateSite = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      site_type,
      site_name,
      address,
      status = "active",
    } = req.body;

    if (!site_type || !site_name || !address) {
      return res.status(400).json({
        success: false,
        message: "Site type, site name and address are required.",
      });
    }

    const result = await pool.query(
      `
      UPDATE sites
      SET site_type = $1,
          site_name = $2,
          address = $3,
          status = $4,
          updated_at = NOW()
      WHERE id = $5
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [site_type, site_name, address, status, id]
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
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

exports.deleteSite = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBy = req.user?.id || null;

    const result = await pool.query(
      `
      UPDATE sites
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
        message: "Site not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Site deleted successfully",
    });
  } catch (error) {
    console.error("Delete site error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};