import { useMemo, useState } from "react";

function ReportsPage({
  payments = [],
  workers = [],
  sites = [],
  tenders = [],
  invoices = [],
}) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [paymentType, setPaymentType] = useState("all");
  const [invoiceStatus, setInvoiceStatus] = useState("all");

  const money = (value) =>
    `$${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const inDateRange = (dateValue) => {
    if (!dateValue) return true;
    const date = new Date(dateValue);
    if (fromDate && date < new Date(fromDate)) return false;
    if (toDate && date > new Date(toDate)) return false;
    return true;
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const typeMatch = paymentType === "all" || p.payment_type === paymentType;
      return typeMatch && inDateRange(p.payment_date || p.created_at);
    });
  }, [payments, paymentType, fromDate, toDate]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((i) => {
      const statusMatch = invoiceStatus === "all" || i.status === invoiceStatus;
      return statusMatch && inDateRange(i.created_at);
    });
  }, [invoices, invoiceStatus, fromDate, toDate]);

  const totalIncome = filteredPayments
    .filter((p) => p.payment_type === "Income")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalExpense = filteredPayments
    .filter((p) => p.payment_type === "Expense")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const balance = totalIncome - totalExpense;

  const invoiceTotal = filteredInvoices.reduce(
    (sum, i) => sum + Number(i.amount || 0),
    0
  );

  const paidInvoiceTotal = filteredInvoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const unpaidInvoiceTotal = filteredInvoices
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const categoryTotals = filteredPayments.reduce((acc, payment) => {
    const category = payment.category || "Other";
    acc[category] = (acc[category] || 0) + Number(payment.amount || 0);
    return acc;
  }, {});

  const maxCategoryAmount = Math.max(...Object.values(categoryTotals), 1);

  const tenderStats = {
    running: tenders.filter((t) => t.status === "running").length,
    passed: tenders.filter((t) => t.status === "passed").length,
    dueSoon: tenders.filter((t) => t.status === "due soon").length,
  };

  const workerStats = {
    active: workers.filter((w) => w.status === "active").length,
    inactive: workers.filter((w) => w.status === "inactive").length,
  };

  const siteStats = {
    personal: sites.filter((s) => s.site_type === "Personal Site").length,
    subcontractor: sites.filter((s) => s.site_type === "Subcontractor Site")
      .length,
    active: sites.filter((s) => s.status === "active").length,
    completed: sites.filter((s) => s.status === "completed").length,
  };

  const exportCSV = () => {
    const rows = [
      ["Report Type", "Name", "Type/Status", "Amount"],
      ["Payment", "Total Income", "Income", totalIncome],
      ["Payment", "Total Expense", "Expense", totalExpense],
      ["Payment", "Balance", "Profit/Loss", balance],
      ["Invoice", "Total Invoice Amount", "All", invoiceTotal],
      ["Invoice", "Paid Invoice Amount", "Paid", paidInvoiceTotal],
      ["Invoice", "Unpaid Invoice Amount", "Pending/Overdue", unpaidInvoiceTotal],
      ...Object.entries(categoryTotals).map(([category, amount]) => [
        "Category",
        category,
        "Payment Category",
        amount,
      ]),
    ];

    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "construction-report.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>Financial, tender, site, worker and invoice overview.</p>
        </div>

        <button className="primary-btn" onClick={exportCSV}>
          Export CSV
        </button>
      </div>

      <section className="panel">
        <h2>Report Filters</h2>

        <div className="form-grid">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />

          <select
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
          >
            <option value="all">All Payment Types</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
            <option value="Investment">Investment</option>
            <option value="Loan">Loan</option>
            <option value="Return">Return</option>
          </select>

          <select
            value={invoiceStatus}
            onChange={(e) => setInvoiceStatus(e.target.value)}
          >
            <option value="all">All Invoice Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </section>

      <section className="cards">
        <div className="card">
          <p>Total Income</p>
          <h2>{money(totalIncome)}</h2>
        </div>

        <div className="card">
          <p>Total Expense</p>
          <h2>{money(totalExpense)}</h2>
        </div>

        <div className="card">
          <p>Balance</p>
          <h2>{money(balance)}</h2>
        </div>

        <div className="card">
          <p>Unpaid Invoices</p>
          <h2>{money(unpaidInvoiceTotal)}</h2>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <h2>Payment Category Chart</h2>

          {Object.keys(categoryTotals).length === 0 ? (
            <p>No payment data found for selected filters.</p>
          ) : (
            <div className="report-chart">
              {Object.entries(categoryTotals).map(([category, amount]) => (
                <div className="report-bar-row" key={category}>
                  <div className="report-bar-label">{category}</div>
                  <div className="report-bar-track">
                    <div
                      className="report-bar-fill"
                      style={{
                        width: `${(amount / maxCategoryAmount) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="report-bar-value">{money(amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Invoice Summary</h2>

          <table>
          <tbody>
            <tr>
              <td>Total Invoices</td>
              <td className="number-cell">{filteredInvoices.length}</td>
            </tr>
            <tr>
              <td>Paid Invoices</td>
              <td className="number-cell">
                {filteredInvoices.filter((i) => i.status === "paid").length}
              </td>
            </tr>
            <tr>
              <td>Pending Invoices</td>
              <td className="number-cell">
                {filteredInvoices.filter((i) => i.status === "pending").length}
              </td>
            </tr>
            <tr>
              <td>Overdue Invoices</td>
              <td className="number-cell">
                {filteredInvoices.filter((i) => i.status === "overdue").length}
              </td>
            </tr>
            <tr>
              <td>Total Invoice Amount</td>
              <td className="amount-cell">{money(invoiceTotal)}</td>
            </tr>
            <tr>
              <td>Paid Amount</td>
              <td className="amount-cell">{money(paidInvoiceTotal)}</td>
            </tr>
            <tr>
              <td>Pending / Unpaid Amount</td>
              <td className="amount-cell">{money(unpaidInvoiceTotal)}</td>
            </tr>
          </tbody>
          </table>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <h2>Tender Summary</h2>

          <table>
            <tbody>
              <tr>
                <td>Running Tenders</td>
                <td className="number-cell">{tenderStats.running}</td>
              </tr>
              <tr>
                <td>Passed Tenders</td>
                <td className="number-cell">{tenderStats.passed}</td>
              </tr>
              <tr>
                <td>Due Soon Tenders</td>
                <td className="number-cell">{tenderStats.dueSoon}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>Site & Worker Summary</h2>

          <table>
            <tbody>
              <tr>
                <td>Personal Sites</td>
                <td className="number-cell">{siteStats.personal}</td>
              </tr>
              <tr>
                <td>Subcontractor Sites</td>
                <td className="number-cell">{siteStats.subcontractor}</td>
              </tr>
              <tr>
                <td>Active Sites</td>
                <td className="number-cell">{siteStats.active}</td>
              </tr>
              <tr>
                <td>Completed Sites</td>
                <td className="number-cell">{siteStats.completed}</td>
              </tr>
              <tr>
                <td>Active Workers</td>
                <td className="number-cell">{workerStats.active}</td>
              </tr>
              <tr>
                <td>Inactive Workers</td>
                <td className="number-cell">{workerStats.inactive}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default ReportsPage;