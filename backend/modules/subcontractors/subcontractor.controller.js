const pool = require("../../database/pool");

exports.getSubcontractors = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM subcontractors
      WHERE COALESCE(is_deleted, FALSE) = FALSE
      ORDER BY id DESC
      `
    );

    res.status(200).json({
      success: true,
      subcontractors: result.rows,
    });
  } catch (error) {
    console.error("Get subcontractors error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createSubcontractor = async (req, res) => {
  try {
    const {
      company_id = null,
      user_id = null,
      full_name,
      phone,
      email,
      business_name,
      gst_number,
      bank_name,
      account_name,
      account_number,
      ifsc_code,
      status = "active",
    } = req.body;

    if (!full_name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Subcontractor name and phone are required.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO subcontractors
      (
        company_id,
        user_id,
        full_name,
        phone,
        email,
        business_name,
        gst_number,
        bank_name,
        account_name,
        account_number,
        ifsc_code,
        status,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
      `,
      [
        company_id,
        user_id || null,
        full_name,
        phone,
        email || null,
        business_name || null,
        gst_number || null,
        bank_name || null,
        account_name || null,
        account_number || null,
        ifsc_code || null,
        status,
        req.user?.id || null,
      ]
    );

    res.status(201).json({
      success: true,
      subcontractor: result.rows[0],
    });
  } catch (error) {
    console.error("Create subcontractor error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

exports.updateSubcontractor = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      user_id = null,
      full_name,
      phone,
      email,
      business_name,
      gst_number,
      bank_name,
      account_name,
      account_number,
      ifsc_code,
      status = "active",
    } = req.body;

    if (!full_name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Subcontractor name and phone are required.",
      });
    }

    const result = await pool.query(
      `
      UPDATE subcontractors
      SET user_id = $1,
          full_name = $2,
          phone = $3,
          email = $4,
          business_name = $5,
          gst_number = $6,
          bank_name = $7,
          account_name = $8,
          account_number = $9,
          ifsc_code = $10,
          status = $11,
          updated_at = NOW()
      WHERE id = $12
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [
        user_id || null,
        full_name,
        phone,
        email || null,
        business_name || null,
        gst_number || null,
        bank_name || null,
        account_name || null,
        account_number || null,
        ifsc_code || null,
        status,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Subcontractor not found",
      });
    }

    res.status(200).json({
      success: true,
      subcontractor: result.rows[0],
    });
  } catch (error) {
    console.error("Update subcontractor error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

exports.deleteSubcontractor = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBy = req.user?.id || null;

    const result = await pool.query(
      `
      UPDATE subcontractors
      SET
        is_deleted = TRUE,
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
        message: "Subcontractor not found or already deleted",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Subcontractor deleted successfully",
      subcontractor: result.rows[0],
    });
  } catch (error) {
    console.error("Delete subcontractor error:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
    });

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to delete subcontractor"
          : error.message,
    });
  }
};