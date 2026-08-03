/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Material received on site: what arrived, how much, at what rate, on which
| bill, with an optional photo of the docket.
|
| Distinct from the tender materials under /api/tenders/:id/materials,
| which are the PLAN priced when the job was won. These are the record of
| what actually turned up. Nothing reconciles the two.
|
| Responsibilities:
|   - Serve the material catalog a supervisor picks names from
|   - List and summarise entries for a site
|   - Record a new delivery, subject to the entry window
|   - Soft-delete an entry
|   - Approve or reject an entry (office only)
|
| Exports (all Express handlers):
|   getCatalog, getSummary, getEntries, createEntry, deleteEntry,
|   approveEntry, rejectEntry
|
| Used by:
|   ./siteOperations.routes.js
|
| Depends on:
|   database/pool.js, utils/asyncHandler.js, utils/requestContext.js
|   ./entryWindow.service.js — the backdating rule
|
| Database tables touched:
|   material_entries   SELECT, INSERT, UPDATE (approval and soft delete)
|   material_catalog   SELECT
|   sites, tenders     SELECT, for ownership checks
|
| API surface:
|   GET    /api/site-operations/materials/catalog
|   GET    /api/site-operations/materials/summary
|   GET    /api/site-operations/materials
|   POST   /api/site-operations/materials
|   DELETE /api/site-operations/materials/:id
|   POST   /api/site-operations/materials/:id/approve   office only
|   POST   /api/site-operations/materials/:id/reject    office only
|
| Frontend consumers:
|   siteOperationsService.js -> useSiteOperations.js -> SiteOperationsPage
|
| Security:
|   Recording is open to any authenticated user; approving is office-only,
|   so the person who records a delivery cannot also sign it off. Every
|   statement is company-scoped, and site_id is checked against the
|   caller's company before an entry is attached to it.
|
| Note:
|   material_catalog carries both `name` and `name_local` (Gujarati). See
|   F-06 for the inconsistency between that and the labour tables.
|
*/

const pool = require("../../database/pool");

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
| Site material entries
|--------------------------------------------------------------------------
|
| From the notebook (p.02-03):
|
|   "Whatever quantity of the above arrives each day is added with its rate
|    and bill. Keep a photo upload option too."
|
|   "Keep an option to add the material photo from gallery OR direct camera.
|    The company should get data on whether this photo is current or was
|    uploaded from the gallery."
|
| photo_source records which of the two the supervisor used. It is reported
| honestly rather than trusted: photo_is_verified is only set when the client
| supplies a capture timestamp close to the upload, which a gallery re-upload
| of an old file will not satisfy.
|
*/

const VALID_PHOTO_SOURCES = new Set([
  "camera",
  "gallery",
  "unknown",
]);

/**
 * How close a claimed capture time must be to now for a "camera" claim to
 * be treated as corroborated. Ten minutes covers a slow upload on a poor
 * site connection without accepting yesterday's photo.
 */
const LIVE_CAPTURE_TOLERANCE_MS =
  10 * 60 * 1000;

/**
 * Decides whether a "taken just now" claim is credible.
 *
 * This is corroboration, not proof — a determined user can forge the
 * timestamp. It exists so the office can sort entries by confidence, which
 * is what the notebook actually asks for.
 */
const assessPhoto = ({
  photoSource,
  photoCapturedAt,
}) => {
  const source =
    VALID_PHOTO_SOURCES.has(
      photoSource
    )
      ? photoSource
      : "unknown";

  if (source !== "camera") {
    return {
      source,
      capturedAt:
        photoCapturedAt || null,
      isVerified: false,
    };
  }

  const captured = photoCapturedAt
    ? new Date(photoCapturedAt)
    : null;

  const isFresh =
    captured &&
    !Number.isNaN(
      captured.getTime()
    ) &&
    Math.abs(
      Date.now() - captured.getTime()
    ) <= LIVE_CAPTURE_TOLERANCE_MS;

  return {
    source,
    capturedAt: captured
      ? captured.toISOString()
      : null,
    isVerified: Boolean(isFresh),
  };
};

/**
 * Confirms a tender belongs to the caller's company.
 */
const tenderInCompany = async (
  tenderId,
  companyId
) => {
  if (!tenderId) return true;

  const result = await pool.query(
    `SELECT 1 FROM tenders
      WHERE id = $1 AND company_id = $2
        AND COALESCE(is_deleted, FALSE) = FALSE`,
    [tenderId, companyId]
  );

  return result.rows.length > 0;
};

const siteInCompany = async (
  siteId,
  companyId
) => {
  if (!siteId) return true;

  const result = await pool.query(
    `SELECT 1 FROM sites
      WHERE id = $1 AND company_id = $2
        AND COALESCE(is_deleted, FALSE) = FALSE`,
    [siteId, companyId]
  );

  return result.rows.length > 0;
};

