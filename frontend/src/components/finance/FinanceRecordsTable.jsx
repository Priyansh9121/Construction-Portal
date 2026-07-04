const money = (value) => `$${Number(value || 0).toFixed(2)}`;

function FinanceRecordsTable({
  payments = [],
  onEdit,
  onDelete,
  title = "Finance Records",
}) {
  return (
    <div className="panel">
      <h2>{title}</h2>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Sub Type</th>
              <th>Category</th>
              <th>Amount</th>
              <th>GST</th>
              <th>Mode</th>
              <th>Details</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.payment_date?.slice(0, 10)}</td>
                <td>{payment.payment_type}</td>
                <td>{payment.payment_sub_type}</td>
                <td>{payment.category}</td>
                <td>{money(payment.amount)}</td>
                <td>{money(payment.gst_amount)}</td>
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
                <td colSpan="9">No finance records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FinanceRecordsTable;