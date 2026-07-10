function TenderDailyProgressTab({ dailyUpdates = [] }) {
  const dateOnly = (value) => (value ? String(value).slice(0, 10) : "");

  const updatesWithPhotos = dailyUpdates.filter((log) => log.photo_url).length;

  const uniqueWorkers = new Set(
    dailyUpdates.map((log) => log.worker_name).filter(Boolean)
  ).size;

  const latestUpdates = [...dailyUpdates].sort(
    (a, b) =>
      new Date(b.log_date || b.created_at || 0) -
      new Date(a.log_date || a.created_at || 0)
  );

  return (
    <>
      <section className="summary-cards">
        <div className="card">
          <p>Total Updates</p>
          <h2>{dailyUpdates.length}</h2>
        </div>

        <div className="card">
          <p>Workers Reported</p>
          <h2>{uniqueWorkers}</h2>
        </div>

        <div className="card">
          <p>Photo Updates</p>
          <h2>{updatesWithPhotos}</h2>
        </div>

        <div className="card">
          <p>Text Only Updates</p>
          <h2>{dailyUpdates.length - updatesWithPhotos}</h2>
        </div>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Daily Progress Timeline</h2>
            <p className="muted-text">
              Latest site progress notes and photos submitted for this tender.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Worker</th>
                <th>Notes</th>
                <th>Photo</th>
              </tr>
            </thead>

            <tbody>
              {latestUpdates.map((log) => (
                <tr key={log.id}>
                  <td>{dateOnly(log.log_date || log.created_at)}</td>
                  <td>{log.worker_name || "N/A"}</td>
                  <td>{log.notes || "-"}</td>
                  <td>
                    {log.photo_url ? (
                      <a href={log.photo_url} target="_blank" rel="noreferrer">
                        Open Photo
                      </a>
                    ) : (
                      "No photo"
                    )}
                  </td>
                </tr>
              ))}

              {latestUpdates.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty-table-message">
                    No daily progress updates yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Progress Photo Gallery</h2>
            <p className="muted-text">
              Uploaded progress photos for quick visual review.
            </p>
          </div>
        </div>

        <div className="dashboard-grid two-column-dashboard">
          {latestUpdates
            .filter((log) => log.photo_url)
            .slice(0, 8)
            .map((log) => (
              <div className="card" key={`photo-${log.id}`}>
                <p>
                  {dateOnly(log.log_date || log.created_at)} •{" "}
                  {log.worker_name || "Worker"}
                </p>

                <img
                  src={log.photo_url}
                  alt={log.notes || "Progress"}
                  style={{
                    width: "100%",
                    maxHeight: 220,
                    objectFit: "cover",
                    borderRadius: 12,
                    marginTop: 10,
                  }}
                />

                <p className="muted-text" style={{ marginTop: 10 }}>
                  {log.notes || "No notes provided."}
                </p>
              </div>
            ))}

          {updatesWithPhotos === 0 && (
            <div className="empty-table-message">
              No progress photos uploaded yet.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default TenderDailyProgressTab;