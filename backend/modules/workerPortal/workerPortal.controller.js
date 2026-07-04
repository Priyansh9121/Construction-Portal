const pool = require("../../database/pool");

/*
|--------------------------------------------------------------------------
| Helper: get logged-in worker profile
|--------------------------------------------------------------------------
*/
async function getWorkerByLoggedInUser(userId) {
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
    LEFT JOIN users u ON u.id = w.user_id
    WHERE w.user_id = $1
      AND COALESCE(w.is_deleted, FALSE) = FALSE
      AND COALESCE(w.status, 'active') != 'inactive'
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0];
}

/*
|--------------------------------------------------------------------------
| Helper: check active tender assignment
|--------------------------------------------------------------------------
*/
async function getActiveAssignment(workerId, siteId, tenderId) {
  const result = await pool.query(
    `
    SELECT tw.*
    FROM tender_workers tw
    INNER JOIN tenders t ON t.id = tw.tender_id
    WHERE tw.worker_id = $1
      AND t.site_id = $2
      AND tw.tender_id = $3
      AND tw.status = 'active'
      AND COALESCE(tw.is_deleted, FALSE) = FALSE
    LIMIT 1
    `,
    [workerId, siteId, tenderId]
  );

  return result.rows[0];
}

/*
|--------------------------------------------------------------------------
| GET /api/worker-portal/me
|--------------------------------------------------------------------------
*/
exports.getMyProfile = async (req, res) => {
  try {
    const loggedInUserId = Number(req.user?.id || req.user?.userId);

    const worker = await getWorkerByLoggedInUser(loggedInUserId);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message:
          "No worker profile is linked to this login user. Ask admin to link this user to a worker record.",
      });
    }

    return res.status(200).json({
      success: true,
      worker,
    });
  } catch (error) {
    console.error("Worker portal profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/worker-portal/assignments
|--------------------------------------------------------------------------
*/
exports.getMyAssignments = async (req, res) => {
  try {
    const loggedInUserId = Number(req.user?.id || req.user?.userId);

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
        tw.id AS assignment_id,
        tw.worker_id,
        t.site_id,
        tw.tender_id,
        tw.notes AS assignment_notes,
        tw.status AS assignment_status,
        tw.created_at AS assigned_at,

        s.site_name,
        s.address,
        s.site_type,
        s.status AS site_status,

        t.title AS tender_title,
        t.status AS tender_status,
        t.due_date,
        t.description AS tender_description
      FROM tender_workers tw
      INNER JOIN tenders t ON t.id = tw.tender_id
      LEFT JOIN sites s ON s.id = t.site_id
      WHERE tw.worker_id = $1
        AND tw.status = 'active'
        AND COALESCE(tw.is_deleted, FALSE) = FALSE
        AND COALESCE(t.is_deleted, FALSE) = FALSE
      ORDER BY tw.id DESC
      `,
      [worker.worker_id]
    );

    return res.status(200).json({
      success: true,
      worker,
      assignments: result.rows,
    });
  } catch (error) {
    console.error("Worker assignments error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/worker-portal/daily-updates
|--------------------------------------------------------------------------
*/
exports.getMyDailyUpdates = async (req, res) => {
  try {
    const loggedInUserId = Number(req.user?.id || req.user?.userId);

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
        AND COALESCE(dsl.is_deleted, FALSE) = FALSE
      ORDER BY dsl.log_date DESC, dsl.id DESC
      `,
      [worker.worker_id]
    );

    return res.status(200).json({
      success: true,
      updates: result.rows,
    });
  } catch (error) {
    console.error("Get worker daily updates error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| POST /api/worker-portal/daily-updates
|--------------------------------------------------------------------------
*/
exports.createMyDailyUpdate = async (req, res) => {
  try {
    const loggedInUserId = Number(req.user?.id || req.user?.userId);

    const worker = await getWorkerByLoggedInUser(loggedInUserId);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message:
          "No worker profile is linked to this login user. Ask admin to link this user to a worker record.",
      });
    }

    const { site_id, tender_id, log_date, notes, photo_url } = req.body;

    if (!site_id || !tender_id || !log_date) {
      return res.status(400).json({
        success: false,
        message: "Site, tender and log date are required.",
      });
    }

    const numericSiteId = Number(site_id);
    const numericTenderId = Number(tender_id);

    if (Number.isNaN(numericSiteId) || Number.isNaN(numericTenderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid site or tender ID.",
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

    if (diffDays > 3) {
      const approvalResult = await pool.query(
        `
        INSERT INTO daily_update_approvals
          (
            worker_id,
            site_id,
            tender_id,
            log_date,
            notes,
            photo_url,
            reason,
            status
          )
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING *
        `,
        [
          worker.worker_id,
          numericSiteId,
          numericTenderId,
          log_date,
          notes || "",
          photo_url || null,
          "Worker submitted an update older than 3 days.",
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

    return res.status(201).json({
      success: true,
      message: "Daily update submitted successfully.",
      update: insertResult.rows[0],
    });
  } catch (error) {
    console.error("Create worker daily update error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/worker-portal/tenders/:id/documents
|--------------------------------------------------------------------------
*/
exports.getMyTenderDocuments = async (req, res) => {
  try {
    const loggedInUserId = Number(req.user?.id || req.user?.userId);
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
      FROM tender_workers
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

    return res.status(200).json({
      success: true,
      documents: documentsResult.rows,
    });
  } catch (error) {
    console.error("Worker tender documents error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/worker-portal/money
|--------------------------------------------------------------------------
*/
exports.getMyMoney = async (req, res) => {
  try {
    const loggedInUserId = Number(req.user?.id || req.user?.userId);
    const worker = await getWorkerByLoggedInUser(loggedInUserId);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "No worker profile is linked to this login user.",
      });
    }

    const allocations = await pool.query(
      `
      SELECT *
      FROM worker_allocations
      WHERE worker_id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      ORDER BY id DESC
      `,
      [worker.worker_id]
    );

    const expenses = await pool.query(
      `
      SELECT
        we.*
      FROM worker_expenses we
      INNER JOIN worker_allocations wa ON wa.id = we.allocation_id
      WHERE wa.worker_id = $1
      AND COALESCE(we.is_deleted, FALSE) = FALSE
      AND COALESCE(wa.is_deleted, FALSE) = FALSE
      ORDER BY we.id DESC
      `,
      [worker.worker_id]
    );

    return res.status(200).json({
      success: true,
      worker,
      allocations: allocations.rows,
      expenses: expenses.rows,
    });
  } catch (error) {
    console.error("Worker money error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| POST /api/worker-portal/expenses
|--------------------------------------------------------------------------
*/
exports.createMyExpense = async (req, res) => {
  try {
    const loggedInUserId = Number(req.user?.id || req.user?.userId);
    const worker = await getWorkerByLoggedInUser(loggedInUserId);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "No worker profile is linked to this login user.",
      });
    }

    const {
      allocation_id,
      expense_amount,
      expense_description,
      expense_date,
      uploaded_photo,
    } = req.body;

    if (!allocation_id || !expense_amount || !expense_date) {
      return res.status(400).json({
        success: false,
        message: "Allocation, expense amount and date are required.",
      });
    }

    const allocationResult = await pool.query(
      `
      SELECT *
      FROM worker_allocations
      WHERE id = $1
      AND worker_id = $2
      AND approval_status = 'approved'
      AND COALESCE(is_deleted, FALSE) = FALSE
      `,
      [allocation_id, worker.worker_id]
    );

    if (allocationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Valid approved allocation not found for this worker.",
      });
    }

    const spentResult = await pool.query(
      `
      SELECT COALESCE(SUM(expense_amount), 0) AS total_spent
      FROM worker_expenses
      WHERE allocation_id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      AND COALESCE(approval_status, 'approved') != 'rejected'
      `,
      [allocation_id]
    );

    const allocatedAmount = Number(allocationResult.rows[0].allocated_amount);
    const alreadySpent = Number(spentResult.rows[0].total_spent);
    const newExpense = Number(expense_amount);
    const remainingBalance = allocatedAmount - alreadySpent - newExpense;

    const result = await pool.query(
      `
      INSERT INTO worker_expenses
      (
        allocation_id,
        expense_amount,
        expense_description,
        expense_date,
        remaining_balance,
        uploaded_photo,
        approval_status,
        created_by
      )
      VALUES
      ($1, $2, $3, $4, $5, $6, 'pending', $7)
      RETURNING *
      `,
      [
        allocation_id,
        expense_amount,
        expense_description || "",
        expense_date,
        remainingBalance,
        uploaded_photo || null,
        loggedInUserId,
      ]
    );

    return res.status(202).json({
      success: true,
      requiresApproval: true,
      message: "Expense submitted and waiting for admin approval.",
      expense: result.rows[0],
    });
  } catch (error) {
    console.error("Create worker expense error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};