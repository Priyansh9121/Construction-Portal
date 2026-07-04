const pool = require("../../database/pool");

exports.getTenders = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        t.*,
        s.site_name,
        s.site_type,
        s.address AS site_address
      FROM tenders t
      LEFT JOIN sites s ON s.id = t.site_id
      WHERE COALESCE(t.is_deleted, FALSE) = FALSE
      ORDER BY t.id DESC
      `
    );

    res.status(200).json({
      success: true,
      tenders: result.rows,
    });
  } catch (error) {
    console.error("Get tenders error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createTender = async (req, res) => {
  try {
    const {
      company_id = null,
      site_id = null,
      title,
      status = "running",
      due_date,
      description,
      estimated_value = 0,
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Tender title is required.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO tenders
      (
        company_id,
        site_id,
        title,
        status,
        due_date,
        description,
        estimated_value,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        company_id,
        site_id || null,
        title,
        status,
        due_date || null,
        description || "",
        Number(estimated_value || 0),
        req.user?.id || null,
      ]
    );

    res.status(201).json({
      success: true,
      tender: result.rows[0],
    });
  } catch (error) {
    console.error("Create tender error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

exports.updateTender = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      status = "running",
      due_date,
      description,
      site_id,
      estimated_value = 0,
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Tender title is required.",
      });
    }

    const result = await pool.query(
      `
      UPDATE tenders
      SET title = $1,
          status = $2,
          due_date = $3,
          description = $4,
          site_id = $5,
          estimated_value = $6,
          updated_at = NOW()
      WHERE id = $7
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [
        title,
        status,
        due_date || null,
        description || "",
        site_id || null,
        Number(estimated_value || 0),
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tender not found",
      });
    }

    res.status(200).json({
      success: true,
      tender: result.rows[0],
    });
  } catch (error) {
    console.error("Update tender error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

exports.deleteTender = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBy = req.user?.id || null;

    const result = await pool.query(
      `
      UPDATE tenders
      SET is_deleted = TRUE,
          deleted_at = NOW(),
          deleted_by = $2,
          updated_at = NOW()
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [id, deletedBy]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tender not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Tender deleted successfully",
    });
  } catch (error) {
    console.error("Delete tender error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};