/*
|--------------------------------------------------------------------------
| GET /api/site-operations/materials/catalog
|--------------------------------------------------------------------------
*/
exports.getCatalog = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        name_local,
        main_section,
        unit,
        hsn_code,
        default_gst_percent,
        sort_order
      FROM material_catalog
      WHERE company_id = $1
        AND is_active = TRUE
      ORDER BY sort_order, name
      `,
      [companyId]
    );

    // Grouped by main_section so the UI can render the notebook's
    // "Main Section" structure without regrouping client-side.
    const sections = result.rows.reduce(
      (acc, row) => {
        (acc[row.main_section] ??=
          []).push(row);

        return acc;
      },
      {}
    );

    return res.status(200).json({
      success: true,
      materials: result.rows,
      sections,
    });
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/site-operations/materials
|--------------------------------------------------------------------------
*/
exports.getEntries = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const conditions = [
      "sme.company_id = $1",
      "COALESCE(sme.is_deleted, FALSE) = FALSE",
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
      (i) => `sme.tender_id = $${i}`
    );

    addFilter(
      req.query.site_id,
      (i) => `sme.site_id = $${i}`
    );

    addFilter(
      req.query.material_id,
      (i) => `sme.material_id = $${i}`
    );

    addFilter(
      req.query.approval_status,
      (i) =>
        `sme.approval_status = $${i}`
    );

    addFilter(
      req.query.from_date,
      (i) => `sme.entry_date >= $${i}`
    );

    addFilter(
      req.query.to_date,
      (i) => `sme.entry_date <= $${i}`
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
        sme.id,
        sme.tender_id,
        t.title AS tender_title,
        sme.site_id,
        s.site_name,
        sme.material_id,
        sme.material_name,
        sme.main_section,
        sme.entry_date,
        sme.quantity,
        sme.unit,
        sme.rate,
        sme.amount,
        sme.gst_percent,
        sme.gst_amount,
        sme.total_amount,
        sme.supplier_id,
        sme.supplier_name,
        sme.bill_number,
        sme.bill_url,
        sme.vehicle_number,
        sme.photo_url,
        sme.photo_source,
        sme.photo_captured_at,
        sme.photo_is_verified,
        sme.approval_status,
        sme.admin_comment,
        sme.recorded_by,
        u.full_name AS recorded_by_name,
        sme.created_at,
        COUNT(*) OVER () AS total_count
      FROM site_material_entries sme
      LEFT JOIN tenders t
        ON t.id = sme.tender_id
       AND t.company_id = sme.company_id
      LEFT JOIN sites s
        ON s.id = sme.site_id
       AND s.company_id = sme.company_id
      LEFT JOIN users u
        ON u.id = sme.recorded_by
      WHERE ${conditions.join(" AND ")}
      ORDER BY sme.entry_date DESC, sme.id DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
      `,
      values
    );

    return res.status(200).json({
      success: true,
      entries: result.rows,
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
| POST /api/site-operations/materials
|--------------------------------------------------------------------------
*/
exports.createEntry = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const {
      tender_id = null,
      site_id = null,
      material_id = null,
      material_name,
      entry_date,
      quantity,
      unit,
      rate,
      gst_percent,
      supplier_id = null,
      supplier_name,
      bill_number,
      bill_url,
      vehicle_number,
      photo_url,
      photo_source,
      photo_captured_at,
    } = req.body;

    if (!entry_date) {
      return res.status(400).json({
        success: false,
        message:
          "Entry date is required.",
      });
    }

    const qty = toNumber(quantity);

    if (
      !Number.isFinite(qty) ||
      qty <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Quantity must be greater than zero.",
      });
    }

    const unitRate =
      toNumber(rate) || 0;

    if (unitRate < 0) {
      return res.status(400).json({
        success: false,
        message:
          "Rate cannot be negative.",
      });
    }

    // Resolve the catalog row so name, unit and GST default from it rather
    // than being trusted from the client.
    let resolved = null;

    if (material_id) {
      const catalogResult =
        await pool.query(
          `
          SELECT name, name_local, main_section, unit, default_gst_percent
          FROM material_catalog
          WHERE id = $1 AND company_id = $2 AND is_active = TRUE
          `,
          [material_id, companyId]
        );

      resolved =
        catalogResult.rows[0] || null;

      if (!resolved) {
        return sendNotFound(
          res,
          "Material"
        );
      }
    }

    const finalName = cleanText(
      resolved?.name || material_name
    );

    if (!finalName) {
      return res.status(400).json({
        success: false,
        message:
          "Select a material or provide a material name.",
      });
    }

    if (
      !(await tenderInCompany(
        tender_id,
        companyId
      ))
    ) {
      return sendNotFound(
        res,
        "Tender"
      );
    }

    if (
      !(await siteInCompany(
        site_id,
        companyId
      ))
    ) {
      return sendNotFound(
        res,
        "Site"
      );
    }

    // The two-day rule.
    const windowCheck =
      await checkEntryWindow({
        companyId,
        userId: getUserId(req),
        userRole: getUserRole(req),
        module: MODULES.MATERIAL,
        entryDate: entry_date,
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

    const photo = assessPhoto({
      photoSource: photo_source,
      photoCapturedAt:
        photo_captured_at,
    });

    // Money is computed server-side; the client does not get to send a
    // total that disagrees with quantity x rate.
    const amount = qty * unitRate;

    const gstPercent =
      gst_percent === undefined ||
      gst_percent === null
        ? Number(
            resolved?.default_gst_percent ||
              0
          )
        : toNumber(gst_percent) || 0;

    const gstAmount =
      (amount * gstPercent) / 100;

    const totalAmount =
      amount + gstAmount;

    const result = await pool.query(
      `
      INSERT INTO site_material_entries
      (
        company_id, tender_id, site_id, material_id, material_name,
        main_section, entry_date, quantity, unit, rate, amount,
        gst_percent, gst_amount, total_amount,
        supplier_id, supplier_name, bill_number, bill_url, vehicle_number,
        photo_url, photo_source, photo_captured_at, photo_is_verified,
        recorded_by, access_request_id, approval_status
      )
      VALUES
      (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17, $18, $19,
        $20, $21, $22, $23,
        $24, $25, 'pending'
      )
      RETURNING *
      `,
      [
        companyId,
        tender_id,
        site_id,
        material_id,
        finalName,
        resolved?.main_section ||
          null,
        entry_date,
        qty,
        cleanText(
          unit || resolved?.unit
        ) || "unit",
        unitRate,
        amount,
        gstPercent,
        gstAmount,
        totalAmount,
        supplier_id,
        cleanText(supplier_name),
        cleanText(bill_number),
        bill_url || null,
        cleanText(vehicle_number),
        photo_url || null,
        photo.source,
        photo.capturedAt,
        photo.isVerified,
        getUserId(req),
        windowCheck.accessRequestId,
      ]
    );

    // A backdating grant covers one entry.
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
| DELETE /api/site-operations/materials/:id
|--------------------------------------------------------------------------
*/
exports.deleteEntry = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const entryId = requireParamId(
      req,
      res,
      "id",
      "material entry"
    );

    if (!entryId) return;

    const result = await pool.query(
      `
      UPDATE site_material_entries
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
        entryId,
        companyId,
        getUserId(req),
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Material entry"
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Material entry deleted successfully.",
    });
  }
);

/*
|--------------------------------------------------------------------------
| Approval
|--------------------------------------------------------------------------
*/
const setApprovalStatus = (
  nextStatus
) =>
  asyncHandler(async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const entryId = requireParamId(
      req,
      res,
      "id",
      "material entry"
    );

    if (!entryId) return;

    const result = await pool.query(
      `
      UPDATE site_material_entries
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
        entryId,
        companyId,
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Material entry"
      );
    }

    return res.status(200).json({
      success: true,
      entry: result.rows[0],
    });
  });

