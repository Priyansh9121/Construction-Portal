import { useState } from "react";
import DeleteVerificationModal from "../components/DeleteVerificationModal";
import { updateWorker } from "../services/workerService";
import ExportButtons from "../components/export/ExportButtons";
import { formatCurrency } from "../utils/currency";
import { useAuth } from "../contexts/AuthContext";
import useWorkers from "../hooks/useWorkers";
import toast from "react-hot-toast";

function WorkersPage() {
  const { user } = useAuth();

  const {
    workers,
    addWorker,
    removeWorker,
    fetchWorkers,
  } = useWorkers(user);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingWorker, setEditingWorker] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [adding, setAdding] =
    useState(false);

  const [updating, setUpdating] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    salary: "",
    role: "",
    status: "active",
  });

  const money = formatCurrency;

  const filteredWorkers = workers.filter((worker) => {
    const search = searchTerm.toLowerCase();

    return (
      worker.full_name?.toLowerCase().includes(search) ||
      worker.phone?.toLowerCase().includes(search) ||
      worker.role?.toLowerCase().includes(search) ||
      worker.status?.toLowerCase().includes(search) ||
      String(worker.salary || "").includes(search)
    );
  });

  const activeWorkers = workers.filter((worker) => worker.status === "active");
  const inactiveWorkers = workers.filter(
    (worker) => worker.status === "inactive"
  );

  const totalSalary = workers.reduce(
    (sum, worker) => sum + Number(worker.salary || 0),
    0
  );

  const filteredSalary = filteredWorkers.reduce(
    (sum, worker) => sum + Number(worker.salary || 0),
    0
  );

  const averageSalary =
    workers.length > 0 ? totalSalary / workers.length : 0;

  const workerExportRows = filteredWorkers.map((worker) => ({
    full_name: worker.full_name || "",
    phone: worker.phone || "",
    role: worker.role || "",
    salary: money(worker.salary),
    status: worker.status || "",
  }));

  const workerExportColumns = [
    { key: "full_name", label: "Worker Name" },
    { key: "phone", label: "Phone" },
    { key: "role", label: "Role" },
    { key: "salary", label: "Salary" },
    { key: "status", label: "Status" },
  ];

  const emptyEditForm = {
    full_name: "",
    phone: "",
    salary: "",
    role: "",
    status: "active",
  };

  const handleAddWorker = async (
    event
  ) => {
    event.preventDefault();
  
    if (adding) return;
  
    const form =
      event.currentTarget;
  
    const payload = {
      company_id:
        user?.company_id || null,
      full_name:
        form.full_name.value.trim(),
      phone:
        form.phone.value.trim(),
      salary: Number(
        form.salary.value || 0
      ),
      role:
        form.role.value.trim(),
      status:
        form.status.value,
    };
  
    try {
      setAdding(true);
  
      await addWorker(payload);
  
      form.reset();
  
      toast.success(
        "Worker added successfully."
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to add worker."
      );
    } finally {
      setAdding(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) {
      return;
    }
  
    try {
      setDeleting(true);
  
      await removeWorker(
        deleteTarget.id
      );
  
      if (
        editingWorker?.id ===
        deleteTarget.id
      ) {
        cancelEdit();
      }
  
      setDeleteTarget(null);
  
      toast.success(
        "Worker deleted successfully."
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to delete worker."
      );
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (worker) => {
    setEditingWorker(worker);

    setEditForm({
      full_name: worker.full_name || "",
      phone: worker.phone || "",
      salary: worker.salary || "",
      role: worker.role || "",
      status: worker.status || "active",
    });
  };

  const cancelEdit = () => {
    setEditingWorker(null);
    setEditForm(emptyEditForm);
  };

  const handleEditChange = (event) => {
    setEditForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const handleUpdateWorker = async (
    event
  ) => {
    event.preventDefault();
  
    if (!editingWorker || updating) {
      return;
    }
  
    try {
      setUpdating(true);
  
      await updateWorker(
        editingWorker.id,
        {
          ...editForm,
          full_name:
            editForm.full_name.trim(),
          phone:
            editForm.phone.trim(),
          salary: Number(
            editForm.salary || 0
          ),
          role:
            editForm.role.trim(),
        }
      );
  
      await fetchWorkers();
      cancelEdit();
  
      toast.success(
        "Worker updated successfully."
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to update worker."
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
            <h2>Workers Management</h2>
            <p className="muted-text">
              Manage labour records, salary details, roles and worker status.
            </p>
          </div>

          <ExportButtons
            filename="workers"
            title="Workers Report"
            subtitle="Construction Portal worker register"
            rows={workerExportRows}
            columns={workerExportColumns}
          />
        </div>
      </section>

      <section className="summary-cards">
        <div className="card">
          <p>Total Workers</p>
          <h2>{workers.length}</h2>
        </div>

        <div className="card highlight-success">
          <p>Active Workers</p>
          <h2>{activeWorkers.length}</h2>
        </div>

        <div className="card highlight-warning">
          <p>Inactive Workers</p>
          <h2>{inactiveWorkers.length}</h2>
        </div>

        <div className="card">
          <p>Total Salary</p>
          <h2>{money(totalSalary)}</h2>
        </div>

        <div className="card">
          <p>Average Salary</p>
          <h2>{money(averageSalary)}</h2>
        </div>

        <div className="card">
          <p>Filtered Salary</p>
          <h2>{money(filteredSalary)}</h2>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>{editingWorker ? "Edit Worker" : "Add Worker"}</h2>
              <p className="muted-text">
                {editingWorker
                  ? "Update worker details and employment status."
                  : "Create a new worker record for allocations and site updates."}
              </p>
            </div>
          </div>

          {editingWorker ? (
            <form className="payment-form" onSubmit={handleUpdateWorker}>
              <div className="form-grid">
                <label>
                  Worker Name
                  <input
                    name="full_name"
                    value={editForm.full_name}
                    onChange={handleEditChange}
                    required
                  />
                </label>

                <label>
                  Phone Number
                  <input
                    name="phone"
                    value={editForm.phone}
                    onChange={handleEditChange}
                    required
                  />
                </label>

                <label>
                  Salary
                  <input
                    name="salary"
                    type="number"
                    value={editForm.salary}
                    onChange={handleEditChange}
                    required
                  />
                </label>

                <label>
                  Role
                  <input
                    name="role"
                    value={editForm.role}
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
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <div className="form-preview-total">
                Salary Preview: {money(editForm.salary)}
              </div>

              <div className="form-actions">
                <button type="submit">Save Changes</button>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <form className="payment-form" onSubmit={handleAddWorker}>
              <div className="form-grid">
                <label>
                  Worker Name
                  <input name="full_name" required />
                </label>

                <label>
                  Phone Number
                  <input name="phone" required />
                </label>

                <label>
                  Salary
                  <input name="salary" type="number" required />
                </label>

                <label>
                  Role
                  <input name="role" required />
                </label>

                <label>
                  Status
                  <select name="status" defaultValue="active" required>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <button type="submit">Add Worker</button>
            </form>
          )}
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Worker Search</h2>
              <p className="muted-text">
                Search by name, phone, role, salary or status.
              </p>
            </div>
          </div>

          <input
            className="search-input"
            type="text"
            placeholder="Search workers..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <table>
            <tbody>
              <tr>
                <td>Total Matching Workers</td>
                <td className="number-cell">{filteredWorkers.length}</td>
              </tr>

              <tr>
                <td>Matching Salary Total</td>
                <td className="amount-cell">{money(filteredSalary)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Workers Register</h2>
            <p className="muted-text">
              Complete worker list with role, salary, status and actions.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Salary</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredWorkers.map((worker) => (
                <tr key={worker.id}>
                  <td>{worker.full_name || "-"}</td>
                  <td>{worker.phone || "-"}</td>
                  <td className="amount-cell">{money(worker.salary)}</td>
                  <td>{worker.role || "-"}</td>
                  <td>
                    <span
                      className={
                        worker.status === "active"
                          ? "badge green"
                          : "badge yellow"
                      }
                    >
                      {worker.status || "-"}
                    </span>
                  </td>
                  <td>
                    <button type="button" onClick={() => startEdit(worker)}>
                      Edit
                    </button>

                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => setDeleteTarget(worker)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {filteredWorkers.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-table-message">
                    No workers found.
                  </td>
                </tr>
              )}
            </tbody>

            {filteredWorkers.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="2">
                    <strong>Total</strong>
                  </td>
                  <td className="amount-cell">
                    <strong>{money(filteredSalary)}</strong>
                  </td>
                  <td colSpan="3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <DeleteVerificationModal
        open={!!deleteTarget}
        itemName={deleteTarget?.full_name || "worker"}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export default WorkersPage;