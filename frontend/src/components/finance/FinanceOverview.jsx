import { money } from "../../utils/financeHelper";

function FinanceOverview({ totals = {} }) {
  const income = Number(totals.totalIncome || 0);
  const expense = Number(totals.totalExpense || 0);
  const balance = Number(totals.balance || income - expense || 0);
  const gstPending = Number(totals.gstPending || 0);
  const companyChargePending = Number(totals.companyChargePending || 0);

  const expenseRatio = income > 0 ? Math.min((expense / income) * 100, 100) : 0;
  const profitRatio = income > 0 ? (balance / income) * 100 : 0;

  return (
    <>
      <section className="cards dashboard-cards">
        <div className="card highlight-success">
          <p>Total Income</p>
          <h2>{money(income)}</h2>
        </div>

        <div className="card highlight-danger">
          <p>Total Expense</p>
          <h2>{money(expense)}</h2>
        </div>

        <div className={balance >= 0 ? "card highlight-success" : "card highlight-danger"}>
          <p>Balance</p>
          <h2>{money(balance)}</h2>
        </div>

        <div className="card highlight-warning">
          <p>Baki GST</p>
          <h2>{money(gstPending)}</h2>
        </div>

        <div className="card highlight-danger">
          <p>Baki Company Charge</p>
          <h2>{money(companyChargePending)}</h2>
        </div>

        <div className="card">
          <p>Total Records</p>
          <h2>{totals.recordCount || 0}</h2>
        </div>
      </section>

      <section className="dashboard-grid two-column-dashboard">
        <div className="panel">
          <h2>Expense Ratio</h2>

          <div className="report-bar">
            <div
              className="report-bar-fill"
              style={{ width: `${expenseRatio}%` }}
            />
          </div>

          <table>
            <tbody>
              <tr>
                <td>Income</td>
                <td className="amount-cell">{money(income)}</td>
              </tr>
              <tr>
                <td>Expense</td>
                <td className="amount-cell">{money(expense)}</td>
              </tr>
              <tr>
                <td>Expense %</td>
                <td className="amount-cell">{expenseRatio.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>Profit Ratio</h2>

          <div className="report-bar">
            <div
              className="report-bar-fill"
              style={{ width: `${Math.max(Math.min(profitRatio, 100), 0)}%` }}
            />
          </div>

          <table>
            <tbody>
              <tr>
                <td>Balance</td>
                <td className="amount-cell">{money(balance)}</td>
              </tr>
              <tr>
                <td>Profit %</td>
                <td className="amount-cell">{profitRatio.toFixed(2)}%</td>
              </tr>
              <tr>
                <td>Finance Status</td>
                <td>
                  <span className={balance >= 0 ? "badge green" : "badge yellow"}>
                    {balance >= 0 ? "Healthy" : "Needs Review"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default FinanceOverview;