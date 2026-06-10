const pool = require("../../database/pool");

exports.getSubcontractors = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM subcontractors
       WHERE is_deleted = FALSE
       ORDER BY id DESC`
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
    } = req.body;

    const result = await pool.query(
      `INSERT INTO subcontractors
       (company_id, full_name, phone, email, business_name, gst_number, bank_name, account_name, account_number, ifsc_code, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        company_id,
        full_name,
        phone,
        email,
        business_name,
        gst_number,
        bank_name,
        account_name,
        account_number,
        ifsc_code,
        status || "active",
      ]
    );

    res.status(201).json({
      success: true,
      subcontractor: result.rows[0],
    });
  } catch (error) {
    console.error("Create subcontractor error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteSubcontractor = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBy = req.user?.id || null;

    const result = await pool.query(
      `UPDATE subcontractors
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
        message: "Subcontractor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Subcontractor deleted successfully",
    });
  } catch (error) {
    console.error("Delete subcontractor error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};