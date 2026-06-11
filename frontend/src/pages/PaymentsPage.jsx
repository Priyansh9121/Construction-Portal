import { useState } from "react";
import DeleteVerificationModal from "../components/DeleteVerificationModal";
import { updatePayment } from "../services/paymentService";

function PaymentsPage({ payments, addPayment, deletePayment }) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [editForm, setEditForm] = useState({
    payment_type: "",
    category: "",
    amount: "",
    payment_date: "",
    description: "",
  });

  const filteredPayments = payments.filter((payment) => {
    const search = searchTerm.toLowerCase();

    return (
      payment.payment_type?.toLowerCase().includes(search) ||
      payment.category?.toLowerCase().includes(search) ||
      payment.description?.toLowerCase().includes(search) ||
      payment.payment_date?.toLowerCase().includes(search) ||
      String(payment.amount || "").toLowerCase().includes(search)
    );
  });

  const totalIncome = payments
    .filter((p) => p.payment_type === "Income")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalExpense = payments
    .filter((p) => p.payment_type === "Expense")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const balance = totalIncome - totalExpense;

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    await deletePayment(deleteTarget.id);
    setDeleteTarget(null);
  };

  const startEdit = (payment) => {
    setEditingPayment(payment);

    setEditForm({
      payment_type: payment.payment_type || "",
      category: payment.category || "",
      amount: payment.amount || "",
      payment_date: payment.payment_date
        ? payment.payment_date.slice(0, 10)
        : "",
      description: payment.description || "",
    });
  };

  const cancelEdit = () => {
    setEditingPayment(null);

    setEditForm({
      payment_type: "",
      category: "",
      amount: "",
      payment_date: "",
      description: "",
    });
  };

  const handleEditChange = (e) => {
    setEditForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleUpdatePayment = async (e) => {
    e.preventDefault();

    if (!editingPayment) return;

    await updatePayment(editingPayment.id, editForm);

    window.location.reload();
  };

  return (
    <>
      <section className="summary-cards">
        <div className="card">
          <p>Total Income</p>
          <h2>${totalIncome.toFixed(2)}</h2>
        </div>

        <div className="card">
          <p>Total Expense</p>
          <h2>${totalExpense.toFixed(2)}</h2>
        </div>

        <div className="card">
          <p>Balance</p>
          <h2>${balance.toFixed(2)}</h2>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <h2>{editingPayment ? "Edit Payment" : "Add Payment"}</h2>

          {editingPayment ? (
            <form className="payment-form" onSubmit={handleUpdatePayment}>
              <select
                name="payment_type"
                value={editForm.payment_type}
                onChange={handleEditChange}
                required
              >
                <option value="">Select Payment Type</option>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
                <option value="Investment">Partner Investment</option>
                <option value="Loan">Loan</option>
                <option value="Return">Returned Payment</option>
              </select>

              <select
                name="category"
                value={editForm.category}
                onChange={handleEditChange}
                required
              >
                <option value="">Select Category</option>
                <option value="Government Payment">Government Payment</option>
                <option value="Worker Salary">Worker Salary</option>
                <option value="Subcontractor Payment">
                  Subcontractor Payment
                </option>
                <option value="Partner Internal Transfer">
                  Partner Internal Transfer
                </option>
                <option value="Personal Investment">Personal Investment</option>
                <option value="Company Expense">Company Expense</option>
                <option value="Material Purchase">Material Purchase</option>
              </select>

              <input
                name="amount"
                type="number"
                placeholder="Amount"
                value={editForm.amount}
                onChange={handleEditChange}
                required
              />

              <input
                name="payment_date"
                type="date"
                value={editForm.payment_date}
                onChange={handleEditChange}
                required
              />

              <textarea
                name="description"
                placeholder="Description"
                value={editForm.description}
                onChange={handleEditChange}
              ></textarea>

              <button type="submit">Save Changes</button>

              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>
            </form>
          ) : (
            <form className="payment-form" onSubmit={addPayment}>
              <select name="payment_type" required>
                <option value="">Select Payment Type</option>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
                <option value="Investment">Partner Investment</option>
                <option value="Loan">Loan</option>
                <option value="Return">Returned Payment</option>
              </select>

              <select name="category" required>
                <option value="">Select Category</option>
                <option value="Government Payment">Government Payment</option>
                <option value="Worker Salary">Worker Salary</option>
                <option value="Subcontractor Payment">
                  Subcontractor Payment
                </option>
                <option value="Partner Internal Transfer">
                  Partner Internal Transfer
                </option>
                <option value="Personal Investment">Personal Investment</option>
                <option value="Company Expense">Company Expense</option>
                <option value="Material Purchase">Material Purchase</option>
              </select>

              <input name="amount" type="number" placeholder="Amount" required />

              <input name="payment_date" type="date" required />

              <textarea name="description" placeholder="Description"></textarea>

              <button type="submit">Add Payment</button>
            </form>
          )}
        </div>

        <div className="panel">
          <h2>Payment Records</h2>

          <input
            className="search-input"
            type="text"
            placeholder="Search payments by type, category, amount, date or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Category</th>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.payment_type}</td>
                  <td>{payment.category}</td>
                  <td>
                    {payment.payment_date
                      ? payment.payment_date.slice(0, 10)
                      : ""}
                  </td>
                  <td>{payment.description}</td>
                  <td>${Number(payment.amount).toFixed(2)}</td>
                  <td>
                    <button type="button" onClick={() => startEdit(payment)}>
                      Edit
                    </button>

                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => setDeleteTarget(payment)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan="6">No payments found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DeleteVerificationModal
        open={!!deleteTarget}
        itemName={deleteTarget?.category || "payment"}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export default PaymentsPage;