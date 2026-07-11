import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DeleteVerificationModal from "../components/DeleteVerificationModal";
import { updateTender } from "../services/tenderService";
import ExportButtons from "../components/export/ExportButtons";
import { formatCurrency } from "../utils/currency";
import { useAuth } from "../contexts/AuthContext";
import useTenders from "../hooks/useTenders";
import useSites from "../hooks/useSites";


function TendersPage() {
  const { user } = useAuth();

  const {
    tenders = [],
    addTender,
    removeTender,
    fetchTenders,
  } = useTenders(user);

  const { sites = [] } = useSites(user);
  const navigate = useNavigate();

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingTender, setEditingTender] = useState(null);
  const [activeTab, setActiveTab] = useState("running");
  const [searchTerm, setSearchTerm] = useState("");

  const emptyForm = {
    title: "",
    status: "running",
    due_date: "",
    description: "",
    site_id: "",
    estimated_value: "",
  };

  const [editForm, setEditForm] = useState(emptyForm);

  const money = formatCurrency;

  const dateOnly = (value) => (value ? String(value).slice(0, 10) : "");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const next7Days = new Date(today);
  next7Days.setDate(next7Days.getDate() + 7);

  const getSiteName = (siteId) => {
    const site = sites?.find((item) => Number(item.id) === Number(siteId));
    return site ? site.site_name : "N/A";
  };

  const runningTenders = tenders.filter((tender) => tender.status === "running");
  const completedTenders = tenders.filter(
    (tender) => tender.status === "completed" || tender.status === "passed"
  );
  const pendingTenders = tenders.filter((tender) => tender.status === "pending");

  const dueSoonTenders = tenders.filter((tender) => {
    if (!tender.due_date) return false;

    const due = new Date(tender.due_date);
    return due >= today && due <= next7Days && tender.status !== "completed";
  });

  const totalTenderValue = tenders.reduce(
    (sum, tender) => sum + Number(tender.estimated_value || 0),
    0
  );

  const filteredTenders = tenders.filter((tender) => {
    const search = searchTerm.toLowerCase();
    const matchesTab =
      activeTab === "due soon"
        ? dueSoonTenders.some((item) => Number(item.id) === Number(tender.id))
        : tender.status === activeTab;

    const siteName = (
      tender.site_name ||
      getSiteName(tender.site_id) ||
      ""
    ).toLowerCase();

    const matchesSearch =
      tender.title?.toLowerCase().includes(search) ||
      tender.tender_name?.toLowerCase().includes(search) ||
      tender.status?.toLowerCase().includes(search) ||
      tender.description?.toLowerCase().includes(search) ||
      tender.due_date?.toLowerCase().includes(search) ||
      String(tender.estimated_value || "").includes(search) ||
      siteName.includes(search);

    return matchesTab && matchesSearch;
  });

  const filteredTenderValue = filteredTenders.reduce(
    (sum, tender) => sum + Number(tender.estimated_value || 0),
    0
  );

  const tenderExportColumns = [
    { key: "title", label: "Tender" },
    { key: "site_name", label: "Site" },
    { key: "status", label: "Status" },
    { key: "due_date", label: "Due Date" },
    { key: "estimated_value", label: "Estimated Value" },
    { key: "description", label: "Description" },
  ];

  const tenderExportRows = filteredTenders.map((tender) => ({
    title: tender.title || tender.tender_name || "",
    site_name: tender.site_name || getSiteName(tender.site_id),
    status: tender.status || "",
    due_date: dateOnly(tender.due_date),
    estimated_value: money(tender.estimated_value),
    description: tender.description || "",
  }));

  const handleAddTender = async (event) => {
    event.preventDefault();
  
    const form = event.currentTarget;
  
    const newTender = {
      company_id: user?.company_id || null,
      site_id: form.site_id.value
        ? Number(form.site_id.value)
        : null,
      title: form.title.value.trim(),
      status: form.status.value,
      due_date: form.due_date.value || null,
      description: form.description.value.trim(),
      estimated_value: Number(
        form.estimated_value.value || 0
      ),
    };
  
    try {
      await addTender(newTender);
      form.reset();
    } catch (error) {
      console.error(
        "Failed to add tender:",
        error.response?.data || error
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    await removeTender(deleteTarget.id);
    setDeleteTarget(null);
  };

  const startEdit = (tender) => {
    setEditingTender(tender);

    setEditForm({
      title: tender.title || tender.tender_name || "",
      status: tender.status || "running",
      due_date: dateOnly(tender.due_date),
      description: tender.description || "",
      site_id: tender.site_id || "",
      estimated_value: tender.estimated_value || "",
    });
  };

  const cancelEdit = () => {
    setEditingTender(null);
    setEditForm(emptyForm);
  };

  const handleEditChange = (event) => {
    setEditForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const handleUpdateTender = async (event) => {
    event.preventDefault();

    if (!editingTender) return;

    await updateTender(editingTender.id, {
      ...editForm,
      site_id: editForm.site_id
        ? Number(editForm.site_id)
        : null,
      estimated_value: Number(
        editForm.estimated_value || 0
      ),
    });
    
    await fetchTenders();
    cancelEdit();
  };

  return (
    <>
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Tenders Management</h2>
            <p className="muted-text">
              Track running, pending, completed and due-soon tenders with site
              links and estimated values.
            </p>
          </div>

          <ExportButtons
            filename="tenders"
            title="Tenders Report"
            subtitle="Construction Portal tender register"
            rows={tenderExportRows}
            columns={tenderExportColumns}
          />
        </div>
      </section>

      <section className="summary-cards">
        <div className="card">
          <p>Total Tenders</p>
          <h2>{tenders.length}</h2>
        </div>

        <div className="card highlight-success">
          <p>Running</p>
          <h2>{runningTenders.length}</h2>
        </div>

        <div className="card">
          <p>Completed / Passed</p>
          <h2>{completedTenders.length}</h2>
        </div>

        <div className="card highlight-warning">
          <p>Pending</p>
          <h2>{pendingTenders.length}</h2>
        </div>

        <div className="card highlight-danger">
          <p>Due Soon</p>
          <h2>{dueSoonTenders.length}</h2>
        </div>

        <div className="card">
          <p>Total Tender Value</p>
          <h2>{money(totalTenderValue)}</h2>
        </div>

        <div className="card">
          <p>Filtered Value</p>
          <h2>{money(filteredTenderValue)}</h2>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>{editingTender ? "Edit Tender" : "Add Tender"}</h2>
              <p className="muted-text">
                {editingTender
                  ? "Update tender site, status, due date and estimated value."
                  : "Create a new tender and link it to a site."}
              </p>
            </div>
          </div>

          {editingTender ? (
            <form className="payment-form" onSubmit={handleUpdateTender}>
              <div className="form-grid">
                <label>
                  Site
                  <select
                    name="site_id"
                    value={editForm.site_id}
                    onChange={handleEditChange}
                  >
                    <option value="">Select Site</option>
                    {sites?.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.site_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Tender Title
                  <input
                    name="title"
                    value={editForm.title}
                    onChange={handleEditChange}
                    required
                  />
                </label>

                <label>
                  Status
                  <select
                    name="status"
                    value={editForm.status}
                    onChange={handleEditChange}
                    required
                  >
                    <option value="running">Running</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="passed">Passed</option>
                  </select>
                </label>

                <label>
                  Due Date
                  <input
                    name="due_date"
                    type="date"
                    value={editForm.due_date}
                    onChange={handleEditChange}
                  />
                </label>

                <label>
                  Estimated Value
                  <input
                    name="estimated_value"
                    type="number"
                    value={editForm.estimated_value}
                    onChange={handleEditChange}
                  />
                </label>
              </div>

              <label>
                Description
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                />
              </label>

              <div className="form-preview-total">
                Estimated Value Preview: {money(editForm.estimated_value)}
              </div>

              <div className="form-actions">
                <button type="submit">Save Changes</button>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <form
              className="payment-form"
              onSubmit={handleAddTender}
            >
              <div className="form-grid">
                <label>
                  Site
                  <select name="site_id" defaultValue="">
                    <option value="">Select Site</option>
                    {sites?.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.site_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Tender Title
                  <input name="title" required />
                </label>

                <label>
                  Status
                  <select name="status" defaultValue="running" required>
                    <option value="running">Running</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="passed">Passed</option>
                  </select>
                </label>

                <label>
                  Due Date
                  <input name="due_date" type="date" />
                </label>

                <label>
                  Estimated Value
                  <input name="estimated_value" type="number" />
                </label>
              </div>

              <label>
                Description
                <textarea name="description" />
              </label>

              <button type="submit">Add Tender</button>
            </form>
          )}
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Tender Filters</h2>
              <p className="muted-text">
                Filter by status and search title, site, value or due date.
              </p>
            </div>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={activeTab === "running" ? "active-tab" : ""}
              onClick={() => setActiveTab("running")}
            >
              Running
            </button>

            <button
              type="button"
              className={activeTab === "pending" ? "active-tab" : ""}
              onClick={() => setActiveTab("pending")}
            >
              Pending
            </button>

            <button
              type="button"
              className={activeTab === "completed" ? "active-tab" : ""}
              onClick={() => setActiveTab("completed")}
            >
              Completed
            </button>

            <button
              type="button"
              className={activeTab === "passed" ? "active-tab" : ""}
              onClick={() => setActiveTab("passed")}
            >
              Passed
            </button>

            <button
              type="button"
              className={activeTab === "due soon" ? "active-tab" : ""}
              onClick={() => setActiveTab("due soon")}
            >
              Due Soon
            </button>
          </div>

          <input
            className="search-input"
            type="text"
            placeholder="Search tenders..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <table>
            <tbody>
              <tr>
                <td>Current Filter</td>
                <td>{activeTab}</td>
              </tr>

              <tr>
                <td>Matching Tenders</td>
                <td className="number-cell">{filteredTenders.length}</td>
              </tr>

              <tr>
                <td>Matching Value</td>
                <td className="amount-cell">{money(filteredTenderValue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Tenders Register</h2>
            <p className="muted-text">
              Open a tender to manage finance, documents, materials, workers and
              subcontractors.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Tender</th>
                <th>Site</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Estimated Value</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredTenders.map((tender) => (
                <tr key={tender.id}>
                  <td>{tender.title || tender.tender_name || "-"}</td>
                  <td>{tender.site_name || getSiteName(tender.site_id)}</td>
                  <td>
                    <span
                      className={
                        tender.status === "running"
                          ? "badge green"
                          : tender.status === "pending"
                          ? "badge yellow"
                          : "badge blue"
                      }
                    >
                      {tender.status || "-"}
                    </span>
                  </td>
                  <td>{dateOnly(tender.due_date)}</td>
                  <td className="amount-cell">
                    {money(tender.estimated_value)}
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() => navigate(`/tenders/${tender.id}`)}
                    >
                      Open
                    </button>

                    <button type="button" onClick={() => startEdit(tender)}>
                      Edit
                    </button>

                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => setDeleteTarget(tender)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {filteredTenders.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-table-message">
                    No tenders found.
                  </td>
                </tr>
              )}
            </tbody>

            {filteredTenders.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="4">
                    <strong>Total</strong>
                  </td>
                  <td className="amount-cell">
                    <strong>{money(filteredTenderValue)}</strong>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <DeleteVerificationModal
        open={!!deleteTarget}
        itemName={deleteTarget?.title || deleteTarget?.tender_name || "tender"}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export default TendersPage;