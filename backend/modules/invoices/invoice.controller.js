const pool = require("../../database/pool");

exports.getInvoices = async (req, res) => {
  try {
    const search = req.query.search || "";

    const result = await pool.query(
      `
      SELECT *
      FROM invoices
      WHERE COALESCE(is_deleted, FALSE) = FALSE
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
      company_id = null,
      tender_id = null,
      invoice_number,
      amount,
      status = "pending",
    } = req.body;

    if (!invoice_number || !amount) {
      return res.status(400).json({
        success: false,
        message: "Invoice number and amount are required.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO invoices
      (company_id, tender_id, invoice_number, amount, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        company_id,
        tender_id || null,
        invoice_number,
        Number(amount || 0),
        status,
        req.user?.id || null,
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
      message: error.message || "Server error",
    });
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBy = req.user?.id || null;

    const result = await pool.query(
      `
      UPDATE invoices
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

    if (!invoice_number || !amount) {
      return res.status(400).json({
        success: false,
        message: "Invoice number and amount are required.",
      });
    }

    const result = await pool.query(
      `
      UPDATE invoices
      SET invoice_number = $1,
          amount = $2,
          status = $3,
          updated_at = NOW()
      WHERE id = $4
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [invoice_number, Number(amount || 0), status || "pending", id]
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
      message: error.message || "Server error",
    });
  }
};