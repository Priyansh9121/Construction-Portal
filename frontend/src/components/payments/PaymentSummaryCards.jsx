import { money } from "../../utils/paymentHelpers";

function PaymentSummaryCards({ summary }) {
  return (
    <section className="summary-cards">
      <div className="card">
        <p>Total Income</p>
        <h2>{money(summary.totalIncome)}</h2>
      </div>

      <div className="card">
        <p>Total Expense</p>
        <h2>{money(summary.totalExpense)}</h2>
      </div>

      <div className="card">
        <p>Balance</p>
        <h2>{money(summary.balance)}</h2>
      </div>

      <div
        className="card"
        style={{
          background: "#e8f5e9",
          border: "2px solid #28a745",
        }}
      >
        <p>Government GST Received</p>
        <h2>{money(summary.governmentGstReceived)}</h2>
      </div>

      <div
        className="card"
        style={{
          background: "#ffe5e5",
          border: "2px solid #dc3545",
        }}
      >
        <p>Company Charges</p>
        <h2>{money(summary.companyCharges)}</h2>
      </div>

      <div
        className="card"
        style={{
          background: "#fff3cd",
          border: "2px solid #fd7e14",
        }}
      >
        <p>GST Remaining</p>
        <h2>{money(summary.gstRemaining)}</h2>
      </div>
    </section>
  );
}

export default PaymentSummaryCards;