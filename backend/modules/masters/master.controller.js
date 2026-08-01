const pool = require("../../database/pool");

const asyncHandler = require("../../utils/asyncHandler");

const {
  requireCompanyId,
  requireParamId,
  sendNotFound,
  cleanText,
  cleanLowerText,
} = require("../../utils/requestContext");

/*
|--------------------------------------------------------------------------
| Master data
|--------------------------------------------------------------------------
|
| investors, suppliers and clients already existed in the database but no
| code touched them, so payments could only record a free-text
| investor_name. That makes it impossible to answer "what do we owe this
| investor across every tender".
|
| The three tables share the same shape — name, contact details, status —
| so one parameterised controller serves all of them rather than three
| near-identical files.
|
*/

const MASTERS = Object.freeze({
  investors: {
    table: "investors",
    label: "Investor",
    collection: "investors",
    // Columns beyond the shared set.
    extraColumns: [],
  },
  suppliers: {
    table: "suppliers",
    label: "Supplier",
    collection: "suppliers",
    extraColumns: ["gst_number"],
  },
  clients: {
    table: "clients",
    label: "Client",
    collection: "clients",
    extraColumns: ["gst_number"],
  },
});

const SHARED_COLUMNS = [
  "name",
  "phone",
  "email",
  "address",
  "status",
];

/**
 * Resolves the master config from the route, refusing anything not on the
 * allowlist. The table name is interpolated into SQL, so it must never come
 * from user input unchecked.
 */
const resolveMaster = (req, res) => {
  const key = req.params.master;

  const config = MASTERS[key];

  if (!config) {
    res.status(404).json({
      success: false,
      message: "Unknown master type.",
    });

    return null;
  }

  return config;
};

/**
 * Columns this master accepts, in a stable order.
 */
const columnsFor = (config) => [
  ...SHARED_COLUMNS,
  ...config.extraColumns,
  ...(config.table === "investors"
    ? ["notes"]
    : []),
];