exports.approveEntry =
  setApprovalStatus("approved");

exports.rejectEntry =
  setApprovalStatus("rejected");

/*
|--------------------------------------------------------------------------
| GET /api/site-operations/materials/summary
|--------------------------------------------------------------------------
|
| Per-material totals for a tender, which is what the office needs in order
| to reconcile what was delivered against what was billed.
|
*/
exports.getSummary = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const values = [companyId];

    let tenderFilter = "";

    if (req.query.tender_id) {
      values.push(
        req.query.tender_id
      );

      tenderFilter = `AND sme.tender_id = $${values.length}`;
    }

    const result = await pool.query(
      `
      SELECT
        sme.material_name,
        sme.main_section,
        sme.unit,
        SUM(sme.quantity)     AS total_quantity,
        SUM(sme.amount)       AS total_amount,
        SUM(sme.gst_amount)   AS total_gst,
        SUM(sme.total_amount) AS grand_total,
        COUNT(*)              AS entry_count,
        COUNT(*) FILTER (
          WHERE sme.approval_status = 'pending'
        ) AS pending_count,
        COUNT(*) FILTER (
          WHERE sme.photo_is_verified
        ) AS verified_photo_count
      FROM site_material_entries sme
      WHERE sme.company_id = $1
        AND COALESCE(sme.is_deleted, FALSE) = FALSE
        ${tenderFilter}
      GROUP BY sme.material_name, sme.main_section, sme.unit
      ORDER BY grand_total DESC
      `,
      values
    );

    return res.status(200).json({
      success: true,
      summary: result.rows,
    });
  }
);
