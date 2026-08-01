const pool = require("../../database/pool");

const asyncHandler = require("../../utils/asyncHandler");

const {
  requireCompanyId,
  getUserId,
  getUserRole,
  requireParamId,
  sendNotFound,
  sendForbidden,
  cleanText,
} = require("../../utils/requestContext");

const {
  SUPERVISOR_EDIT_WINDOW_DAYS,
} = require("../../config/env");

/*
|--------------------------------------------------------------------------
| Tenant scoping
|--------------------------------------------------------------------------
|
| daily_site_logs carries company_id. Every statement below filters on it.
|
| The previous implementation listed logs with no company filter at all and
| deleted by id alone, so any authenticated user could read and destroy
| another company's site history.
|
*/

/**
 * Confirms a site belongs to the caller's company.
 *
 * createSiteLog previously took site_id straight from the request body and
 * inserted without checking, which let a user write a log into another
 * company's site.
 */
const siteBelongsToCompany = async (
  siteId,
  companyId
) => {
  const result = await pool.query(
    `
    SELECT id
    FROM sites
    WHERE id = $1
      AND company_id = $2
      AND COALESCE(is_deleted, FALSE) = FALSE
    `,
    [siteId, companyId]
  );

  return result.rows.length > 0;
};

/**
 * Confirms a tender belongs to the caller's company.
 */
const tenderBelongsToCompany = async (
  tenderId,
  companyId
) => {
  const result = await pool.query(
    `
    SELECT id
    FROM tenders
    WHERE id = $1
      AND company_id = $2
      AND COALESCE(is_deleted, FALSE) = FALSE
    `,
    [tenderId, companyId]
  );

  return result.rows.length > 0;
};

/*
|--------------------------------------------------------------------------
| GET /api/site-logs
|--------------------------------------------------------------------------
*/
exports.getSiteLogs = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const conditions = [
      "dsl.company_id = $1",
      "COALESCE(dsl.is_deleted, FALSE) = FALSE",
    ];

    const values = [companyId];

    if (req.query.site_id) {
      values.push(
        req.query.site_id
      );

      conditions.push(
        `dsl.site_id = $${values.length}`
      );
    }

    if (req.query.tender_id) {
      values.push(
        req.query.tender_id
      );

      conditions.push(
        `dsl.tender_id = $${values.length}`
      );
    }

    if (req.query.from_date) {
      values.push(
        req.query.from_date
      );

      conditions.push(
        `dsl.log_date >= $${values.length}`
      );
    }

    if (req.query.to_date) {
      values.push(req.query.to_date);

      conditions.push(
        `dsl.log_date <= $${values.length}`
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
        dsl.id,
        dsl.site_id,
        s.site_name,
        dsl.worker_id,
        w.full_name AS worker_name,
        dsl.subcontractor_id,
        sc.full_name AS subcontractor_name,
        dsl.tender_id,
        t.title AS tender_title,
        dsl.log_date,
        dsl.notes,
        dsl.photo_url,
        dsl.created_at,
        COUNT(*) OVER () AS total_count
      FROM daily_site_logs dsl
      LEFT JOIN sites s
        ON s.id = dsl.site_id
       AND s.company_id = dsl.company_id
      LEFT JOIN workers w
        ON w.id = dsl.worker_id
       AND w.company_id = dsl.company_id
      LEFT JOIN subcontractors sc
        ON sc.id = dsl.subcontractor_id
       AND sc.company_id = dsl.company_id
      LEFT JOIN tenders t
        ON t.id = dsl.tender_id
       AND t.company_id = dsl.company_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY dsl.log_date DESC, dsl.id DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
      `,
      values
    );

    return res.status(200).json({
      success: true,
      siteLogs: result.rows,
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
| POST /api/site-logs
|--------------------------------------------------------------------------
*/
exports.createSiteLog = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const {
      site_id,
      tender_id = null,
      worker_id = null,
      subcontractor_id = null,
      log_date,
      notes,
      photo_url,
      photo_source = "unknown",
    } = req.body;

    if (!site_id || !log_date) {
      return res.status(400).json({
        success: false,
        message:
          "Site and log date are required.",
      });
    }

    if (
      !worker_id &&
      !subcontractor_id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Worker or subcontractor is required.",
      });
    }

    // Ownership checks on every client-supplied foreign key.
    if (
      !(await siteBelongsToCompany(
        site_id,
        companyId
      ))
    ) {
      return sendNotFound(
        res,
        "Site"
      );
    }

    if (
      tender_id &&
      !(await tenderBelongsToCompany(
        tender_id,
        companyId
      ))
    ) {
      return sendNotFound(
        res,
        "Tender"
      );
    }

    const selectedDate = new Date(
      log_date
    );

    const today = new Date();

    selectedDate.setHours(
      0,
      0,
      0,
      0
    );

    today.setHours(0, 0, 0, 0);

    const diffDays = Math.floor(
      (today - selectedDate) /
        (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) {
      return res.status(400).json({
        success: false,
        message:
          "Future daily updates are not allowed.",
      });
    }

    // Backdating window, from the operations notes: entries go in within a
    // couple of days; older ones need the office to grant access.
    if (
      diffDays >
        SUPERVISOR_EDIT_WINDOW_DAYS &&
      getUserRole(req) !== "admin"
    ) {
      return sendForbidden(
        res,
        `You cannot add an update older than ${SUPERVISOR_EDIT_WINDOW_DAYS} days. Request access from the office.`
      );
    }

    const result = await pool.query(
      `
      INSERT INTO daily_site_logs
      (
        company_id,
        site_id,
        tender_id,
        worker_id,
        subcontractor_id,
        log_date,
        notes,
        photo_url,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        companyId,
        site_id,
        tender_id || null,
        worker_id || null,
        subcontractor_id || null,
        log_date,
        cleanText(notes),
        photo_url || null,
        getUserId(req),
      ]
    );

    return res.status(201).json({
      success: true,
      siteLog: {
        ...result.rows[0],
        photo_source,
      },
    });
  }
);

/*
|--------------------------------------------------------------------------
| DELETE /api/site-logs/:id
|--------------------------------------------------------------------------
*/
exports.deleteSiteLog = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const logId = requireParamId(
      req,
      res,
      "id",
      "site log"
    );

    if (!logId) {
      return;
    }

    const result = await pool.query(
      `
      UPDATE daily_site_logs
      SET is_deleted = TRUE,
          deleted_at = NOW(),
          deleted_by = $3
      WHERE id = $1
        AND company_id = $2
        AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING id
      `,
      [
        logId,
        companyId,
        getUserId(req),
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Site log"
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Site log deleted successfully.",
    });
  }
);
