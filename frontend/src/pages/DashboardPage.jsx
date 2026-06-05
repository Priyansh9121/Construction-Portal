import StatCard from "../components/StatCard";

function DashboardPage({ payments, workers }) {
  const totalIncome = payments
    .filter((p) => p.payment_type === "Income")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalExpense = payments
    .filter((p) => p.payment_type === "Expense")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const balance = totalIncome - totalExpense;

  return (
    <>
      <section className="cards">
        <StatCard title="Company Balance" value={`$${balance.toFixed(2)}`} />
        <StatCard title="Total Income" value={`$${totalIncome.toFixed(2)}`} />
        <StatCard title="Total Expense" value={`$${totalExpense.toFixed(2)}`} />
        <StatCard title="Total Workers" value={workers.length} />
      </section>

      <section className="panel">
        <h2>Recent Payments</h2>

        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Category</th>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>

          <tbody>
            {payments.slice(0, 5).map((payment) => (
              <tr key={payment.id}>
                <td>{payment.payment_type}</td>
                <td>{payment.category}</td>
                <td>{payment.payment_date ? payment.payment_date.slice(0, 10) : ""}</td>
                <td>{payment.description}</td>
                <td>${Number(payment.amount).toFixed(2)}</td>
              </tr>
            ))}

            {payments.length === 0 && (
              <tr>
                <td colSpan="5">No payments added yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

export default DashboardPage;