/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The labour ledger: the people or gangs working a site, and the daily
| entries recorded against each.
|
| A two-level structure, unlike materials. A `labour` row is the labourer
| or gang; `labour_work_entries` are the days they worked. The ledger view puts
| the two together into a running account — days worked, amount due,
| amount paid.
|
| Responsibilities:
|   - Serve the labour category reference list
|   - List labour records for a site
|   - Create, update and soft-delete a labour record
|   - Record a day's work against one labour record
|   - Produce the per-labour ledger
|
| Exports (all Express handlers):
|   getCategories, getLabour, createLabour, getLedger, createWorkEntry,
|   updateLabour, deleteLabour
|
| Used by:
|   ./siteOperations.routes.js
|
| Depends on:
|   database/pool.js, utils/asyncHandler.js, utils/requestContext.js
|   ./entryWindow.service.js — applied to work entries, which are dated
|
| Database tables touched:
|   labour             SELECT, INSERT, UPDATE
|   labour_work_entries  SELECT, INSERT
|   labour_categories  SELECT
|   sites, tenders     SELECT, for ownership checks
|
| API surface:
|   GET    /api/site-operations/labour/categories
|   GET    /api/site-operations/labour
|   POST   /api/site-operations/labour
|   GET    /api/site-operations/labour/:id/ledger
|   POST   /api/site-operations/labour/:id/entries
|   PUT    /api/site-operations/labour/:id
|   DELETE /api/site-operations/labour/:id
|
| Frontend consumers:
|   siteOperationsService.js -> useSiteOperations.js -> SiteOperationsPage
|
| Security:
|   Every statement is company-scoped. A labour id from another company
|   matches nothing, so the ledger and the work-entry endpoints cannot be
|   pointed at another tenant's records.
|
| Note:
|   This is the one site-operations area with NO approve/reject workflow.
|   A supervisor records and amends labour directly, bounded only by the
|   entry window — unlike materials and banking expenses, which the office
|   signs off.
|
|   `labour` carries a `category_local` column that the seed data leaves
|   null, filling labour_categories.name_local instead. See F-06.
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
| Labour ledger
|--------------------------------------------------------------------------
|
| From the notebook (p.05, "લિબરકામ"):
|
|   "A list of labourers, which the supervisor adds by name for those
|    working under them."
|
|   "Each labourer's account stays here — how many rupees are paid to them
|    each day. The labourer's name can be added with their work label, such
|    as કડિયા (mason), પ્લાસ્ટર (plaster), છત કામ (roofing)."
|
|   "Clicking on any one labourer's name opens a small section beside it
|    showing that labourer's total wages."
|
| So: a labour master per supervisor, and a dated wage ledger per labourer
| with a running paid/outstanding balance.
|
*/

