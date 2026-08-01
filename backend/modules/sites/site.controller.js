const pool = require("../../database/pool");

const asyncHandler = require("../../utils/asyncHandler");

const {
  requireCompanyId,
  getUserId,
  requireParamId,
  sendNotFound,
  cleanText,
} = require("../../utils/requestContext");

/*
|--------------------------------------------------------------------------
| Sites
|--------------------------------------------------------------------------
|
| This module had no tenant scoping at all:
|
|   getSites     listed every company's sites
|   getSiteById  fetched any site by id
|   createSite   took company_id straight from the request body, so a
|                client could create a site inside another company
|   updateSite   updated any site by id
|   deleteSite   deleted any site by id
|
| company_id is now taken from the authenticated session and never from the
| request body, and every statement filters on it.
|
| getSiteById also joined `tenders.site_id`, which does not exist — the
| relationship runs the other way, sites.tender_id -> tenders.id. That query
| raised 42703 every time it was called.
|
*/

/*
|--------------------------------------------------------------------------
| GET /api/sites
|--------------------------------------------------------------------------
*/
exports.getSites = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const conditions = [
      "s.company_id = $1",
      "COALESCE(s.is_deleted, FALSE) = FALSE",
    ];

    const values = [companyId];

    if (req.query.tender_id) {
      values.push(req.query.tender_id);

      conditions.push(
        `s.tender_id = $${values.length}`
      );
    }

    if (req.query.status) {
      values.push(req.query.status);

      conditions.push(
        `s.status = $${values.length}`
      );
    }

    if (req.query.site_type) {
      values.push(req.query.site_type);

      conditions.push(
        `s.site_type = $${values.length}`
      );
    }

    const limit = Math.min(
      Number(req.query.limit) || 200,
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
        s.*,
        t.title AS tender_title,
        COUNT(*) OVER () AS total_count
      FROM sites s
      LEFT JOIN tenders t
        ON t.id = s.tender_id
       AND t.company_id = s.company_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY s.id DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
      `,
      values
    );

    return res.status(200).json({
      success: true,
      sites: result.rows,
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
| GET /api/sites/:id
|--------------------------------------------------------------------------
*/
exports.getSiteById = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const siteId = requireParamId(
      req,
      res,
      "id",
      "site"
    );

    if (!siteId) return;

    const siteResult = await pool.query(
      `
      SELECT *
      FROM sites
      WHERE id = $1
        AND company_id = $2
        AND COALESCE(is_deleted, FALSE) = FALSE
      `,
      [siteId, companyId]
    );

    if (siteResult.rows.length === 0) {
      return sendNotFound(res, "Site");
    }

    // A site belongs to at most one tender, via sites.tender_id. The
    // previous query had this backwards and read a column that does not
    // exist on tenders.
    const tendersResult =
      await pool.query(
        `
        SELECT t.*
        FROM tenders t
        INNER JOIN sites s
          ON s.tender_id = t.id
        WHERE s.id = $1
          AND t.company_id = $2
          AND COALESCE(t.is_deleted, FALSE) = FALSE
        ORDER BY t.id DESC
        `,
        [siteId, companyId]
      );

    return res.status(200).json({
      success: true,
      site: siteResult.rows[0],
      tenders: tendersResult.rows,
    });
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/sites
|--------------------------------------------------------------------------
*/
exports.createSite = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const {
      site_type,
      site_name,
      address,
      status = "active",
      tender_id = null,
      city,
      state,
      postcode,
      country,
    } = req.body;

    if (
      !site_type ||
      !site_name ||
      !address
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Site type, site name and address are required.",
      });
    }

    // A site may only be attached to a tender in the same company.
    if (tender_id) {
      const tender = await pool.query(
        `SELECT 1 FROM tenders
          WHERE id = $1 AND company_id = $2
            AND COALESCE(is_deleted, FALSE) = FALSE`,
        [tender_id, companyId]
      );

      if (tender.rows.length === 0) {
        return sendNotFound(
          res,
          "Tender"
        );
      }
    }

    const result = await pool.query(
      `
      INSERT INTO sites
      (
        company_id, tender_id, site_type, site_name, address,
        status, city, state, postcode, country
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        // Always from the session, never from the body.
        companyId,
        tender_id,
        cleanText(site_type),
        cleanText(site_name),
        cleanText(address),
        status,
        cleanText(city) || null,
        cleanText(state) || null,
        cleanText(postcode) || null,
        cleanText(country) || null,
      ]
    );

    return res.status(201).json({
      success: true,
      site: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| PUT /api/sites/:id
|--------------------------------------------------------------------------
*/
exports.updateSite = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const siteId = requireParamId(
      req,
      res,
      "id",
      "site"
    );

    if (!siteId) return;

    const {
      site_type,
      site_name,
      address,
      status = "active",
      city,
      state,
      postcode,
      country,
    } = req.body;

    if (
      !site_type ||
      !site_name ||
      !address
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Site type, site name and address are required.",
      });
    }

    const result = await pool.query(
      `
      UPDATE sites
      SET site_type = $1,
          site_name = $2,
          address   = $3,
          status    = $4,
          city      = COALESCE($5, city),
          state     = COALESCE($6, state),
          postcode  = COALESCE($7, postcode),
          country   = COALESCE($8, country),
          updated_at = NOW()
      WHERE id = $9
        AND company_id = $10
        AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [
        cleanText(site_type),
        cleanText(site_name),
        cleanText(address),
        status,
        cleanText(city) || null,
        cleanText(state) || null,
        cleanText(postcode) || null,
        cleanText(country) || null,
        siteId,
        companyId,
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(res, "Site");
    }

    return res.status(200).json({
      success: true,
      site: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| DELETE /api/sites/:id
|--------------------------------------------------------------------------
*/
exports.deleteSite = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const siteId = requireParamId(
      req,
      res,
      "id",
      "site"
    );

    if (!siteId) return;

    // Refuse to remove a site that still has activity recorded against it,
    // rather than orphaning those records.
    const linked = await pool.query(
      `
      SELECT
        (SELECT COUNT(*) FROM daily_site_logs
          WHERE site_id = $1 AND company_id = $2
            AND COALESCE(is_deleted, FALSE) = FALSE)::INT AS logs,
        (SELECT COUNT(*) FROM payments
          WHERE site_id = $1 AND company_id = $2
            AND COALESCE(is_deleted, FALSE) = FALSE)::INT AS payments
      `,
      [siteId, companyId]
    );

    const { logs, payments } =
      linked.rows[0];

    if (logs > 0 || payments > 0) {
      return res.status(409).json({
        success: false,
        message: `This site has ${logs} daily update(s) and ${payments} payment(s) recorded against it. Remove those first.`,
      });
    }

    const result = await pool.query(
      `
      UPDATE sites
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
        siteId,
        companyId,
        getUserId(req),
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(res, "Site");
    }

    return res.status(200).json({
      success: true,
      message:
        "Site deleted successfully.",
    });
  }
);
