function ReportsPage({
  payments = [],
  workers = [],
  sites = [],
  tenders = [],
  invoices = [],
}) {
  const totalIncome = payments
    .filter((p) => p.payment_type === "Income")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalExpense = payments
    .filter((p) => p.payment_type === "Expense")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const balance = totalIncome - totalExpense;

  const governmentPayments = payments
    .filter((p) => p.category === "Government Payment")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const workerSalaries = payments
    .filter((p) => p.category === "Worker Salary")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const subcontractorPayments = payments
    .filter((p) => p.category === "Subcontractor Payment")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const materialPurchases = payments
    .filter((p) => p.category === "Material Purchase")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const runningTenders = tenders.filter((t) => t.status === "running").length;
  const passedTenders = tenders.filter((t) => t.status === "passed").length;
  const dueSoonTenders = tenders.filter((t) => t.status === "due soon").length;

  const activeWorkers = workers.filter((w) => w.status === "active").length;
  const inactiveWorkers = workers.filter((w) => w.status === "inactive").length;

  const personalSites = sites.filter((s) => s.site_type === "Personal Site").length;
  const subcontractorSites = sites.filter(
    (s) => s.site_type === "Subcontractor Site"
  ).length;

  const activeSites = sites.filter((s) => s.status === "active").length;
  const completedSites = sites.filter((s) => s.status === "completed").length;
  const pendingSites = sites.filter((s) => s.status === "pending").length;

  const pendingInvoices = invoices.filter((i) => i.status === "pending").length;
  const paidInvoices = invoices.filter((i) => i.status === "paid").length;
  const overdueInvoices = invoices.filter((i) => i.status === "overdue").length;

  const invoiceTotal = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount || 0),
    0
  );

  const paidInvoiceTotal = invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  const pendingInvoiceTotal = invoices
    .filter((invoice) => invoice.status !== "paid")
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  return (
    <>
      <section className="cards">
        <div className="card">
          <p>Company Balance</p>
          <h2>${balance.toFixed(2)}</h2>
        </div>

        <div className="card">
          <p>Total Income</p>
          <h2>${totalIncome.toFixed(2)}</h2>
        </div>

        <div className="card">
          <p>Total Expense</p>
          <h2>${totalExpense.toFixed(2)}</h2>
        </div>

        <div className="card">
          <p>Profit / Loss</p>
          <h2>${balance.toFixed(2)}</h2>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <h2>Financial Report</h2>

          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Total Amount</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>Government Payments</td>
                <td>${governmentPayments.toFixed(2)}</td>
              </tr>

              <tr>
                <td>Worker Salaries</td>
                <td>${workerSalaries.toFixed(2)}</td>
              </tr>

              <tr>
                <td>Subcontractor Payments</td>
                <td>${subcontractorPayments.toFixed(2)}</td>
              </tr>

              <tr>
                <td>Material Purchases</td>
                <td>${materialPurchases.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>Tender Report</h2>

          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Count</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>Running</td>
                <td>{runningTenders}</td>
              </tr>

              <tr>
                <td>Passed</td>
                <td>{passedTenders}</td>
              </tr>

              <tr>
                <td>Due Soon</td>
                <td>{dueSoonTenders}</td>
              </tr>

              <tr>
                <td>Total Tenders</td>
                <td>{tenders.length}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>Workforce Report</h2>

          <table>
            <thead>
              <tr>
                <th>Worker Status</th>
                <th>Count</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>Active Workers</td>
                <td>{activeWorkers}</td>
              </tr>

              <tr>
                <td>Inactive Workers</td>
                <td>{inactiveWorkers}</td>
              </tr>

              <tr>
                <td>Total Workers</td>
                <td>{workers.length}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>Site Report</h2>

          <table>
            <thead>
              <tr>
                <th>Site Type / Status</th>
                <th>Count</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>Personal Sites</td>
                <td>{personalSites}</td>
              </tr>

              <tr>
                <td>Subcontractor Sites</td>
                <td>{subcontractorSites}</td>
              </tr>

              <tr>
                <td>Active Sites</td>
                <td>{activeSites}</td>
              </tr>

              <tr>
                <td>Completed Sites</td>
                <td>{completedSites}</td>
              </tr>

              <tr>
                <td>Pending Sites</td>
                <td>{pendingSites}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>Invoice Report</h2>

          <table>
            <thead>
              <tr>
                <th>Invoice Metric</th>
                <th>Value</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>Total Invoices</td>
                <td>{invoices.length}</td>
              </tr>

              <tr>
                <td>Paid Invoices</td>
                <td>{paidInvoices}</td>
              </tr>

              <tr>
                <td>Pending Invoices</td>
                <td>{pendingInvoices}</td>
              </tr>

              <tr>
                <td>Overdue Invoices</td>
                <td>{overdueInvoices}</td>
              </tr>

              <tr>
                <td>Total Invoice Amount</td>
                <td>${invoiceTotal.toFixed(2)}</td>
              </tr>

              <tr>
                <td>Paid Invoice Amount</td>
                <td>${paidInvoiceTotal.toFixed(2)}</td>
              </tr>

              <tr>
                <td>Pending / Unpaid Amount</td>
                <td>${pendingInvoiceTotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default ReportsPage;