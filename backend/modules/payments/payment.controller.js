const pool = require("../../database/pool");
const asyncHandler = require("../../utils/asyncHandler");

exports.getPayments = asyncHandler(async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM payments WHERE is_deleted = FALSE ORDER BY created_at DESC"
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
    } = req.body;

    const created_by = req.user?.id || null;

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

  exports.updatePayment = async (req, res) => {
    try {
      const { id } = req.params;
  
      const {
        payment_type,
        category,
        amount,
        payment_date,
        description,
      } = req.body;
  
      const result = await pool.query(
        `UPDATE payments
         SET payment_type = $1,
             category = $2,
             amount = $3,
             payment_date = $4,
             description = $5
         WHERE id = $6
         AND is_deleted = FALSE
         RETURNING *`,
        [
          payment_type,
          category,
          amount,
          payment_date,
          description,
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
        message: "Server error",
      });
    }
  };