function TenderDailyProgressTab({ dailyUpdates }) {
    return (
      <div className="panel">
        <h2>Daily Progress</h2>
  
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
              {dailyUpdates.map((log) => (
                <tr key={log.id}>
                  <td>{log.log_date?.slice(0, 10)}</td>
                  <td>{log.worker_name || "N/A"}</td>
                  <td>{log.notes}</td>
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
  
              {dailyUpdates.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty-table-message">
                    No daily progress updates yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  
  export default TenderDailyProgressTab;