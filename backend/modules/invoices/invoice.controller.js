const pool = require("../../database/pool")

exports.getInvoices = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM invoices WHERE is_deleted = FALSE ORDER BY id DESC"
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