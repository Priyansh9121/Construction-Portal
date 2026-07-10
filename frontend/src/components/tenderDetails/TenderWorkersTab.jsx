function TenderWorkersTab({
  workers = [],
  assignedWorkers = [],
  workerForm,
  setWorkerForm,
  handleAssignWorker,
  setDeleteTarget,
}) {
  const activeWorkers = assignedWorkers.filter(
    (item) => item.status === "active"
  ).length;

  const completedWorkers = assignedWorkers.filter(
    (item) => item.status === "completed"
  ).length;

  const pausedWorkers = assignedWorkers.filter(
    (item) => item.status === "paused"
  ).length;

  const availableWorkers = workers.filter(
    (worker) =>
      !assignedWorkers.some(
        (assigned) => Number(assigned.worker_id) === Number(worker.id)
      )
  );

  return (
    <>
      <section className="summary-cards">
        <div className="card">
          <p>Assigned Workers</p>
          <h2>{assignedWorkers.length}</h2>
        </div>

        <div className="card highlight-success">
          <p>Active</p>
          <h2>{activeWorkers}</h2>
        </div>

        <div className="card">
          <p>Completed</p>
          <h2>{completedWorkers}</h2>
        </div>

        <div className="card highlight-warning">
          <p>Paused</p>
          <h2>{pausedWorkers}</h2>
        </div>

        <div className="card">
          <p>Available Workers</p>
          <h2>{availableWorkers.length}</h2>
        </div>
      </section>

      <div className="payment-grid">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Assign Worker to Tender</h2>
              <p className="muted-text">
                Allocate workers to this tender and track assignment status.
              </p>
            </div>
          </div>

          <form className="payment-form" onSubmit={handleAssignWorker}>
            <select
              value={workerForm.worker_id}
              onChange={(e) =>
                setWorkerForm({
                  ...workerForm,
                  worker_id: e.target.value,
                })
              }
              required
            >
              <option value="">Select Worker</option>

              {availableWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.full_name} - {worker.role || "Worker"}
                </option>
              ))}
            </select>

            <textarea
              placeholder="Assignment notes / work responsibility"
              value={workerForm.notes}
              onChange={(e) =>
                setWorkerForm({
                  ...workerForm,
                  notes: e.target.value,
                })
              }
            />

            <select
              value={workerForm.status}
              onChange={(e) =>
                setWorkerForm({
                  ...workerForm,
                  status: e.target.value,
                })
              }
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
            </select>

            <button type="submit">Assign Worker</button>
          </form>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Worker Status Summary</h2>
              <p className="muted-text">
                Current labour allocation status for this tender.
              </p>
            </div>
          </div>

          <table>
            <tbody>
              <tr>
                <td>Total Assigned</td>
                <td className="number-cell">{assignedWorkers.length}</td>
              </tr>

              <tr>
                <td>Active Workers</td>
                <td className="number-cell">{activeWorkers}</td>
              </tr>

              <tr>
                <td>Completed Workers</td>
                <td className="number-cell">{completedWorkers}</td>
              </tr>

              <tr>
                <td>Paused Workers</td>
                <td className="number-cell">{pausedWorkers}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Assigned Workers Register</h2>
            <p className="muted-text">
              Workers currently linked to this tender.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Notes</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {assignedWorkers.map((item) => (
                <tr key={item.id}>
                  <td>{item.full_name || "-"}</td>
                  <td>{item.phone || "-"}</td>
                  <td>{item.role || "-"}</td>
                  <td>{item.notes || "-"}</td>
                  <td>
                    <span
                      className={
                        item.status === "active"
                          ? "badge green"
                          : item.status === "paused"
                          ? "badge yellow"
                          : "badge blue"
                      }
                    >
                      {item.status || "-"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() =>
                        setDeleteTarget({
                          type: "worker",
                          item,
                        })
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}

              {assignedWorkers.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-table-message">
                    No workers assigned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default TenderWorkersTab;