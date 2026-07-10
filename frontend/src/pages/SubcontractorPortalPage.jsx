import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { formatCurrency } from "../utils/currency";
import ExportButtons from "../components/export/ExportButtons";

import {
  getSubcontractorProfile,
  getSubcontractorTenders,
  getSubcontractorTenderDetails,
  createSubcontractorDailyUpdate,
  addSubcontractorTenderDocument,
} from "../services/subcontractorPortalService";

import { uploadFile } from "../services/uploadService";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function SubcontractorPortalPage({ logout }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const today = new Date().toISOString().slice(0, 10);

  const minimumUpdateDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 2);
    return date.toISOString().slice(0, 10);
  }, []);

  const [subcontractor, setSubcontractor] = useState(null);
  const [tenders, setTenders] = useState([]);

  const [selectedTenderId, setSelectedTenderId] = useState("");
  const [selectedTender, setSelectedTender] = useState(null);

  const [documents, setDocuments] = useState([]);
  const [updates, setUpdates] = useState([]);

  const [activeSection, setActiveSection] = useState("overview");

  const [updateForm, setUpdateForm] = useState({
    log_date: today,
    notes: "",
  });

  const [updatePhoto, setUpdatePhoto] = useState(null);
  const [updatePhotoPreview, setUpdatePhotoPreview] =
    useState("");

  const [documentForm, setDocumentForm] = useState({
    document_name: "",
    document_type: "PDF",
  });

  const [documentFile, setDocumentFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [tenderLoading, setTenderLoading] = useState(false);
  const [updateSubmitting, setUpdateSubmitting] =
    useState(false);
  const [documentSubmitting, setDocumentSubmitting] =
    useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const dateOnly = (value) =>
    value ? String(value).slice(0, 10) : "-";

  const normaliseStatus = (value) =>
    String(value || "pending").trim().toLowerCase();

  const getStatusClass = (status) => {
    const value = normaliseStatus(status);

    if (["approved", "active", "running", "paid"].includes(value)) {
      return "badge green";
    }

    if (
      ["rejected", "inactive", "cancelled", "overdue"].includes(
        value
      )
    ) {
      return "badge red";
    }

    return "badge yellow";
  };

  const totals = useMemo(() => {
    return {
      assignedValue: tenders.reduce(
        (sum, item) =>
          sum + Number(item.assigned_amount || 0),
        0
      ),

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
    };
  }, [tenders, updates]);

  const recentUpdates = useMemo(() => {
    return [...updates]
      .sort(
        (a, b) =>
          new Date(b.log_date || b.created_at || 0) -
          new Date(a.log_date || a.created_at || 0)
      )
      .slice(0, 5);
  }, [updates]);

  const tenderExportColumns = [
    { key: "tender", label: "Tender" },
    { key: "site", label: "Site" },
    { key: "status", label: "Status" },
    { key: "assigned_amount", label: "Assigned Amount" },
  ];

  const tenderExportRows = tenders.map((item) => ({
    tender: item.tender_title || "",
    site: item.site_name || "",
    status:
      item.assignment_status || item.tender_status || "active",
    assigned_amount: formatCurrency(item.assigned_amount),
  }));

  const updateExportColumns = [
    { key: "date", label: "Date" },
    { key: "tender", label: "Tender" },
    { key: "site", label: "Site" },
    { key: "notes", label: "Notes" },
    { key: "status", label: "Status" },
    { key: "admin_comment", label: "Admin Comment" },
    { key: "photo", label: "Photo URL" },
  ];

  const updateExportRows = updates.map((item) => ({
    date: dateOnly(item.log_date),
    tender: selectedTender?.title || "",
    site: selectedTender?.site_name || "",
    notes: item.notes || "",
    status: normaliseStatus(
      item.approval_status || item.status
    ),
    admin_comment: item.admin_comment || "",
    photo: item.photo_url || "",
  }));

  const clearTenderData = () => {
    setSelectedTender(null);
    setDocuments([]);
    setUpdates([]);
  };

  const openTender = async (tenderId) => {
    if (!tenderId) {
      clearTenderData();
      return;
    }

    const assigned = tenders.some(
      (item) =>
        String(item.tender_id) === String(tenderId)
    );

    if (!assigned && tenders.length > 0) {
      setError(
        "This tender is not assigned to your account."
      );
      return;
    }

    try {
      setTenderLoading(true);
      setError("");

      const data =
        await getSubcontractorTenderDetails(tenderId);

      setSelectedTender(data.tender || null);
      setSelectedTenderId(String(tenderId));
      setDocuments(data.documents || []);
      setUpdates(data.updates || []);
    } catch (requestError) {
      clearTenderData();

      setError(
        requestError.response?.data?.message ||
          "Failed to load tender details."
      );
    } finally {
      setTenderLoading(false);
    }
  };

  const loadPortal = async () => {
    try {
      setLoading(true);
      setError("");

      const [profileData, tenderData] = await Promise.all([
        getSubcontractorProfile(),
        getSubcontractorTenders(),
      ]);

      const scopedTenders = tenderData.tenders || [];

      setSubcontractor(profileData.subcontractor || null);
      setTenders(scopedTenders);

      if (scopedTenders.length > 0) {
        await openTender(scopedTenders[0].tender_id);
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Failed to load your subcontractor portal."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortal();
  }, []);

  useEffect(() => {
    return () => {
      if (updatePhotoPreview) {
        URL.revokeObjectURL(updatePhotoPreview);
      }
    };
  }, [updatePhotoPreview]);

  const handleLogout = () => {
    if (typeof logout === "function") {
      logout();
    }

    navigate("/login", { replace: true });
  };

  const handleTenderChange = async (event) => {
    const tenderId = event.target.value;

    setSelectedTenderId(tenderId);

    if (!tenderId) {
      clearTenderData();
      return;
    }

    await openTender(tenderId);
  };

  const handleUpdatePhoto = (event) => {
    const file = event.target.files?.[0] || null;

    if (file && !file.type.startsWith("image/")) {
      setError("Progress evidence must be an image.");
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

  const handleUpdateSubmit = async (event) => {
    event.preventDefault();

    if (!selectedTender) {
      setError("Select one of your assigned tenders.");
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
          "subcontractor-updates"
        );
      }

      const result =
        await createSubcontractorDailyUpdate({
          site_id: selectedTender.site_id,
          tender_id: selectedTender.id,
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

      await openTender(selectedTender.id);
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

  const handleDocumentSubmit = async (event) => {
    event.preventDefault();

    if (!selectedTender) {
      setError("Select an assigned tender.");
      return;
    }

    if (!documentFile) {
      setError("Select a document.");
      return;
    }

    if (documentFile.size > MAX_FILE_SIZE) {
      setError("The document must be smaller than 10 MB.");
      return;
    }

    try {
      setDocumentSubmitting(true);
      setMessage("");
      setError("");

      const fileUrl = await uploadFile(
        documentFile,
        "subcontractor-documents"
      );

      await addSubcontractorTenderDocument({
        tender_id: selectedTender.id,
        document_name:
          documentForm.document_name.trim(),
        document_type: documentForm.document_type,
        file_url: fileUrl,
      });

      setDocumentForm({
        document_name: "",
        document_type: "PDF",
      });

      setDocumentFile(null);
      setMessage("Document uploaded successfully.");

      await openTender(selectedTender.id);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Failed to upload the document."
      );
    } finally {
      setDocumentSubmitting(false);
    }
  };

  const exportConfig = {
    overview: {
      filename: "my-assigned-tenders",
      title: "My Assigned Tenders",
      rows: tenderExportRows,
      columns: tenderExportColumns,
      summary: {
        Subcontractor:
          subcontractor?.business_name ||
          subcontractor?.full_name ||
          user?.full_name ||
          "Subcontractor",
        Tenders: tenders.length,
        "Assigned Value": formatCurrency(
          totals.assignedValue
        ),
      },
    },

    tenders: {
      filename: "my-assigned-tenders",
      title: "My Assigned Tenders",
      rows: tenderExportRows,
      columns: tenderExportColumns,
      summary: {
        Tenders: tenders.length,
        "Assigned Value": formatCurrency(
          totals.assignedValue
        ),
      },
    },

    updates: {
      filename: "my-subcontractor-updates",
      title: "My Daily Updates",
      rows: updateExportRows,
      columns: updateExportColumns,
      summary: {
        Updates: updates.length,
        Pending: totals.pendingUpdates,
        Approved: totals.approvedUpdates,
      },
    },
  };

  const currentExport =
    exportConfig[activeSection] || exportConfig.overview;

  if (loading) {
    return (
      <main className="subcontractor-portal-page">
        <section className="panel">
          Loading your subcontractor portal...
        </section>
      </main>
    );
  }

  return (
    <main className="subcontractor-portal-page">
      <header className="worker-header">
        <div>
          <p className="muted-text">
            Subcontractor Portal
          </p>

          <h1>
            Welcome back,{" "}
            {subcontractor?.business_name ||
              subcontractor?.full_name ||
              user?.full_name ||
              user?.email ||
              "Subcontractor"}
          </h1>

          <p className="muted-text">
            View your assigned tenders, submit progress and manage
            project documents.
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
          <p>My Tenders</p>
          <h2>{tenders.length}</h2>
        </div>

        <div className="card">
          <p>Assigned Value</p>
          <h2>{formatCurrency(totals.assignedValue)}</h2>
        </div>

        <div className="card highlight-warning">
          <p>Pending Updates</p>
          <h2>{totals.pendingUpdates}</h2>
        </div>

        <div className="card">
          <p>Selected Tender Documents</p>
          <h2>{documents.length}</h2>
        </div>
      </section>

      <section className="panel">
        <div className="tabs">
          {[
            ["overview", "Home"],
            ["tenders", "My Tenders"],
            ["updates", "Daily Updates"],
            ["documents", "Documents"],
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

      <section className="panel">
        <label>
          Selected Tender
          <select
            value={selectedTenderId}
            onChange={handleTenderChange}
          >
            <option value="">Select assigned tender</option>

            {tenders.map((item) => (
              <option
                key={item.assignment_id}
                value={item.tender_id}
              >
                {item.tender_title} — {item.site_name}
              </option>
            ))}
          </select>
        </label>

        {selectedTender && (
          <div className="form-preview-total">
            {selectedTender.title} ·{" "}
            {selectedTender.site_name} ·{" "}
            {selectedTender.status}
          </div>
        )}
      </section>

      {tenderLoading && (
        <section className="panel">
          Loading tender...
        </section>
      )}

      {!tenderLoading && activeSection === "overview" && (
        <section className="payment-grid">
          <div className="panel">
            <h2>Submit Today’s Progress</h2>

            <form
              className="payment-form"
              onSubmit={handleUpdateSubmit}
            >
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
                Progress Notes
                <textarea
                  value={updateForm.notes}
                  onChange={(event) =>
                    setUpdateForm((previous) => ({
                      ...previous,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="What work was completed?"
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
                Photos must be images under 10 MB. Updates require
                approval.
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
                  updateSubmitting || !selectedTender
                }
              >
                {updateSubmitting
                  ? "Submitting..."
                  : "Submit Update"}
              </button>
            </form>
          </div>

          <div className="panel">
            <h2>Recent Updates</h2>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Notes</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {recentUpdates.map((item) => (
                    <tr key={item.id}>
                      <td>{dateOnly(item.log_date)}</td>
                      <td>{item.notes || "-"}</td>
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
                        No updates for this tender.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {!tenderLoading && activeSection === "tenders" && (
        <section className="payment-grid">
          <div className="panel">
            <h2>My Assigned Tenders</h2>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Tender</th>
                    <th>Site</th>
                    <th>Status</th>
                    <th>Assigned Amount</th>
                    <th>Open</th>
                  </tr>
                </thead>

                <tbody>
                  {tenders.map((item) => (
                    <tr key={item.assignment_id}>
                      <td>{item.tender_title || "-"}</td>
                      <td>{item.site_name || "-"}</td>
                      <td>
                        <span
                          className={getStatusClass(
                            item.assignment_status ||
                              item.tender_status
                          )}
                        >
                          {item.assignment_status ||
                            item.tender_status ||
                            "active"}
                        </span>
                      </td>
                      <td className="amount-cell">
                        {formatCurrency(item.assigned_amount)}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            openTender(item.tender_id)
                          }
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}

                  {tenders.length === 0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="empty-table-message"
                      >
                        No tenders are assigned to you.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h2>Tender Summary</h2>

            {selectedTender ? (
              <table>
                <tbody>
                  <tr>
                    <th>Tender</th>
                    <td>{selectedTender.title || "-"}</td>
                  </tr>

                  <tr>
                    <th>Site</th>
                    <td>
                      {selectedTender.site_name || "-"}
                    </td>
                  </tr>

                  <tr>
                    <th>Status</th>
                    <td>{selectedTender.status || "-"}</td>
                  </tr>

                  <tr>
                    <th>Documents</th>
                    <td>{documents.length}</td>
                  </tr>

                  <tr>
                    <th>Updates</th>
                    <td>{updates.length}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="muted-text">
                Select an assigned tender.
              </p>
            )}
          </div>
        </section>
      )}

      {!tenderLoading && activeSection === "updates" && (
        <section className="panel">
          <h2>My Daily Updates</h2>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
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
                      colSpan="5"
                      className="empty-table-message"
                    >
                      No updates for this tender.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!tenderLoading && activeSection === "documents" && (
        <section className="payment-grid">
          <div className="panel">
            <h2>Upload Document</h2>

            <form
              className="payment-form"
              onSubmit={handleDocumentSubmit}
            >
              <label>
                Document Name
                <input
                  value={documentForm.document_name}
                  onChange={(event) =>
                    setDocumentForm((previous) => ({
                      ...previous,
                      document_name: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                Type
                <select
                  value={documentForm.document_type}
                  onChange={(event) =>
                    setDocumentForm((previous) => ({
                      ...previous,
                      document_type: event.target.value,
                    }))
                  }
                >
                  <option value="PDF">PDF</option>
                  <option value="Word">Word</option>
                  <option value="JPG">JPG</option>
                  <option value="PNG">PNG</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label>
                File
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(event) =>
                    setDocumentFile(
                      event.target.files?.[0] || null
                    )
                  }
                  required
                />
              </label>

              <button
                type="submit"
                disabled={
                  documentSubmitting || !selectedTender
                }
              >
                {documentSubmitting
                  ? "Uploading..."
                  : "Upload Document"}
              </button>
            </form>
          </div>

          <div className="panel">
            <h2>My Tender Documents</h2>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
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
                        No documents for this tender.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeSection === "profile" && (
        <section className="panel">
          <h2>My Profile</h2>

          <table>
            <tbody>
              <tr>
                <th>Name</th>
                <td>
                  {subcontractor?.full_name ||
                    user?.full_name ||
                    "-"}
                </td>
              </tr>

              <tr>
                <th>Business</th>
                <td>
                  {subcontractor?.business_name || "-"}
                </td>
              </tr>

              <tr>
                <th>Email</th>
                <td>
                  {subcontractor?.email ||
                    subcontractor?.login_email ||
                    user?.email ||
                    "-"}
                </td>
              </tr>

              <tr>
                <th>Phone</th>
                <td>{subcontractor?.phone || "-"}</td>
              </tr>

              <tr>
                <th>GST Number</th>
                <td>{subcontractor?.gst_number || "-"}</td>
              </tr>

              <tr>
                <th>Status</th>
                <td>
                  {subcontractor?.subcontractor_status ||
                    subcontractor?.status ||
                    "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

export default SubcontractorPortalPage;