const pool = require("../../database/pool")

exports.getSiteLogs = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        dsl.id,
        dsl.site_id,
        s.site_name,
        dsl.worker_id,
        w.full_name AS worker_name,
        dsl.tender_id,
        dsl.log_date,
        dsl.notes,
        dsl.photo_url,
        dsl.created_at
      FROM daily_site_logs dsl
      LEFT JOIN sites s ON dsl.site_id = s.id
      LEFT JOIN workers w ON dsl.worker_id = w.id
      WHERE COALESCE(dsl.is_deleted, FALSE) = FALSE
      ORDER BY dsl.id DESC
    `);

    res.status(200).json({
      success: true,
      siteLogs: result.rows,
    });
  } catch (error) {
    console.error("Get site logs error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createSiteLog = async (req, res) => {
  try {
    const {
      site_id,
      tender_id = null,
      worker_id,
      log_date,
      notes,
      photo_url,
    } = req.body;
    
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
      `INSERT INTO daily_site_logs
       (site_id, tender_id, worker_id, log_date, notes, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [site_id, tender_id || null, worker_id, log_date, notes, photo_url || null]
    );

    res.status(201).json({
      success: true,
      siteLog: result.rows[0],
    });
  } catch (error) {
    console.error("Create site log error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteSiteLog = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "UPDATE daily_site_logs SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $2 WHERE id = $1 RETURNING *",
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
    console.error("Delete site log error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};