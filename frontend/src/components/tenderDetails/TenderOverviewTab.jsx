import { formatCurrency } from "../../utils/currency";

function TenderOverviewTab({
  tenderValue = 0,
  remainingBudget = 0,
  documents = [],
  materialTotal = 0,
  bankingTotal = 0,
  dailyUpdates = [],
  tenderIncome = 0,
  totalTenderCost = 0,
  tenderProfit = 0,
  tenderProfitPercentage = 0,
  financeSummary = {},
  materialCost = 0,
  subcontractorCost = 0,
  bankingCost = 0,
}) {
  const money = formatCurrency;

  const percent = (value) =>
    `${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;

  const safeTenderValue = Number(tenderValue || 0);
  const safeTotalCost = Number(totalTenderCost || 0);
  const safeIncome = Number(tenderIncome || 0);

  const budgetUsedPercent =
    safeTenderValue > 0 ? Math.min((safeTotalCost / safeTenderValue) * 100, 100) : 0;

  const incomeProgressPercent =
    safeTenderValue > 0 ? Math.min((safeIncome / safeTenderValue) * 100, 100) : 0;

  const costRows = [
    {
      label: "Material Cost",
      value: materialCost,
      percent:
        safeTotalCost > 0 ? (Number(materialCost || 0) / safeTotalCost) * 100 : 0,
    },
    {
      label: "Subcontractor Cost",
      value: subcontractorCost,
      percent:
        safeTotalCost > 0
          ? (Number(subcontractorCost || 0) / safeTotalCost) * 100
          : 0,
    },
    {
      label: "Banking / Other Cost",
      value: bankingCost,
      percent:
        safeTotalCost > 0 ? (Number(bankingCost || 0) / safeTotalCost) * 100 : 0,
    },
  ];

  const healthStatus =
    tenderProfit > 0
      ? "Profitable"
      : tenderProfit < 0
      ? "Loss / Review Needed"
      : "Break-even";

  return (
    <>
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Tender Executive Overview</h2>
            <p className="muted-text">
              Budget, income, cost, profit, GST and operational progress summary.
            </p>
          </div>

          <span className={tenderProfit >= 0 ? "badge green" : "badge yellow"}>
            {healthStatus}
          </span>
        </div>

        <div className="summary-cards">
          <div className="card">
            <p>Tender Value</p>
            <h2>{money(tenderValue)}</h2>
          </div>

          <div className="card">
            <p>Tender Income</p>
            <h2>{money(tenderIncome)}</h2>
          </div>

          <div className="card">
            <p>Total Cost</p>
            <h2>{money(totalTenderCost)}</h2>
          </div>

          <div className={tenderProfit >= 0 ? "card highlight-success" : "card highlight-danger"}>
            <p>Profit / Loss</p>
            <h2>{money(tenderProfit)}</h2>
          </div>

          <div className="card">
            <p>Profit Margin</p>
            <h2>{percent(tenderProfitPercentage)}</h2>
          </div>

          <div className="card">
            <p>Remaining Budget</p>
            <h2>{money(remainingBudget)}</h2>
          </div>

          <div className="card highlight-warning">
            <p>Baki GST</p>
            <h2>{money(financeSummary?.gst_left)}</h2>
          </div>

          <div className="card highlight-danger">
            <p>Baki Company Charge</p>
            <h2>{money(financeSummary?.company_charge_left)}</h2>
          </div>

          <div className="card">
            <p>Documents</p>
            <h2>{documents.length}</h2>
          </div>

          <div className="card">
            <p>Daily Updates</p>
            <h2>{dailyUpdates.length}</h2>
          </div>

          <div className="card">
            <p>Material Total</p>
            <h2>{money(materialTotal)}</h2>
          </div>

          <div className="card">
            <p>Banking Total</p>
            <h2>{money(bankingTotal)}</h2>
          </div>
        </div>
      </section>

      <section className="dashboard-grid two-column-dashboard">
        <div className="panel">
          <h2>Budget Utilisation</h2>

          <div className="report-bar">
            <div
              className="report-bar-fill"
              style={{ width: `${budgetUsedPercent}%` }}
            />
          </div>

          <table>
            <tbody>
              <tr>
                <td>Budget Used</td>
                <td className="amount-cell">{percent(budgetUsedPercent)}</td>
              </tr>
              <tr>
                <td>Tender Value</td>
                <td className="amount-cell">{money(tenderValue)}</td>
              </tr>
              <tr>
                <td>Total Cost</td>
                <td className="amount-cell">{money(totalTenderCost)}</td>
              </tr>
              <tr>
                <td>Remaining Budget</td>
                <td className="amount-cell">{money(remainingBudget)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>Income Progress</h2>

          <div className="report-bar">
            <div
              className="report-bar-fill"
              style={{ width: `${incomeProgressPercent}%` }}
            />
          </div>

          <table>
            <tbody>
              <tr>
                <td>Income Collected</td>
                <td className="amount-cell">{percent(incomeProgressPercent)}</td>
              </tr>
              <tr>
                <td>Tender Income</td>
                <td className="amount-cell">{money(tenderIncome)}</td>
              </tr>
              <tr>
                <td>Overall Done</td>
                <td className="amount-cell">{money(financeSummary?.overall_done)}</td>
              </tr>
              <tr>
                <td>Overall Left</td>
                <td className="amount-cell">{money(financeSummary?.overall_left)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>Cost Breakdown</h2>

          <table>
            <thead>
              <tr>
                <th>Cost Type</th>
                <th>Amount</th>
                <th>% of Cost</th>
              </tr>
            </thead>

            <tbody>
              {costRows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className="amount-cell">{money(row.value)}</td>
                  <td className="amount-cell">{percent(row.percent)}</td>
                </tr>
              ))}

              <tr>
                <td>
                  <strong>Total Cost</strong>
                </td>
                <td className="amount-cell">
                  <strong>{money(totalTenderCost)}</strong>
                </td>
                <td className="amount-cell">
                  <strong>100.00%</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>Finance Control</h2>

          <table>
            <tbody>
              <tr>
                <td>GST Left</td>
                <td className="amount-cell">{money(financeSummary?.gst_left)}</td>
              </tr>
              <tr>
                <td>Company Charge Left</td>
                <td className="amount-cell">
                  {money(financeSummary?.company_charge_left)}
                </td>
              </tr>
              <tr>
                <td>Overall Done</td>
                <td className="amount-cell">{money(financeSummary?.overall_done)}</td>
              </tr>
              <tr>
                <td>Overall Left</td>
                <td className="amount-cell">{money(financeSummary?.overall_left)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Tender Profit Breakdown</h2>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>Tender Value</td>
                <td className="amount-cell">{money(tenderValue)}</td>
              </tr>

              <tr>
                <td>Tender Income</td>
                <td className="amount-cell">{money(tenderIncome)}</td>
              </tr>

              <tr>
                <td>Material Cost</td>
                <td className="amount-cell">{money(materialCost)}</td>
              </tr>

              <tr>
                <td>Subcontractor Cost</td>
                <td className="amount-cell">{money(subcontractorCost)}</td>
              </tr>

              <tr>
                <td>Banking / Other Cost</td>
                <td className="amount-cell">{money(bankingCost)}</td>
              </tr>

              <tr>
                <td>Total Cost</td>
                <td className="amount-cell">{money(totalTenderCost)}</td>
              </tr>

              <tr>
                <td>Remaining Budget</td>
                <td className="amount-cell">{money(remainingBudget)}</td>
              </tr>

              <tr>
                <td>Profit / Loss</td>
                <td className="amount-cell">{money(tenderProfit)}</td>
              </tr>

              <tr>
                <td>Profit Percentage</td>
                <td className="amount-cell">{percent(tenderProfitPercentage)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default TenderOverviewTab;