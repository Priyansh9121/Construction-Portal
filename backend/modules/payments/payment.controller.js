const pool = require("../../database/pool");

const asyncHandler = require("../../utils/asyncHandler");

const {
  requireCompanyId,
  getUserId,
  requireParamId,
  sendNotFound,
} = require("../../utils/requestContext");

const {
  ALL_SECTIONS,
  DIRECTIONS,
  SUB_TYPES,
} = require("./payment.hierarchy");

const {
  validatePayment,
  buildPaymentRecord,
  calculateInterest,
  money,
} = require("./payment.service");

/*
|--------------------------------------------------------------------------
| Payments
|--------------------------------------------------------------------------
|
| The Add Payment surface from the notebook: income and expense, each with
| its own scope/sub-type tree.
|
| getPayments previously built its filter from query parameters only, with
| no company_id anywhere, so any authenticated user received every company's
| financial records. Every statement here is company-scoped.
|
*/

/**
 * The exact column list written on insert and update.
 *
 * Declared once so the two statements cannot drift apart — a mismatch there
 * is how a field silently stops saving on edit.
 */
const PAYMENT_COLUMNS = [
  "company_id",
  "payment_type",
  "payment_direction",
  "payment_scope",
  "payment_sub_type",
  "category",
  "amount",
  "gst_percent",
  "gst_amount",
  "gst_total",
  "gst_received",
  "gst_left",
  "collected_gst",
  "bill_number",
  "bill_amount",
  "charge_amount",
  "company_charge_percent",
  "company_charge_total",
  "interest_percent",
  "interest_amount",
  "interest_accrued_to",
  "tds_amount",
  "quantity",
  "payment_date",
  "payment_mode",
  "source_type",
  "fd_site",
  "tender_id",
  "site_id",
  "investor_id",
  "supplier_id",
  "client_id",
  "subcontractor_id",
  "labour_id",
  "investor_name",
  "worker_name",
  "material_name",
  "description",
  "details",
  "reference_number",
  "receipt_url",
  "created_by",
];

/**
 * Confirms a client-supplied foreign key belongs to the caller's company.
 */
const belongsToCompany = async (
  table,
  id,
  companyId
) => {
  if (!id) return true;

  const result = await pool.query(
    `SELECT 1 FROM ${table}
      WHERE id = $1 AND company_id = $2
        AND COALESCE(is_deleted, FALSE) = FALSE`,
    [id, companyId]
  );

  return result.rows.length > 0;
};

/**
 * Validates every relationship on the payload in one pass.
 *
 * Returns an error message, or null when all references are in-tenant.
 */
