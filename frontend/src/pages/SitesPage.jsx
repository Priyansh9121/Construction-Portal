import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DeleteVerificationModal from "../components/DeleteVerificationModal";
import { updateSite } from "../services/siteService";
import ExportButtons from "../components/export/ExportButtons";

function SitesPage({ sites = [], addSite, deleteSite, fetchSites }) {
  const navigate = useNavigate();

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingSite, setEditingSite] = useState(null);
  const [activeTab, setActiveTab] = useState("Personal Site");
  const [searchTerm, setSearchTerm] = useState("");

  const emptyForm = {
    site_type: "",
    site_name: "",
    address: "",
    status: "active",
  };

  const [editForm, setEditForm] = useState(emptyForm);

  const personalSites = sites.filter((site) => site.site_type === "Personal Site");
  const subcontractorSites = sites.filter(
    (site) => site.site_type === "Subcontractor Site"
  );
  const activeSites = sites.filter((site) => site.status === "active");
  const inactiveSites = sites.filter((site) => site.status === "inactive");

  const filteredSites = sites.filter((site) => {
    const search = searchTerm.toLowerCase();
    const matchesTab = site.site_type === activeTab;

    const matchesSearch =
      site.site_name?.toLowerCase().includes(search) ||
      site.address?.toLowerCase().includes(search) ||
      site.status?.toLowerCase().includes(search) ||
      site.site_type?.toLowerCase().includes(search);

    return matchesTab && matchesSearch;
  });

  const siteExportColumns = [
    { key: "site_name", label: "Site Name" },
    { key: "site_type", label: "Type" },
    { key: "address", label: "Address" },
    { key: "status", label: "Status" },
  ];

  const siteExportRows = filteredSites.map((site) => ({
    site_name: site.site_name || "",
    site_type: site.site_type || "",
    address: site.address || "",
    status: site.status || "",
  }));

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
    setEditForm(emptyForm);
  };

  const handleEditChange = (event) => {
    setEditForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const handleUpdateSite = async (event) => {
    event.preventDefault();

    if (!editingSite) return;

    await updateSite(editingSite.id, editForm);
    await fetchSites();
    cancelEdit();
  };

  return (
    <>
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Sites Management</h2>
            <p className="muted-text">
              Manage personal and subcontractor sites, status, addresses and linked tenders.
            </p>
          </div>

          <ExportButtons
            filename="sites"
            title="Sites Report"
            subtitle="Construction Portal sites register"
            rows={siteExportRows}
            columns={siteExportColumns}
          />
        </div>
      </section>

      <section className="summary-cards">
        <div className="card">
          <p>Total Sites</p>
          <h2>{sites.length}</h2>
        </div>

        <div className="card highlight-success">
          <p>Active Sites</p>
          <h2>{activeSites.length}</h2>
        </div>

        <div className="card highlight-warning">
          <p>Inactive Sites</p>
          <h2>{inactiveSites.length}</h2>
        </div>

        <div className="card">
          <p>Personal Sites</p>
          <h2>{personalSites.length}</h2>
        </div>

        <div className="card">
          <p>Subcontractor Sites</p>
          <h2>{subcontractorSites.length}</h2>
        </div>

        <div className="card">
          <p>Filtered Sites</p>
          <h2>{filteredSites.length}</h2>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>{editingSite ? "Edit Site" : "Add Site"}</h2>
              <p className="muted-text">
                {editingSite
                  ? "Update site type, name, address and status."
                  : "Create a new construction site record."}
              </p>
            </div>
          </div>

          {editingSite ? (
            <form className="payment-form" onSubmit={handleUpdateSite}>
              <div className="form-grid">
                <label>
                  Site Type
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
                </label>

                <label>
                  Site Name
                  <input
                    name="site_name"
                    value={editForm.site_name}
                    onChange={handleEditChange}
                    required
                  />
                </label>

                <label>
                  Address
                  <input
                    name="address"
                    value={editForm.address}
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
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
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
            <form className="payment-form" onSubmit={addSite}>
              <div className="form-grid">
                <label>
                  Site Type
                  <select name="site_type" defaultValue="" required>
                    <option value="">Select Site Type</option>
                    <option value="Personal Site">Personal Site</option>
                    <option value="Subcontractor Site">Subcontractor Site</option>
                  </select>
                </label>

                <label>
                  Site Name
                  <input name="site_name" required />
                </label>

                <label>
                  Address
                  <input name="address" required />
                </label>

                <label>
                  Status
                  <select name="status" defaultValue="active" required>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <button type="submit">Add Site</button>
            </form>
          )}
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Site Filters</h2>
              <p className="muted-text">
                Switch site type and search by name, address or status.
              </p>
            </div>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={activeTab === "Personal Site" ? "active-tab" : ""}
              onClick={() => setActiveTab("Personal Site")}
            >
              Personal Sites
            </button>

            <button
              type="button"
              className={
                activeTab === "Subcontractor Site" ? "active-tab" : ""
              }
              onClick={() => setActiveTab("Subcontractor Site")}
            >
              Subcontractor Sites
            </button>
          </div>

          <input
            className="search-input"
            type="text"
            placeholder="Search sites..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <table>
            <tbody>
              <tr>
                <td>Current Type</td>
                <td>{activeTab}</td>
              </tr>

              <tr>
                <td>Matching Sites</td>
                <td className="number-cell">{filteredSites.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Sites Register</h2>
            <p className="muted-text">
              Open a site to manage tenders, finance and site-level details.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Site Name</th>
                <th>Type</th>
                <th>Address</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredSites.map((site) => (
                <tr key={site.id}>
                  <td>{site.site_name || "-"}</td>
                  <td>{site.site_type || "-"}</td>
                  <td>{site.address || "-"}</td>
                  <td>
                    <span
                      className={
                        site.status === "active" ? "badge green" : "badge yellow"
                      }
                    >
                      {site.status || "-"}
                    </span>
                  </td>

                  <td>
                    <button type="button" onClick={() => navigate(`/sites/${site.id}`)}>
                      Open
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
                  <td colSpan="5" className="empty-table-message">
                    No sites found.
                  </td>
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