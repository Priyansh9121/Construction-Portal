import { formatCurrency } from "../../utils/currency";

const money = formatCurrency;
  
  const dateOnly = (value) => (value ? String(value).slice(0, 10) : "-");
  
  function getBadgeClass(type) {
    if (type === "Income") return "badge green";
    if (type === "Expense") return "badge yellow";
    return "badge blue";
  }
  
  function FinanceRecordsTable({
    payments = [],
    onEdit,
    onDelete,
    title = "Finance Records",
  }) {
    const totalAmount = payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );
  
    const totalGst = payments.reduce(
      (sum, payment) => sum + Number(payment.gst_amount || 0),
      0
    );
  
    return (
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>{title}</h2>
            <p className="muted-text">
              {payments.length} records • Total {money(totalAmount)} • GST{" "}
              {money(totalGst)}
            </p>
          </div>
        </div>
  
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Sub Type</th>
                <th>Category</th>
                <th>Amount</th>
                <th>GST / Charge</th>
                <th>Mode</th>
                <th>Details</th>
                <th>Action</th>
              </tr>
            </thead>
  
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{dateOnly(payment.payment_date || payment.created_at)}</td>
  
                  <td>
                    <span className={getBadgeClass(payment.payment_type)}>
                      {payment.payment_type || "-"}
                    </span>
                  </td>
  
                  <td>{payment.payment_sub_type || payment.record_type || "-"}</td>
                  <td>{payment.category || payment.payment_scope || "-"}</td>
                  <td className="amount-cell">{money(payment.amount)}</td>
                  <td className="amount-cell">{money(payment.gst_amount)}</td>
                  <td>{payment.payment_mode || "-"}</td>
                  <td>{payment.details || payment.description || "-"}</td>
  
                  <td>
                    {onEdit && (
                      <button type="button" onClick={() => onEdit(payment)}>
                        Edit
                      </button>
                    )}
  
                    {onDelete && (
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => onDelete(payment)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
  
              {payments.length === 0 && (
                <tr>
                  <td colSpan="9" className="empty-table-message">
                    No finance records found.
                  </td>
                </tr>
              )}
            </tbody>
  
            {payments.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="4">
                    <strong>Total</strong>
                  </td>
                  <td className="amount-cell">
                    <strong>{money(totalAmount)}</strong>
                  </td>
                  <td className="amount-cell">
                    <strong>{money(totalGst)}</strong>
                  </td>
                  <td colSpan="3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    );
  }
  
  export default FinanceRecordsTable;