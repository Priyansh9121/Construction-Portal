import { useState } from "react";
import DeleteVerificationModal from "../components/DeleteVerificationModal";
import { updateWorker } from "../services/workerService";

function WorkersPage({ workers, addWorker, deleteWorker }) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingWorker, setEditingWorker] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    salary: "",
    role: "",
    status: "active",
  });

  const filteredWorkers = workers.filter((worker) => {
    const search = searchTerm.toLowerCase();

    return (
      worker.full_name?.toLowerCase().includes(search) ||
      worker.phone?.toLowerCase().includes(search) ||
      worker.role?.toLowerCase().includes(search) ||
      worker.status?.toLowerCase().includes(search) ||
      String(worker.salary || "").toLowerCase().includes(search)
    );
  });

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    await deleteWorker(deleteTarget.id);
    setDeleteTarget(null);
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

    setEditForm({
      full_name: "",
      phone: "",
      salary: "",
      role: "",
      status: "active",
    });
  };

  const handleEditChange = (e) => {
    setEditForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleUpdateWorker = async (e) => {
    e.preventDefault();

    if (!editingWorker) return;

    await updateWorker(editingWorker.id, editForm);

    window.location.reload();
  };

  return (
    <>
      <section className="payment-grid">
        <div className="panel">
          <h2>{editingWorker ? "Edit Worker" : "Add Worker"}</h2>

          {editingWorker ? (
            <form className="payment-form" onSubmit={handleUpdateWorker}>
              <input
                name="full_name"
                placeholder="Worker Name"
                value={editForm.full_name}
                onChange={handleEditChange}
                required
              />

              <input
                name="phone"
                placeholder="Phone Number"
                value={editForm.phone}
                onChange={handleEditChange}
                required
              />

              <input
                name="salary"
                type="number"
                placeholder="Salary"
                value={editForm.salary}
                onChange={handleEditChange}
                required
              />

              <input
                name="role"
                placeholder="Role"
                value={editForm.role}
                onChange={handleEditChange}
                required
              />

              <select
                name="status"
                value={editForm.status}
                onChange={handleEditChange}
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <button type="submit">Save Changes</button>

              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>
            </form>
          ) : (
            <form className="payment-form" onSubmit={addWorker}>
              <input name="full_name" placeholder="Worker Name" required />
              <input name="phone" placeholder="Phone Number" required />
              <input name="salary" type="number" placeholder="Salary" required />
              <input name="role" placeholder="Role" required />

              <select name="status" defaultValue="active" required>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <button type="submit">Add Worker</button>
            </form>
          )}
        </div>

        <div className="panel">
          <h2>Workers List</h2>

          <input
            className="search-input"
            type="text"
            placeholder="Search workers by name, phone, role, salary or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

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
                  <td>{worker.full_name}</td>
                  <td>{worker.phone}</td>
                  <td>${Number(worker.salary).toFixed(2)}</td>
                  <td>{worker.role}</td>
                  <td>{worker.status}</td>
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