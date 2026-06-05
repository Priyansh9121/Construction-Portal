const pool = require("../../database/pool")

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
        we.created_at
      FROM worker_expenses we
      LEFT JOIN worker_allocations wa ON we.allocation_id = wa.id
      LEFT JOIN workers w ON wa.worker_id = w.id
      ORDER BY we.id DESC
    `);

    res.status(200).json({
      success: true,
      expenses: result.rows,
    });
  } catch (error) {
    console.error("Get expenses error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
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

    const allocationResult = await pool.query(
      "SELECT allocated_amount FROM worker_allocations WHERE id = $1",
      [allocation_id]
    );

    if (allocationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Allocation not found",
      });
    }

    const spentResult = await pool.query(
      "SELECT COALESCE(SUM(expense_amount), 0) AS total_spent FROM worker_expenses WHERE allocation_id = $1",
      [allocation_id]
    );

    const allocatedAmount = Number(allocationResult.rows[0].allocated_amount);
    const alreadySpent = Number(spentResult.rows[0].total_spent);
    const newExpense = Number(expense_amount);
    const remainingBalance = allocatedAmount - alreadySpent - newExpense;

    const result = await pool.query(
      `INSERT INTO worker_expenses
       (allocation_id, expense_amount, expense_description, expense_date, remaining_balance, uploaded_photo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        allocation_id,
        expense_amount,
        expense_description,
        expense_date,
        remainingBalance,
        uploaded_photo || null,
      ]
    );

    res.status(201).json({
      success: true,
      expense: result.rows[0],
    });
  } catch (error) {
    console.error("Create expense error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM worker_expenses WHERE id = $1 RETURNING *",
      [id]
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
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};