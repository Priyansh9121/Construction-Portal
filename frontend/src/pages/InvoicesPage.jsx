import { useState } from "react";
import DeleteVerificationModal from "../components/DeleteVerificationModal";

function InvoicesPage({
  invoices,
  addInvoice,
  deleteInvoice,
}) {
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    await deleteInvoice(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <>
      <section className="payment-grid">
        <div className="panel">
          <h2>Add Invoice</h2>

          <form className="payment-form" onSubmit={addInvoice}>
            <input
              name="invoice_number"
              placeholder="Invoice Number"
              required
            />

            <input
              name="amount"
              type="number"
              placeholder="Amount"
              required
            />

            <select name="status" required>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>

            <button type="submit">Add Invoice</button>
          </form>
        </div>

        <div className="panel">
          <h2>Invoices List</h2>

          <table>
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoice_number}</td>

                  <td>${Number(invoice.amount).toFixed(2)}</td>

                  <td>{invoice.status}</td>

                  <td>{invoice.created_at?.slice(0, 10)}</td>

                  <td>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => setDeleteTarget(invoice)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {invoices.length === 0 && (
                <tr>
                  <td colSpan="5">No invoices added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DeleteVerificationModal
        open={!!deleteTarget}
        itemName={deleteTarget?.invoice_number || "invoice"}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export default InvoicesPage;