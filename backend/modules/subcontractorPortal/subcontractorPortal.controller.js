const pool = require("../../database/pool");

async function getSubcontractorByLoggedInUser(userId) {
  const result = await pool.query(
    `
    SELECT
      s.id AS subcontractor_id,
      s.company_id,
      s.user_id,
      s.full_name,
      s.phone,
      s.email,
      s.business_name,
      s.gst_number,
      s.bank_name,
      s.account_name,
      s.account_number,
      s.ifsc_code,
      s.status AS subcontractor_status,
      u.email AS login_email,
      u.role AS login_role
    FROM subcontractors s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.user_id = $1
      AND COALESCE(s.is_deleted, FALSE) = FALSE
      AND COALESCE(s.status, 'active') != 'inactive'
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0];
}

async function checkSubcontractorTenderAccess(subcontractorId, tenderId) {
  const result = await pool.query(
    `
    SELECT *
    FROM tender_subcontractors
    WHERE subcontractor_id = $1
      AND tender_id = $2
      AND COALESCE(is_deleted, FALSE) = FALSE
    LIMIT 1
    `,
    [subcontractorId, tenderId]
  );

  return result.rows[0];
}

exports.getMyProfile = async (req, res) => {
  try {
    const subcontractor = await getSubcontractorByLoggedInUser(req.user.id);

    if (!subcontractor) {
      return res.status(404).json({
        success: false,
        message:
          "No subcontractor profile is linked to this login user. Ask admin to link this user to a subcontractor record.",
      });
    }

    res.status(200).json({
      success: true,
      subcontractor,
    });
  } catch (error) {
    console.error("Subcontractor profile error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getMyTenders = async (req, res) => {
  try {
    const subcontractor = await getSubcontractorByLoggedInUser(req.user.id);

    if (!subcontractor) {
      return res.status(404).json({
        success: false,
        message:
          "No subcontractor profile is linked to this login user. Ask admin to link this user to a subcontractor record.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        ts.id AS assignment_id,
        ts.subcontractor_id,
        ts.tender_id,
        ts.work_description,
        ts.assigned_amount,
        ts.status AS assignment_status,
        ts.created_at AS assigned_at,

        t.title AS tender_title,
        t.status AS tender_status,
        t.due_date,
        t.description AS tender_description,
        t.estimated_value,

        s.id AS site_id,
        s.site_name,
        s.address,
        s.site_type,
        s.status AS site_status
      FROM tender_subcontractors ts
      INNER JOIN tenders t ON t.id = ts.tender_id
      LEFT JOIN sites s ON s.id = t.site_id
      WHERE ts.subcontractor_id = $1
        AND COALESCE(ts.is_deleted, FALSE) = FALSE
        AND COALESCE(t.is_deleted, FALSE) = FALSE
      ORDER BY ts.id DESC
      `,
      [subcontractor.subcontractor_id]
    );

    res.status(200).json({
      success: true,
      subcontractor,
      tenders: result.rows,
    });
  } catch (error) {
    console.error("Subcontractor tenders error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getMyTenderDetails = async (req, res) => {
  try {
    const tenderId = Number(req.params.id);

    const subcontractor = await getSubcontractorByLoggedInUser(req.user.id);

    if (!subcontractor) {
      return res.status(404).json({
        success: false,
        message:
          "No subcontractor profile is linked to this login user. Ask admin to link this user to a subcontractor record.",
      });
    }

    const assignment = await checkSubcontractorTenderAccess(
      subcontractor.subcontractor_id,
      tenderId
    );

    if (!assignment) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this tender.",
      });
    }

    const tenderResult = await pool.query(
      `
      SELECT
        t.*,
        s.site_name,
        s.address,
        s.site_type
      FROM tenders t
      LEFT JOIN sites s ON s.id = t.site_id
      WHERE t.id = $1
        AND COALESCE(t.is_deleted, FALSE) = FALSE
      `,
      [tenderId]
    );

    const documents = await pool.query(
      `
      SELECT
        id,
        tender_id,
        document_name,
        document_type,
        file_url,
        uploaded_by,
        created_at
      FROM tender_documents
      WHERE tender_id = $1
        AND COALESCE(is_deleted, FALSE) = FALSE
      ORDER BY id DESC
      `,
      [tenderId]
    );

    const materials = await pool.query(
      `
      SELECT *
      FROM tender_materials
      WHERE tender_id = $1
        AND COALESCE(is_deleted, FALSE) = FALSE
      ORDER BY id DESC
      `,
      [tenderId]
    );

    const banking = await pool.query(
      `
      SELECT *
      FROM tender_banking
      WHERE tender_id = $1
        AND COALESCE(is_deleted, FALSE) = FALSE
      ORDER BY id DESC
      `,
      [tenderId]
    );

    const updates = await pool.query(
      `
      SELECT
        dsl.id,
        dsl.site_id,
        dsl.tender_id,
        dsl.worker_id,
        dsl.subcontractor_id,
        dsl.log_date,
        dsl.notes,
        dsl.photo_url,
        dsl.created_at,
        w.full_name AS worker_name,
        sc.full_name AS subcontractor_name,
        s.site_name
      FROM daily_site_logs dsl
      LEFT JOIN workers w ON w.id = dsl.worker_id
      LEFT JOIN subcontractors sc ON sc.id = dsl.subcontractor_id
      LEFT JOIN sites s ON s.id = dsl.site_id
      WHERE dsl.tender_id = $1
        AND COALESCE(dsl.is_deleted, FALSE) = FALSE
      ORDER BY dsl.log_date DESC, dsl.id DESC
      `,
      [tenderId]
    );

    res.status(200).json({
      success: true,
      subcontractor,
      assignment,
      tender: tenderResult.rows[0],
      documents: documents.rows,
      materials: materials.rows,
      banking: banking.rows,
      updates: updates.rows,
    });
  } catch (error) {
    console.error("Subcontractor tender details error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.createMyDailyUpdate = async (req, res) => {
  try {
    const subcontractor = await getSubcontractorByLoggedInUser(req.user.id);

    if (!subcontractor) {
      return res.status(404).json({
        success: false,
        message: "No subcontractor profile is linked to this login user.",
      });
    }

    const { site_id, tender_id, log_date, notes, photo_url } = req.body;

    if (!site_id || !tender_id || !log_date) {
      return res.status(400).json({
        success: false,
        message: "Site, tender and log date are required.",
      });
    }

    const assignment = await checkSubcontractorTenderAccess(
      subcontractor.subcontractor_id,
      Number(tender_id)
    );

    if (!assignment) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this tender.",
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

    if (diffDays > 3) {
      const approvalResult = await pool.query(
        `
        INSERT INTO daily_update_approvals
        (
          subcontractor_id,
          site_id,
          tender_id,
          log_date,
          notes,
          photo_url,
          reason,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING *
        `,
        [
          subcontractor.subcontractor_id,
          site_id,
          tender_id,
          log_date,
          notes || "",
          photo_url || null,
          "Subcontractor submitted an update older than 3 days.",
        ]
      );

      return res.status(202).json({
        success: true,
        requiresApproval: true,
        message:
          "This update is older than 3 days and has been sent to admin for approval.",
        approval: approvalResult.rows[0],
      });
    }

    const result = await pool.query(
      `
      INSERT INTO daily_site_logs
      (
        site_id,
        tender_id,
        subcontractor_id,
        log_date,
        notes,
        photo_url,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        site_id,
        tender_id,
        subcontractor.subcontractor_id,
        log_date,
        notes || "",
        photo_url || null,
        req.user?.id || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Subcontractor daily update submitted successfully.",
      update: result.rows[0],
    });
  } catch (error) {
    console.error("Subcontractor daily update error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

exports.addMyTenderDocument = async (req, res) => {
  try {
    const subcontractor = await getSubcontractorByLoggedInUser(req.user.id);

    if (!subcontractor) {
      return res.status(404).json({
        success: false,
        message: "No subcontractor profile is linked to this login user.",
      });
    }

    const { tender_id, document_name, document_type, file_url } = req.body;

    if (!tender_id || !document_name) {
      return res.status(400).json({
        success: false,
        message: "Tender and document name are required.",
      });
    }

    const assignment = await checkSubcontractorTenderAccess(
      subcontractor.subcontractor_id,
      Number(tender_id)
    );

    if (!assignment) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this tender.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO tender_documents
      (
        tender_id,
        document_name,
        document_type,
        file_url,
        uploaded_by,
        uploaded_by_type,
        is_deleted
      )
      VALUES ($1, $2, $3, $4, $5, 'subcontractor', FALSE)
      RETURNING *
      `,
      [
        tender_id,
        document_name,
        document_type || "PDF",
        file_url || null,
        req.user?.id || null,
      ]
    );

    res.status(201).json({
      success: true,
      document: result.rows[0],
    });
  } catch (error) {
    console.error("Subcontractor document upload error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};