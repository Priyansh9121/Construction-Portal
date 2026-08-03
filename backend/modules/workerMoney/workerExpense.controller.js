/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Worker expenses: what an allocated advance was actually spent on.
|
| The debit side of the worker-money picture. Each expense hangs off a
| worker allocation, so the two together answer "we advanced this much, and
| here is what became of it".
|
| Responsibilities:
|   - List expenses for the caller's company
|   - Create an expense against an allocation
|   - Update, soft-delete, approve and reject one
|
| Exports:
|   see module.exports at the foot of the file
|
| Used by:
|   ./workerExpense.routes.js, mounted at /api/worker-expenses
|
| Depends on:
|   database/pool.js, utils/asyncHandler.js, utils/requestContext.js
|   modules/notifications/notification.service.js
|
| Database tables touched:
|   worker_expenses     SELECT, INSERT, UPDATE
|   worker_allocations  SELECT, to resolve and verify the parent
|   workers             SELECT, for display names
|   notifications       INSERT, via the notification service
|
| API surface:
|   GET/POST/PUT/DELETE /api/worker-expenses, plus approve and reject.
|   Office-only at the mount.
|
| Frontend consumers:
|   workerMoneyService.js -> useWorkerMoney.js -> WorkerMoneyPage.jsx
|
| Audited:
|   Yes — logActivity is attached in the route file.
|
| Security:
|   Two levels. The expense is company-scoped directly, and its parent
|   allocation is resolved through a company-scoped lookup rather than
|   trusted from the body — so an expense cannot be attached to another
|   tenant's allocation.
|
*/

const pool = require("../../database/pool");

const asyncHandler = require("../../utils/asyncHandler");

const {
  requireCompanyId,
  getUserId,
  requireParamId,
  sendNotFound,
  toNumber,
  cleanText,
} = require("../../utils/requestContext");

/*
|--------------------------------------------------------------------------
| Tenant scoping
|--------------------------------------------------------------------------
|
| worker_expenses has a company_id column as of migration 001. Every query
| below filters on it.
|
| Ownership of the parent allocation is resolved through a company-scoped
| lookup rather than by id alone, so a client cannot attach an expense to
| another company's allocation by guessing its id.
|
*/

/**
 * Loads an allocation only if it belongs to the caller's company.
 *
 * Returns null when the allocation does not exist, is soft-deleted, or
 * belongs to a different company. The caller cannot distinguish those
 * cases, which is deliberate: it prevents id enumeration.
 */
const findAllocationForCompany = async (
  allocationId,
  companyId
) => {
  const result = await pool.query(
    `
    SELECT
      wa.id,
      wa.allocated_amount,
      wa.worker_id
    FROM worker_allocations wa
    WHERE wa.id = $1
      AND wa.company_id = $2
      AND COALESCE(wa.is_deleted, FALSE) = FALSE
    `,
    [allocationId, companyId]
  );

  return result.rows[0] || null;
};

/**
 * Sums approved and pending spend against an allocation.
 *
 * excludeExpenseId lets an update recalculate the balance without counting
 * the row currently being edited.
 */
const sumSpentOnAllocation = async (
  allocationId,
  companyId,
  excludeExpenseId = null
) => {
  const result = await pool.query(
    `
    SELECT COALESCE(SUM(expense_amount), 0) AS total_spent
    FROM worker_expenses
    WHERE allocation_id = $1
      AND company_id = $2
      AND ($3::BIGINT IS NULL OR id <> $3)
      AND approval_status <> 'rejected'
      AND COALESCE(is_deleted, FALSE) = FALSE
    `,
    [
      allocationId,
      companyId,
      excludeExpenseId,
    ]
  );

  return Number(
    result.rows[0].total_spent
  );
};

