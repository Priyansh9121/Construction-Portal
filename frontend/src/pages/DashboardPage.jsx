import StatCard from "../components/StatCard";

function DashboardPage({
  payments = [],
  workers = [],
  sites = [],
  tenders = [],
  invoices = [],
  subcontractors = [],
}) {
  const totalIncome = payments
    .filter((p) => p.payment_type === "Income")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalExpense = payments
    .filter((p) => p.payment_type === "Expense")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const balance = totalIncome - totalExpense;

  const activeWorkers = workers.filter(
    (worker) => worker.status === "active"
  ).length;

  const activeSites = sites.filter(
    (site) => site.status === "active"
  ).length;

  const runningTenders = tenders.filter(
    (tender) => tender.status === "running"
  ).length;

  const dueSoonTenders = tenders.filter(
    (tender) => tender.status === "due soon"
  ).length;

  const unpaidInvoices = invoices.filter(
    (invoice) => invoice.status !== "paid"
  ).length;

  const recentPayments = payments.slice(0, 5);
  const recentTenders = tenders.slice(0, 5);

  return (
    <>
      <section className="cards">
        <StatCard title="Company Balance" value={`$${balance.toFixed(2)}`} />
        <StatCard title="Total Income" value={`$${totalIncome.toFixed(2)}`} />
        <StatCard title="Total Expense" value={`$${totalExpense.toFixed(2)}`} />
        <StatCard title="Total Workers" value={workers.length} />
        <StatCard title="Active Workers" value={activeWorkers} />
        <StatCard title="Total Sites" value={sites.length} />
        <StatCard title="Active Sites" value={activeSites} />
        <StatCard title="Running Tenders" value={runningTenders} />
        <StatCard title="Due Soon Tenders" value={dueSoonTenders} />
        <StatCard title="Total Invoices" value={invoices.length} />
        <StatCard title="Unpaid Invoices" value={unpaidInvoices} />
        <StatCard title="Subcontractors" value={subcontractors.length} />
      </section>

      <section className="payment-grid">
        <div className="panel">
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
              {recentPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.payment_type}</td>
                  <td>{payment.category}</td>
                  <td>
                    {payment.payment_date
                      ? payment.payment_date.slice(0, 10)
                      : ""}
                  </td>
                  <td>{payment.description}</td>
                  <td>${Number(payment.amount).toFixed(2)}</td>
                </tr>
              ))}

              {recentPayments.length === 0 && (
                <tr>
                  <td colSpan="5">No payments added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>Recent Tenders</h2>

          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Description</th>
              </tr>
            </thead>

            <tbody>
              {recentTenders.map((tender) => (
                <tr key={tender.id}>
                  <td>{tender.title}</td>
                  <td>{tender.status}</td>
                  <td>
                    {tender.due_date
                      ? tender.due_date.slice(0, 10)
                      : ""}
                  </td>
                  <td>{tender.description}</td>
                </tr>
              ))}

              {recentTenders.length === 0 && (
                <tr>
                  <td colSpan="4">No tenders added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default DashboardPage;