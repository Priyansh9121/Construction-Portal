const pool = require("../../database/pool");

/**
 * Normalise and validate an array of tender sites.
 */
const validateSites = (sites) => {
  if (!Array.isArray(sites) || sites.length === 0) {
    return {
      valid: false,
      message: "At least one site is required.",
    };
  }

  for (const [index, site] of sites.entries()) {
    if (!site.site_name?.trim()) {
      return {
        valid: false,
        message: `Site ${index + 1} name is required.`,
      };
    }

    if (!site.address?.trim()) {
      return {
        valid: false,
        message: `Site ${index + 1} address is required.`,
      };
    }
  }

  return { valid: true };
};

/**
 * GET /api/tenders
 *
 * Returns every tender with its child sites.
 */
exports.getTenders = async (req, res) => {
  try {
    const companyId = req.user?.company_id || null;

    const databaseCheck = await pool.query(`
      SELECT
        current_database() AS database_name,
        current_schema() AS current_schema,
        current_user AS database_user,
        inet_server_addr() AS server_address,
        inet_server_port() AS server_port,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'sites'
            AND column_name = 'tender_id'
        ) AS tender_id_exists
    `);
    
    console.log("BACKEND DATABASE CHECK:", databaseCheck.rows[0]);

    const result = await pool.query(
      `
      SELECT
        t.*,

        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', s.id,
              'tender_id', s.tender_id,
              'company_id', s.company_id,
              'site_name', s.site_name,
              'site_type', s.site_type,
              'address', s.address,
              'status', s.status,
              'progress_percent', s.progress_percent,
              'last_update_at', s.last_update_at,
              'created_at', s.created_at,
              'updated_at', s.updated_at
            )
            ORDER BY s.id ASC
          )
          FILTER (
            WHERE s.id IS NOT NULL
            AND COALESCE(s.is_deleted, FALSE) = FALSE
          ),
          '[]'::jsonb
        ) AS sites

      FROM public.tenders t

      LEFT JOIN public.sites s
        ON s.tender_id = t.id
        AND COALESCE(s.is_deleted, FALSE) = FALSE

      WHERE COALESCE(t.is_deleted, FALSE) = FALSE
        AND (
          $1::INTEGER IS NULL
          OR t.company_id = $1
        )

      GROUP BY t.id
      ORDER BY t.id DESC
      `,
      [companyId]
    );

    return res.status(200).json({
      success: true,
      tenders: result.rows,
    });
  } catch (error) {
    console.error("Get tenders error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

/**
 * GET /api/tenders/:id
 *
 * Use this for TenderDetailsPage.
 */
exports.getTenderById = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id || null;

    const result = await pool.query(
      `
      SELECT
        t.*,

        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', s.id,
              'tender_id', s.tender_id,
              'company_id', s.company_id,
              'site_name', s.site_name,
              'site_type', s.site_type,
              'address', s.address,
              'status', s.status,
              'progress_percent', s.progress_percent,
              'last_update_at', s.last_update_at,
              'created_at', s.created_at,
              'updated_at', s.updated_at
            )
            ORDER BY s.id ASC
          )
          FILTER (
            WHERE s.id IS NOT NULL
            AND COALESCE(s.is_deleted, FALSE) = FALSE
          ),
          '[]'::jsonb
        ) AS sites

      FROM public.tenders t

      LEFT JOIN public.sites s
        ON s.tender_id = t.id
        AND COALESCE(s.is_deleted, FALSE) = FALSE

      WHERE t.id = $1
        AND COALESCE(t.is_deleted, FALSE) = FALSE
        AND (
          $2::INTEGER IS NULL
          OR t.company_id = $2
        )

      GROUP BY t.id
      `,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tender not found.",
      });
    }

    return res.status(200).json({
      success: true,
      tender: result.rows[0],
    });
  } catch (error) {
    console.error("Get tender by ID error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

/**
 * POST /api/tenders
 *
 * Creates:
 * 1 tender
 * Multiple child sites
 *
 * Everything runs inside one database transaction.
 */
exports.createTender = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      company_id,
      title,
      client_name,
      tender_type = "Personal Tender",
      status = "running",
      start_date,
      due_date,
      description,
      estimated_value = 0,
      progress_percent = 0,
      sites,
    } = req.body;

    const companyId =
      req.user?.company_id ||
      company_id ||
      null;

    const createdBy = req.user?.id || null;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required.",
      });
    }

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tender title is required.",
      });
    }

    const siteValidation = validateSites(sites);

    if (!siteValidation.valid) {
      return res.status(400).json({
        success: false,
        message: siteValidation.message,
      });
    }

    await client.query("BEGIN");

    const tenderResult = await client.query(
      `
      INSERT INTO tenders
      (
        company_id,
        title,
        client_name,
        tender_type,
        status,
        start_date,
        due_date,
        description,
        estimated_value,
        progress_percent,
        created_by,
        created_at,
        updated_at
      )
      VALUES
      (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, NOW(), NOW()
      )
      RETURNING *
      `,
      [
        companyId,
        title.trim(),
        client_name?.trim() || null,
        tender_type || "Personal Tender",
        status || "running",
        start_date || null,
        due_date || null,
        description?.trim() || "",
        Number(estimated_value || 0),
        Number(progress_percent || 0),
        createdBy,
      ]
    );

    const tender = tenderResult.rows[0];
    const createdSites = [];

    for (const site of sites) {
      const siteResult = await client.query(
        `
        INSERT INTO sites
        (
          company_id,
          tender_id,
          site_name,
          site_type,
          address,
          status,
          progress_percent,
          created_at,
          updated_at
        )
        VALUES
        (
          $1, $2, $3, $4, $5,
          $6, $7, NOW(), NOW()
        )
        RETURNING *
        `,
        [
          companyId,
          tender.id,
          site.site_name.trim(),
          site.site_type || "Personal Site",
          site.address.trim(),
          site.status || "active",
          Number(site.progress_percent || 0),
        ]
      );

      createdSites.push(siteResult.rows[0]);
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Tender and sites created successfully.",
      tender: {
        ...tender,
        sites: createdSites,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create tender error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create tender.",
    });
  } finally {
    client.release();
  }
};

