const pool = require("../../database/pool");
const asyncHandler = require("../../utils/asyncHandler");

exports.getPayments = asyncHandler(async (req, res) => {
  try {
    const {
      tender_id,
      site_id,
      payment_type,
      payment_scope,
      payment_sub_type,
    } = req.query;

    const conditions = ["is_deleted = FALSE"];
    const values = [];

    if (tender_id) {
      values.push(tender_id);
      conditions.push(`tender_id = $${values.length}`);
    }

    if (site_id) {
      values.push(site_id);
      conditions.push(`site_id = $${values.length}`);
    }

    if (payment_type) {
      values.push(payment_type);
      conditions.push(`payment_type = $${values.length}`);
    }

    if (payment_scope) {
      values.push(payment_scope);
      conditions.push(`payment_scope = $${values.length}`);
    }

    if (payment_sub_type) {
      values.push(payment_sub_type);
      conditions.push(`payment_sub_type = $${values.length}`);
    }

    const result = await pool.query(
      `
      SELECT *
      FROM payments
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      `,
      values
    );

    res.status(200).json({
      success: true,
      payments: result.rows,
    });
  } catch (error) {
    console.error("Get payments error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

exports.createPayment = async (req, res) => {
  try {
    const {
      company_id = null,
      payment_type,
      category,
      amount,
      description,
      payment_date,

      payment_scope,
      payment_sub_type,

      tender_id,
      site_id,

      material_name,
      quantity,

      gst_amount,
      collected_gst,

      payment_mode,
      details,

      worker_name,

      investor_name,
      interest_percent,
      fd_site,
    } = req.body;

    const created_by = req.user?.id || null;

    const result = await pool.query(
      `
      INSERT INTO payments
      (
        company_id,
        payment_type,
        category,
        amount,
        description,
        payment_date,
        created_by,

        payment_scope,
        payment_sub_type,

        tender_id,
        site_id,

        material_name,
        quantity,

        gst_amount,
        collected_gst,

        payment_mode,
        details,

        worker_name,

        investor_name,
        interest_percent,
        fd_site
      )
      VALUES
      (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9,
        $10, $11,
        $12, $13,
        $14, $15,
        $16, $17,
        $18,
        $19, $20, $21
      )
      RETURNING *
      `,
      [
        company_id,
        payment_type,
        category,
        amount,
        description,
        payment_date,
        created_by,

        payment_scope || null,
        payment_sub_type || null,

        tender_id || null,
        site_id || null,

        material_name || null,
        quantity || 0,

        gst_amount || 0,
        collected_gst || 0,

        payment_mode || null,
        details || null,

        worker_name || null,

        investor_name || null,
        interest_percent || 0,
        fd_site || null,
      ]
    );

    res.status(201).json({
      success: true,
      payment: result.rows[0],
    });
  } catch (error) {
    console.error("Create payment error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      payment_type,
      category,
      amount,
      payment_date,
      description,

      payment_scope,
      payment_sub_type,

      tender_id,
      site_id,

      material_name,
      quantity,

      gst_amount,
      collected_gst,

      payment_mode,
      details,

      worker_name,

      investor_name,
      interest_percent,
      fd_site,
    } = req.body;

    const result = await pool.query(
      `
      UPDATE payments
      SET
        payment_type = $1,
        category = $2,
        amount = $3,
        payment_date = $4,
        description = $5,

        payment_scope = $6,
        payment_sub_type = $7,

        tender_id = $8,
        site_id = $9,

        material_name = $10,
        quantity = $11,

        gst_amount = $12,
        collected_gst = $13,

        payment_mode = $14,
        details = $15,

        worker_name = $16,

        investor_name = $17,
        interest_percent = $18,
        fd_site = $19
      WHERE id = $20
      AND is_deleted = FALSE
      RETURNING *
      `,
      [
        payment_type,
        category,
        amount,
        payment_date,
        description,

        payment_scope || null,
        payment_sub_type || null,

        tender_id || null,
        site_id || null,

        material_name || null,
        quantity || 0,

        gst_amount || 0,
        collected_gst || 0,

        payment_mode || null,
        details || null,

        worker_name || null,

        investor_name || null,
        interest_percent || 0,
        fd_site || null,

        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.status(200).json({
      success: true,
      payment: result.rows[0],
    });
  } catch (error) {
    console.error("Update payment error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBy = req.user?.id || null;

    const result = await pool.query(
      `UPDATE payments
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
        message: "Payment not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment deleted successfully",
    });
  } catch (error) {
    console.error("Delete payment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};