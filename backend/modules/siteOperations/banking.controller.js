/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The supervisor's cash float: money the office issues to them, and what
| they spend it on.
|
| Two sides, deliberately recorded by different people:
|
|   receipts   money IN to the supervisor. Office-only to create — a
|              supervisor who could record their own incoming funds could
|              account for any expenditure.
|   expenses   money OUT, recorded by the supervisor, then approved or
|              rejected by the office.
|
| That asymmetry IS the reconciliation. The summary is the difference
| between the two.
|
| Responsibilities:
|   - Summarise the float: received, spent, outstanding
|   - List and create receipts (creation office-only)
|   - List and create expenses
|   - Approve or reject an expense (office only)
|
| Exports (all Express handlers):
|   getSummary, getReceipts, createReceipt, getExpenses, createExpense,
|   approveExpense, rejectExpense
|
| Used by:
|   ./siteOperations.routes.js
|
| Depends on:
|   database/pool.js, utils/asyncHandler.js, utils/requestContext.js
|   ./entryWindow.service.js
|
| Database tables touched:
|   supervisor_fund_receipts  SELECT, INSERT
|   supervisor_expenses       SELECT, INSERT, UPDATE (approval)
|   sites, tenders      SELECT, for ownership checks
|
| API surface:
|   GET    /api/site-operations/banking/summary
|   GET    /api/site-operations/banking/receipts
|   POST   /api/site-operations/banking/receipts        office only
|   GET    /api/site-operations/banking/expenses
|   POST   /api/site-operations/banking/expenses
|   POST   /api/site-operations/banking/expenses/:id/approve  office only
|   POST   /api/site-operations/banking/expenses/:id/reject   office only
|
| Frontend consumers:
|   siteOperationsService.js -> useSiteOperations.js -> SiteOperationsPage
|
| Entry window:
|   Banking gets a LONGER window than the other modules —
|   SUPERVISOR_EDIT_WINDOW_DAYS plus SUPERVISOR_BANKING_GRACE_DAYS —
|   because the notes allow one extra day for it. checkEntryWindow applies
|   that automatically for MODULES.BANKING.
|
| Security:
|   Every statement is company-scoped. The separation between who records
|   receipts and who records expenses is enforced at the route, not here.
|
| Note:
|   Distinct from tender banking under /api/tenders/:id/banking, which
|   tracks guarantees and deposits rather than site cash.
|
*/

const pool = require("../../database/pool");
const {
  resolveEntrySite,
} = require("./siteScope.service");

const asyncHandler = require("../../utils/asyncHandler");

const {
  requireCompanyId,
  getUserId,
  getUserRole,
  requireParamId,
  sendNotFound,
  toNumber,
  cleanText,
} = require("../../utils/requestContext");

const {
  MODULES,
  checkEntryWindow,
  consumeGrant,
} = require("./entryWindow.service");

/*
|--------------------------------------------------------------------------
| Supervisor banking
|--------------------------------------------------------------------------
|
| From the notebook (p.04, "બેંકિંગ"):
|
|   "The supervisor gets money in 3 ways:
|      - into the bank account
|      - cash
|      - GST-paid cash"
|
|   "Whatever the supervisor spends each day, or any wages paid, all of it
|    must be added daily. One extra day is given for adding. After 2 days,
|    to enter any older entry they must call the company and take access."
|
| Receipts (money in) and expenses (money out) are separate tables so the
| supervisor's running float is receipts minus expenses, per type.
|
*/

const RECEIPT_TYPES = new Set([
  "bank",
  "cash",
  "gst_cash",
]);

/**
 * Restricts a supervisor to their own records; admins and managers see all.
 */
const applyOwnershipScope = (
  req,
  conditions,
  values,
  column
) => {
  const role = String(
    getUserRole(req) || ""
  ).toLowerCase();

  if (
    ["admin", "manager"].includes(
      role
    )
  ) {
    if (req.query.supervisor_id) {
      values.push(
        req.query.supervisor_id
      );

      conditions.push(
        `${column} = $${values.length}`
      );
    }

    return;
  }

  values.push(getUserId(req));

  conditions.push(
    `${column} = $${values.length}`
  );
};

