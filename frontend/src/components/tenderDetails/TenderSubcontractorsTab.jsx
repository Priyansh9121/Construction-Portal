function TenderSubcontractorsTab({
    subcontractors,
    subcontractorAssignedTotal,
    editingAssignedSub,
    subcontractorForm,
    setSubcontractorForm,
    allSubcontractors,
    handleAssignSubcontractor,
    startEditAssignedSubcontractor,
    setEditingAssignedSub,
    setDeleteTarget,
  }) {
    const resetSubcontractorForm = () => {
      setEditingAssignedSub(null);
  
      setSubcontractorForm({
        subcontractor_id: "",
        work_description: "",
        assigned_amount: "",
        status: "active",
      });
    };
  
    return (
      <>
        <div className="summary-cards">
          <div className="card">
            <p>Assigned Subcontractors</p>
            <h2>{subcontractors.length}</h2>
          </div>
  
          <div className="card">
            <p>Total Assigned Amount</p>
            <h2>${subcontractorAssignedTotal.toFixed(2)}</h2>
          </div>
        </div>
  
        <div className="payment-grid">
          <div className="panel">
            <h2>
              {editingAssignedSub
                ? "Edit Assigned Subcontractor"
                : "Assign Subcontractor"}
            </h2>
  
            <form className="payment-form" onSubmit={handleAssignSubcontractor}>
              <select
                value={subcontractorForm.subcontractor_id}
                onChange={(e) =>
                  setSubcontractorForm({
                    ...subcontractorForm,
                    subcontractor_id: e.target.value,
                  })
                }
                required
              >
                <option value="">Select Subcontractor</option>
  
                {allSubcontractors.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.full_name}
                    {sub.business_name ? ` - ${sub.business_name}` : ""}
                  </option>
                ))}
              </select>
  
              <input
                placeholder="Work description"
                value={subcontractorForm.work_description}
                onChange={(e) =>
                  setSubcontractorForm({
                    ...subcontractorForm,
                    work_description: e.target.value,
                  })
                }
              />
  
              <input
                type="number"
                placeholder="Assigned amount"
                value={subcontractorForm.assigned_amount}
                onChange={(e) =>
                  setSubcontractorForm({
                    ...subcontractorForm,
                    assigned_amount: e.target.value,
                  })
                }
              />
  
              <select
                value={subcontractorForm.status}
                onChange={(e) =>
                  setSubcontractorForm({
                    ...subcontractorForm,
                    status: e.target.value,
                  })
                }
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
              </select>
  
              <button type="submit">
                {editingAssignedSub ? "Save Changes" : "Assign to Tender"}
              </button>
  
              {editingAssignedSub && (
                <button type="button" onClick={resetSubcontractorForm}>
                  Cancel
                </button>
              )}
            </form>
          </div>
  
          <div className="panel">
            <h2>Assigned Subcontractors</h2>
  
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Business</th>
                    <th>Phone</th>
                    <th>Work</th>
                    <th>Assigned Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
  
                <tbody>
                  {subcontractors.map((sub) => (
                    <tr key={sub.id}>
                      <td>{sub.full_name}</td>
                      <td>{sub.business_name}</td>
                      <td>{sub.phone}</td>
                      <td>{sub.work_description}</td>
                      <td>${Number(sub.assigned_amount).toFixed(2)}</td>
                      <td>{sub.status}</td>
  
                      <td>
                        <button
                          type="button"
                          onClick={() => startEditAssignedSubcontractor(sub)}
                        >
                          Edit
                        </button>
  
                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() =>
                            setDeleteTarget({
                              type: "subcontractor",
                              item: sub,
                            })
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
  
                  {subcontractors.length === 0 && (
                    <tr>
                      <td colSpan="7" className="empty-table-message">
                        No subcontractors assigned yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </>
    );
  }
  
  export default TenderSubcontractorsTab;