const checkReferences = async (
  payload,
  companyId
) => {
  const checks = [
    ["tenders", payload.tender_id, "Tender"],
    ["sites", payload.site_id, "Site"],
    [
      "subcontractors",
      payload.subcontractor_id,
      "Subcontractor",
    ],
  ];

  for (const [
    table,
    id,
    label,
  ] of checks) {
    if (
      !(await belongsToCompany(
        table,
        id,
        companyId
      ))
    ) {
      return `${label} not found.`;
    }
  }

  // investors, suppliers and clients have no is_deleted column.
  const plainChecks = [
    [
      "investors",
      payload.investor_id,
      "Investor",
    ],
    [
      "suppliers",
      payload.supplier_id,
      "Supplier",
    ],
    ["clients", payload.client_id, "Client"],
  ];

  for (const [
    table,
    id,
    label,
  ] of plainChecks) {
    if (!id) continue;

    const result = await pool.query(
      `SELECT 1 FROM ${table} WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return `${label} not found.`;
    }
  }

  return null;
};

/*
|--------------------------------------------------------------------------
| GET /api/payments/hierarchy
|--------------------------------------------------------------------------
|
| Serves the Add Payment tree so the frontend renders from one definition
| instead of keeping a second copy that can fall out of step.
|
*/
exports.getHierarchy = asyncHandler(
  async (req, res) => {
    return res.status(200).json({
      success: true,
      hierarchy: {
        income:
          ALL_SECTIONS[
            DIRECTIONS.INCOME
          ],
        expense:
          ALL_SECTIONS[
            DIRECTIONS.EXPENSE
          ],
      },
    });
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/payments
|--------------------------------------------------------------------------
*/
exports.getPayments = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const conditions = [
      "p.company_id = $1",
      "COALESCE(p.is_deleted, FALSE) = FALSE",
    ];

    const values = [companyId];

    const addFilter = (
      value,
      clause
    ) => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return;
      }

      values.push(value);

      conditions.push(
        clause(values.length)
      );
    };

    addFilter(
      req.query.tender_id,
      (i) => `p.tender_id = $${i}`
    );

    addFilter(
      req.query.site_id,
      (i) => `p.site_id = $${i}`
    );

    addFilter(
      req.query.payment_type,
      (i) => `p.payment_type = $${i}`
    );

    addFilter(
      req.query.payment_direction,
      (i) =>
        `p.payment_direction = $${i}`
    );

    addFilter(
      req.query.payment_scope,
      (i) => `p.payment_scope = $${i}`
    );

    addFilter(
      req.query.payment_sub_type,
      (i) =>
        `p.payment_sub_type = $${i}`
    );

    addFilter(
      req.query.from_date,
      (i) => `p.payment_date >= $${i}`
    );

    addFilter(
      req.query.to_date,
      (i) => `p.payment_date <= $${i}`
    );

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
        p.*,
        t.title      AS tender_title,
        s.site_name,
        sc.full_name AS subcontractor_name,
        COUNT(*) OVER () AS total_count
      FROM payments p
      LEFT JOIN tenders t
        ON t.id = p.tender_id AND t.company_id = p.company_id
      LEFT JOIN sites s
        ON s.id = p.site_id AND s.company_id = p.company_id
      LEFT JOIN subcontractors sc
        ON sc.id = p.subcontractor_id AND sc.company_id = p.company_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY p.payment_date DESC NULLS LAST, p.id DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
      `,
      values
    );

    return res.status(200).json({
      success: true,
      payments: result.rows,
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
| POST /api/payments
|--------------------------------------------------------------------------
*/
exports.createPayment = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    // Accept the legacy capitalised payment_type as a direction so the
    // existing screens keep working while the frontend migrates.
    const payload = {
      ...req.body,
      payment_direction:
        req.body.payment_direction ||
        String(
          req.body.payment_type || ""
        ).toLowerCase(),
    };

    const errors =
      validatePayment(payload);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    const referenceError =
      await checkReferences(
        payload,
        companyId
      );

    if (referenceError) {
      return res.status(404).json({
        success: false,
        message: referenceError,
      });
    }

    const record = buildPaymentRecord(
      payload,
      {
        companyId,
        userId: getUserId(req),
      }
    );

    const placeholders =
      PAYMENT_COLUMNS.map(
        (_, i) => `$${i + 1}`
      ).join(", ");

    const result = await pool.query(
      `
      INSERT INTO payments (${PAYMENT_COLUMNS.join(", ")})
      VALUES (${placeholders})
      RETURNING *
      `,
      PAYMENT_COLUMNS.map(
        (column) => record[column]
      )
    );

    return res.status(201).json({
      success: true,
      payment: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| PUT /api/payments/:id
|--------------------------------------------------------------------------
*/
exports.updatePayment = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const paymentId = requireParamId(
      req,
      res,
      "id",
      "payment"
    );

    if (!paymentId) return;

    const payload = {
      ...req.body,
      payment_direction:
        req.body.payment_direction ||
        String(
          req.body.payment_type || ""
        ).toLowerCase(),
    };

    const errors =
      validatePayment(payload);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    const referenceError =
      await checkReferences(
        payload,
        companyId
      );

    if (referenceError) {
      return res.status(404).json({
        success: false,
        message: referenceError,
      });
    }

    const record = buildPaymentRecord(
      payload,
      {
        companyId,
        userId: getUserId(req),
      }
    );

    // company_id and created_by are not editable.
    const updatable =
      PAYMENT_COLUMNS.filter(
        (column) =>
          ![
            "company_id",
            "created_by",
          ].includes(column)
      );

    const assignments = updatable
      .map(
        (column, i) =>
          `${column} = $${i + 1}`
      )
      .join(", ");

    const values = updatable.map(
      (column) => record[column]
    );

    values.push(paymentId, companyId);

    const result = await pool.query(
      `
      UPDATE payments
      SET ${assignments}, updated_at = NOW()
      WHERE id = $${values.length - 1}
        AND company_id = $${values.length}
        AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Payment"
      );
    }

    return res.status(200).json({
      success: true,
      payment: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| DELETE /api/payments/:id
|--------------------------------------------------------------------------
*/
exports.deletePayment = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const paymentId = requireParamId(
      req,
      res,
      "id",
      "payment"
    );

    if (!paymentId) return;

    const result = await pool.query(
      `
      UPDATE payments
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
        paymentId,
        companyId,
        getUserId(req),
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Payment"
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Payment deleted successfully.",
      deletedPaymentId:
        result.rows[0].id,
    });
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/payments/summary
|--------------------------------------------------------------------------
|
| Income, expense and balance broken down by scope and sub-type — the
| ledger view the office works from.
|
*/
exports.getSummary = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const conditions = [
      "company_id = $1",
      "COALESCE(is_deleted, FALSE) = FALSE",
    ];

    const values = [companyId];

    if (req.query.tender_id) {
      values.push(
        req.query.tender_id
      );

      conditions.push(
        `tender_id = $${values.length}`
      );
    }

    if (req.query.from_date) {
      values.push(
        req.query.from_date
      );

      conditions.push(
        `payment_date >= $${values.length}`
      );
    }

    if (req.query.to_date) {
      values.push(req.query.to_date);

      conditions.push(
        `payment_date <= $${values.length}`
      );
    }

    const where =
      conditions.join(" AND ");

    const breakdown = await pool.query(
      `
      SELECT
        payment_direction,
        payment_scope,
        payment_sub_type,
        SUM(amount)        AS total_amount,
        SUM(gst_amount)    AS total_gst,
        SUM(gst_left)      AS gst_outstanding,
        SUM(tds_amount)    AS total_tds,
        SUM(charge_amount) AS total_charge,
        COUNT(*)           AS entry_count
      FROM payments
      WHERE ${where}
      GROUP BY payment_direction, payment_scope, payment_sub_type
      ORDER BY payment_direction, payment_scope, payment_sub_type
      `,
      values
    );

    const totals = await pool.query(
      `
      SELECT
        COALESCE(SUM(amount) FILTER (
          WHERE payment_direction = 'income'
        ), 0) AS total_income,
        COALESCE(SUM(amount) FILTER (
          WHERE payment_direction = 'expense'
        ), 0) AS total_expense,
        COALESCE(SUM(gst_left), 0)   AS gst_outstanding,
        COALESCE(SUM(tds_amount), 0) AS total_tds
      FROM payments
      WHERE ${where}
      `,
      values
    );

    const row = totals.rows[0];

    return res.status(200).json({
      success: true,
      summary: {
        total_income: money(
          row.total_income
        ),
        total_expense: money(
          row.total_expense
        ),
        balance:
          money(row.total_income) -
          money(row.total_expense),
        gst_outstanding: money(
          row.gst_outstanding
        ),
        total_tds: money(
          row.total_tds
        ),
      },
      breakdown: breakdown.rows,
    });
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/payments/investor-interest
|--------------------------------------------------------------------------
|
| From the notes: interest keeps accruing per day on investor money, so the
| figure has to be computed as of now rather than stored once.
|
*/
exports.getInvestorInterest =
  asyncHandler(async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const result = await pool.query(
      `
      SELECT
        id,
        investor_id,
        investor_name,
        fd_site,
        tender_id,
        payment_date,
        amount,
        interest_percent,
        payment_direction
      FROM payments
      WHERE company_id = $1
        AND payment_sub_type = $2
        AND interest_percent > 0
        AND COALESCE(is_deleted, FALSE) = FALSE
      ORDER BY payment_date DESC
      `,
      [companyId, SUB_TYPES.INVESTOR]
    );

    let principalTotal = 0;

    let interestTotal = 0;

    const entries = result.rows.map(
      (row) => {
        const accrual =
          calculateInterest({
            principal: row.amount,
            interestPercent:
              row.interest_percent,
            fromDate:
              row.payment_date,
          });

        principalTotal += money(
          row.amount
        );

        interestTotal +=
          accrual.interest_amount;

        return {
          ...row,
          ...accrual,
          total_payable:
            money(row.amount) +
            accrual.interest_amount,
        };
      }
    );

    return res.status(200).json({
      success: true,
      entries,
      summary: {
        principal_total:
          principalTotal,
        interest_total:
          interestTotal,
        total_payable:
          principalTotal +
          interestTotal,
      },
    });
  });
