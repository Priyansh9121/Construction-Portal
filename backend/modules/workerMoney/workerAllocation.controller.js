/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Worker allocations: money advanced to a worker against future earnings.
|
| An allocation is requested, then approved or rejected by the office. It
| is the credit side of the worker-money picture; workerExpense.controller
| records what the money was spent on.
|
| Responsibilities:
|   - List allocations for the caller's company
|   - Create an allocation
|   - Update, soft-delete, approve and reject one
|
| Exports:
|   see module.exports at the foot of the file
|
| Used by:
|   ./workerAllocation.routes.js, mounted at /api/worker-allocations
|
| Depends on:
|   database/pool.js, utils/asyncHandler.js, utils/requestContext.js
|   modules/notifications/notification.service.js — the worker is told the
|     outcome
|
| Database tables touched:
|   worker_allocations  SELECT, INSERT, UPDATE
|   workers, tenders    SELECT, for ownership checks and display names
|   notifications       INSERT, via the notification service
|
| API surface:
|   GET/POST/PUT/DELETE /api/worker-allocations, plus approve and reject.
|   Office-only: server.js mounts this behind requireOffice. A worker sees
|   their own allocations through /api/worker-portal instead.
|
| Frontend consumers:
|   workerMoneyService.js -> useWorkerMoney.js -> WorkerMoneyPage.jsx
|
| Audited:
|   Yes — workerAllocation.routes.js attaches logActivity to the mutations.
|
| Security:
|   Every statement is company-scoped. The banner below records why that is
|   stated so insistently.
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
| worker_allocations carries company_id as of migration 001.
|
| This file previously contained no company_id reference at all: it listed
| every company's advances, and updated, deleted, approved and rejected them
| by id alone. That made cross-tenant approval of money movements possible by
| guessing sequential ids.
|
*/

/**
 * Confirms a worker belongs to the caller's company.
 */
const workerBelongsToCompany = async (
  workerId,
  companyId
) => {
  const result = await pool.query(
    `
    SELECT id
    FROM workers
    WHERE id = $1
      AND company_id = $2
      AND COALESCE(is_deleted, FALSE) = FALSE
    `,
    [workerId, companyId]
  );

  return result.rows.length > 0;
};

