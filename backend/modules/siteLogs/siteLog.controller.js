const pool = require("../../database/pool");

exports.getSiteLogs = async (req, res) => {
  try {
    const result = await pool.query(`
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
        dsl.created_at
      FROM daily_site_logs dsl
      LEFT JOIN sites s ON dsl.site_id = s.id
      LEFT JOIN workers w ON dsl.worker_id = w.id
      LEFT JOIN subcontractors sc ON dsl.subcontractor_id = sc.id
      LEFT JOIN tenders t ON dsl.tender_id = t.id
      WHERE COALESCE(dsl.is_deleted, FALSE) = FALSE
      ORDER BY dsl.log_date DESC, dsl.id DESC
    `);

    res.status(200).json({
      success: true,
      siteLogs: result.rows,
    });
  } catch (error) {
    console.error("Get site logs error:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      stack: error.stack,
    });
  
    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to load site logs."
          : error.message,
    });
  }
};

exports.createSiteLog = async (req, res) => {
  try {
    const {
      site_id,
      tender_id = null,
      worker_id = null,
      subcontractor_id = null,
      log_date,
      notes,
      photo_url,
    } = req.body;

    if (!site_id || !log_date) {
      return res.status(400).json({
        success: false,
        message: "Site and log date are required.",
      });
    }

    if (!worker_id && !subcontractor_id) {
      return res.status(400).json({
        success: false,
        message: "Worker or subcontractor is required.",
      });
    }

    const selectedDate = new Date(log_date);
    const today = new Date();

    selectedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.floor(
      (today - selectedDate) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) {
      return res.status(400).json({
        success: false,
        message: "Future daily updates are not allowed.",
      });
    }

    if (diffDays > 3 && req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "You cannot add an update/photo older than 3 days. Please ask admin permission.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO daily_site_logs
      (
        site_id,
        tender_id,
        worker_id,
        subcontractor_id,
        log_date,
        notes,
        photo_url,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        site_id,
        tender_id || null,
        worker_id || null,
        subcontractor_id || null,
        log_date,
        notes || "",
        photo_url || null,
        req.user?.id || null,
      ]
    );

    res.status(201).json({
      success: true,
      siteLog: result.rows[0],
    });
  } catch (error) {
    console.error("Create site log error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

exports.deleteSiteLog = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE daily_site_logs
      SET is_deleted = TRUE,
          deleted_at = NOW(),
          deleted_by = $2
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [id, req.user?.id || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Site log not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Site log deleted successfully",
    });
  } catch (error) {
    console.error("Delete payment error:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      stack: error.stack,
    });
  
    res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to delete payment."
          : error.message,
    });
  }
};