import { formatCurrency } from "../../utils/currency";

function TenderSubcontractorsTab({
  subcontractors = [],
  subcontractorAssignedTotal = 0,
  editingAssignedSub,
  subcontractorForm,
  setSubcontractorForm,
  allSubcontractors = [],
  handleAssignSubcontractor,
  startEditAssignedSubcontractor,
  setEditingAssignedSub,
  setDeleteTarget,
}) {
  const money = formatCurrency;

  const activeSubs = subcontractors.filter((sub) => sub.status === "active");
  const completedSubs = subcontractors.filter(
    (sub) => sub.status === "completed"
  );
  const pausedSubs = subcontractors.filter((sub) => sub.status === "paused");

  const averageAssigned =
    subcontractors.length > 0
      ? Number(subcontractorAssignedTotal || 0) / subcontractors.length
      : 0;

  const resetSubcontractorForm = () => {
    setEditingAssignedSub(null);

    setSubcontractorForm({
      subcontractor_id: "",
      work_description: "",
      assigned_amount: "",
      status: "active",
    });
  };

  const selectedSub = allSubcontractors.find(
    (sub) => Number(sub.id) === Number(subcontractorForm.subcontractor_id)
  );

  return (
    <>
      <section className="summary-cards">
        <div className="card">
          <p>Assigned Subcontractors</p>
          <h2>{subcontractors.length}</h2>
        </div>

        <div className="card">
          <p>Total Assigned Amount</p>
          <h2>{money(subcontractorAssignedTotal)}</h2>
        </div>

        <div className="card highlight-success">
          <p>Active</p>
          <h2>{activeSubs.length}</h2>
        </div>

        <div className="card">
          <p>Completed</p>
          <h2>{completedSubs.length}</h2>
        </div>

        <div className="card highlight-warning">
          <p>Paused</p>
          <h2>{pausedSubs.length}</h2>
        </div>

        <div className="card">
          <p>Average Assigned</p>
          <h2>{money(averageAssigned)}</h2>
        </div>
      </section>

      <div className="payment-grid">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                {editingAssignedSub
                  ? "Edit Assigned Subcontractor"
                  : "Assign Subcontractor"}
              </h2>
              <p className="muted-text">
                Assign subcontractor work packages, value and status.
              </p>
            </div>
          </div>

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
              disabled={!!editingAssignedSub}
            >
              <option value="">Select Subcontractor</option>

              {allSubcontractors.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.full_name}
                  {sub.business_name ? ` - ${sub.business_name}` : ""}
                </option>
              ))}
            </select>

            {selectedSub && (
              <div className="form-preview-total">
                Selected: {selectedSub.full_name}
                {selectedSub.business_name ? ` | ${selectedSub.business_name}` : ""}
                {selectedSub.phone ? ` | ${selectedSub.phone}` : ""}
              </div>
            )}

            <textarea
              placeholder="Work description"
              value={subcontractorForm.work_description}
              onChange={(e) =>
                setSubcontractorForm({
                  ...subcontractorForm,
                  work_description: e.target.value,
                })
              }
              required
            />

            <div className="form-grid">
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
                required
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
            </div>

            <div className="form-preview-total">
              Assigned Amount Preview: {money(subcontractorForm.assigned_amount)}
            </div>

            <div className="form-actions">
              <button type="submit">
                {editingAssignedSub ? "Save Changes" : "Assign to Tender"}
              </button>

              {editingAssignedSub && (
                <button type="button" onClick={resetSubcontractorForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Status Summary</h2>
              <p className="muted-text">
                Subcontractor package status for this tender.
              </p>
            </div>
          </div>

          <table>
            <tbody>
              <tr>
                <td>Total Assigned</td>
                <td className="number-cell">{subcontractors.length}</td>
              </tr>
              <tr>
                <td>Active</td>
                <td className="number-cell">{activeSubs.length}</td>
              </tr>
              <tr>
                <td>Completed</td>
                <td className="number-cell">{completedSubs.length}</td>
              </tr>
              <tr>
                <td>Paused</td>
                <td className="number-cell">{pausedSubs.length}</td>
              </tr>
              <tr>
                <td>Total Value</td>
                <td className="amount-cell">{money(subcontractorAssignedTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Assigned Subcontractors Register</h2>
            <p className="muted-text">
              Full subcontractor assignment and work package register.
            </p>
          </div>
        </div>

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
                  <td>{sub.full_name || "-"}</td>
                  <td>{sub.business_name || "-"}</td>
                  <td>{sub.phone || "-"}</td>
                  <td>{sub.work_description || "-"}</td>
                  <td className="amount-cell">{money(sub.assigned_amount)}</td>
                  <td>
                    <span
                      className={
                        sub.status === "active"
                          ? "badge green"
                          : sub.status === "paused"
                          ? "badge yellow"
                          : "badge blue"
                      }
                    >
                      {sub.status || "-"}
                    </span>
                  </td>

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
      </section>
    </>
  );
}

export default TenderSubcontractorsTab;