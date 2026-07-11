const pool = require("../../database/pool");

exports.getExpenses = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        we.id,
        we.allocation_id,
        wa.worker_id,
        w.full_name AS worker_name,
        we.expense_amount,
        we.expense_description,
        we.expense_date,
        we.remaining_balance,
        we.uploaded_photo,
        we.approval_status,
        we.admin_comment,
        we.approved_by,
        we.approved_at,
        we.created_at
      FROM worker_expenses we
      LEFT JOIN worker_allocations wa ON we.allocation_id = wa.id
      LEFT JOIN workers w ON wa.worker_id = w.id
      WHERE COALESCE(we.is_deleted, FALSE) = FALSE
      ORDER BY we.id DESC
    `);

    res.status(200).json({
      success: true,
      expenses: result.rows,
    });
  } catch (error) {
    console.error("Get expenses error:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack,
    });
  
    res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to load worker expenses."
          : error.message,
    });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const {
      allocation_id,
      expense_amount,
      expense_description,
      expense_date,
      uploaded_photo,
    } = req.body;

    if (!allocation_id || !expense_amount || !expense_date) {
      return res.status(400).json({
        success: false,
        message: "Allocation, expense amount and date are required",
      });
    }

    const allocationResult = await pool.query(
      `
      SELECT allocated_amount
      FROM worker_allocations
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      `,
      [allocation_id]
    );

    if (allocationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Allocation not found",
      });
    }

    const spentResult = await pool.query(
      `
      SELECT COALESCE(SUM(expense_amount), 0) AS total_spent
      FROM worker_expenses
      WHERE allocation_id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      `,
      [allocation_id]
    );

    const allocatedAmount = Number(allocationResult.rows[0].allocated_amount);
    const alreadySpent = Number(spentResult.rows[0].total_spent);
    const newExpense = Number(expense_amount);
    const remainingBalance = allocatedAmount - alreadySpent - newExpense;

    const result = await pool.query(
      `
      INSERT INTO worker_expenses
      (
        allocation_id,
        expense_amount,
        expense_description,
        expense_date,
        remaining_balance,
        uploaded_photo,
        approval_status,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7)
      RETURNING *
      `,
      [
        allocation_id,
        expense_amount,
        expense_description || "",
        expense_date,
        remainingBalance,
        uploaded_photo || null,
        req.user?.id || null,
      ]
    );

    res.status(201).json({
      success: true,
      expense: result.rows[0],
    });
  } catch (error) {
    console.error("Create expense error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      allocation_id,
      expense_amount,
      expense_description,
      expense_date,
      uploaded_photo,
    } = req.body;

    const allocationResult = await pool.query(
      `
      SELECT allocated_amount
      FROM worker_allocations
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      `,
      [allocation_id]
    );

    if (allocationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Allocation not found",
      });
    }

    const spentResult = await pool.query(
      `
      SELECT COALESCE(SUM(expense_amount), 0) AS total_spent
      FROM worker_expenses
      WHERE allocation_id = $1
      AND id != $2
      AND COALESCE(is_deleted, FALSE) = FALSE
      `,
      [allocation_id, id]
    );

    const allocatedAmount = Number(allocationResult.rows[0].allocated_amount);
    const alreadySpent = Number(spentResult.rows[0].total_spent);
    const newExpense = Number(expense_amount);
    const remainingBalance = allocatedAmount - alreadySpent - newExpense;

    const result = await pool.query(
      `
      UPDATE worker_expenses
      SET allocation_id = $1,
          expense_amount = $2,
          expense_description = $3,
          expense_date = $4,
          remaining_balance = $5,
          uploaded_photo = $6,
          updated_at = NOW()
      WHERE id = $7
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [
        allocation_id,
        expense_amount,
        expense_description || "",
        expense_date,
        remainingBalance,
        uploaded_photo || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    res.status(200).json({
      success: true,
      expense: result.rows[0],
    });
  } catch (error) {
    console.error("Update expense error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE worker_expenses
      SET is_deleted = TRUE,
          deleted_at = NOW(),
          deleted_by = $2,
          updated_at = NOW()
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [id, req.user?.id || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error("Delete expense error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.approveExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_comment } = req.body;

    const result = await pool.query(
      `
      UPDATE worker_expenses
      SET approval_status = 'approved',
          admin_comment = $2,
          approved_by = $3,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [id, admin_comment || "", req.user?.id || null]
    );

    res.status(200).json({
      success: true,
      expense: result.rows[0],
    });
  } catch (error) {
    console.error("Approve expense error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.rejectExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_comment } = req.body;

    const result = await pool.query(
      `
      UPDATE worker_expenses
      SET approval_status = 'rejected',
          admin_comment = $2,
          approved_by = $3,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [id, admin_comment || "", req.user?.id || null]
    );

    res.status(200).json({
      success: true,
      expense: result.rows[0],
    });
  } catch (error) {
    console.error("Reject expense error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};