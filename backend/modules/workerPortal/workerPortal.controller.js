const pool = require("../../database/pool");

/*
|--------------------------------------------------------------------------
| Helper: get logged-in worker profile
|--------------------------------------------------------------------------
| req.user comes from authMiddleware.
| req.user.id is the logged-in user's ID from JWT.
|
| We use workers.user_id to find the worker record connected
| to this login user.
*/
async function getWorkerByLoggedInUser(userId) {
    console.log("DEBUG logged in userId:", userId);
  
    const checkAllWorkers = await pool.query(`
      SELECT id, full_name, user_id, status, is_deleted
      FROM workers
      ORDER BY id
    `);
  
    console.log("DEBUG all workers:", checkAllWorkers.rows);
  
    const result = await pool.query(
      `
      SELECT
        w.id AS worker_id,
        w.company_id,
        w.user_id,
        w.full_name,
        w.phone,
        w.salary,
        w.role AS worker_job_role,
        w.status AS worker_status,
        u.email AS login_email,
        u.role AS login_role
      FROM workers w
      INNER JOIN users u ON u.id = w.user_id
      WHERE w.user_id = $1
        AND COALESCE(w.is_deleted, FALSE) = FALSE
        AND COALESCE(w.status, 'active') != 'inactive'
      LIMIT 1
      `,
      [userId]
    );
  
    console.log("DEBUG matched worker:", result.rows);
  
    return result.rows[0];
}
/*
|--------------------------------------------------------------------------
| Helper: check if worker is allowed to submit update
|--------------------------------------------------------------------------
| A worker should only submit daily progress for the site/tender
| they are assigned to.
*/
async function getActiveAssignment(workerId, siteId, tenderId) {
  const result = await pool.query(
    `
    SELECT *
    FROM worker_assignments
    WHERE worker_id = $1
      AND site_id = $2
      AND (
        tender_id = $3
        OR ($3::INT IS NULL AND tender_id IS NULL)
      )
      AND status = 'active'
      AND is_deleted = FALSE
    LIMIT 1
    `,
    [workerId, siteId, tenderId || null]
  );

  return result.rows[0];
}

