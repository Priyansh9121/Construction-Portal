const pool = require("../../database/pool")

exports.getInvoices = async (req, res) => {
  try {
    const search = req.query.search || "";

    const result = await pool.query(
      `
      SELECT *
      FROM invoices
      WHERE is_deleted = FALSE
      AND (
        invoice_number ILIKE $1
        OR status ILIKE $1
      )
      ORDER BY created_at DESC
      `,
      [`%${search}%`]
    );

    res.status(200).json({
      success: true,
      invoices: result.rows,
    });
  } catch (error) {
    console.error("Get invoices error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.createInvoice = async (req, res) => {
  try {
    const {
      company_id,
      tender_id,
      invoice_number,
      amount,
      status,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO invoices
      (company_id, tender_id, invoice_number, amount, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        company_id,
        tender_id,
        invoice_number,
        amount,
        status,
      ]
    );

    res.status(201).json({
      success: true,
      invoice: result.rows[0],
    });
  } catch (error) {
    console.error("Create invoice error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBy = req.user?.id || null;

    const result = await pool.query(
      `UPDATE invoices
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
        message: "Invoice not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error) {
    console.error("Delete invoice error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const { invoice_number, amount, status } = req.body;

    const result = await pool.query(
      `UPDATE invoices
       SET invoice_number = $1,
           amount = $2,
           status = $3
       WHERE id = $4
       AND is_deleted = FALSE
       RETURNING *`,
      [invoice_number, amount, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.status(200).json({
      success: true,
      invoice: result.rows[0],
    });
  } catch (error) {
    console.error("Update invoice error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};