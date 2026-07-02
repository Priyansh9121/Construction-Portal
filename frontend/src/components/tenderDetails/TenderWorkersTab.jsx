function TenderWorkersTab({
    workers,
    assignedWorkers,
    workerForm,
    setWorkerForm,
    handleAssignWorker,
    setDeleteTarget,
  }) {
    return (
      <div className="payment-grid">
        <div className="panel">
          <h2>Assign Worker to Tender</h2>
  
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
  
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.full_name} - {worker.role}
                </option>
              ))}
            </select>
  
            <input
              placeholder="Notes"
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
          <h2>Assigned Workers</h2>
  
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
                    <td>{item.full_name}</td>
                    <td>{item.phone}</td>
                    <td>{item.role}</td>
                    <td>{item.notes}</td>
                    <td>{item.status}</td>
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
        </div>
      </div>
    );
  }
  
  export default TenderWorkersTab;