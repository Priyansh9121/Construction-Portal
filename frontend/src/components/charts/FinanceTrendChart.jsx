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
  
  function FinanceTrendChart({ payments = [] }) {
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