const money = (value) => `$${Number(value || 0).toFixed(2)}`;

function FinanceSummaryCards({ summary = {} }) {
  return (
    <div className="summary-cards">
      <div className="card">
        <p>Total Income</p>
        <h2>{money(summary.totalIncome)}</h2>
      </div>

      <div className="card">
        <p>Total Expense</p>
        <h2>{money(summary.totalExpense)}</h2>
      </div>

      <div className="card">
        <p>Net Profit</p>
        <h2>{money(summary.netProfit)}</h2>
      </div>

      <div className="card">
        <p>GST Total</p>
        <h2>{money(summary.gstTotal)}</h2>
      </div>

      <div className="card">
        <p>GST Returned</p>
        <h2>{money(summary.gstReturned)}</h2>
      </div>

      <div className="card">
        <p>Baki GST</p>
        <h2>{money(summary.gstLeft)}</h2>
      </div>

      <div className="card">
        <p>Company Charge</p>
        <h2>{money(summary.companyChargeTotal)}</h2>
      </div>

      <div className="card">
        <p>Company Charge Paid</p>
        <h2>{money(summary.companyChargePaid)}</h2>
      </div>

      <div className="card">
        <p>Baki Company Charge</p>
        <h2>{money(summary.companyChargeLeft)}</h2>
      </div>
    </div>
  );
}

export default FinanceSummaryCards;