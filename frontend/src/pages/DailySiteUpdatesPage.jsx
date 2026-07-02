import { useState } from "react";
import DeleteVerificationModal from "../components/DeleteVerificationModal";
import { createTender } from "../services/tenderService";

function DailySiteUpdatesPage({
  sites,
  tenders,
  workers,
  siteLogs,
  addSiteLog,
  deleteSiteLog,
}) {
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (!deleteSiteLog) {
      alert("Delete function is missing.");
      return;
    }

    await deleteSiteLog(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <>
      <section className="payment-grid">
        <div className="panel">
          <h2>Add Daily Site Update</h2>

          <form className="payment-form" onSubmit={addSiteLog}>
            <select name="site_id" required>
              <option value="">Select Site</option>

              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.site_name}
                </option>
              ))}
            </select>

            <select name="tender_id">
              <option value="">Select Tender</option>

              {tenders.map((tender) => (
                <option key={tender.id} value={tender.id}>
                  {tender.title}
                </option>
              ))}
            </select>

            <select name="worker_id" required>
              <option value="">Select Worker</option>

              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.full_name}
                </option>
              ))}
            </select>

            <input name="log_date" type="date" required />
            <small style={{ color: "#64748b" }}>
              Normal users can only add updates/photos for the last 3 days.
              Older entries require admin permission.
            </small>

            <textarea
              name="notes"
              placeholder="Daily work notes"
            ></textarea>

            <label>Take Site Photo</label>

            <input
              name="camera_photo"
              type="file"
              accept="image/*"
              capture="environment"
            />

            <label>Upload Existing Photo</label>

            <input
              name="gallery_photo"
              type="file"
              accept="image/*"
            />

            <button type="submit">Add Update</button>
          </form>
        </div>

        <div className="panel">
          <h2>Latest Site Updates</h2>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Tender</th>
                  <th>Worker</th>
                  <th>Date</th>
                  <th>Notes</th>
                  <th>Photo</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {siteLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.site_name || "-"}</td>
                    <td>{log.tender_title || log.tender_name || "-"}</td>
                    <td>{log.worker_name || "-"}</td>
                    <td>{log.log_date?.slice(0, 10)}</td>
                    <td>{log.notes || "-"}</td>

                    <td>
                      {log.photo_url ? (
                        <a
                          href={log.photo_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View Photo
                        </a>
                      ) : (
                        "No photo"
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => setDeleteTarget(log)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}

                {siteLogs.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-table-message">
                      No daily updates found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <DeleteVerificationModal
        open={!!deleteTarget}
        itemName={
          deleteTarget?.site_name ||
          deleteTarget?.worker_name ||
          "daily update"
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export default DailySiteUpdatesPage;