/**
 * PUT /api/tenders/:id
 *
 * Updates the tender and synchronises its sites.
 *
 * Existing sites must include an id.
 * New sites should not include an id.
 * Existing sites omitted from the payload are soft-deleted.
 */
exports.updateTender = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const {
      title,
      client_name,
      tender_type = "Personal Tender",
      status = "running",
      start_date,
      due_date,
      description,
      estimated_value = 0,
      progress_percent = 0,
      sites,
    } = req.body;

    const companyId = req.user?.company_id || null;
    const updatedBy = req.user?.id || null;

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tender title is required.",
      });
    }

    if (sites !== undefined) {
      const siteValidation = validateSites(sites);

      if (!siteValidation.valid) {
        return res.status(400).json({
          success: false,
          message: siteValidation.message,
        });
      }
    }

    await client.query("BEGIN");

    const existingTenderResult = await client.query(
      `
      SELECT *
      FROM tenders
      WHERE id = $1
        AND COALESCE(is_deleted, FALSE) = FALSE
        AND (
          $2::INTEGER IS NULL
          OR company_id = $2
        )
      FOR UPDATE
      `,
      [id, companyId]
    );

    if (existingTenderResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Tender not found.",
      });
    }

    const existingTender = existingTenderResult.rows[0];

    const tenderResult = await client.query(
      `
      UPDATE tenders
      SET
        title = $1,
        client_name = $2,
        tender_type = $3,
        status = $4,
        start_date = $5,
        due_date = $6,
        description = $7,
        estimated_value = $8,
        progress_percent = $9,
        updated_at = NOW()
      WHERE id = $10
        AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [
        title.trim(),
        client_name?.trim() || null,
        tender_type || "Personal Tender",
        status || "running",
        start_date || null,
        due_date || null,
        description?.trim() || "",
        Number(estimated_value || 0),
        Number(progress_percent || 0),
        id,
      ]
    );

    const updatedSites = [];

    if (Array.isArray(sites)) {
      const existingSitesResult = await client.query(
        `
        SELECT id
        FROM sites
        WHERE tender_id = $1
          AND COALESCE(is_deleted, FALSE) = FALSE
        `,
        [id]
      );

      const existingSiteIds = existingSitesResult.rows.map(
        (site) => Number(site.id)
      );

      const submittedExistingSiteIds = sites
        .filter((site) => site.id)
        .map((site) => Number(site.id));

      for (const site of sites) {
        if (site.id) {
          const siteResult = await client.query(
            `
            UPDATE sites
            SET
              site_name = $1,
              site_type = $2,
              address = $3,
              status = $4,
              progress_percent = $5,
              updated_at = NOW()
            WHERE id = $6
              AND tender_id = $7
              AND COALESCE(is_deleted, FALSE) = FALSE
            RETURNING *
            `,
            [
              site.site_name.trim(),
              site.site_type || "Personal Site",
              site.address.trim(),
              site.status || "active",
              Number(site.progress_percent || 0),
              site.id,
              id,
            ]
          );

          if (siteResult.rows.length === 0) {
            throw new Error(
              `Site ${site.id} was not found under this tender.`
            );
          }

          updatedSites.push(siteResult.rows[0]);
        } else {
          const siteResult = await client.query(
            `
            INSERT INTO sites
            (
              company_id,
              tender_id,
              site_name,
              site_type,
              address,
              status,
              progress_percent,
              created_at,
              updated_at
            )
            VALUES
            (
              $1, $2, $3, $4, $5,
              $6, $7, NOW(), NOW()
            )
            RETURNING *
            `,
            [
              existingTender.company_id,
              id,
              site.site_name.trim(),
              site.site_type || "Personal Site",
              site.address.trim(),
              site.status || "active",
              Number(site.progress_percent || 0),
            ]
          );

          updatedSites.push(siteResult.rows[0]);
        }
      }

      const removedSiteIds = existingSiteIds.filter(
        (siteId) =>
          !submittedExistingSiteIds.includes(siteId)
      );

      if (removedSiteIds.length > 0) {
        await client.query(
          `
          UPDATE sites
          SET
            is_deleted = TRUE,
            deleted_at = NOW(),
            deleted_by = $1,
            updated_at = NOW()
          WHERE tender_id = $2
            AND id = ANY($3::INTEGER[])
            AND COALESCE(is_deleted, FALSE) = FALSE
          `,
          [
            updatedBy,
            id,
            removedSiteIds,
          ]
        );
      }
    } else {
      const sitesResult = await client.query(
        `
        SELECT *
        FROM sites
        WHERE tender_id = $1
          AND COALESCE(is_deleted, FALSE) = FALSE
        ORDER BY id ASC
        `,
        [id]
      );

      updatedSites.push(...sitesResult.rows);
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Tender updated successfully.",
      tender: {
        ...tenderResult.rows[0],
        sites: updatedSites,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Update tender error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update tender.",
    });
  } finally {
    client.release();
  }
};

/**
 * DELETE /api/tenders/:id
 *
 * Soft-deletes the tender and all its child sites.
 */
exports.deleteTender = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const deletedBy = req.user?.id || null;
    const companyId = req.user?.company_id || null;

    await client.query("BEGIN");

    const tenderResult = await client.query(
      `
      UPDATE tenders
      SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = $1,
        updated_at = NOW()
      WHERE id = $2
        AND COALESCE(is_deleted, FALSE) = FALSE
        AND (
          $3::INTEGER IS NULL
          OR company_id = $3
        )
      RETURNING *
      `,
      [
        deletedBy,
        id,
        companyId,
      ]
    );

    if (tenderResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Tender not found.",
      });
    }

    await client.query(
      `
      UPDATE sites
      SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = $1,
        updated_at = NOW()
      WHERE tender_id = $2
        AND COALESCE(is_deleted, FALSE) = FALSE
      `,
      [
        deletedBy,
        id,
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Tender and associated sites deleted successfully.",
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Delete tender error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  } finally {
    client.release();
  }
};