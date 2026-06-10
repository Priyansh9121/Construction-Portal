import { useState } from "react";
import DeleteVerificationModal from "../components/DeleteVerificationModal";

function SitesPage({ sites, addSite, deleteSite }) {
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    await deleteSite(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <>
      <section className="payment-grid">
        <div className="panel">
          <h2>Add Site</h2>

          <form className="payment-form" onSubmit={addSite}>
            <select name="site_type" required>
              <option value="">Select Site Type</option>
              <option value="Personal Site">Personal Site</option>
              <option value="Subcontractor Site">
                Subcontractor Site
              </option>
            </select>

            <input
              name="site_name"
              placeholder="Site Name"
              required
            />

            <input
              name="address"
              placeholder="Address"
              required
            />

            <select name="status" required>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
            </select>

            <button type="submit">Add Site</button>
          </form>
        </div>

        <div className="panel">
          <h2>Sites List</h2>

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
              {sites.map((site) => (
                <tr key={site.id}>
                  <td>{site.site_type}</td>
                  <td>{site.site_name}</td>
                  <td>{site.address}</td>
                  <td>{site.status}</td>

                  <td>
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

              {sites.length === 0 && (
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