import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DeleteVerificationModal from "../components/DeleteVerificationModal";
import { updateSite } from "../services/siteService";

function SitesPage({ sites, addSite, deleteSite }) {
  const navigate = useNavigate();

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingSite, setEditingSite] = useState(null);
  const [activeTab, setActiveTab] = useState("Personal Site");
  const [searchTerm, setSearchTerm] = useState("");

  const [editForm, setEditForm] = useState({
    site_type: "",
    site_name: "",
    address: "",
    status: "active",
  });

  const filteredSites = sites.filter((site) => {
    const matchesTab = site.site_type === activeTab;
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      site.site_name?.toLowerCase().includes(search) ||
      site.address?.toLowerCase().includes(search) ||
      site.status?.toLowerCase().includes(search) ||
      site.site_type?.toLowerCase().includes(search);

    return matchesTab && matchesSearch;
  });

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    await deleteSite(deleteTarget.id);
    setDeleteTarget(null);
  };

  const startEdit = (site) => {
    setEditingSite(site);

    setEditForm({
      site_type: site.site_type || "",
      site_name: site.site_name || "",
      address: site.address || "",
      status: site.status || "active",
    });
  };

  const cancelEdit = () => {
    setEditingSite(null);

    setEditForm({
      site_type: "",
      site_name: "",
      address: "",
      status: "active",
    });
  };

  const handleEditChange = (e) => {
    setEditForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleUpdateSite = async (e) => {
    e.preventDefault();

    if (!editingSite) return;

    await updateSite(editingSite.id, editForm);

    window.location.reload();
  };

  return (
    <>
      <section className="payment-grid">
        <div className="panel">
          <h2>{editingSite ? "Edit Site" : "Add Site"}</h2>

          {editingSite ? (
            <form className="payment-form" onSubmit={handleUpdateSite}>
              <select
                name="site_type"
                value={editForm.site_type}
                onChange={handleEditChange}
                required
              >
                <option value="">Select Site Type</option>
                <option value="Personal Site">Personal Site</option>
                <option value="Subcontractor Site">Subcontractor Site</option>
              </select>

              <input
                name="site_name"
                placeholder="Site Name"
                value={editForm.site_name}
                onChange={handleEditChange}
                required
              />

              <input
                name="address"
                placeholder="Address"
                value={editForm.address}
                onChange={handleEditChange}
                required
              />

              <select
                name="status"
                value={editForm.status}
                onChange={handleEditChange}
                required
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>

              <button type="submit">Save Changes</button>

              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>
            </form>
          ) : (
            <form className="payment-form" onSubmit={addSite}>
              <select name="site_type" defaultValue={activeTab} required>
                <option value="">Select Site Type</option>
                <option value="Personal Site">Personal Site</option>
                <option value="Subcontractor Site">Subcontractor Site</option>
              </select>

              <input name="site_name" placeholder="Site Name" required />

              <input name="address" placeholder="Address" required />

              <select name="status" defaultValue="active" required>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>

              <button type="submit">Add Site</button>
            </form>
          )}
        </div>

        <div className="panel">
          <h2>Sites List</h2>

          <div className="tabs">
            <button
              type="button"
              className={activeTab === "Personal Site" ? "active-tab" : ""}
              onClick={() => setActiveTab("Personal Site")}
            >
              Personal
            </button>

            <button
              type="button"
              className={
                activeTab === "Subcontractor Site" ? "active-tab" : ""
              }
              onClick={() => setActiveTab("Subcontractor Site")}
            >
              Subcontractor
            </button>
          </div>

          <input
            className="search-input"
            type="text"
            placeholder="Search sites by name, address, status or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Site Name</th>
                <th>Address</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredSites.map((site) => (
                <tr key={site.id}>
                  <td>{site.site_type}</td>
                  <td>{site.site_name}</td>
                  <td>{site.address}</td>
                  <td>{site.status}</td>

                  <td
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/sites/${site.id}`)}
                    >
                      Open Site
                    </button>

                    <button type="button" onClick={() => startEdit(site)}>
                      Edit
                    </button>

                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => setDeleteTarget(site)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {filteredSites.length === 0 && (
                <tr>
                  <td colSpan="5">No sites added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DeleteVerificationModal
        open={!!deleteTarget}
        itemName={deleteTarget?.site_name || "site"}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export default SitesPage;