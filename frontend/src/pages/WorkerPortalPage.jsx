import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { formatCurrency } from "../utils/currency";
import ExportButtons from "../components/export/ExportButtons";

import {
  getWorkerProfile,
  getWorkerAssignments,
  getWorkerDailyUpdates,
  createWorkerDailyUpdate,
  getWorkerTenderDocuments,
  getWorkerMoney,
  createWorkerPortalExpense,
} from "../services/workerPortalService";

import { uploadFile } from "../services/uploadService";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function WorkerPortalPage({ logout }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const today = new Date().toISOString().slice(0, 10);

  const minimumUpdateDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 2);
    return date.toISOString().slice(0, 10);
  }, []);

  const [worker, setWorker] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [activeSection, setActiveSection] = useState("overview");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");

  const [updateForm, setUpdateForm] = useState({
    log_date: today,
    notes: "",
  });

  const [updatePhoto, setUpdatePhoto] = useState(null);
  const [updatePhotoPreview, setUpdatePhotoPreview] = useState("");

  const [expenseForm, setExpenseForm] = useState({
    allocation_id: "",
    expense_amount: "",
    expense_date: today,
    expense_description: "",
  });

  const [expenseEvidence, setExpenseEvidence] = useState(null);
  const [expensePreview, setExpensePreview] = useState("");

  const [loading, setLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [updateSubmitting, setUpdateSubmitting] = useState(false);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const dateOnly = (value) =>
    value ? String(value).slice(0, 10) : "-";

  const normaliseStatus = (value) =>
    String(value || "pending").trim().toLowerCase();

  const getStatusClass = (status) => {
    const value = normaliseStatus(status);

    if (["approved", "active", "running"].includes(value)) {
      return "badge green";
    }

    if (["rejected", "inactive", "cancelled"].includes(value)) {
      return "badge red";
    }

    return "badge yellow";
  };

  const selectedAssignment = useMemo(() => {
    return assignments.find(
      (item) =>
        String(item.assignment_id) === String(selectedAssignmentId)
    );
  }, [assignments, selectedAssignmentId]);

  const allocationSummary = useMemo(() => {
    return allocations.map((allocation) => {
      const relatedExpenses = expenses.filter(
        (expense) =>
          Number(expense.allocation_id) === Number(allocation.id) &&
          normaliseStatus(expense.approval_status) !== "rejected"
      );

      const spent = relatedExpenses.reduce(
        (sum, expense) =>
          sum + Number(expense.expense_amount || 0),
        0
      );

      const allocated = Number(allocation.allocated_amount || 0);

      return {
        ...allocation,
        spent,
        remaining: allocated - spent,
      };
    });
  }, [allocations, expenses]);

  const totals = useMemo(() => {
    const totalAllocated = allocationSummary.reduce(
      (sum, item) => sum + Number(item.allocated_amount || 0),
      0
    );

    const totalSpent = allocationSummary.reduce(
      (sum, item) => sum + Number(item.spent || 0),
      0
    );

    return {
      totalAllocated,
      totalSpent,
      remaining: totalAllocated - totalSpent,

      pendingUpdates: updates.filter(
        (item) =>
          normaliseStatus(item.approval_status || item.status) ===
          "pending"
      ).length,

      approvedUpdates: updates.filter(
        (item) =>
          normaliseStatus(item.approval_status || item.status) ===
          "approved"
      ).length,

      pendingExpenses: expenses.filter(
        (item) =>
          normaliseStatus(item.approval_status) === "pending"
      ).length,
    };
  }, [allocationSummary, updates, expenses]);

  const recentUpdates = useMemo(() => {
    return [...updates]
      .sort(
        (a, b) =>
          new Date(b.log_date || b.created_at || 0) -
          new Date(a.log_date || a.created_at || 0)
      )
      .slice(0, 5);
  }, [updates]);

  const recentExpenses = useMemo(() => {
    return [...expenses]
      .sort(
        (a, b) =>
          new Date(b.expense_date || b.created_at || 0) -
          new Date(a.expense_date || a.created_at || 0)
      )
      .slice(0, 5);
  }, [expenses]);

  const assignmentExportColumns = [
    { key: "site", label: "Site" },
    { key: "tender", label: "Tender" },
    { key: "status", label: "Status" },
  ];

  const assignmentExportRows = assignments.map((item) => ({
    site: item.site_name || "",
    tender: item.tender_title || "",
    status:
      item.tender_status || item.assignment_status || "active",
  }));

  const updateExportColumns = [
    { key: "date", label: "Date" },
    { key: "site", label: "Site" },
    { key: "tender", label: "Tender" },
    { key: "notes", label: "Notes" },
    { key: "status", label: "Status" },
    { key: "admin_comment", label: "Admin Comment" },
    { key: "photo", label: "Photo URL" },
  ];

  const updateExportRows = updates.map((item) => ({
    date: dateOnly(item.log_date),
    site: item.site_name || "",
    tender: item.tender_title || "",
    notes: item.notes || "",
    status: normaliseStatus(
      item.approval_status || item.status
    ),
    admin_comment: item.admin_comment || "",
    photo: item.photo_url || "",
  }));

  const moneyExportColumns = [
    { key: "purpose", label: "Purpose" },
    { key: "allocated", label: "Allocated" },
    { key: "spent", label: "Spent" },
    { key: "remaining", label: "Remaining" },
    { key: "status", label: "Status" },
  ];

  const moneyExportRows = allocationSummary.map((item) => ({
    purpose: item.purpose || "",
    allocated: formatCurrency(item.allocated_amount),
    spent: formatCurrency(item.spent),
    remaining: formatCurrency(item.remaining),
    status: normaliseStatus(item.approval_status),
  }));

  const loadMoney = async () => {
    const data = await getWorkerMoney();

    setAllocations(data.allocations || []);
    setExpenses(data.expenses || []);
  };

  const loadPortal = async () => {
    try {
      setLoading(true);
      setError("");

      const [profileData, assignmentData, updateData] =
        await Promise.all([
          getWorkerProfile(),
          getWorkerAssignments(),
          getWorkerDailyUpdates(),
        ]);

      const scopedAssignments =
        assignmentData.assignments || [];

      setWorker(profileData.worker || null);
      setAssignments(scopedAssignments);
      setUpdates(updateData.updates || []);

      if (scopedAssignments.length > 0) {
        setSelectedAssignmentId((current) => {
          const currentStillExists = scopedAssignments.some(
            (item) =>
              String(item.assignment_id) === String(current)
          );

          return currentStillExists
            ? current
            : String(scopedAssignments[0].assignment_id);
        });
      }

      await loadMoney();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Failed to load your worker portal."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortal();
  }, []);

  useEffect(() => {
    async function loadSelectedDocuments() {
      if (!selectedAssignment?.tender_id) {
        setDocuments([]);
        return;
      }

      try {
        setDocumentsLoading(true);
        setError("");

        const data = await getWorkerTenderDocuments(
          selectedAssignment.tender_id
        );

        setDocuments(data.documents || []);
      } catch (requestError) {
        setDocuments([]);

        setError(
          requestError.response?.data?.message ||
            "Failed to load project documents."
        );
      } finally {
        setDocumentsLoading(false);
      }
    }

    loadSelectedDocuments();
  }, [selectedAssignment]);

  useEffect(() => {
    return () => {
      if (updatePhotoPreview) {
        URL.revokeObjectURL(updatePhotoPreview);
      }

      if (expensePreview) {
        URL.revokeObjectURL(expensePreview);
      }
    };
  }, [updatePhotoPreview, expensePreview]);

  const handleLogout = () => {
    if (typeof logout === "function") {
      logout();
    }

    navigate("/login", { replace: true });
  };

  const handleUpdatePhoto = (event) => {
    const file = event.target.files?.[0] || null;

    if (file && !file.type.startsWith("image/")) {
      setError("Daily progress evidence must be an image.");
      event.target.value = "";
      return;
    }

    if (file && file.size > MAX_FILE_SIZE) {
      setError("The image must be smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    if (updatePhotoPreview) {
      URL.revokeObjectURL(updatePhotoPreview);
    }

    setError("");
    setUpdatePhoto(file);
    setUpdatePhotoPreview(
      file ? URL.createObjectURL(file) : ""
    );
  };

  const handleExpenseEvidence = (event) => {
    const file = event.target.files?.[0] || null;

    if (
      file &&
      !file.type.startsWith("image/") &&
      file.type !== "application/pdf"
    ) {
      setError("Expense evidence must be an image or PDF.");
      event.target.value = "";
      return;
    }

    if (file && file.size > MAX_FILE_SIZE) {
      setError("The expense evidence must be smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    if (expensePreview) {
      URL.revokeObjectURL(expensePreview);
    }

    setError("");
    setExpenseEvidence(file);

    setExpensePreview(
      file?.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : ""
    );
  };

  const handleUpdateSubmit = async (event) => {
    event.preventDefault();

    if (!selectedAssignment) {
      setError("Select one of your assigned projects.");
      return;
    }

    if (
      updateForm.log_date < minimumUpdateDate ||
      updateForm.log_date > today
    ) {
      setError(
        "Updates can only be submitted for today or the previous two days."
      );
      return;
    }

    if (!updateForm.notes.trim() && !updatePhoto) {
      setError("Add progress notes or a site photo.");
      return;
    }

    try {
      setUpdateSubmitting(true);
      setMessage("");
      setError("");

      let photoUrl = null;

      if (updatePhoto) {
        photoUrl = await uploadFile(
          updatePhoto,
          "worker-updates"
        );
      }

      const result = await createWorkerDailyUpdate({
        site_id: selectedAssignment.site_id,
        tender_id: selectedAssignment.tender_id,
        log_date: updateForm.log_date,
        notes: updateForm.notes.trim(),
        photo_url: photoUrl,
      });

      setUpdateForm({
        log_date: today,
        notes: "",
      });

      setUpdatePhoto(null);

      if (updatePhotoPreview) {
        URL.revokeObjectURL(updatePhotoPreview);
      }

      setUpdatePhotoPreview("");

      setMessage(
        result.message ||
          "Daily update submitted for approval."
      );

      const updateData = await getWorkerDailyUpdates();
      setUpdates(updateData.updates || []);
      setActiveSection("updates");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Failed to submit your daily update."
      );
    } finally {
      setUpdateSubmitting(false);
    }
  };

  const handleExpenseChange = (event) => {
    setExpenseForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  };

  const handleExpenseSubmit = async (event) => {
    event.preventDefault();

    const allocation = allocationSummary.find(
      (item) =>
        String(item.id) ===
        String(expenseForm.allocation_id)
    );

    if (!allocation) {
      setError("Select an approved allocation.");
      return;
    }

    const expenseAmount = Number(
      expenseForm.expense_amount || 0
    );

    if (expenseAmount <= 0) {
      setError("Enter a valid expense amount.");
      return;
    }

    if (expenseAmount > Number(allocation.remaining || 0)) {
      setError(
        `The expense cannot exceed ${formatCurrency(
          allocation.remaining
        )}, which is the remaining allocation.`
      );
      return;
    }

    try {
      setExpenseSubmitting(true);
      setMessage("");
      setError("");

      let evidenceUrl = null;

      if (expenseEvidence) {
        evidenceUrl = await uploadFile(
          expenseEvidence,
          "worker-expenses"
        );
      }

      const result = await createWorkerPortalExpense({
        allocation_id: expenseForm.allocation_id,
        expense_amount: expenseAmount,
        expense_date: expenseForm.expense_date,
        expense_description:
          expenseForm.expense_description.trim(),
        uploaded_photo: evidenceUrl,
      });

      setExpenseForm({
        allocation_id: "",
        expense_amount: "",
        expense_date: today,
        expense_description: "",
      });

      setExpenseEvidence(null);

      if (expensePreview) {
        URL.revokeObjectURL(expensePreview);
      }

      setExpensePreview("");

      setMessage(
        result.message ||
          "Expense submitted for approval."
      );

      await loadMoney();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Failed to submit the expense."
      );
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const exportConfig = {
    overview: {
      filename: "my-worker-projects",
      title: "My Assigned Projects",
      rows: assignmentExportRows,
      columns: assignmentExportColumns,
      summary: {
        Worker:
          worker?.full_name ||
          user?.full_name ||
          "Worker",
        Projects: assignments.length,
        "Pending Updates": totals.pendingUpdates,
      },
    },

    projects: {
      filename: "my-worker-projects",
      title: "My Assigned Projects",
      rows: assignmentExportRows,
      columns: assignmentExportColumns,
      summary: {
        Projects: assignments.length,
      },
    },

    updates: {
      filename: "my-daily-updates",
      title: "My Daily Updates",
      rows: updateExportRows,
      columns: updateExportColumns,
      summary: {
        Updates: updates.length,
        Pending: totals.pendingUpdates,
        Approved: totals.approvedUpdates,
      },
    },

    money: {
      filename: "my-worker-money",
      title: "My Worker Money",
      rows: moneyExportRows,
      columns: moneyExportColumns,
      summary: {
        Allocated: formatCurrency(totals.totalAllocated),
        Spent: formatCurrency(totals.totalSpent),
        Remaining: formatCurrency(totals.remaining),
      },
    },
  };

  const currentExport =
    exportConfig[activeSection] || exportConfig.overview;

  if (loading) {
    return (
      <main className="worker-portal-page">
        <section className="panel">
          Loading your worker portal...
        </section>
      </main>
    );
  }

  return (
    <main className="worker-portal-page">
      <header className="worker-header">
        <div>
          <p className="muted-text">Worker Portal</p>

          <h1>
            Welcome back,{" "}
            {worker?.full_name ||
              user?.full_name ||
              user?.email ||
              "Worker"}
          </h1>

          <p className="muted-text">
            View your projects, submit progress and manage your
            work expenses.
          </p>
        </div>

        <div className="report-actions">
          <ExportButtons
            filename={currentExport.filename}
            title={currentExport.title}
            rows={currentExport.rows}
            columns={currentExport.columns}
            summary={currentExport.summary}
          />

          <button
            type="button"
            className="delete-btn"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      {message && (
        <p className="success-message">{message}</p>
      )}

      {error && <p className="error">{error}</p>}

      <section className="summary-cards">
        <div className="card">
          <p>My Projects</p>
          <h2>{assignments.length}</h2>
        </div>

        <div className="card highlight-warning">
          <p>Pending Updates</p>
          <h2>{totals.pendingUpdates}</h2>
        </div>

        <div className="card highlight-warning">
          <p>Pending Expenses</p>
          <h2>{totals.pendingExpenses}</h2>
        </div>

        <div className="card">
          <p>Available Balance</p>
          <h2>{formatCurrency(totals.remaining)}</h2>
        </div>
      </section>

      <section className="panel">
        <div className="tabs">
          {[
            ["overview", "Home"],
            ["projects", "My Projects"],
            ["updates", "Daily Updates"],
            ["money", "My Money"],
            ["profile", "My Profile"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={
                activeSection === key ? "active-tab" : ""
              }
              onClick={() => setActiveSection(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {activeSection === "overview" && (
        <section className="payment-grid">
          <div className="panel">
            <div className="section-title-row">
              <div>
                <h2>Submit Today’s Progress</h2>
                <p className="muted-text">
                  Add notes or a photo for one of your assigned
                  projects.
                </p>
              </div>
            </div>

            <form
              className="payment-form"
              onSubmit={handleUpdateSubmit}
            >
              <label>
                Project
                <select
                  value={selectedAssignmentId}
                  onChange={(event) =>
                    setSelectedAssignmentId(
                      event.target.value
                    )
                  }
                  required
                >
                  <option value="">Select project</option>

                  {assignments.map((item) => (
                    <option
                      key={item.assignment_id}
                      value={item.assignment_id}
                    >
                      {item.site_name} — {item.tender_title}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Date
                <input
                  type="date"
                  min={minimumUpdateDate}
                  max={today}
                  value={updateForm.log_date}
                  onChange={(event) =>
                    setUpdateForm((previous) => ({
                      ...previous,
                      log_date: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                Work Completed
                <textarea
                  value={updateForm.notes}
                  onChange={(event) =>
                    setUpdateForm((previous) => ({
                      ...previous,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="What work was completed today?"
                />
              </label>

              <label>
                Progress Photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleUpdatePhoto}
                />
              </label>

              <small>
                Photos must be images under 10 MB. Updates are sent
                for approval.
              </small>

              {updatePhotoPreview && (
                <img
                  src={updatePhotoPreview}
                  alt="Progress preview"
                  className="worker-photo-preview"
                />
              )}

              <button
                type="submit"
                disabled={
                  updateSubmitting || assignments.length === 0
                }
              >
                {updateSubmitting
                  ? "Submitting..."
                  : "Submit Update"}
              </button>
            </form>
          </div>

          <div className="panel">
            <div className="section-title-row">
              <div>
                <h2>Recent Activity</h2>
                <p className="muted-text">
                  Your latest updates and approvals.
                </p>
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {recentUpdates.map((item) => (
                    <tr key={item.id}>
                      <td>{dateOnly(item.log_date)}</td>
                      <td>
                        {item.site_name || "-"}
                        <br />
                        <small>
                          {item.tender_title || ""}
                        </small>
                      </td>
                      <td>
                        <span
                          className={getStatusClass(
                            item.approval_status ||
                              item.status
                          )}
                        >
                          {normaliseStatus(
                            item.approval_status ||
                              item.status
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {recentUpdates.length === 0 && (
                    <tr>
                      <td
                        colSpan="3"
                        className="empty-table-message"
                      >
                        No updates submitted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeSection === "projects" && (
        <section className="payment-grid">
          <div className="panel">
            <h2>My Assigned Projects</h2>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Tender</th>
                    <th>Status</th>
                    <th>Open</th>
                  </tr>
                </thead>

                <tbody>
                  {assignments.map((item) => (
                    <tr key={item.assignment_id}>
                      <td>{item.site_name || "-"}</td>
                      <td>{item.tender_title || "-"}</td>
                      <td>
                        <span
                          className={getStatusClass(
                            item.tender_status ||
                              item.assignment_status
                          )}
                        >
                          {item.tender_status ||
                            item.assignment_status ||
                            "active"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedAssignmentId(
                              String(item.assignment_id)
                            )
                          }
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}

                  {assignments.length === 0 && (
                    <tr>
                      <td
                        colSpan="4"
                        className="empty-table-message"
                      >
                        No projects are assigned to you.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h2>Project Documents</h2>

            {selectedAssignment && (
              <p className="muted-text">
                {selectedAssignment.site_name} —{" "}
                {selectedAssignment.tender_title}
              </p>
            )}

            {documentsLoading ? (
              <p>Loading documents...</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Type</th>
                      <th>Open</th>
                    </tr>
                  </thead>

                  <tbody>
                    {documents.map((document) => (
                      <tr key={document.id}>
                        <td>
                          {document.document_name || "-"}
                        </td>
                        <td>
                          {document.document_type || "-"}
                        </td>
                        <td>
                          {document.file_url ? (
                            <a
                              href={document.file_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}

                    {documents.length === 0 && (
                      <tr>
                        <td
                          colSpan="3"
                          className="empty-table-message"
                        >
                          No documents for this project.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {activeSection === "updates" && (
        <section className="panel">
          <h2>My Daily Updates</h2>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Project</th>
                  <th>Notes</th>
                  <th>Photo</th>
                  <th>Status</th>
                  <th>Admin Comment</th>
                </tr>
              </thead>

              <tbody>
                {updates.map((item) => (
                  <tr key={item.id}>
                    <td>{dateOnly(item.log_date)}</td>
                    <td>
                      {item.site_name || "-"}
                      <br />
                      <small>{item.tender_title || ""}</small>
                    </td>
                    <td>{item.notes || "-"}</td>
                    <td>
                      {item.photo_url ? (
                        <a
                          href={item.photo_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <span
                        className={getStatusClass(
                          item.approval_status || item.status
                        )}
                      >
                        {normaliseStatus(
                          item.approval_status || item.status
                        )}
                      </span>
                    </td>
                    <td>{item.admin_comment || "-"}</td>
                  </tr>
                ))}

                {updates.length === 0 && (
                  <tr>
                    <td
                      colSpan="6"
                      className="empty-table-message"
                    >
                      No daily updates found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSection === "money" && (
        <>
          <section className="summary-cards">
            <div className="card">
              <p>Allocated</p>
              <h2>{formatCurrency(totals.totalAllocated)}</h2>
            </div>

            <div className="card">
              <p>Spent</p>
              <h2>{formatCurrency(totals.totalSpent)}</h2>
            </div>

            <div className="card">
              <p>Available</p>
              <h2>{formatCurrency(totals.remaining)}</h2>
            </div>
          </section>

          <section className="payment-grid">
            <div className="panel">
              <h2>Submit Expense</h2>

              <form
                className="payment-form"
                onSubmit={handleExpenseSubmit}
              >
                <label>
                  Allocation
                  <select
                    name="allocation_id"
                    value={expenseForm.allocation_id}
                    onChange={handleExpenseChange}
                    required
                  >
                    <option value="">Select allocation</option>

                    {allocationSummary
                      .filter(
                        (item) =>
                          normaliseStatus(
                            item.approval_status
                          ) === "approved" &&
                          Number(item.remaining || 0) > 0
                      )
                      .map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.purpose || "Allocation"} —{" "}
                          {formatCurrency(item.remaining)} left
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Amount
                  <input
                    name="expense_amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={expenseForm.expense_amount}
                    onChange={handleExpenseChange}
                    required
                  />
                </label>

                <label>
                  Date
                  <input
                    name="expense_date"
                    type="date"
                    max={today}
                    value={expenseForm.expense_date}
                    onChange={handleExpenseChange}
                    required
                  />
                </label>

                <label>
                  Description
                  <textarea
                    name="expense_description"
                    value={
                      expenseForm.expense_description
                    }
                    onChange={handleExpenseChange}
                    required
                  />
                </label>

                <label>
                  Receipt
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleExpenseEvidence}
                  />
                </label>

                {expensePreview && (
                  <img
                    src={expensePreview}
                    alt="Expense evidence"
                    className="worker-photo-preview"
                  />
                )}

                <button
                  type="submit"
                  disabled={expenseSubmitting}
                >
                  {expenseSubmitting
                    ? "Submitting..."
                    : "Submit Expense"}
                </button>
              </form>
            </div>

            <div className="panel">
              <h2>Recent Expenses</h2>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentExpenses.map((item) => (
                      <tr key={item.id}>
                        <td>{dateOnly(item.expense_date)}</td>
                        <td className="amount-cell">
                          {formatCurrency(
                            item.expense_amount
                          )}
                        </td>
                        <td>
                          <span
                            className={getStatusClass(
                              item.approval_status
                            )}
                          >
                            {normaliseStatus(
                              item.approval_status
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {recentExpenses.length === 0 && (
                      <tr>
                        <td
                          colSpan="3"
                          className="empty-table-message"
                        >
                          No expenses submitted.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="panel">
            <h2>Allocation Details</h2>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Purpose</th>
                    <th>Allocated</th>
                    <th>Spent</th>
                    <th>Available</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {allocationSummary.map((item) => (
                    <tr key={item.id}>
                      <td>{item.purpose || "-"}</td>
                      <td className="amount-cell">
                        {formatCurrency(
                          item.allocated_amount
                        )}
                      </td>
                      <td className="amount-cell">
                        {formatCurrency(item.spent)}
                      </td>
                      <td className="amount-cell">
                        {formatCurrency(item.remaining)}
                      </td>
                      <td>
                        <span
                          className={getStatusClass(
                            item.approval_status
                          )}
                        >
                          {normaliseStatus(
                            item.approval_status
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {allocationSummary.length === 0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="empty-table-message"
                      >
                        No allocations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeSection === "profile" && (
        <section className="panel">
          <h2>My Profile</h2>

          <table>
            <tbody>
              <tr>
                <th>Name</th>
                <td>
                  {worker?.full_name ||
                    user?.full_name ||
                    "-"}
                </td>
              </tr>

              <tr>
                <th>Email</th>
                <td>{worker?.email || user?.email || "-"}</td>
              </tr>

              <tr>
                <th>Phone</th>
                <td>{worker?.phone || "-"}</td>
              </tr>

              <tr>
                <th>Role</th>
                <td>{worker?.role || "Worker"}</td>
              </tr>

              <tr>
                <th>Status</th>
                <td>{worker?.status || "-"}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

export default WorkerPortalPage;