/*
|--------------------------------------------------------------------------
| GET /api/masters/:master
|--------------------------------------------------------------------------
*/
exports.list = asyncHandler(
  async (req, res) => {
    const config = resolveMaster(
      req,
      res
    );

    if (!config) return;

    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const conditions = [
      "m.company_id = $1",
    ];

    const values = [companyId];

    if (req.query.status) {
      values.push(req.query.status);

      conditions.push(
        `m.status = $${values.length}`
      );
    }

    if (req.query.search) {
      values.push(
        `%${cleanLowerText(
          req.query.search
        )}%`
      );

      conditions.push(
        `(lower(m.name) LIKE $${values.length}
          OR lower(COALESCE(m.phone, '')) LIKE $${values.length}
          OR lower(COALESCE(m.email, '')) LIKE $${values.length})`
      );
    }

    const result = await pool.query(
      `
      SELECT m.*
      FROM ${config.table} m
      WHERE ${conditions.join(" AND ")}
      ORDER BY m.name
      LIMIT 500
      `,
      values
    );

    return res.status(200).json({
      success: true,
      [config.collection]: result.rows,
      // A stable key as well, so clients can read either shape.
      items: result.rows,
    });
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/masters/:master
|--------------------------------------------------------------------------
*/
exports.create = asyncHandler(
  async (req, res) => {
    const config = resolveMaster(
      req,
      res
    );

    if (!config) return;

    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const name = cleanText(
      req.body.name
    );

    if (!name) {
      return res.status(400).json({
        success: false,
        message: `${config.label} name is required.`,
      });
    }

    const columns =
      columnsFor(config);

    const values = [
      companyId,
      ...columns.map((column) =>
        column === "status"
          ? req.body.status || "active"
          : cleanText(
              req.body[column]
            ) || null
      ),
    ];

    // Overwrite the name slot with the validated value.
    values[1] = name;

    const placeholders = values
      .map((_, i) => `$${i + 1}`)
      .join(", ");

    const result = await pool.query(
      `
      INSERT INTO ${config.table}
        (company_id, ${columns.join(", ")})
      VALUES (${placeholders})
      RETURNING *
      `,
      values
    );

    return res.status(201).json({
      success: true,
      item: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| PUT /api/masters/:master/:id
|--------------------------------------------------------------------------
*/
exports.update = asyncHandler(
  async (req, res) => {
    const config = resolveMaster(
      req,
      res
    );

    if (!config) return;

    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const id = requireParamId(
      req,
      res,
      "id",
      config.label.toLowerCase()
    );

    if (!id) return;

    const columns =
      columnsFor(config);

    // COALESCE keeps an omitted field at its current value, so a partial
    // update does not blank out everything it did not mention.
    const assignments = columns
      .map(
        (column, i) =>
          `${column} = COALESCE($${i + 1}, ${column})`
      )
      .join(", ");

    const values = columns.map(
      (column) =>
        cleanText(req.body[column]) ||
        null
    );

    values.push(id, companyId);

    const result = await pool.query(
      `
      UPDATE ${config.table}
      SET ${assignments}, updated_at = NOW()
      WHERE id = $${values.length - 1}
        AND company_id = $${values.length}
      RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        config.label
      );
    }

    return res.status(200).json({
      success: true,
      item: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| DELETE /api/masters/:master/:id
|--------------------------------------------------------------------------
|
| These tables have no is_deleted column, so removal is a status change
| rather than a delete. That keeps historic payments pointing at a row that
| still resolves.
|
*/
exports.archive = asyncHandler(
  async (req, res) => {
    const config = resolveMaster(
      req,
      res
    );

    if (!config) return;

    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const id = requireParamId(
      req,
      res,
      "id",
      config.label.toLowerCase()
    );

    if (!id) return;

    const result = await pool.query(
      `
      UPDATE ${config.table}
      SET status = 'inactive', updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING id
      `,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        config.label
      );
    }

    return res.status(200).json({
      success: true,
      message: `${config.label} archived.`,
    });
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/masters/investors/:id/statement
|--------------------------------------------------------------------------
|
| Everything taken from and returned to one investor, with interest accrued
| to date. This is the reason the investors table is worth wiring up.
|
*/
exports.getInvestorStatement =
  asyncHandler(async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const id = requireParamId(
      req,
      res,
      "id",
      "investor"
    );

    if (!id) return;

    const investorResult =
      await pool.query(
        `SELECT * FROM investors WHERE id = $1 AND company_id = $2`,
        [id, companyId]
      );

    if (
      investorResult.rows.length === 0
    ) {
      return sendNotFound(
        res,
        "Investor"
      );
    }

    const investor =
      investorResult.rows[0];

    // Match on the foreign key where it is set, and fall back to the
    // free-text name for rows created before investor_id existed.
    const payments = await pool.query(
      `
      SELECT
        p.id,
        p.payment_direction,
        p.payment_date,
        p.amount,
        p.interest_percent,
        p.fd_site,
        p.payment_mode,
        p.details,
        p.tender_id,
        t.title AS tender_title
      FROM payments p
      LEFT JOIN tenders t
        ON t.id = p.tender_id AND t.company_id = p.company_id
      WHERE p.company_id = $1
        AND p.payment_sub_type = 'INVESTOR'
        AND (p.investor_id = $2 OR lower(p.investor_name) = lower($3))
        AND COALESCE(p.is_deleted, FALSE) = FALSE
      ORDER BY p.payment_date DESC, p.id DESC
      `,
      [companyId, id, investor.name]
    );

    const {
      calculateInterest,
      money,
    } = require("../payments/payment.service");

    let received = 0;

    let returned = 0;

    let interest = 0;

    const entries = payments.rows.map(
      (row) => {
        const accrual =
          calculateInterest({
            principal: row.amount,
            interestPercent:
              row.interest_percent,
            fromDate:
              row.payment_date,
          });

        if (
          row.payment_direction ===
          "income"
        ) {
          // Money taken in from the investor.
          received += money(
            row.amount
          );

          interest +=
            accrual.interest_amount;
        } else {
          returned += money(
            row.amount
          );
        }

        return {
          ...row,
          ...accrual,
        };
      }
    );

    return res.status(200).json({
      success: true,
      investor,
      entries,
      summary: {
        total_received: received,
        total_returned: returned,
        interest_accrued: interest,
        outstanding:
          received +
          interest -
          returned,
      },
    });
  });