/*
|--------------------------------------------------------------------------
| GET /api/site-operations/labour/categories
|--------------------------------------------------------------------------
*/
exports.getCategories = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const result = await pool.query(
      `
      SELECT id, code, name, name_local, default_rate, sort_order
      FROM labour_categories
      WHERE company_id = $1 AND is_active = TRUE
      ORDER BY sort_order, name
      `,
      [companyId]
    );

    return res.status(200).json({
      success: true,
      categories: result.rows,
    });
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/site-operations/labour
|--------------------------------------------------------------------------
|
| The labour list, each row carrying its running totals so the UI can show
| the per-labourer summary without a second request.
|
*/
exports.getLabour = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const conditions = [
      "l.company_id = $1",
      "COALESCE(l.is_deleted, FALSE) = FALSE",
    ];

    const values = [companyId];

    const addFilter = (
      value,
      clause
    ) => {
      if (!value) return;

      values.push(value);

      conditions.push(
        clause(values.length)
      );
    };

    addFilter(
      req.query.tender_id,
      (i) => `l.tender_id = $${i}`
    );

    addFilter(
      req.query.site_id,
      (i) => `l.site_id = $${i}`
    );

    addFilter(
      req.query.category,
      (i) => `l.category = $${i}`
    );

    addFilter(
      req.query.status,
      (i) => `l.status = $${i}`
    );

    // A supervisor sees only their own labour list; admins see all.
    const role = String(
      getUserRole(req) || ""
    ).toLowerCase();

    if (
      !["admin", "manager"].includes(
        role
      )
    ) {
      values.push(getUserId(req));

      conditions.push(
        `l.supervisor_user_id = $${values.length}`
      );
    }

    const result = await pool.query(
      `
      SELECT
        l.id,
        l.full_name,
        l.phone,
        l.category,
        l.category_local,
        l.daily_rate,
        l.status,
        l.tender_id,
        t.title AS tender_title,
        l.site_id,
        s.site_name,
        l.supervisor_user_id,
        u.full_name AS supervisor_name,
        l.created_at,

        COALESCE(led.total_wage, 0)    AS total_wage,
        COALESCE(led.total_paid, 0)    AS total_paid,
        COALESCE(led.total_wage, 0)
          - COALESCE(led.total_paid, 0) AS outstanding,
        COALESCE(led.days_worked, 0)   AS total_days,
        led.last_work_date
      FROM labour l
      LEFT JOIN tenders t
        ON t.id = l.tender_id AND t.company_id = l.company_id
      LEFT JOIN sites s
        ON s.id = l.site_id AND s.company_id = l.company_id
      LEFT JOIN users u
        ON u.id = l.supervisor_user_id
      LEFT JOIN LATERAL (
        SELECT
          SUM(e.wage_amount)  AS total_wage,
          SUM(e.amount_paid)  AS total_paid,
          SUM(e.days_worked)  AS days_worked,
          MAX(e.work_date)    AS last_work_date
        FROM labour_work_entries e
        WHERE e.labour_id = l.id
          AND e.company_id = l.company_id
          AND e.approval_status <> 'rejected'
          AND COALESCE(e.is_deleted, FALSE) = FALSE
      ) led ON TRUE
      WHERE ${conditions.join(" AND ")}
      ORDER BY l.full_name
      `,
      values
    );

    return res.status(200).json({
      success: true,
      labour: result.rows,
    });
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/site-operations/labour
|--------------------------------------------------------------------------
*/
exports.createLabour = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const {
      full_name,
      phone,
      category = "other",
      daily_rate,
      tender_id = null,
      site_id = null,
      notes,
    } = req.body;

    const name = cleanText(full_name);

    if (!name) {
      return res.status(400).json({
        success: false,
        message:
          "Labour name is required.",
      });
    }

    // Pull the local-language label from the category lookup so the site
    // screens can show કડિયા rather than "kadiya".
    /*
     * A labourer belongs to a site, and every work entry recorded against
     * them inherits that site (see the entries insert below). So this is
     * the one place the site has to be established. See
     * siteScope.service.js for why it stopped being optional.
     */
    const scope = await resolveEntrySite({
      siteId: site_id,
      tenderId: tender_id,
      companyId,
      subject: "labourer",
    });

    if (scope.error) {
      return res
        .status(scope.error.status)
        .json(scope.error.body);
    }

    const categoryResult =
      await pool.query(
        `
        SELECT name_local, default_rate
        FROM labour_categories
        WHERE company_id = $1 AND code = $2
        `,
        [companyId, category]
      );

    const categoryRow =
      categoryResult.rows[0] || null;

    const rate =
      toNumber(daily_rate) ||
      Number(
        categoryRow?.default_rate || 0
      );

    const result = await pool.query(
      `
      INSERT INTO labour
      (
        company_id, tender_id, site_id, supervisor_user_id,
        full_name, phone, category, category_local, daily_rate,
        notes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
      `,
      [
        companyId,
        scope.site.tender_id,
        scope.site.id,
        getUserId(req),
        name,
        cleanText(phone),
        category,
        categoryRow?.name_local ||
          null,
        rate,
        cleanText(notes),
        getUserId(req),
      ]
    );

    return res.status(201).json({
      success: true,
      labour: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/site-operations/labour/:id/ledger
|--------------------------------------------------------------------------
|
| The "click a labourer to see their account" view.
|
*/
exports.getLedger = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const labourId = requireParamId(
      req,
      res,
      "id",
      "labour"
    );

    if (!labourId) return;

    const labourResult =
      await pool.query(
        `
        SELECT l.*, u.full_name AS supervisor_name
        FROM labour l
        LEFT JOIN users u ON u.id = l.supervisor_user_id
        WHERE l.id = $1
          AND l.company_id = $2
          AND COALESCE(l.is_deleted, FALSE) = FALSE
        `,
        [labourId, companyId]
      );

    if (
      labourResult.rows.length === 0
    ) {
      return sendNotFound(
        res,
        "Labour"
      );
    }

    const entriesResult =
      await pool.query(
        `
        SELECT
          e.id,
          e.work_date,
          e.days_worked,
          e.hours_worked,
          e.rate,
          e.wage_amount,
          e.amount_paid,
          e.balance_amount,
          e.work_description,
          e.payment_mode,
          e.approval_status,
          e.admin_comment,
          e.created_at
        FROM labour_work_entries e
        WHERE e.labour_id = $1
          AND e.company_id = $2
          AND COALESCE(e.is_deleted, FALSE) = FALSE
        ORDER BY e.work_date DESC, e.id DESC
        `,
        [labourId, companyId]
      );

    const totals =
      entriesResult.rows.reduce(
        (acc, row) => {
          if (
            row.approval_status ===
            "rejected"
          ) {
            return acc;
          }

          acc.wage += Number(
            row.wage_amount || 0
          );

          acc.paid += Number(
            row.amount_paid || 0
          );

          acc.days += Number(
            row.days_worked || 0
          );

          return acc;
        },
        { wage: 0, paid: 0, days: 0 }
      );

    return res.status(200).json({
      success: true,
      labour: labourResult.rows[0],
      entries: entriesResult.rows,
      summary: {
        total_wage: totals.wage,
        total_paid: totals.paid,
        outstanding:
          totals.wage - totals.paid,
        total_days: totals.days,
      },
    });
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/site-operations/labour/:id/entries
|--------------------------------------------------------------------------
*/
exports.createWorkEntry = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const labourId = requireParamId(
      req,
      res,
      "id",
      "labour"
    );

    if (!labourId) return;

    const {
      work_date,
      days_worked = 1,
      hours_worked = null,
      rate,
      amount_paid = 0,
      work_description,
      payment_mode = "cash",
    } = req.body;

    if (!work_date) {
      return res.status(400).json({
        success: false,
        message:
          "Work date is required.",
      });
    }

    // Ownership: resolves the labourer within the caller's company.
    const labourResult =
      await pool.query(
        `
        SELECT id, daily_rate, tender_id, site_id
        FROM labour
        WHERE id = $1
          AND company_id = $2
          AND COALESCE(is_deleted, FALSE) = FALSE
        `,
        [labourId, companyId]
      );

    const labour =
      labourResult.rows[0];

    if (!labour) {
      return sendNotFound(
        res,
        "Labour"
      );
    }

    const windowCheck =
      await checkEntryWindow({
        companyId,
        userId: getUserId(req),
        userRole: getUserRole(req),
        module: MODULES.LABOUR,
        entryDate: work_date,
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

    const days = toNumber(
      days_worked,
      1
    );

    // toNumber falls back to 0 for a missing value, so `?? ` would never
    // fire here — an omitted rate has to be detected before conversion,
    // otherwise every entry is priced at zero.
    const rateProvided =
      rate !== undefined &&
      rate !== null &&
      rate !== "";

    const appliedRate = rateProvided
      ? toNumber(rate, 0)
      : Number(
          labour.daily_rate || 0
        );

    const wageAmount =
      days * appliedRate;

    const paid =
      toNumber(amount_paid) || 0;

    if (paid < 0) {
      return res.status(400).json({
        success: false,
        message:
          "Amount paid cannot be negative.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO labour_work_entries
      (
        company_id, labour_id, tender_id, site_id,
        work_date, days_worked, hours_worked, rate,
        wage_amount, amount_paid, balance_amount,
        work_description, payment_mode,
        recorded_by, access_request_id, approval_status
      )
      VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending')
      RETURNING *
      `,
      [
        companyId,
        labourId,
        labour.tender_id,
        labour.site_id,
        work_date,
        days,
        hours_worked,
        appliedRate,
        wageAmount,
        paid,
        wageAmount - paid,
        cleanText(work_description),
        payment_mode,
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
      entry: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| PUT /api/site-operations/labour/:id
|--------------------------------------------------------------------------
*/
exports.updateLabour = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const labourId = requireParamId(
      req,
      res,
      "id",
      "labour"
    );

    if (!labourId) return;

    const {
      full_name,
      phone,
      category,
      daily_rate,
      status,
      notes,
    } = req.body;

    const result = await pool.query(
      `
      UPDATE labour
      SET full_name  = COALESCE($1, full_name),
          phone      = COALESCE($2, phone),
          category   = COALESCE($3, category),
          daily_rate = COALESCE($4, daily_rate),
          status     = COALESCE($5, status),
          notes      = COALESCE($6, notes),
          updated_at = NOW()
      WHERE id = $7
        AND company_id = $8
        AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [
        cleanText(full_name) || null,
        cleanText(phone) || null,
        category || null,
        // Must stay null when the field is absent. toNumber would turn an
        // omitted rate into 0, and COALESCE would then write that 0 over
        // the labourer's existing rate on any partial update.
        daily_rate === undefined ||
        daily_rate === null ||
        daily_rate === ""
          ? null
          : toNumber(daily_rate, 0),
        status || null,
        cleanText(notes) || null,
        labourId,
        companyId,
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Labour"
      );
    }

    return res.status(200).json({
      success: true,
      labour: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| DELETE /api/site-operations/labour/:id
|--------------------------------------------------------------------------
*/
exports.deleteLabour = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const labourId = requireParamId(
      req,
      res,
      "id",
      "labour"
    );

    if (!labourId) return;

    const result = await pool.query(
      `
      UPDATE labour
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
        labourId,
        companyId,
        getUserId(req),
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Labour"
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Labour removed successfully.",
    });
  }
);
