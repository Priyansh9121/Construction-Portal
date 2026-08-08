/**
 * File purpose:
 * Line chart of income and expense over time.
 *
 * Props:
 * - The payment rows to plot, and a date range
 *
 * State and hooks:
 * - Derives its series with useMemo
 *
 * Rendered by:
 * - DashboardPage.jsx, FinanceOverview.jsx
 *
 * Important notes:
 * - Plots rows already loaded rather than querying an aggregate endpoint, so
 * - it reflects what the session has fetched.
 */

import EmptyState from "../dashboard/EmptyState";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Legend,
  } from "recharts";
  
  function FinanceTrendChart({ payments = [], emptyState = null }) {
    const monthlyData = Object.values(
      payments.reduce((acc, payment) => {
        const date = payment.payment_date || payment.created_at;
        if (!date) return acc;
  
        const month = date.slice(0, 7);
  
        if (!acc[month]) {
          acc[month] = {
            month,
            income: 0,
            expense: 0,
            profit: 0,
          };
        }
  
        if (payment.payment_type === "Income") {
          acc[month].income += Number(payment.amount || 0);
        }
  
        if (payment.payment_type === "Expense") {
          acc[month].expense += Number(payment.amount || 0);
        }
  
        acc[month].profit = acc[month].income - acc[month].expense;
  
        return acc;
      }, {})
    ).sort((a, b) => a.month.localeCompare(b.month));
  
    /*
     * DASH-003. A trend needs at least two months to BE a trend.
     *
     * OPT-IN, because this component is NOT Dashboard-only. PaymentsPage
     * renders it too (DASH-008). The first version of this guard applied
     * unconditionally and put a "Record a payment" link -- pointing at
     * /payments -- onto the /payments page itself, and changed the appearance
     * of an unmigrated route. A caller now has to ask for the empty state and
     * supply its own action, so the Dashboard gets it and Payments is
     * untouched until the finance route group is migrated.
     *
     * The chart previously rendered its axes and an empty 340px plot whatever
     * the data, so a brand-new company met a void that was the largest element
     * on the Dashboard. Hiding the section outright was rejected: the user
     * would never learn the view exists, and the page would gain an unexplained
     * gap in its rhythm. Instead the section keeps its title and explains
     * itself in a fraction of the height.
     *
     * The threshold is two months, not zero payments, because a single point
     * is not a trend either — plotting one month draws a chart that cannot
     * show direction and implies a measurement it does not have.
     */
    if (emptyState && monthlyData.length < 2) {
      const noPayments = monthlyData.length === 0;

      return (
        <div className="panel premium-chart-panel">
          <div className="section-title-row">
            <div>
              <h2>Monthly Finance Trend</h2>
              <p className="muted-text">
                Income, expenses and profit by month
              </p>
            </div>
          </div>

          <EmptyState
            title={noPayments ? "No payments recorded yet" : "Not enough history yet"}
            description={
              noPayments
                ? "Once payments are recorded, this shows how income and expenses move month by month."
                : "A trend needs at least two months of records. This fills in as the next month is recorded."
            }
            action={noPayments ? emptyState.action ?? null : null}
          />
        </div>
      );
    }

    return (
      <div className="panel premium-chart-panel">
        <div className="section-title-row">
          <div>
            <h2>Monthly Finance Trend</h2>
            <p className="muted-text">
              Income, expenses and profit by month
            </p>
          </div>
        </div>
  
        <div className="premium-chart-shell">
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
  
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
  
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
  
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
  
              <Area
                type="monotone"
                dataKey="income"
                stroke="#16a34a"
                strokeWidth={3}
                fill="url(#incomeGradient)"
                activeDot={{ r: 6 }}
                animationDuration={1200}
              />
  
              <Area
                type="monotone"
                dataKey="expense"
                stroke="#dc2626"
                strokeWidth={3}
                fill="url(#expenseGradient)"
                activeDot={{ r: 6 }}
                animationDuration={1400}
              />
  
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#2563eb"
                strokeWidth={3}
                fill="url(#profitGradient)"
                activeDot={{ r: 6 }}
                animationDuration={1600}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }
  
  export default FinanceTrendChart;