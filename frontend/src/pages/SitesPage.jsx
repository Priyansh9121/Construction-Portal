import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import DeleteVerificationModal from "../components/DeleteVerificationModal";
import ExportButtons from "../components/export/ExportButtons";

import { useAuth } from "../contexts/AuthContext";
import useSites from "../hooks/useSites";

import { updateSite } from "../services/siteService";

const EMPTY_EDIT_FORM = {
  site_type: "",
  site_name: "",
  address: "",
  status: "active",
};

function SitesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    sites = [],
    addSite,
    removeSite,
    fetchSites,
  } = useSites(user);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingSite, setEditingSite] = useState(null);
  const [activeTab, setActiveTab] = useState("Personal Site");
  const [searchTerm, setSearchTerm] = useState("");
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const personalSites = useMemo(
    () =>
      sites.filter(
        (site) => site.site_type === "Personal Site"
      ),
    [sites]
  );

  const subcontractorSites = useMemo(
    () =>
      sites.filter(
        (site) => site.site_type === "Subcontractor Site"
      ),
    [sites]
  );

  const activeSites = useMemo(
    () =>
      sites.filter(
        (site) =>
          String(site.status || "").toLowerCase() === "active"
      ),
    [sites]
  );

  const inactiveSites = useMemo(
    () =>
      sites.filter(
        (site) =>
          String(site.status || "").toLowerCase() === "inactive"
      ),
    [sites]
  );

  const filteredSites = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return sites.filter((site) => {
      const matchesTab = site.site_type === activeTab;

      const searchableText = [
        site.site_name,
        site.address,
        site.status,
        site.site_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search || searchableText.includes(search);

      return matchesTab && matchesSearch;
    });
  }, [sites, activeTab, searchTerm]);

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

  const siteExportSummary = {
    "Total Sites": sites.length,
    "Active Sites": activeSites.length,
    "Inactive Sites": inactiveSites.length,
    "Personal Sites": personalSites.length,
    "Subcontractor Sites": subcontractorSites.length,
    "Filtered Sites": filteredSites.length,
  };

  const handleAddSite = async (event) => {
    event.preventDefault();

    if (adding) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    const newSite = {
      company_id: user?.company_id || null,
      site_type: String(formData.get("site_type") || "").trim(),
      site_name: String(formData.get("site_name") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      status: String(formData.get("status") || "active"),
    };

    try {
      setAdding(true);
      setMessage("");

      await addSite(newSite);

      form.reset();
      toast.success(
        "Site added successfully."
      );
    } catch (error) {
      console.error(
        "Failed to add site:",
        error.response?.data || error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to add site."
      );
    } finally {
      setAdding(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;

    try {
      setDeleting(true);
      setMessage("");

      await removeSite(deleteTarget.id);

      if (editingSite?.id === deleteTarget.id) {
        cancelEdit();
      }

      setDeleteTarget(null);
      toast.success(
        "Site deleted successfully."
      );
    } catch (error) {
      console.error(
        "Failed to delete site:",
        error.response?.data || error
      );

      setMessage(
        error.response?.data?.message ||
          "Failed to delete site."
      );
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (site) => {
    setEditingSite(site);
    setMessage("");

    setEditForm({
      site_type: site.site_type || "",
      site_name: site.site_name || "",
      address: site.address || "",
      status: site.status || "active",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const cancelEdit = () => {
    setEditingSite(null);
    setEditForm(EMPTY_EDIT_FORM);
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;

    setEditForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));
  };

  const handleUpdateSite = async (event) => {
    event.preventDefault();

    if (!editingSite || updating) return;

    const updatePayload = {
      company_id:
        editingSite.company_id ||
        user?.company_id ||
        null,
      site_type: editForm.site_type.trim(),
      site_name: editForm.site_name.trim(),
      address: editForm.address.trim(),
      status: editForm.status,
    };

    try {
      setUpdating(true);
      setMessage("");

      await updateSite(editingSite.id, updatePayload);
      await fetchSites();

      cancelEdit();
      toast.success(
        "Site updated successfully."
      );
    } catch (error) {
      console.error(
        "Failed to update site:",
        error.response?.data || error
      );

      setMessage(
        error.response?.data?.message ||
          "Failed to update site."
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Sites Management</h2>

            <p className="muted-text">
              Manage personal and subcontractor sites,
              statuses, addresses and linked tenders.
            </p>
          </div>

          <ExportButtons
            filename="sites"
            title="Sites Report"
            subtitle="Construction Portal sites register"
            rows={siteExportRows}
            columns={siteExportColumns}
            summary={siteExportSummary}
          />
        </div>

        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
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
              <h2>
                {editingSite ? "Edit Site" : "Add Site"}
              </h2>

              <p className="muted-text">
                {editingSite
                  ? "Update the site type, name, address and status."
                  : "Create a new construction site record."}
              </p>
            </div>
          </div>

          {editingSite ? (
            <form
              className="payment-form"
              onSubmit={handleUpdateSite}
            >
              <div className="form-grid">
                <label>
                  Site Type
                  <select
                    name="site_type"
                    value={editForm.site_type}
                    onChange={handleEditChange}
                    required
                  >
                    <option value="">
                      Select Site Type
                    </option>

                    <option value="Personal Site">
                      Personal Site
                    </option>

                    <option value="Subcontractor Site">
                      Subcontractor Site
                    </option>
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
                    <option value="active">
                      Active
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>
                  </select>
                </label>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={updating}
                >
                  {updating
                    ? "Saving..."
                    : "Save Changes"}
                </button>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={cancelEdit}
                  disabled={updating}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <form
              className="payment-form"
              onSubmit={handleAddSite}
            >
              <div className="form-grid">
                <label>
                  Site Type
                  <select
                    name="site_type"
                    defaultValue=""
                    required
                  >
                    <option value="">
                      Select Site Type
                    </option>

                    <option value="Personal Site">
                      Personal Site
                    </option>

                    <option value="Subcontractor Site">
                      Subcontractor Site
                    </option>
                  </select>
                </label>

                <label>
                  Site Name
                  <input
                    name="site_name"
                    required
                  />
                </label>

                <label>
                  Address
                  <input
                    name="address"
                    required
                  />
                </label>

                <label>
                  Status
                  <select
                    name="status"
                    defaultValue="active"
                    required
                  >
                    <option value="active">
                      Active
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>
                  </select>
                </label>
              </div>

              <button
                type="submit"
                disabled={adding}
              >
                {adding ? "Adding..." : "Add Site"}
              </button>
            </form>
          )}
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Site Filters</h2>

              <p className="muted-text">
                Switch site type and search by name,
                address or status.
              </p>
            </div>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={
                activeTab === "Personal Site"
                  ? "active-tab"
                  : ""
              }
              onClick={() =>
                setActiveTab("Personal Site")
              }
            >
              Personal Sites
            </button>

            <button
              type="button"
              className={
                activeTab === "Subcontractor Site"
                  ? "active-tab"
                  : ""
              }
              onClick={() =>
                setActiveTab("Subcontractor Site")
              }
            >
              Subcontractor Sites
            </button>
          </div>

          <input
            className="search-input"
            type="search"
            placeholder="Search sites..."
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
          />

          <table>
            <tbody>
              <tr>
                <td>Current Type</td>
                <td>{activeTab}</td>
              </tr>

              <tr>
                <td>Matching Sites</td>
                <td className="number-cell">
                  {filteredSites.length}
                </td>
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
              Open a site to manage tenders, finance and
              site-level details.
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
                        String(
                          site.status || ""
                        ).toLowerCase() === "active"
                          ? "badge green"
                          : "badge yellow"
                      }
                    >
                      {site.status || "-"}
                    </span>
                  </td>

                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/sites/${site.id}`)
                        }
                      >
                        Open
                      </button>

                      <button
                        type="button"
                        onClick={() => startEdit(site)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() =>
                          setDeleteTarget(site)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredSites.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="empty-table-message"
                  >
                    No sites found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DeleteVerificationModal
        open={Boolean(deleteTarget)}
        itemName={
          deleteTarget?.site_name ||
          "site"
        }
        onCancel={() => {
          if (!deleting) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={
          handleConfirmDelete
        }
        loading={deleting}
      />
    </>
  );
}

export default SitesPage;