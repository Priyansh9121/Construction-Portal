function DailySiteUpdatesPage({
  sites,
  workers,
  siteLogs,
  addSiteLog,
}) {
  return (
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

          <select name="worker_id" required>
            <option value="">Select Worker</option>

            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.full_name}
              </option>
            ))}
          </select>

          <input name="log_date" type="date" required />

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

        <table>
          <thead>
            <tr>
              <th>Site</th>
              <th>Worker</th>
              <th>Date</th>
              <th>Notes</th>
              <th>Photo</th>
            </tr>
          </thead>

          <tbody>
            {siteLogs.map((log) => (
              <tr key={log.id}>
                <td>{log.site_name}</td>
                <td>{log.worker_name}</td>
                <td>{log.log_date?.slice(0, 10)}</td>
                <td>{log.notes}</td>

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
              </tr>
            ))}

            {siteLogs.length === 0 && (
              <tr>
                <td colSpan="5" className="empty-table-message">
                  No daily updates found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default DailySiteUpdatesPage;