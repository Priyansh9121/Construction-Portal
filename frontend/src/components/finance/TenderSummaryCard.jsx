import { money } from "../../utils/financeHelper";

function TenderSummaryCard({ selectedTender, payments = [] }) {
  if (!selectedTender) return null;

  const tenderPayments = payments.filter(
    (payment) => Number(payment.tender_id) === Number(selectedTender.id)
  );

  const income = tenderPayments
    .filter((payment) => payment.payment_type === "Income")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const expense = tenderPayments
    .filter((payment) => payment.payment_type === "Expense")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const gstTotal = tenderPayments
    .filter((payment) => payment.payment_sub_type === "GOVERNMENT_BILL")
    .reduce((sum, payment) => sum + Number(payment.gst_amount || 0), 0);

  const gstDone = tenderPayments
    .filter((payment) => payment.payment_sub_type === "GST_RETURN")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const companyTotal = tenderPayments
    .filter((payment) => payment.payment_sub_type === "COMPANY_CHARGE")
    .reduce(
      (sum, payment) => sum + Number(payment.gst_amount || payment.amount || 0),
      0
    );

  const companyDone = tenderPayments
    .filter((payment) => payment.payment_sub_type === "COMPANY_CHARGE_PAYMENT")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const estimatedValue = Number(selectedTender.estimated_value || 0);
  const profit = income - expense;
  const margin = income > 0 ? (profit / income) * 100 : 0;
  const budgetUsed = estimatedValue > 0 ? (expense / estimatedValue) * 100 : 0;

  return (
    <div className="payment-tender-summary panel">
      <div className="section-title-row">
        <div>
          <h3>{selectedTender.title || selectedTender.tender_name}</h3>
          <p className="muted-text">
            Tender finance snapshot before saving this record.
          </p>
        </div>

        <span
          className={
            selectedTender.status === "running"
              ? "badge green"
              : selectedTender.status === "completed"
              ? "badge blue"
              : "badge yellow"
          }
        >
          {selectedTender.status || "-"}
        </span>
      </div>

      <div className="summary-cards">
        <div className="card">
          <p>Tender Value</p>
          <h2>{money(estimatedValue)}</h2>
        </div>

        <div className="card highlight-success">
          <p>Income</p>
          <h2>{money(income)}</h2>
        </div>

        <div className="card highlight-danger">
          <p>Expense</p>
          <h2>{money(expense)}</h2>
        </div>

        <div className={profit >= 0 ? "card highlight-success" : "card highlight-danger"}>
          <p>Profit</p>
          <h2>{money(profit)}</h2>
        </div>

        <div className="card">
          <p>Margin</p>
          <h2>{margin.toFixed(2)}%</h2>
        </div>

        <div className="card highlight-warning">
          <p>GST Left</p>
          <h2>{money(gstTotal - gstDone)}</h2>
        </div>

        <div className="card highlight-danger">
          <p>Company Charge Left</p>
          <h2>{money(companyTotal - companyDone)}</h2>
        </div>
      </div>

      <div className="report-bar">
        <div
          className="report-bar-fill"
          style={{ width: `${Math.min(budgetUsed, 100)}%` }}
        />
      </div>

      <p className="muted-text">
        Budget used: {budgetUsed.toFixed(2)}%
      </p>
    </div>
  );
}

export default TenderSummaryCard;