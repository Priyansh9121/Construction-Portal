import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import DeleteVerificationModal from "../components/DeleteVerificationModal";
import ExportButtons from "../components/export/ExportButtons";

import { updateInvoice } from "../services/invoiceService";
import { formatCurrency } from "../utils/currency";
import { useAuth } from "../contexts/AuthContext";
import useInvoices from "../hooks/useInvoices";

const EMPTY_EDIT_FORM = {
  invoice_number: "",
  amount: "",
  status: "pending",
};

function InvoicesPage() {
  const { user } = useAuth();

  const {
    invoices = [],
    addInvoice,
    removeInvoice,
    fetchInvoices,
  } = useInvoices(user);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const money = formatCurrency;

  const dateOnly = (value) =>
    value ? String(value).slice(0, 10) : "-";

  const normaliseStatus = (value) =>
    String(value || "pending")
      .trim()
      .toLowerCase();

  const getStatusClass = (status) => {
    const value = normaliseStatus(status);

    if (value === "paid") {
      return "badge green";
    }

    if (value === "overdue") {
      return "badge red";
    }

    return "badge yellow";
  };

  const totals = useMemo(() => {
    const totalAmount = invoices.reduce(
      (sum, invoice) =>
        sum + Number(invoice.amount || 0),
      0
    );

    const paidInvoices = invoices.filter(
      (invoice) =>
        normaliseStatus(invoice.status) === "paid"
    );

    const pendingInvoices = invoices.filter(
      (invoice) =>
        normaliseStatus(invoice.status) === "pending"
    );

    const overdueInvoices = invoices.filter(
      (invoice) =>
        normaliseStatus(invoice.status) === "overdue"
    );

    const paidAmount = paidInvoices.reduce(
      (sum, invoice) =>
        sum + Number(invoice.amount || 0),
      0
    );

    const pendingAmount = pendingInvoices.reduce(
      (sum, invoice) =>
        sum + Number(invoice.amount || 0),
      0
    );

    const overdueAmount = overdueInvoices.reduce(
      (sum, invoice) =>
        sum + Number(invoice.amount || 0),
      0
    );

    return {
      totalAmount,
      paidAmount,
      pendingAmount,
      overdueAmount,
      paidCount: paidInvoices.length,
      pendingCount: pendingInvoices.length,
      overdueCount: overdueInvoices.length,
    };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const searchValue = search
      .trim()
      .toLowerCase();

    return invoices.filter((invoice) => {
      const status = normaliseStatus(invoice.status);

      const searchableText = [
        invoice.invoice_number,
        invoice.amount,
        invoice.created_at,
        status,
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase();

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      const matchesSearch =
        !searchValue ||
        searchableText.includes(searchValue);

      return matchesStatus && matchesSearch;
    });
  }, [invoices, search, statusFilter]);

  const filteredTotal = useMemo(
    () =>
      filteredInvoices.reduce(
        (sum, invoice) =>
          sum + Number(invoice.amount || 0),
        0
      ),
    [filteredInvoices]
  );

  const invoiceExportRows = filteredInvoices.map(
    (invoice) => ({
      invoice_number: invoice.invoice_number || "",
      amount: money(invoice.amount),
      status: normaliseStatus(invoice.status),
      created_at: dateOnly(invoice.created_at),
    })
  );

  const invoiceExportColumns = [
    {
      key: "invoice_number",
      label: "Invoice No.",
    },
    {
      key: "amount",
      label: "Amount",
    },
    {
      key: "status",
      label: "Status",
    },
    {
      key: "created_at",
      label: "Created Date",
    },
  ];

  const invoiceExportSummary = {
    "Total Invoices": invoices.length,
    "Total Invoice Value": money(totals.totalAmount),
    "Paid Invoices": totals.paidCount,
    "Paid Amount": money(totals.paidAmount),
    "Pending Invoices": totals.pendingCount,
    "Pending Amount": money(totals.pendingAmount),
    "Overdue Invoices": totals.overdueCount,
    "Overdue Amount": money(totals.overdueAmount),
    "Filtered Records": filteredInvoices.length,
    "Filtered Value": money(filteredTotal),
  };

  const startEdit = (invoice) => {
    setEditingInvoice(invoice);
    setSelectedInvoice(invoice);

    setEditForm({
      invoice_number: invoice.invoice_number || "",
      amount: invoice.amount || "",
      status: normaliseStatus(invoice.status),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const cancelEdit = () => {
    setEditingInvoice(null);
    setEditForm(EMPTY_EDIT_FORM);
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;

    setEditForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));
  };

  const handleAddInvoice = async (event) => {
    event.preventDefault();

    if (adding) {
      return;
    }

    const form = event.currentTarget;

    const invoiceNumber =
      form.invoice_number.value.trim();

    const amount = Number(
      form.amount.value || 0
    );

    if (!invoiceNumber) {
      toast.error("Invoice number is required.");
      return;
    }

    if (amount <= 0) {
      toast.error(
        "Invoice amount must be greater than zero."
      );
      return;
    }

    const newInvoice = {
      company_id: user?.company_id || null,
      tender_id: form.tender_id?.value
        ? Number(form.tender_id.value)
        : null,
      invoice_number: invoiceNumber,
      amount,
      status: form.status.value,
    };

    try {
      setAdding(true);

      await addInvoice(newInvoice);

      form.reset();

      toast.success(
        "Invoice added successfully."
      );
    } catch (error) {
      console.error(
        "Failed to add invoice:",
        error.response?.data || error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to add invoice."
      );
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateInvoice = async (event) => {
    event.preventDefault();

    if (!editingInvoice || updating) {
      return;
    }

    const invoiceNumber =
      editForm.invoice_number.trim();

    const amount = Number(
      editForm.amount || 0
    );

    if (!invoiceNumber) {
      toast.error("Invoice number is required.");
      return;
    }

    if (amount <= 0) {
      toast.error(
        "Invoice amount must be greater than zero."
      );
      return;
    }

    try {
      setUpdating(true);

      await updateInvoice(editingInvoice.id, {
        invoice_number: invoiceNumber,
        amount,
        status: editForm.status,
      });

      await fetchInvoices();

      cancelEdit();

      toast.success(
        "Invoice updated successfully."
      );
    } catch (error) {
      console.error(
        "Failed to update invoice:",
        error.response?.data || error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to update invoice."
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) {
      return;
    }

    try {
      setDeleting(true);

      await removeInvoice(deleteTarget.id);

      if (
        selectedInvoice?.id === deleteTarget.id
      ) {
        setSelectedInvoice(null);
      }

      if (
        editingInvoice?.id === deleteTarget.id
      ) {
        cancelEdit();
      }

      setDeleteTarget(null);

      toast.success(
        "Invoice deleted successfully."
      );
    } catch (error) {
      console.error(
        "Failed to delete invoice:",
        error.response?.data || error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to delete invoice."
      );
    } finally {
      setDeleting(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  return (
    <>
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Invoices Management</h2>

            <p className="muted-text">
              Create, track, review and export construction
              invoices.
            </p>
          </div>

          <ExportButtons
            filename="invoices"
            title="Invoices Report"
            subtitle="Construction Portal invoice register"
            rows={invoiceExportRows}
            columns={invoiceExportColumns}
            summary={invoiceExportSummary}
          />
        </div>
      </section>

      <section className="summary-cards">
        <div className="card">
          <p>Total Invoices</p>
          <h2>{invoices.length}</h2>
        </div>

        <div className="card">
          <p>Total Invoice Value</p>
          <h2>{money(totals.totalAmount)}</h2>
        </div>

        <div className="card highlight-success">
          <p>Paid</p>
          <h2>{totals.paidCount}</h2>
          <small>{money(totals.paidAmount)}</small>
        </div>

        <div className="card highlight-warning">
          <p>Pending</p>
          <h2>{totals.pendingCount}</h2>
          <small>{money(totals.pendingAmount)}</small>
        </div>

        <div className="card highlight-danger">
          <p>Overdue</p>
          <h2>{totals.overdueCount}</h2>
          <small>{money(totals.overdueAmount)}</small>
        </div>

        <div className="card">
          <p>Filtered Value</p>
          <h2>{money(filteredTotal)}</h2>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                {editingInvoice
                  ? "Edit Invoice"
                  : "Add Invoice"}
              </h2>

              <p className="muted-text">
                {editingInvoice
                  ? "Update the selected invoice number, value or payment status."
                  : "Create a new invoice and begin tracking its payment status."}
              </p>
            </div>
          </div>

          {editingInvoice ? (
            <form
              className="payment-form"
              onSubmit={handleUpdateInvoice}
            >
              <div className="form-grid">
                <label>
                  Invoice Number
                  <input
                    name="invoice_number"
                    value={editForm.invoice_number}
                    onChange={handleEditChange}
                    disabled={updating}
                    required
                  />
                </label>

                <label>
                  Invoice Amount
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editForm.amount}
                    onChange={handleEditChange}
                    disabled={updating}
                    required
                  />
                </label>

                <label>
                  Status
                  <select
                    name="status"
                    value={editForm.status}
                    onChange={handleEditChange}
                    disabled={updating}
                    required
                  >
                    <option value="pending">
                      Pending
                    </option>

                    <option value="paid">
                      Paid
                    </option>

                    <option value="overdue">
                      Overdue
                    </option>
                  </select>
                </label>
              </div>

              <div className="form-preview-total">
                Invoice Preview:{" "}
                {editForm.invoice_number || "New Invoice"} ·{" "}
                {money(editForm.amount)} ·{" "}
                {editForm.status}
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={updating}
                >
                  {updating
                    ? "Saving..."
                    : "Save Changes"}
                </button>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={cancelEdit}
                  disabled={updating}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <form
              className="payment-form"
              onSubmit={handleAddInvoice}
            >
              <div className="form-grid">
                <label>
                  Invoice Number
                  <input
                    name="invoice_number"
                    placeholder="Example: INV-2026-001"
                    disabled={adding}
                    required
                  />
                </label>

                <label>
                  Invoice Amount
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    disabled={adding}
                    required
                  />
                </label>

                <label>
                  Status
                  <select
                    name="status"
                    defaultValue="pending"
                    disabled={adding}
                    required
                  >
                    <option value="pending">
                      Pending
                    </option>

                    <option value="paid">
                      Paid
                    </option>

                    <option value="overdue">
                      Overdue
                    </option>
                  </select>
                </label>
              </div>

              <button
                type="submit"
                disabled={adding}
              >
                {adding
                  ? "Adding..."
                  : "Add Invoice"}
              </button>
            </form>
          )}
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Invoice Filters</h2>

              <p className="muted-text">
                Filter the register by payment status, number,
                amount or date.
              </p>
            </div>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={
                statusFilter === "all"
                  ? "active-tab"
                  : ""
              }
              onClick={() =>
                setStatusFilter("all")
              }
            >
              All
            </button>

            <button
              type="button"
              className={
                statusFilter === "pending"
                  ? "active-tab"
                  : ""
              }
              onClick={() =>
                setStatusFilter("pending")
              }
            >
              Pending
            </button>

            <button
              type="button"
              className={
                statusFilter === "paid"
                  ? "active-tab"
                  : ""
              }
              onClick={() =>
                setStatusFilter("paid")
              }
            >
              Paid
            </button>

            <button
              type="button"
              className={
                statusFilter === "overdue"
                  ? "active-tab"
                  : ""
              }
              onClick={() =>
                setStatusFilter("overdue")
              }
            >
              Overdue
            </button>
          </div>

          <input
            className="search-input"
            type="search"
            placeholder="Search invoice number, status, amount or date..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <div className="form-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={resetFilters}
            >
              Reset Filters
            </button>
          </div>

          <table>
            <tbody>
              <tr>
                <td>Current Status</td>
                <td>{statusFilter}</td>
              </tr>

              <tr>
                <td>Matching Invoices</td>
                <td className="number-cell">
                  {filteredInvoices.length}
                </td>
              </tr>

              <tr>
                <td>Matching Value</td>
                <td className="amount-cell">
                  {money(filteredTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {selectedInvoice && (
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>Invoice Preview</h2>

              <p className="muted-text">
                Quick invoice summary before editing or
                exporting.
              </p>
            </div>

            <button
              type="button"
              className="secondary-btn"
              onClick={() =>
                setSelectedInvoice(null)
              }
              disabled={deleting}
            >
              Close Preview
            </button>
          </div>

          <section className="summary-cards">
            <div className="card">
              <p>Invoice Number</p>

              <h2>
                {selectedInvoice.invoice_number || "-"}
              </h2>
            </div>

            <div className="card">
              <p>Amount</p>

              <h2>
                {money(selectedInvoice.amount)}
              </h2>
            </div>

            <div className="card">
              <p>Status</p>

              <h2>
                <span
                  className={getStatusClass(
                    selectedInvoice.status
                  )}
                >
                  {normaliseStatus(
                    selectedInvoice.status
                  )}
                </span>
              </h2>
            </div>

            <div className="card">
              <p>Created</p>

              <h2>
                {dateOnly(
                  selectedInvoice.created_at
                )}
              </h2>
            </div>
          </section>
        </section>
      )}

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Invoices Register</h2>

            <p className="muted-text">
              {filteredInvoices.length} matching invoice
              {filteredInvoices.length === 1 ? "" : "s"} with
              a total value of {money(filteredTotal)}.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
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
                  <td>
                    <button
                      type="button"
                      className="table-link-button"
                      onClick={() =>
                        setSelectedInvoice(invoice)
                      }
                      disabled={deleting}
                    >
                      {invoice.invoice_number || "-"}
                    </button>
                  </td>

                  <td className="amount-cell">
                    {money(invoice.amount)}
                  </td>

                  <td>
                    <span
                      className={getStatusClass(
                        invoice.status
                      )}
                    >
                      {normaliseStatus(invoice.status)}
                    </span>
                  </td>

                  <td>
                    {dateOnly(invoice.created_at)}
                  </td>

                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        onClick={() =>
                          startEdit(invoice)
                        }
                        disabled={
                          updating || deleting
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() =>
                          setSelectedInvoice(invoice)
                        }
                        disabled={deleting}
                      >
                        Preview
                      </button>

                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() =>
                          setDeleteTarget(invoice)
                        }
                        disabled={deleting}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredInvoices.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="empty-table-message"
                  >
                    No matching invoices found.
                  </td>
                </tr>
              )}
            </tbody>

            {filteredInvoices.length > 0 && (
              <tfoot>
                <tr>
                  <td>
                    <strong>Total</strong>
                  </td>

                  <td className="amount-cell">
                    <strong>
                      {money(filteredTotal)}
                    </strong>
                  </td>

                  <td colSpan="3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <DeleteVerificationModal
        open={Boolean(deleteTarget)}
        itemName={
          deleteTarget?.invoice_number || "invoice"
        }
        onCancel={() => {
          if (!deleting) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </>
  );
}

export default InvoicesPage;