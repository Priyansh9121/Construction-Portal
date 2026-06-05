const pool = require("../../database/pool")
const asyncHandler = require("../../utils/asyncHandler");

exports.getPayments = asyncHandler(async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM payments ORDER BY created_at DESC"
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
      company_id,
      payment_type,
      category,
      amount,
      description,
      payment_date,
      created_by,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO payments 
       (company_id, payment_type, category, amount, description, payment_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        company_id,
        payment_type,
        category,
        amount,
        description,
        payment_date,
        created_by,
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
      message: "Server error",
    });
  }
};

exports.deletePayment = async (req, res) => {
    try {
      const { id } = req.params;
  
      const result = await pool.query(
        "DELETE FROM payments WHERE id = $1 RETURNING *",
        [id]
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