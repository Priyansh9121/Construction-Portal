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
        dsl.log_date,
        dsl.notes,
        dsl.photo_url,
        dsl.created_at
      FROM daily_site_logs dsl
      LEFT JOIN sites s ON dsl.site_id = s.id
      LEFT JOIN workers w ON dsl.worker_id = w.id
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
    const { site_id, worker_id, log_date, notes, photo_url } = req.body;

    const result = await pool.query(
      `INSERT INTO daily_site_logs
       (site_id, worker_id, log_date, notes, photo_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [site_id, worker_id, log_date, notes, photo_url || null]
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
      "DELETE FROM daily_site_logs WHERE id = $1 RETURNING *",
      [id]
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