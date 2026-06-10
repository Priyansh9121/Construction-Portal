import { useState } from "react";
import DeleteVerificationModal from "../components/DeleteVerificationModal";

function WorkersPage({ workers, addWorker, deleteWorker }) {
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    await deleteWorker(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <>
      <section className="payment-grid">
        <div className="panel">
          <h2>Add Worker</h2>

          <form className="payment-form" onSubmit={addWorker}>
            <input name="full_name" placeholder="Worker Name" required />
            <input name="phone" placeholder="Phone Number" required />
            <input name="salary" type="number" placeholder="Salary" required />
            <input name="role" placeholder="Role" required />

            <select name="status" required>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <button type="submit">Add Worker</button>
          </form>
        </div>

        <div className="panel">
          <h2>Workers List</h2>

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
              {workers.map((worker) => (
                <tr key={worker.id}>
                  <td>{worker.full_name}</td>
                  <td>{worker.phone}</td>
                  <td>${Number(worker.salary).toFixed(2)}</td>
                  <td>{worker.role}</td>
                  <td>{worker.status}</td>
                  <td>
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

              {workers.length === 0 && (
                <tr>
                  <td colSpan="6">No workers added yet.</td>
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