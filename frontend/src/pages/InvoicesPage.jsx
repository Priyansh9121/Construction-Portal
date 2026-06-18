import { useState } from "react";
import DeleteVerificationModal from "../components/DeleteVerificationModal";
import { updateInvoice } from "../services/invoiceService";

function InvoicesPage({
  invoices,
  addInvoice,
  deleteInvoice,
}) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [editingInvoice, setEditingInvoice] = useState(null);

  const [editForm, setEditForm] = useState({
    invoice_number: "",
    amount: "",
    status: "pending",
  });

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    await deleteInvoice(deleteTarget.id);
    setDeleteTarget(null);
  };

  const startEdit = (invoice) => {
    setEditingInvoice(invoice);

    setEditForm({
      invoice_number: invoice.invoice_number || "",
      amount: invoice.amount || "",
      status: invoice.status || "pending",
    });
  };

  const cancelEdit = () => {
    setEditingInvoice(null);

    setEditForm({
      invoice_number: "",
      amount: "",
      status: "pending",
    });
  };

  const handleEditChange = (e) => {
    setEditForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleUpdateInvoice = async (e) => {
    e.preventDefault();

    if (!editingInvoice) return;

    await updateInvoice(editingInvoice.id, editForm);

    window.location.reload();
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const searchValue = search.toLowerCase();
  
    return (
      invoice.invoice_number?.toLowerCase().includes(searchValue) ||
      invoice.status?.toLowerCase().includes(searchValue) ||
      String(invoice.amount || "").toLowerCase().includes(searchValue) ||
      invoice.created_at?.toLowerCase().includes(searchValue)
    );
  });

  return (
    <>
      <section className="payment-grid">
        <div className="panel">
          <h2>{editingInvoice ? "Edit Invoice" : "Add Invoice"}</h2>

          {editingInvoice ? (
            <form className="payment-form" onSubmit={handleUpdateInvoice}>
              <input
                name="invoice_number"
                placeholder="Invoice Number"
                value={editForm.invoice_number}
                onChange={handleEditChange}
                required
              />

              <input
                name="amount"
                type="number"
                placeholder="Amount"
                value={editForm.amount}
                onChange={handleEditChange}
                required
              />

              <select
                name="status"
                value={editForm.status}
                onChange={handleEditChange}
                required
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>

              <button type="submit">Save Changes</button>

              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>
            </form>
          ) : (
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
          )}
        </div>

        <div className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h2>Invoices List</h2>

            <input
              className="search-input"
              type="text"
              placeholder="Search invoices by invoice no, status, amount or date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

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
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoice_number}</td>

                  <td className="amount-cell">
                    ${Number(invoice.amount).toFixed(2)}
                  </td>

                  <td>{invoice.status}</td>

                  <td>
                    {invoice.created_at?.slice(0, 10)}
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() => startEdit(invoice)}
                    >
                      Edit
                    </button>

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

              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-table-message">
                    No matching invoices found.
                  </td>
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