/*
|--------------------------------------------------------------------------
| GET /api/worker-allocations
|--------------------------------------------------------------------------
*/
exports.getAllocations = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const conditions = [
      "wa.company_id = $1",
      "COALESCE(wa.is_deleted, FALSE) = FALSE",
    ];

    const values = [companyId];

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
        `wa.approval_status = $${values.length}`
      );
    }

    const limit = Math.min(
      Number(req.query.limit) ||
        100,
      500
    );

    const offset = Math.max(
      Number(req.query.offset) || 0,
      0
    );

    values.push(limit, offset);

    const result = await pool.query(
      `
      SELECT
        wa.id,
        wa.worker_id,
        w.full_name AS worker_name,
        wa.allocated_amount,
        wa.purpose,
        wa.approval_status,
        wa.admin_comment,
        wa.allocated_by,
        wa.approved_by,
        wa.approved_at,
        wa.created_at,
        COALESCE(spent.total_spent, 0) AS total_spent,
        wa.allocated_amount - COALESCE(spent.total_spent, 0)
          AS remaining_balance,
        COUNT(*) OVER () AS total_count
      FROM worker_allocations wa
      LEFT JOIN workers w
        ON w.id = wa.worker_id
       AND w.company_id = wa.company_id
      LEFT JOIN LATERAL (
        SELECT SUM(we.expense_amount) AS total_spent
        FROM worker_expenses we
        WHERE we.allocation_id = wa.id
          AND we.company_id = wa.company_id
          AND we.approval_status <> 'rejected'
          AND COALESCE(we.is_deleted, FALSE) = FALSE
      ) spent ON TRUE
      WHERE ${conditions.join(" AND ")}
      ORDER BY wa.id DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
      `,
      values
    );

    return res.status(200).json({
      success: true,
      allocations: result.rows,
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
| POST /api/worker-allocations
|--------------------------------------------------------------------------
*/
exports.createAllocation = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const {
      worker_id,
      allocated_amount,
      purpose,
    } = req.body;

    if (
      !worker_id ||
      !allocated_amount
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Worker and allocated amount are required.",
      });
    }

    const amount = toNumber(
      allocated_amount
    );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Allocated amount must be greater than zero.",
      });
    }

    if (
      !(await workerBelongsToCompany(
        worker_id,
        companyId
      ))
    ) {
      return sendNotFound(
        res,
        "Worker"
      );
    }

    const result = await pool.query(
      `
      INSERT INTO worker_allocations
      (
        company_id,
        worker_id,
        allocated_amount,
        purpose,
        allocated_by,
        created_by,
        approval_status
      )
      VALUES ($1, $2, $3, $4, $5, $5, 'pending')
      RETURNING *
      `,
      [
        companyId,
        worker_id,
        amount,
        cleanText(purpose),
        getUserId(req),
      ]
    );

    return res.status(201).json({
      success: true,
      allocation: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| PUT /api/worker-allocations/:id
|--------------------------------------------------------------------------
*/
exports.updateAllocation = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const allocationId =
      requireParamId(
        req,
        res,
        "id",
        "allocation"
      );

    if (!allocationId) {
      return;
    }

    const {
      worker_id,
      allocated_amount,
      purpose,
    } = req.body;

    const amount = toNumber(
      allocated_amount
    );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Allocated amount must be greater than zero.",
      });
    }

    if (
      !(await workerBelongsToCompany(
        worker_id,
        companyId
      ))
    ) {
      return sendNotFound(
        res,
        "Worker"
      );
    }

    // Reducing an allocation below what has already been spent against it
    // would leave a negative balance.
    const spentResult =
      await pool.query(
        `
        SELECT COALESCE(SUM(expense_amount), 0) AS total_spent
        FROM worker_expenses
        WHERE allocation_id = $1
          AND company_id = $2
          AND approval_status <> 'rejected'
          AND COALESCE(is_deleted, FALSE) = FALSE
        `,
        [allocationId, companyId]
      );

    const totalSpent = Number(
      spentResult.rows[0].total_spent
    );

    if (amount < totalSpent) {
      return res.status(400).json({
        success: false,
        message: `Allocation cannot be reduced below the ${totalSpent.toFixed(
          2
        )} already spent against it.`,
      });
    }

    const result = await pool.query(
      `
      UPDATE worker_allocations
      SET worker_id = $1,
          allocated_amount = $2,
          purpose = $3,
          updated_at = NOW()
      WHERE id = $4
        AND company_id = $5
        AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [
        worker_id,
        amount,
        cleanText(purpose),
        allocationId,
        companyId,
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Allocation"
      );
    }

    return res.status(200).json({
      success: true,
      allocation: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| DELETE /api/worker-allocations/:id
|--------------------------------------------------------------------------
*/
exports.deleteAllocation = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const allocationId =
      requireParamId(
        req,
        res,
        "id",
        "allocation"
      );

    if (!allocationId) {
      return;
    }

    // Refuse to remove an allocation that still has live expenses attached,
    // rather than orphaning them.
    const linked = await pool.query(
      `
      SELECT COUNT(*)::INT AS expense_count
      FROM worker_expenses
      WHERE allocation_id = $1
        AND company_id = $2
        AND COALESCE(is_deleted, FALSE) = FALSE
      `,
      [allocationId, companyId]
    );

    if (
      linked.rows[0].expense_count >
      0
    ) {
      return res.status(409).json({
        success: false,
        message: `This allocation has ${linked.rows[0].expense_count} expense(s) recorded against it. Remove those first.`,
      });
    }

    const result = await pool.query(
      `
      UPDATE worker_allocations
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
        allocationId,
        companyId,
        getUserId(req),
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Allocation"
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Allocation deleted successfully.",
    });
  }
);

/*
|--------------------------------------------------------------------------
| Approval transitions
|--------------------------------------------------------------------------
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

    const allocationId =
      requireParamId(
        req,
        res,
        "id",
        "allocation"
      );

    if (!allocationId) {
      return;
    }

    const result = await pool.query(
      `
      UPDATE worker_allocations
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
        allocationId,
        companyId,
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Allocation"
      );
    }

    return res.status(200).json({
      success: true,
      allocation: result.rows[0],
    });
  });

exports.approveAllocation =
  setApprovalStatus("approved");

exports.rejectAllocation =
  setApprovalStatus("rejected");
