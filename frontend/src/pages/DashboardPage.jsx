import { Link } from "react-router-dom";
import StatCard from "../components/StatCard";

function DashboardPage({
  payments = [],
  workers = [],
  sites = [],
  tenders = [],
  invoices = [],
  subcontractors = [],
}) {
  const money = (value) => `$${Number(value || 0).toFixed(2)}`;

  const totalIncome = payments
    .filter((p) => p.payment_type === "Income")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalExpense = payments
    .filter((p) => p.payment_type === "Expense")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const balance = totalIncome - totalExpense;

  const activeWorkers = workers.filter((worker) => worker.status === "active").length;
  const activeSites = sites.filter((site) => site.status === "active").length;

  const runningTenders = tenders.filter((tender) => tender.status === "running").length;
  const dueSoonTenders = tenders.filter((tender) => tender.status === "due soon").length;

  const pendingInvoices = invoices.filter((invoice) => invoice.status === "pending").length;
  const overdueInvoices = invoices.filter((invoice) => invoice.status === "overdue").length;

  const invoiceTotal = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount || 0),
    0
  );

  const pendingInvoiceTotal = invoices
    .filter((invoice) => invoice.status !== "paid")
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  const recentPayments = payments.slice(0, 5);
  const recentTenders = tenders.slice(0, 5);
  const recentInvoices = invoices.slice(0, 5);

  return (
    <>
      <section className="quick-actions">
        <Link to="/payments">Add Payment</Link>
        <Link to="/invoices">Add Invoice</Link>
        <Link to="/tenders">View Tenders</Link>
        <Link to="/daily-site-updates">Daily Updates</Link>
      </section>

      <section className="cards dashboard-cards">
        <StatCard title="Company Balance" value={money(balance)} />
        <StatCard title="Total Income" value={money(totalIncome)} />
        <StatCard title="Total Expense" value={money(totalExpense)} />
        <StatCard title="Invoice Total" value={money(invoiceTotal)} />

        <StatCard title="Pending Invoice Amount" value={money(pendingInvoiceTotal)} />
        <StatCard title="Pending Invoices" value={pendingInvoices} />
        <StatCard title="Overdue Invoices" value={overdueInvoices} />
        <StatCard title="Running Tenders" value={runningTenders} />

        <StatCard title="Due Soon Tenders" value={dueSoonTenders} />
        <StatCard title="Active Sites" value={activeSites} />
        <StatCard title="Active Workers" value={activeWorkers} />
        <StatCard title="Subcontractors" value={subcontractors.length} />
      </section>

      <section className="dashboard-grid two-column-dashboard">
        <div className="panel">
          <div className="section-title-row">
            <h2>Recent Payments</h2>
            <Link to="/payments">View all</Link>
          </div>

          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Category</th>
                <th>Date</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {recentPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.payment_type}</td>
                  <td>{payment.category}</td>
                  <td>{payment.payment_date ? payment.payment_date.slice(0, 10) : ""}</td>
                  <td className="amount-cell">{money(payment.amount)}</td>
                </tr>
              ))}

              {recentPayments.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty-table-message">
                    No payments added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <h2>Recent Invoices</h2>
            <Link to="/invoices">View all</Link>
          </div>

          <table>
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>
              {recentInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoice_number}</td>
                  <td className="amount-cell">{money(invoice.amount)}</td>
                  <td>{invoice.status}</td>
                  <td>{invoice.created_at ? invoice.created_at.slice(0, 10) : ""}</td>
                </tr>
              ))}

              {recentInvoices.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty-table-message">
                    No invoices added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <h2>Recent Tenders</h2>
            <Link to="/tenders">View all</Link>
          </div>

          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Due Date</th>
              </tr>
            </thead>

            <tbody>
              {recentTenders.map((tender) => (
                <tr key={tender.id}>
                  <td>{tender.title}</td>
                  <td>{tender.status}</td>
                  <td>{tender.due_date ? tender.due_date.slice(0, 10) : ""}</td>
                </tr>
              ))}

              {recentTenders.length === 0 && (
                <tr>
                  <td colSpan="3" className="empty-table-message">
                    No tenders added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>Work Overview</h2>

          <table>
            <tbody>
              <tr>
                <td>Total Workers</td>
                <td className="number-cell">{workers.length}</td>
              </tr>
              <tr>
                <td>Total Sites</td>
                <td className="number-cell">{sites.length}</td>
              </tr>
              <tr>
                <td>Total Tenders</td>
                <td className="number-cell">{tenders.length}</td>
              </tr>
              <tr>
                <td>Total Subcontractors</td>
                <td className="number-cell">{subcontractors.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default DashboardPage;