/*
|--------------------------------------------------------------------------
| GET /api/worker-expenses
|--------------------------------------------------------------------------
*/
exports.getExpenses = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const conditions = [
      "we.company_id = $1",
      "COALESCE(we.is_deleted, FALSE) = FALSE",
    ];

    const values = [companyId];

    if (req.query.allocation_id) {
      values.push(
        req.query.allocation_id
      );

      conditions.push(
        `we.allocation_id = $${values.length}`
      );
    }

    if (req.query.worker_id) {
      values.push(
        req.query.worker_id
      );

      conditions.push(
        `wa.worker_id = $${values.length}`
      );
    }

    if (
      req.query.approval_status
    ) {
      values.push(
        req.query.approval_status
      );

      conditions.push(
        `we.approval_status = $${values.length}`
      );
    }

    // Pagination — these endpoints previously returned the entire table.
    const limit = Math.min(
      Number(req.query.limit) ||
        100,
      500
    );

    const offset = Math.max(
      Number(req.query.offset) ||
        0,
      0
    );

    values.push(limit, offset);

    const result = await pool.query(
      `
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
        we.created_at,
        COUNT(*) OVER () AS total_count
      FROM worker_expenses we
      LEFT JOIN worker_allocations wa
        ON wa.id = we.allocation_id
       AND wa.company_id = we.company_id
      LEFT JOIN workers w
        ON w.id = wa.worker_id
       AND w.company_id = we.company_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY we.expense_date DESC, we.id DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
      `,
      values
    );

    return res.status(200).json({
      success: true,
      expenses: result.rows,
      pagination: {
        limit,
        offset,
        total: Number(
          result.rows[0]
            ?.total_count || 0
        ),
      },
    });
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/worker-expenses
|--------------------------------------------------------------------------
*/
exports.createExpense = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const {
      allocation_id,
      expense_amount,
      expense_description,
      expense_date,
      uploaded_photo,
    } = req.body;

    if (
      !allocation_id ||
      !expense_amount ||
      !expense_date
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Allocation, expense amount and date are required.",
      });
    }

    const amount = toNumber(
      expense_amount
    );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Expense amount must be greater than zero.",
      });
    }

    // Ownership check: resolves the allocation within the caller's company.
    const allocation =
      await findAllocationForCompany(
        allocation_id,
        companyId
      );

    if (!allocation) {
      return sendNotFound(
        res,
        "Allocation"
      );
    }

    const allocatedAmount = Number(
      allocation.allocated_amount
    );

    const alreadySpent =
      await sumSpentOnAllocation(
        allocation_id,
        companyId
      );

    const remainingBalance =
      allocatedAmount -
      alreadySpent -
      amount;

    if (remainingBalance < 0) {
      return res.status(400).json({
        success: false,
        message: `This expense exceeds the remaining allocation balance by ${Math.abs(
          remainingBalance
        ).toFixed(2)}.`,
      });
    }

    const result = await pool.query(
      `
      INSERT INTO worker_expenses
      (
        company_id,
        allocation_id,
        expense_amount,
        expense_description,
        expense_date,
        remaining_balance,
        uploaded_photo,
        approval_status,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
      RETURNING *
      `,
      [
        companyId,
        allocation_id,
        amount,
        cleanText(
          expense_description
        ),
        expense_date,
        remainingBalance,
        uploaded_photo || null,
        getUserId(req),
      ]
    );

    return res.status(201).json({
      success: true,
      expense: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| PUT /api/worker-expenses/:id
|--------------------------------------------------------------------------
*/
exports.updateExpense = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const expenseId =
      requireParamId(
        req,
        res,
        "id",
        "expense"
      );

    if (!expenseId) {
      return;
    }

    const {
      allocation_id,
      expense_amount,
      expense_description,
      expense_date,
      uploaded_photo,
    } = req.body;

    const amount = toNumber(
      expense_amount
    );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Expense amount must be greater than zero.",
      });
    }

    const allocation =
      await findAllocationForCompany(
        allocation_id,
        companyId
      );

    if (!allocation) {
      return sendNotFound(
        res,
        "Allocation"
      );
    }

    const alreadySpent =
      await sumSpentOnAllocation(
        allocation_id,
        companyId,
        expenseId
      );

    const remainingBalance =
      Number(
        allocation.allocated_amount
      ) -
      alreadySpent -
      amount;

    if (remainingBalance < 0) {
      return res.status(400).json({
        success: false,
        message: `This expense exceeds the remaining allocation balance by ${Math.abs(
          remainingBalance
        ).toFixed(2)}.`,
      });
    }

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
        AND company_id = $8
        AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [
        allocation_id,
        amount,
        cleanText(
          expense_description
        ),
        expense_date,
        remainingBalance,
        uploaded_photo || null,
        expenseId,
        companyId,
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Expense"
      );
    }

    return res.status(200).json({
      success: true,
      expense: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| DELETE /api/worker-expenses/:id
|--------------------------------------------------------------------------
*/
exports.deleteExpense = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const expenseId =
      requireParamId(
        req,
        res,
        "id",
        "expense"
      );

    if (!expenseId) {
      return;
    }

    const result = await pool.query(
      `
      UPDATE worker_expenses
      SET is_deleted = TRUE,
          deleted_at = NOW(),
          deleted_by = $3,
          updated_at = NOW()
      WHERE id = $1
        AND company_id = $2
        AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING id
      `,
      [
        expenseId,
        companyId,
        getUserId(req),
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Expense"
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Expense deleted successfully.",
    });
  }
);

/*
|--------------------------------------------------------------------------
| Approval transitions
|--------------------------------------------------------------------------
*/

/**
 * Shared handler for approve and reject.
 *
 * Both previously updated by id alone, which let an admin of one company
 * approve or reject another company's expense.
 */
const setApprovalStatus = (
  nextStatus
) =>
  asyncHandler(async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const expenseId =
      requireParamId(
        req,
        res,
        "id",
        "expense"
      );

    if (!expenseId) {
      return;
    }

    const result = await pool.query(
      `
      UPDATE worker_expenses
      SET approval_status = $1,
          admin_comment = $2,
          approved_by = $3,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $4
        AND company_id = $5
        AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [
        nextStatus,
        cleanText(
          req.body.admin_comment
        ),
        getUserId(req),
        expenseId,
        companyId,
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Expense"
      );
    }

    return res.status(200).json({
      success: true,
      expense: result.rows[0],
    });
  });

exports.approveExpense =
  setApprovalStatus("approved");

exports.rejectExpense =
  setApprovalStatus("rejected");
