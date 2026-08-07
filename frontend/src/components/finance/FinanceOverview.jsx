/**
 * File purpose:
 * The finance summary view: cards, chart and filters together.
 *
 * Props:
 * - The payment rows and the active filters
 *
 * State and hooks:
 * - useFinanceStatistics to derive the figures
 *
 * Rendered by:
 * - PaymentsPage.jsx, DashboardPage.jsx
 *
 * Renders:
 * - FinanceSummaryCards, FinanceTrendChart, FinanceFilters
 *
 * Important notes:
 * - Figures are derived client-side from loaded rows. GET /payments/summary
 * - aggregates the same thing in SQL; if the two disagree, the server figure
 * - is authoritative because it sees rows this page may not have loaded.
 */

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
      {/*
        V2-I038 / V2-I039 / V2-I040.
        --------------------------------------------------------------------
        Three things were wrong with the six cards this replaces.

        1. Tone was applied to FACTS. Total Expense was always
           `highlight-danger` — but an expense is normal business operation,
           not a failure — and Total Income was always `highlight-success`.
           Neither is a status. Spending the danger/success vocabulary on
           values that can never be good or bad is what makes a tint stop
           meaning anything.

        2. Tone was UNCONDITIONAL. Baki GST rendered amber and Baki Company
           Charge red even at zero — and zero outstanding is the good
           outcome. A warning that is always on is not a warning.

        3. Everything was the same size, so Balance — the figure someone
           opens this page to see — competed with Total Records.

        Now: Balance leads with the two figures it derives from; the
        outstanding amounts and the record count form the supporting band.
        Tone appears only where there is genuinely a status to report, and
        every toned card carries a text status too, so the state is never
        signalled by colour alone (UI/UX Pro Max "Color Only", severity High).

        The tiers are the Dashboard's `.v2-metrics`, deliberately — the two
        pages should read as one product.
      */}
      <section className="v2-metrics v2-metrics--primary" aria-label="Position">
        {/*
          Zero is neither a surplus nor a deficit, so it gets no tone. The
          original `balance >= 0` painted an empty ledger green and called
          it "In surplus", which is the same defect as the outstanding cards
          below — a status asserted where there is no status yet.
        */}
        <div
          className={
            balance > 0
              ? "card highlight-success"
              : balance < 0
                ? "card highlight-danger"
                : "card"
          }
        >
          <p>Balance</p>
          <h2>{money(balance)}</h2>
          <small>
            {balance > 0
              ? "In surplus"
              : balance < 0
                ? "In deficit"
                : "Nothing recorded"}
          </small>
        </div>

        <div className="card">
          <p>Total Income</p>
          <h2>{money(income)}</h2>
        </div>

        <div className="card">
          <p>Total Expense</p>
          <h2>{money(expense)}</h2>
        </div>
      </section>

      <section
        className="v2-metrics v2-metrics--secondary"
        aria-label="Outstanding"
      >
        <div className={gstPending > 0 ? "card highlight-warning" : "card"}>
          <p>Baki GST</p>
          <h2>{money(gstPending)}</h2>
          <small>{gstPending > 0 ? "Outstanding" : "Settled"}</small>
        </div>

        <div
          className={
            companyChargePending > 0 ? "card highlight-warning" : "card"
          }
        >
          <p>Baki Company Charge</p>
          <h2>{money(companyChargePending)}</h2>
          <small>
            {companyChargePending > 0 ? "Outstanding" : "Settled"}
          </small>
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