/*
|--------------------------------------------------------------------------
| GET /api/site-operations/banking/summary
|--------------------------------------------------------------------------
|
| The supervisor's float: what came in by each route, what went out, and
| what should therefore still be in hand.
|
*/
exports.getSummary = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const receiptConditions = [
      "company_id = $1",
      "COALESCE(is_deleted, FALSE) = FALSE",
    ];

    const receiptValues = [companyId];

    applyOwnershipScope(
      req,
      receiptConditions,
      receiptValues,
      "supervisor_user_id"
    );

    if (req.query.tender_id) {
      receiptValues.push(
        req.query.tender_id
      );

      receiptConditions.push(
        `tender_id = $${receiptValues.length}`
      );
    }

    const receipts = await pool.query(
      `
      SELECT
        receipt_type,
        SUM(amount) AS total,
        COUNT(*)    AS entry_count
      FROM supervisor_fund_receipts
      WHERE ${receiptConditions.join(" AND ")}
      GROUP BY receipt_type
      `,
      receiptValues
    );

    const expenseConditions = [
      "company_id = $1",
      "COALESCE(is_deleted, FALSE) = FALSE",
      "approval_status <> 'rejected'",
    ];

    const expenseValues = [companyId];

    applyOwnershipScope(
      req,
      expenseConditions,
      expenseValues,
      "supervisor_user_id"
    );

    if (req.query.tender_id) {
      expenseValues.push(
        req.query.tender_id
      );

      expenseConditions.push(
        `tender_id = $${expenseValues.length}`
      );
    }

    const expenses = await pool.query(
      `
      SELECT
        payment_mode,
        category,
        SUM(amount) AS total,
        COUNT(*)    AS entry_count
      FROM supervisor_expenses
      WHERE ${expenseConditions.join(" AND ")}
      GROUP BY payment_mode, category
      `,
      expenseValues
    );

    const received = {
      bank: 0,
      cash: 0,
      gst_cash: 0,
    };

    receipts.rows.forEach((row) => {
      received[row.receipt_type] =
        Number(row.total || 0);
    });

    const spentByMode = {
      bank: 0,
      cash: 0,
      upi: 0,
      gst_cash: 0,
    };

    let spentTotal = 0;

    expenses.rows.forEach((row) => {
      const amount = Number(
        row.total || 0
      );

      spentByMode[
        row.payment_mode
      ] =
        (spentByMode[
          row.payment_mode
        ] || 0) + amount;

      spentTotal += amount;
    });

    const receivedTotal =
      received.bank +
      received.cash +
      received.gst_cash;

    return res.status(200).json({
      success: true,
      summary: {
        received,
        received_total: receivedTotal,
        spent_by_mode: spentByMode,
        spent_total: spentTotal,
        // What the supervisor should still be holding.
        balance:
          receivedTotal - spentTotal,
      },
      expense_breakdown:
        expenses.rows,
    });
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/site-operations/banking/receipts
|--------------------------------------------------------------------------
*/
exports.getReceipts = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const conditions = [
      "r.company_id = $1",
      "COALESCE(r.is_deleted, FALSE) = FALSE",
    ];

    const values = [companyId];

    applyOwnershipScope(
      req,
      conditions,
      values,
      "r.supervisor_user_id"
    );

    if (req.query.tender_id) {
      values.push(
        req.query.tender_id
      );

      conditions.push(
        `r.tender_id = $${values.length}`
      );
    }

    if (req.query.receipt_type) {
      values.push(
        req.query.receipt_type
      );

      conditions.push(
        `r.receipt_type = $${values.length}`
      );
    }

    const limit = Math.min(
      Number(req.query.limit) || 100,
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
        r.id,
        r.receipt_date,
        r.receipt_type,
        r.amount,
        r.reference_number,
        r.bank_name,
        r.notes,
        r.receipt_url,
        r.tender_id,
        t.title AS tender_title,
        r.supervisor_user_id,
        u.full_name AS supervisor_name,
        r.created_at,
        COUNT(*) OVER () AS total_count
      FROM supervisor_fund_receipts r
      LEFT JOIN tenders t
        ON t.id = r.tender_id AND t.company_id = r.company_id
      LEFT JOIN users u
        ON u.id = r.supervisor_user_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY r.receipt_date DESC, r.id DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
      `,
      values
    );

    return res.status(200).json({
      success: true,
      receipts: result.rows,
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
| POST /api/site-operations/banking/receipts
|--------------------------------------------------------------------------
|
| Recording money issued to a supervisor. Restricted to admin/manager by
| the route, because a supervisor logging their own incoming funds would
| defeat the point of the reconciliation.
|
*/
exports.createReceipt = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const {
      supervisor_user_id,
      tender_id = null,
      site_id = null,
      receipt_date,
      receipt_type,
      amount,
      reference_number,
      bank_name,
      notes,
      receipt_url,
    } = req.body;

    if (
      !supervisor_user_id ||
      !receipt_date ||
      !receipt_type
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Supervisor, receipt date and receipt type are required.",
      });
    }

    if (
      !RECEIPT_TYPES.has(receipt_type)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Receipt type must be one of: bank, cash, gst_cash.",
      });
    }

    // Money handed to a supervisor is handed to them FOR a site; without
    // one the float cannot be reconciled against what was spent there.
    const receiptScope =
      await resolveEntrySite({
        siteId: site_id,
        tenderId: tender_id,
        companyId,
        subject: "receipt",
      });

    if (receiptScope.error) {
      return res
        .status(receiptScope.error.status)
        .json(receiptScope.error.body);
    }

    const value = toNumber(amount);

    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be greater than zero.",
      });
    }

    // The supervisor must be a member of this company.
    const membership =
      await pool.query(
        `
        SELECT 1 FROM company_users
        WHERE user_id = $1 AND company_id = $2
        `,
        [
          supervisor_user_id,
          companyId,
        ]
      );

    if (
      membership.rows.length === 0
    ) {
      return sendNotFound(
        res,
        "Supervisor"
      );
    }

    const result = await pool.query(
      `
      INSERT INTO supervisor_fund_receipts
      (
        company_id, tender_id, site_id, supervisor_user_id,
        receipt_date, receipt_type, amount,
        reference_number, bank_name, notes, receipt_url, issued_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
      `,
      [
        companyId,
        receiptScope.site.tender_id,
        receiptScope.site.id,
        supervisor_user_id,
        receipt_date,
        receipt_type,
        value,
        cleanText(reference_number),
        cleanText(bank_name),
        cleanText(notes),
        receipt_url || null,
        getUserId(req),
      ]
    );

    return res.status(201).json({
      success: true,
      receipt: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/site-operations/banking/expenses
|--------------------------------------------------------------------------
*/
exports.getExpenses = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const conditions = [
      "e.company_id = $1",
      "COALESCE(e.is_deleted, FALSE) = FALSE",
    ];

    const values = [companyId];

    applyOwnershipScope(
      req,
      conditions,
      values,
      "e.supervisor_user_id"
    );

    [
      ["tender_id", "e.tender_id"],
      ["category", "e.category"],
      [
        "approval_status",
        "e.approval_status",
      ],
    ].forEach(([key, column]) => {
      if (!req.query[key]) return;

      values.push(req.query[key]);

      conditions.push(
        `${column} = $${values.length}`
      );
    });

    if (req.query.from_date) {
      values.push(
        req.query.from_date
      );

      conditions.push(
        `e.expense_date >= $${values.length}`
      );
    }

    if (req.query.to_date) {
      values.push(req.query.to_date);

      conditions.push(
        `e.expense_date <= $${values.length}`
      );
    }

    const limit = Math.min(
      Number(req.query.limit) || 100,
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
        e.id,
        e.expense_date,
        e.category,
        e.amount,
        e.description,
        e.payment_mode,
        e.bill_number,
        e.bill_url,
        e.photo_url,
        e.photo_source,
        e.photo_captured_at,
        e.approval_status,
        e.admin_comment,
        e.tender_id,
        t.title AS tender_title,
        e.labour_id,
        l.full_name AS labour_name,
        e.supervisor_user_id,
        u.full_name AS supervisor_name,
        e.created_at,
        COUNT(*) OVER () AS total_count
      FROM supervisor_expenses e
      LEFT JOIN tenders t
        ON t.id = e.tender_id AND t.company_id = e.company_id
      LEFT JOIN labour l
        ON l.id = e.labour_id AND l.company_id = e.company_id
      LEFT JOIN users u
        ON u.id = e.supervisor_user_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY e.expense_date DESC, e.id DESC
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
| POST /api/site-operations/banking/expenses
|--------------------------------------------------------------------------
*/
exports.createExpense = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const {
      tender_id = null,
      site_id = null,
      expense_date,
      category = "other",
      amount,
      description,
      payment_mode = "cash",
      bill_number,
      bill_url,
      photo_url,
      photo_source = "unknown",
      photo_captured_at = null,
      labour_id = null,
      material_entry_id = null,
    } = req.body;

    if (!expense_date) {
      return res.status(400).json({
        success: false,
        message:
          "Expense date is required.",
      });
    }

    const value = toNumber(amount);

    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be greater than zero.",
      });
    }

    const expenseScope =
      await resolveEntrySite({
        siteId: site_id,
        tenderId: tender_id,
        companyId,
        subject: "expense",
      });

    if (expenseScope.error) {
      return res
        .status(expenseScope.error.status)
        .json(expenseScope.error.body);
    }

    // Banking gets the extra grace day from the notes.
    const windowCheck =
      await checkEntryWindow({
        companyId,
        userId: getUserId(req),
        userRole: getUserRole(req),
        module: MODULES.BANKING,
        entryDate: expense_date,
      });

    if (!windowCheck.allowed) {
      return res
        .status(windowCheck.status)
        .json({
          success: false,
          message:
            windowCheck.message,
          reason: windowCheck.reason,
          days_old:
            windowCheck.daysOld,
        });
    }

    const result = await pool.query(
      `
      INSERT INTO supervisor_expenses
      (
        company_id, tender_id, site_id, supervisor_user_id,
        expense_date, category, amount, description, payment_mode,
        bill_number, bill_url, photo_url, photo_source, photo_captured_at,
        labour_id, material_entry_id,
        recorded_by, access_request_id, approval_status
      )
      VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       $15, $16, $17, $18, 'pending')
      RETURNING *
      `,
      [
        companyId,
        expenseScope.site.tender_id,
        expenseScope.site.id,
        getUserId(req),
        expense_date,
        category,
        value,
        cleanText(description),
        payment_mode,
        cleanText(bill_number),
        bill_url || null,
        photo_url || null,
        photo_source,
        photo_captured_at,
        labour_id,
        material_entry_id,
        getUserId(req),
        windowCheck.accessRequestId,
      ]
    );

    await consumeGrant(
      windowCheck.accessRequestId,
      companyId
    );

    return res.status(201).json({
      success: true,
      expense: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| Approval
|--------------------------------------------------------------------------
*/
const setExpenseApproval = (
  nextStatus
) =>
  asyncHandler(async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const expenseId = requireParamId(
      req,
      res,
      "id",
      "expense"
    );

    if (!expenseId) return;

    // Segregation of duties — see the same guard on material entries.
    const existing = await pool.query(
      `
      SELECT recorded_by
        FROM supervisor_expenses
       WHERE id = $1
         AND company_id = $2
         AND COALESCE(is_deleted, FALSE) = FALSE
      `,
      [expenseId, companyId]
    );

    if (existing.rows.length === 0) {
      return sendNotFound(
        res,
        "Expense"
      );
    }

    if (
      nextStatus === "approved" &&
      Number(
        existing.rows[0].recorded_by
      ) === Number(getUserId(req))
    ) {
      return res.status(409).json({
        success: false,
        reason: "SELF_APPROVAL",
        message:
          "You recorded this expense, so someone else has to approve it.",
      });
    }

    const result = await pool.query(
      `
      UPDATE supervisor_expenses
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
  setExpenseApproval("approved");

exports.rejectExpense =
  setExpenseApproval("rejected");
