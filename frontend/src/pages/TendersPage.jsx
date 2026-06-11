import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DeleteVerificationModal from "../components/DeleteVerificationModal";
import { updateTender } from "../services/tenderService";

function TendersPage({ tenders, sites, addTender, deleteTender }) {
  const navigate = useNavigate();

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingTender, setEditingTender] = useState(null);
  const [activeTab, setActiveTab] = useState("running");
  const [searchTerm, setSearchTerm] = useState("");

  const [editForm, setEditForm] = useState({
    title: "",
    status: "running",
    due_date: "",
    description: "",
    site_id: "",
  });

  const getSiteName = (siteId) => {
    const site = sites?.find((s) => Number(s.id) === Number(siteId));
    return site ? site.site_name : "N/A";
  };

  const filteredTenders = tenders.filter((tender) => {
    const search = searchTerm.toLowerCase();
    const matchesTab = tender.status === activeTab;
    const siteName = getSiteName(tender.site_id).toLowerCase();

    const matchesSearch =
      tender.title?.toLowerCase().includes(search) ||
      tender.status?.toLowerCase().includes(search) ||
      tender.description?.toLowerCase().includes(search) ||
      tender.due_date?.toLowerCase().includes(search) ||
      siteName.includes(search);

    return matchesTab && matchesSearch;
  });

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    await deleteTender(deleteTarget.id);
    setDeleteTarget(null);
  };

  const startEdit = (tender) => {
    setEditingTender(tender);

    setEditForm({
      title: tender.title || "",
      status: tender.status || "running",
      due_date: tender.due_date ? tender.due_date.slice(0, 10) : "",
      description: tender.description || "",
      site_id: tender.site_id || "",
    });
  };

  const cancelEdit = () => {
    setEditingTender(null);

    setEditForm({
      title: "",
      status: "running",
      due_date: "",
      description: "",
      site_id: "",
    });
  };

  const handleEditChange = (e) => {
    setEditForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleUpdateTender = async (e) => {
    e.preventDefault();

    if (!editingTender) return;

    await updateTender(editingTender.id, {
      ...editForm,
      site_id: editForm.site_id ? Number(editForm.site_id) : null,
    });

    window.location.reload();
  };

  return (
    <>
      <section className="payment-grid">
        <div className="panel">
          <h2>{editingTender ? "Edit Tender" : "Add Tender"}</h2>

          {editingTender ? (
            <form className="payment-form" onSubmit={handleUpdateTender}>
              <select
                name="site_id"
                value={editForm.site_id}
                onChange={handleEditChange}
              >
                <option value="">Select Site</option>
                {sites?.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.site_name} - {site.site_type}
                  </option>
                ))}
              </select>

              <input
                name="title"
                placeholder="Tender Title"
                value={editForm.title}
                onChange={handleEditChange}
                required
              />

              <select
                name="status"
                value={editForm.status}
                onChange={handleEditChange}
                required
              >
                <option value="running">Running</option>
                <option value="passed">Passed</option>
                <option value="due soon">Due Soon</option>
              </select>

              <input
                name="due_date"
                type="date"
                value={editForm.due_date}
                onChange={handleEditChange}
                required
              />

              <textarea
                name="description"
                placeholder="Tender Description"
                value={editForm.description}
                onChange={handleEditChange}
              ></textarea>

              <button type="submit">Save Changes</button>

              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>
            </form>
          ) : (
            <form className="payment-form" onSubmit={addTender}>
              <select name="site_id" defaultValue="">
                <option value="">Select Site</option>
                {sites?.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.site_name} - {site.site_type}
                  </option>
                ))}
              </select>

              <input name="title" placeholder="Tender Title" required />

              <select name="status" defaultValue="running" required>
                <option value="running">Running</option>
                <option value="passed">Passed</option>
                <option value="due soon">Due Soon</option>
              </select>

              <input name="due_date" type="date" required />

              <textarea
                name="description"
                placeholder="Tender Description"
              ></textarea>

              <button type="submit">Add Tender</button>
            </form>
          )}
        </div>

        <div className="panel">
          <h2>Tenders List</h2>

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
            placeholder="Search tenders by title, site, status, due date or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Site</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Description</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredTenders.map((tender) => (
                <tr key={tender.id}>
                  <td>{tender.title}</td>

                  <td>{getSiteName(tender.site_id)}</td>

                  <td>{tender.status}</td>

                  <td>
                    {tender.due_date ? tender.due_date.slice(0, 10) : ""}
                  </td>

                  <td>{tender.description}</td>

                  <td
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/tenders/${tender.id}`)}
                      style={{
                        background: "#111827",
                        color: "#fff",
                        border: "none",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      Open Tender
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
                  <td colSpan="6">No tenders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DeleteVerificationModal
        open={!!deleteTarget}
        itemName={deleteTarget?.title || "tender"}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export default TendersPage;