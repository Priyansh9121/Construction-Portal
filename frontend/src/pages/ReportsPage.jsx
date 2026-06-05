function ReportsPage({
    payments,
    workers,
    sites,
    tenders,
    invoices,
  }) {
    const totalIncome = payments
      .filter((p) => p.payment_type === "Income")
      .reduce((sum, p) => sum + Number(p.amount), 0);
  
    const totalExpense = payments
      .filter((p) => p.payment_type === "Expense")
      .reduce((sum, p) => sum + Number(p.amount), 0);
  
    const balance = totalIncome - totalExpense;
  
    const pendingInvoices = invoices.filter(
      (invoice) => invoice.status === "pending"
    ).length;
  
    const paidInvoices = invoices.filter(
      (invoice) => invoice.status === "paid"
    ).length;
  
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
            <p>Total Workers</p>
            <h2>{workers.length}</h2>
          </div>
        </section>
  
        <section className="summary-cards">
          <div className="card">
            <p>Total Sites</p>
            <h2>{sites.length}</h2>
          </div>
  
          <div className="card">
            <p>Total Tenders</p>
            <h2>{tenders.length}</h2>
          </div>
  
          <div className="card">
            <p>Total Invoices</p>
            <h2>{invoices.length}</h2>
          </div>
        </section>
  
        <section className="panel">
          <h2>Invoice Report</h2>
  
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Count</th>
              </tr>
            </thead>
  
            <tbody>
              <tr>
                <td>Pending</td>
                <td>{pendingInvoices}</td>
              </tr>
  
              <tr>
                <td>Paid</td>
                <td>{paidInvoices}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </>
    );
  }
  
  export default ReportsPage;