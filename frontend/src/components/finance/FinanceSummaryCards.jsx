import { formatCurrency } from "../../utils/currency";

const money = formatCurrency;
  
  function FinanceSummaryCards({ summary = {} }) {
    const netProfit = Number(summary.netProfit || 0);
    const gstLeft = Number(summary.gstLeft || summary.gst_left || 0);
    const companyChargeLeft = Number(
      summary.companyChargeLeft || summary.company_charge_left || 0
    );
  
    return (
      <section className="summary-cards">
        <div className="card highlight-success">
          <p>Total Income</p>
          <h2>{money(summary.totalIncome)}</h2>
        </div>
  
        <div className="card highlight-danger">
          <p>Total Expense</p>
          <h2>{money(summary.totalExpense)}</h2>
        </div>
  
        <div className={netProfit >= 0 ? "card highlight-success" : "card highlight-danger"}>
          <p>Net Profit</p>
          <h2>{money(netProfit)}</h2>
        </div>
  
        <div className="card">
          <p>GST Total</p>
          <h2>{money(summary.gstTotal)}</h2>
        </div>
  
        <div className="card">
          <p>GST Returned</p>
          <h2>{money(summary.gstReturned)}</h2>
        </div>
  
        <div className={gstLeft > 0 ? "card highlight-warning" : "card highlight-success"}>
          <p>Baki GST</p>
          <h2>{money(gstLeft)}</h2>
        </div>
  
        <div className="card">
          <p>Company Charge</p>
          <h2>{money(summary.companyChargeTotal)}</h2>
        </div>
  
        <div className="card">
          <p>Company Charge Paid</p>
          <h2>{money(summary.companyChargePaid)}</h2>
        </div>
  
        <div className={companyChargeLeft > 0 ? "card highlight-danger" : "card highlight-success"}>
          <p>Baki Company Charge</p>
          <h2>{money(companyChargeLeft)}</h2>
        </div>
      </section>
    );
  }
  
  export default FinanceSummaryCards;