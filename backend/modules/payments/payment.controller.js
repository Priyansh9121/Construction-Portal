/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The payments module's HTTP layer AND its data access. Unlike tenders,
| which splits controller / service / queries three ways, payments keeps
| the SQL here and delegates only the money arithmetic and validation to
| payment.service.js.
|
| That is a reasonable split for this module: the queries are mostly one
| statement per endpoint, and the genuinely difficult part — what a figure
| should be — is what lives in the service and is unit-tested.
|
| Responsibilities:
|   - Resolve company and user from the authenticated request
|   - Validate payloads through payment.service.validatePayment
|   - Build rows through payment.service.buildPaymentRecord
|   - Own every SQL statement the payments module issues
|   - Aggregate the summary and investor-interest views
|
| Exports (all Express handlers):
|   getHierarchy          the Add Payment tree
|   getPayments           the filtered ledger
|   createPayment, updatePayment, deletePayment
|   getSummary            income/expense/balance by scope and sub-type
|   getInvestorInterest   live interest accrual across investor payments
|
| Used by:
|   ./payment.routes.js
|
| Depends on:
|   database/pool.js
|   utils/asyncHandler.js, utils/requestContext.js
|   ./payment.hierarchy.js  the valid combinations and section list
|   ./payment.service.js    validation and every money calculation
|
| Database tables touched:
|   payments        SELECT, INSERT, UPDATE (soft delete)
|   tenders, sites, workers, subcontractors, investors — joined for
|   display names, and checked for ownership on write
|
| Frontend consumers:
|   frontend/src/services/paymentService.js -> usePayments.js,
|   usePaymentManager.js, usePaymentSections.js -> PaymentsPage.jsx,
|   the finance components, and the dashboard cards
|
| Security:
|   Every statement in this file is company-scoped from the session. The
|   banner below records why that is stated so insistently — this module
|   previously built its filter from query parameters alone, with no
|   company_id anywhere, so any authenticated user received every
|   company's financial records.
|
|   Money figures are recalculated server-side on both create and update.
|   A client may send a derived total, but it is never what gets stored.
|
| Note:
|   All three mutations are audited by the route file. This is the module
|   where that matters most — these rows are the financial record.
|
*/

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
 *
 * Parameters:
 * table     - the table to look in; a trusted literal, see below
 * id        - the client-supplied id, or null
 * companyId - the caller's company
 *
 * Returns:
 * A promise of boolean. TRUE for a missing id — every reference on a
 * payment is optional, so "not supplied" is valid rather than a failure.
 *
 * Security:
 * `table` is interpolated into the SQL string, because Postgres cannot
 * parameterise an identifier. It is safe only because every caller passes
 * a hard-coded literal from the two arrays in checkReferences. Never pass
 * anything derived from a request.
 *
 * id and companyId are bound as $1 and $2.
 *
 * Notes:
 * Excludes soft-deleted rows, so a payment cannot be attached to a tender
 * or site the office has already removed. Only usable for tables that HAVE
 * is_deleted — investors, suppliers and clients do not, which is why
 * checkReferences handles those separately.
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
 * Confirms every record a payment references belongs to the caller.
 *
 * Purpose:
 * A payment can point at a tender, a site, a subcontractor, an investor, a
 * supplier and a client — all client-supplied ids. Without this a caller
 * could post another tenant's id into one of those fields. The payment row
 * itself would still be correctly scoped, because company_id comes from
 * the session, but it would reference a record its own company cannot see:
 * a payment attributed to an invisible tender.
 *
 * Parameters:
 * payload   - the request body, read for each reference field
 * companyId - the caller's company
 *
 * Returns:
 * A message naming the first reference that failed, or null when all pass.
 * A string rather than a boolean so the caller can name the entity in its
 * 404.
 *
 * Side effects:
 * Up to six SELECTs, one per supplied reference. Absent references are
 * skipped.
 *
 * Business rule:
 * Every reference is optional — a payment need not belong to a tender or
 * name a supplier — so a missing id passes rather than failing.
 *
 * Notes:
 * The two lists exist because the tables differ. tenders, sites and
 * subcontractors carry is_deleted and are checked through
 * belongsToCompany, which excludes soft-deleted rows. investors, suppliers
 * and clients have no such column and use a plain company check instead.
 *
 * That distinction is exactly what F-16 got wrong elsewhere:
 * validateClientOwnership in tenderQueries.js filtered clients on
 * is_deleted and failed with 42703 on every call. This file gets it right,
 * and the inline comment above plainChecks is what records why.
 *
 * Sequential rather than parallel, stopping at the first failure — the
 * remaining answers no longer matter once one reference is bad.
 *
 * Note there is no worker check. Payments store worker_name as free text
 * rather than a worker_id, so there is no foreign key to validate.
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
| Auth:     required; office-only
| Response: 200 with the direction -> scope -> sub-type tree
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
|
| Auth:     required; office-only at the mount
| Query:    tender_id, site_id, payment_type, payment_direction,
|           payment_scope, payment_sub_type, date range, search
| Response: 200 { success, payments, pagination }
|           400 the account has no company
|
| The ledger behind PaymentsPage.jsx. Rows come denormalised with the
| tender title, site name and counterparty name, so the table renders from
| one response.
|
| Filters are additive and all optional. Each is applied only when
| present, through the addFilter closure below — the same
| bind-then-number pattern used in tenderQueries, which keeps the
| placeholder numbers correct however many filters are supplied.
|
| Security:
| $1 is the company id, seeded before any filter and never removable. Only
| the named query parameters are honoured; the code reads specific keys
| rather than iterating req.query, so a client cannot filter on an
| arbitrary column.
|
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

    /**
     * Binds a filter value and appends its condition.
     *
     * Absent, null and empty-string values are skipped entirely, so an
     * untouched form control does not become `column = ''` — which would
     * match only rows whose value is literally empty.
     *
     * The clause is a function of the placeholder index rather than a
     * string, because the index depends on how many earlier filters were
     * applied. Deriving it from values.length means pushing and numbering
     * cannot drift apart.
     */
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
|
| Auth:     required; office-only
| Audited:  payments / create
| Body:     payment_direction (or the legacy payment_type), payment_date,
|           payment_scope, payment_sub_type, amount, plus whatever the
|           sub-type requires
| Response: 201 { success, payment }
|           400 validation failed — `errors` carries every problem,
|               `message` the first, so a simple client can show one
|           404 a referenced tender, site, worker or subcontractor is not
|               this company's
|
| The order of operations matters and is deliberate:
|
|   1. Normalise the legacy payment_type into a direction.
|   2. Validate the payload — pure, no I/O, so a malformed request costs
|      no database work.
|   3. Check every referenced foreign key belongs to the company.
|   4. Build the record, RECALCULATING every money figure server-side.
|   5. Insert.
|
| Step 4 is the one that matters most. The client sends derived totals so
| its form can show running figures, but buildPaymentRecord recomputes
| them from the inputs — a stale form or an edited request cannot decide
| what is recorded.
|
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
|
| Auth:     required; office-only
| Audited:  payments / update
| Response: 200 { success, payment }
|           400 validation failed
|           404 no such live payment in this company, or a bad reference
|
| Runs the same five steps as create, including the full recalculation.
| An update is a complete replacement of the payment's figures, not a
| patch — every derived value is recomputed from the submitted inputs, so
| editing one field cannot leave a stale total beside it.
|
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
|
| Auth:     required; office-only
| Audited:  payments / delete
| Response: 200 { success, message }
|           400 invalid id
|           404 no such live payment in this company
|
| Soft, and for a stronger reason than the other registers: a payment is
| the financial record. Reports have been produced from it, the audit
| trail references it, and a balance somewhere was computed with it
| included. Flagging rather than removing keeps all of that explicable.
|
| The WHERE clause requires the row to still be live, so deleting twice
| answers 404 rather than silently overwriting the original deleted_at.
|
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
| Auth:     required; office-only
| Response: 200 with totals per scope and sub-type, plus the balance
|
| Aggregated in SQL rather than by summing the ledger client-side, so the
| headline figures cannot disagree with the rows behind them.
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
| Auth:     required; office-only
| Response: 200 with per-investor accrual as of now
|
| Computed live through calculateInterest rather than stored — see that
| function for why simple interest and a 365-day year, and note that
| master.controller.js uses the same one for the per-investor statement.
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