/*
|--------------------------------------------------------------------------
| GET /api/worker-portal/me
|--------------------------------------------------------------------------
| Purpose:
| Return the logged-in worker profile.
*/
exports.getMyProfile = async (req, res) => {
  try {
    const loggedInUserId = req.user.id;

    const worker = await getWorkerByLoggedInUser(loggedInUserId);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message:
          "No worker profile is linked to this login user. Ask admin to link this user to a worker record.",
      });
    }

    res.status(200).json({
      success: true,
      worker,
    });
  } catch (error) {
    console.error("Worker portal profile error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/worker-portal/assignments
|--------------------------------------------------------------------------
| Purpose:
| Show the logged-in worker's assigned sites/tenders.
*/
exports.getMyAssignments = async (req, res) => {
  try {
    const loggedInUserId = req.user.id;

    const worker = await getWorkerByLoggedInUser(loggedInUserId);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message:
          "No worker profile is linked to this login user. Ask admin to link this user to a worker record.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        wa.id AS assignment_id,
        wa.worker_id,
        wa.site_id,
        wa.tender_id,
        wa.notes AS assignment_notes,
        wa.status AS assignment_status,
        wa.created_at AS assigned_at,

        s.site_name,
        s.address,
        s.site_type,
        s.status AS site_status,

        t.title AS tender_title,
        t.status AS tender_status,
        t.due_date,
        t.description AS tender_description
      FROM worker_assignments wa
      INNER JOIN sites s ON s.id = wa.site_id
      LEFT JOIN tenders t ON t.id = wa.tender_id
      WHERE wa.worker_id = $1
        AND wa.status = 'active'
        AND wa.is_deleted = FALSE
        AND s.is_deleted = FALSE
        AND (
          t.id IS NULL
          OR t.is_deleted = FALSE
        )
      ORDER BY wa.id DESC
      `,
      [worker.worker_id]
    );

    res.status(200).json({
      success: true,
      worker,
      assignments: result.rows,
    });
  } catch (error) {
    console.error("Worker assignments error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/worker-portal/daily-updates
|--------------------------------------------------------------------------
| Purpose:
| Show only this worker's own daily progress updates.
*/
exports.getMyDailyUpdates = async (req, res) => {
  try {
    const loggedInUserId = req.user.id;

    const worker = await getWorkerByLoggedInUser(loggedInUserId);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message:
          "No worker profile is linked to this login user. Ask admin to link this user to a worker record.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        dsl.id,
        dsl.site_id,
        dsl.tender_id,
        dsl.worker_id,
        dsl.log_date,
        dsl.notes,
        dsl.photo_url,
        dsl.created_at,

        s.site_name,
        s.address,

        t.title AS tender_title,
        t.status AS tender_status
      FROM daily_site_logs dsl
      LEFT JOIN sites s ON s.id = dsl.site_id
      LEFT JOIN tenders t ON t.id = dsl.tender_id
      WHERE dsl.worker_id = $1
        AND dsl.is_deleted = FALSE
      ORDER BY dsl.log_date DESC, dsl.id DESC
      `,
      [worker.worker_id]
    );

    res.status(200).json({
      success: true,
      updates: result.rows,
    });
  } catch (error) {
    console.error("Get worker daily updates error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| POST /api/worker-portal/daily-updates
|--------------------------------------------------------------------------
| Purpose:
| Worker submits daily progress.
|
| Body expected:
| {
|   site_id: 1,
|   tender_id: 2,
|   log_date: "2026-06-16",
|   notes: "Completed slab work",
|   photo_url: "https://..."
| }
*/
exports.createMyDailyUpdate = async (req, res) => {
  try {
    const loggedInUserId = req.user.id;

    const worker = await getWorkerByLoggedInUser(loggedInUserId);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message:
          "No worker profile is linked to this login user. Ask admin to link this user to a worker record.",
      });
    }

    const { site_id, tender_id, log_date, notes, photo_url } = req.body;

    if (!site_id || !log_date) {
      return res.status(400).json({
        success: false,
        message: "Site and log date are required.",
      });
    }

    const numericSiteId = Number(site_id);
    const numericTenderId = tender_id ? Number(tender_id) : null;

    if (Number.isNaN(numericSiteId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid site ID.",
      });
    }

    if (tender_id && Number.isNaN(numericTenderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tender ID.",
      });
    }

    const assignment = await getActiveAssignment(
      worker.worker_id,
      numericSiteId,
      numericTenderId
    );

    if (!assignment) {
      return res.status(403).json({
        success: false,
        message:
          "You are not assigned to this site/tender, so you cannot submit a daily update for it.",
      });
    }

    const insertResult = await pool.query(
      `
      INSERT INTO daily_site_logs
        (
          site_id,
          tender_id,
          worker_id,
          log_date,
          notes,
          photo_url,
          created_by
        )
      VALUES
        ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        numericSiteId,
        numericTenderId,
        worker.worker_id,
        log_date,
        notes || "",
        photo_url || null,
        loggedInUserId,
      ]
    );

    const newLogId = insertResult.rows[0].id;

    const fullLogResult = await pool.query(
      `
      SELECT
        dsl.id,
        dsl.site_id,
        dsl.tender_id,
        dsl.worker_id,
        dsl.log_date,
        dsl.notes,
        dsl.photo_url,
        dsl.created_at,

        s.site_name,
        s.address,

        t.title AS tender_title,
        t.status AS tender_status,

        w.full_name AS worker_name
      FROM daily_site_logs dsl
      LEFT JOIN sites s ON s.id = dsl.site_id
      LEFT JOIN tenders t ON t.id = dsl.tender_id
      LEFT JOIN workers w ON w.id = dsl.worker_id
      WHERE dsl.id = $1
      `,
      [newLogId]
    );

    res.status(201).json({
      success: true,
      message: "Daily update submitted successfully.",
      update: fullLogResult.rows[0],
    });
  } catch (error) {
    console.error("Create worker daily update error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


exports.getMyTenderDocuments = async (req, res) => {
    try {
      const loggedInUserId = req.user.id;
      const tenderId = Number(req.params.id);
  
      const worker = await getWorkerByLoggedInUser(loggedInUserId);
  
      if (!worker) {
        return res.status(404).json({
          success: false,
          message: "No worker profile is linked to this login user.",
        });
      }
  
      const assignmentCheck = await pool.query(
        `
        SELECT id
        FROM worker_assignments
        WHERE worker_id = $1
          AND tender_id = $2
          AND status = 'active'
          AND COALESCE(is_deleted, FALSE) = FALSE
        LIMIT 1
        `,
        [worker.worker_id, tenderId]
      );
  
      if (assignmentCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to this tender.",
        });
      }
  
      const documentsResult = await pool.query(
        `
        SELECT
          id,
          tender_id,
          document_name,
          file_url,
          file_type,
          uploaded_at
        FROM tender_documents
        WHERE tender_id = $1
          AND COALESCE(is_deleted, FALSE) = FALSE
        ORDER BY id DESC
        `,
        [tenderId]
      );
  
      res.status(200).json({
        success: true,
        documents: documentsResult.rows,
      });
    } catch (error) {
      console.error("Worker tender documents error:", error);
  
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  };
  exports.getMyTenderDocuments = async (req, res) => {
    try {
      const loggedInUserId = req.user.id;
      const tenderId = Number(req.params.id);
  
      const worker = await getWorkerByLoggedInUser(loggedInUserId);
  
      if (!worker) {
        return res.status(404).json({
          success: false,
          message: "No worker profile is linked to this login user.",
        });
      }
  
      const assignmentCheck = await pool.query(
        `
        SELECT id
        FROM worker_assignments
        WHERE worker_id = $1
          AND tender_id = $2
          AND status = 'active'
          AND COALESCE(is_deleted, FALSE) = FALSE
        LIMIT 1
        `,
        [worker.worker_id, tenderId]
      );
  
      if (assignmentCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to this tender.",
        });
      }
  
      const documentsResult = await pool.query(
        `
        SELECT
          id,
          tender_id,
          document_name,
          document_type,
          file_url,
          created_at
        FROM tender_documents
        WHERE tender_id = $1
          AND COALESCE(is_deleted, FALSE) = FALSE
        ORDER BY id DESC
        `,
        [tenderId]
      );
  
      res.status(200).json({
        success: true,
        documents: documentsResult.rows,
      });
    } catch (error) {
      console.error("Worker tender documents error:", error);
  
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  };