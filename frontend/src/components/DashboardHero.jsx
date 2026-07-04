import { motion } from "framer-motion";

function DashboardHero({
  totalIncome = 0,
  totalExpense = 0,
  netProfit = 0,
  runningTenders = 0,
}) {
  const hour = new Date().getHours();

  const greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  const money = (value) => `$${Number(value || 0).toLocaleString()}`;

  return (
    <motion.section
      className="dashboard-hero"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      <div>
        <p className="dashboard-hero-eyebrow">{greeting}</p>
        <h1>Construction Portal</h1>
        <p className="dashboard-hero-subtitle">
          Track finance, tenders, sites, workers and project progress in one place.
        </p>
      </div>

      <div className="dashboard-hero-stats">
        <div>
          <span>Income</span>
          <strong>{money(totalIncome)}</strong>
        </div>

        <div>
          <span>Expense</span>
          <strong>{money(totalExpense)}</strong>
        </div>

        <div>
          <span>Profit</span>
          <strong>{money(netProfit)}</strong>
        </div>

        <div>
          <span>Running</span>
          <strong>{runningTenders}</strong>
        </div>
      </div>
    </motion.section>
  );
}

export default DashboardHero;