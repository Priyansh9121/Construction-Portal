import { Link } from "react-router-dom";
import AnimatedStatCard from "../components/AnimatedStatCard";
import FinanceTrendChart from "../components/charts/FinanceTrendChart";
import DashboardHero from "../components/DashboardHero";
import ExportButtons from "../components/export/ExportButtons";
import { formatCurrency } from "../utils/currency";
import { useEffect, useState } from "react";
import { getSubcontractors } from "../services/subcontractorService";

function DashboardPage({
  payments = [],
  workers = [],
  sites = [],
  tenders = [],
  invoices = [],
}) {
  const money = formatCurrency;

  const dateOnly = (value) =>
    value ? String(value).slice(0, 10) : "-";

  const normaliseStatus = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const getStatusClass = (status) => {
    const value = normaliseStatus(status);

    if (
      [
        "active",
        "approved",
        "paid",
        "running",
        "completed",
        "passed",
      ].includes(value)
    ) {
      return "badge green";
    }

    if (
      ["overdue", "rejected", "inactive", "failed"].includes(value)
    ) {
      return "badge red";
    }

    return "badge yellow";
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const next7Days = new Date(today);
  next7Days.setDate(next7Days.getDate() + 7);

  const isCurrentMonth = (value) => {
    if (!value) return false;

    const date = new Date(value);

    return (
      date.getMonth() === currentMonth &&
      date.getFullYear() === currentYear
    );
  };

  const isToday = (value) => {
    if (!value) return false;

    const date = new Date(value);
    date.setHours(0, 0, 0, 0);

    return date.getTime() === today.getTime();
  };

  const [subcontractors, setSubcontractors] = useState([]);

  useEffect(() => {
    const loadSubcontractors = async () => {
      try {
        const data = await getSubcontractors();
        setSubcontractors(data || []);
      } catch (error) {
        console.error("Failed to load subcontractors", error);
      }
    };
  
    loadSubcontractors();
  }, []);

  const incomePayments = payments.filter(
    (payment) => payment.payment_type === "Income"
  );

  const expensePayments = payments.filter(
    (payment) => payment.payment_type === "Expense"
  );

  const totalIncome = incomePayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  const totalExpense = expensePayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  const netProfit = totalIncome - totalExpense;

  const monthIncome = incomePayments
    .filter((payment) =>
      isCurrentMonth(payment.payment_date || payment.created_at)
    )
    .reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

  const monthExpense = expensePayments
    .filter((payment) =>
      isCurrentMonth(payment.payment_date || payment.created_at)
    )
    .reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

  const monthProfit = monthIncome - monthExpense;

  const todayIncome = incomePayments
    .filter((payment) =>
      isToday(payment.payment_date || payment.created_at)
    )
    .reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

  const todayExpense = expensePayments
    .filter((payment) =>
      isToday(payment.payment_date || payment.created_at)
    )
    .reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

  const gstTotal = payments
    .filter(
      (payment) =>
        payment.payment_sub_type === "GOVERNMENT_BILL"
    )
    .reduce(
      (sum, payment) =>
        sum +
        Number(
          payment.gst_amount ||
            payment.gst_total ||
            0
        ),
      0
    );

  const gstReturned = payments
    .filter(
      (payment) =>
        payment.payment_sub_type === "GST_RETURN"
    )
    .reduce(
      (sum, payment) =>
        sum +
        Number(
          payment.gst_done ||
            payment.amount ||
            0
        ),
      0
    );

  const gstPending = gstTotal - gstReturned;

  const companyChargeTotal = payments
    .filter(
      (payment) =>
        payment.payment_sub_type === "COMPANY_CHARGE"
    )
    .reduce(
      (sum, payment) =>
        sum +
        Number(
          payment.company_charge_total ||
            payment.gst_amount ||
            payment.amount ||
            0
        ),
      0
    );

  const companyChargePaid = payments
    .filter(
      (payment) =>
        payment.payment_sub_type ===
        "COMPANY_CHARGE_PAYMENT"
    )
    .reduce(
      (sum, payment) =>
        sum + Number(payment.amount || 0),
      0
    );

  const companyChargePending =
    companyChargeTotal - companyChargePaid;

  const activeWorkers = workers.filter(
    (worker) =>
      normaliseStatus(worker.status) === "active"
  ).length;

  const inactiveWorkers = workers.length - activeWorkers;

  const activeSites = sites.filter(
    (site) => normaliseStatus(site.status) === "active"
  ).length;

  const inactiveSites = sites.length - activeSites;

  const runningTenders = tenders.filter(
    (tender) =>
      normaliseStatus(tender.status) === "running"
  ).length;

  const pendingTenders = tenders.filter(
    (tender) =>
      normaliseStatus(tender.status) === "pending"
  ).length;

  const completedTenders = tenders.filter((tender) =>
    ["completed", "passed"].includes(
      normaliseStatus(tender.status)
    )
  ).length;

  const dueSoonTenders = tenders
    .filter((tender) => {
      if (!tender.due_date) return false;

      const dueDate = new Date(tender.due_date);
      dueDate.setHours(0, 0, 0, 0);

      return (
        dueDate >= today &&
        dueDate <= next7Days &&
        !["completed", "passed"].includes(
          normaliseStatus(tender.status)
        )
      );
    })
    .sort(
      (a, b) =>
        new Date(a.due_date || 0) -
        new Date(b.due_date || 0)
    );

  const overdueTenders = tenders.filter((tender) => {
    if (!tender.due_date) return false;

    const dueDate = new Date(tender.due_date);
    dueDate.setHours(0, 0, 0, 0);

    return (
      dueDate < today &&
      !["completed", "passed"].includes(
        normaliseStatus(tender.status)
      )
    );
  });

  const estimatedTenderValue = tenders.reduce(
    (sum, tender) =>
      sum + Number(tender.estimated_value || 0),
    0
  );

  const runningTenderValue = tenders
    .filter(
      (tender) =>
        normaliseStatus(tender.status) === "running"
    )
    .reduce(
      (sum, tender) =>
        sum + Number(tender.estimated_value || 0),
      0
    );

  const paidInvoices = invoices.filter(
    (invoice) =>
      normaliseStatus(invoice.status) === "paid"
  );

  const pendingInvoices = invoices.filter(
    (invoice) =>
      normaliseStatus(invoice.status) === "pending"
  );

  const overdueInvoices = invoices.filter(
    (invoice) =>
      normaliseStatus(invoice.status) === "overdue"
  );

  const invoiceTotal = invoices.reduce(
    (sum, invoice) =>
      sum + Number(invoice.amount || 0),
    0
  );

  const paidInvoiceTotal = paidInvoices.reduce(
    (sum, invoice) =>
      sum + Number(invoice.amount || 0),
    0
  );

  const pendingInvoiceTotal = invoices
    .filter(
      (invoice) =>
        normaliseStatus(invoice.status) !== "paid"
    )
    .reduce(
      (sum, invoice) =>
        sum + Number(invoice.amount || 0),
      0
    );

  const overdueInvoiceTotal = overdueInvoices.reduce(
    (sum, invoice) =>
      sum + Number(invoice.amount || 0),
    0
  );

  const activeSubcontractors = subcontractors.filter(
    (subcontractor) =>
      normaliseStatus(subcontractor.status) === "active"
  ).length;

  const recentPayments = [...payments]
    .sort(
      (a, b) =>
        new Date(
          b.payment_date || b.created_at || 0
        ) -
        new Date(
          a.payment_date || a.created_at || 0
        )
    )
    .slice(0, 6);

  const recentInvoices = [...invoices]
    .sort(
      (a, b) =>
        new Date(b.created_at || 0) -
        new Date(a.created_at || 0)
    )
    .slice(0, 6);

  const recentTenders = [...tenders]
    .sort(
      (a, b) =>
        new Date(
          b.created_at || b.due_date || 0
        ) -
        new Date(
          a.created_at || a.due_date || 0
        )
    )
    .slice(0, 6);

  const recentWorkers = [...workers]
    .sort(
      (a, b) =>
        Number(b.id || 0) - Number(a.id || 0)
    )
    .slice(0, 6);

  const recentSites = [...sites]
    .sort(
      (a, b) =>
        Number(b.id || 0) - Number(a.id || 0)
    )
    .slice(0, 6);

  const cashPosition =
    totalIncome -
    totalExpense -
    Math.max(gstPending, 0) -
    Math.max(companyChargePending, 0);

  const profitMargin =
    totalIncome > 0
      ? (netProfit / totalIncome) * 100
      : 0;

  const expenseRatio =
    totalIncome > 0
      ? (totalExpense / totalIncome) * 100
      : 0;

  const invoiceCollectionRate =
    invoiceTotal > 0
      ? (paidInvoiceTotal / invoiceTotal) * 100
      : 0;

  const tenderCompletionRate =
    tenders.length > 0
      ? (completedTenders / tenders.length) * 100
      : 0;

  const dashboardExportRows = [
    {
      metric: "Total Income",
      value: money(totalIncome),
    },
    {
      metric: "Total Expense",
      value: money(totalExpense),
    },
    {
      metric: "Net Profit",
      value: money(netProfit),
    },
    {
      metric: "Current Month Income",
      value: money(monthIncome),
    },
    {
      metric: "Current Month Expense",
      value: money(monthExpense),
    },
    {
      metric: "Current Month Profit",
      value: money(monthProfit),
    },
    {
      metric: "GST Outstanding",
      value: money(gstPending),
    },
    {
      metric: "Company Charge Outstanding",
      value: money(companyChargePending),
    },
    {
      metric: "Invoice Value",
      value: money(invoiceTotal),
    },
    {
      metric: "Outstanding Invoice Value",
      value: money(pendingInvoiceTotal),
    },
    {
      metric: "Running Tenders",
      value: runningTenders,
    },
    {
      metric: "Pending Tenders",
      value: pendingTenders,
    },
    {
      metric: "Completed Tenders",
      value: completedTenders,
    },
    {
      metric: "Due Soon Tenders",
      value: dueSoonTenders.length,
    },
    {
      metric: "Overdue Tenders",
      value: overdueTenders.length,
    },
    {
      metric: "Active Sites",
      value: activeSites,
    },
    {
      metric: "Active Workers",
      value: activeWorkers,
    },
    {
      metric: "Active Subcontractors",
      value: activeSubcontractors,
    },
  ];

  const dashboardExportColumns = [
    { key: "metric", label: "Metric" },
    { key: "value", label: "Value" },
  ];

  const dashboardExportSummary = {
    "Total Income": money(totalIncome),
    "Total Expense": money(totalExpense),
    "Net Profit": money(netProfit),
    "Profit Margin": `${profitMargin.toFixed(2)}%`,
    "GST Outstanding": money(gstPending),
    "Company Charge Outstanding": money(
      companyChargePending
    ),
    "Invoice Outstanding": money(
      pendingInvoiceTotal
    ),
    "Running Tenders": runningTenders,
    "Active Sites": activeSites,
    "Active Workers": activeWorkers,
  };

  const quickActions = [
    {
      label: "Add Finance Entry",
      description: "Record income or expense",
      path: "/payments",
    },
    {
      label: "Add Worker",
      description: "Manage labour records",
      path: "/workers",
    },
    {
      label: "Add Site",
      description: "Create construction site",
      path: "/sites",
    },
    {
      label: "Add Tender",
      description: "Create project tender",
      path: "/tenders",
    },
    {
      label: "Add Invoice",
      description: "Record a new invoice",
      path: "/invoices",
    },
    {
      label: "Daily Update",
      description: "Submit progress update",
      path: "/daily-site-updates",
    },
    {
      label: "Worker Money",
      description: "Review worker allocations",
      path: "/worker-money",
    },
    {
      label: "Reports Centre",
      description: "Export executive reports",
      path: "/reports",
    },
  ];

  const nextActions = [
    {
      label: "Pending invoices to review",
      value: pendingInvoices.length,
      path: "/invoices",
      urgent: pendingInvoices.length > 0,
    },
    {
      label: "Overdue invoices",
      value: overdueInvoices.length,
      path: "/invoices",
      urgent: overdueInvoices.length > 0,
    },
    {
      label: "Tenders due within 7 days",
      value: dueSoonTenders.length,
      path: "/tenders",
      urgent: dueSoonTenders.length > 0,
    },
    {
      label: "Overdue tenders",
      value: overdueTenders.length,
      path: "/tenders",
      urgent: overdueTenders.length > 0,
    },
    {
      label: "Inactive workers",
      value: inactiveWorkers,
      path: "/workers",
      urgent: false,
    },
    {
      label: "Inactive sites",
      value: inactiveSites,
      path: "/sites",
      urgent: false,
    },
  ];

  return (
    <>
  
      <DashboardHero
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        netProfit={netProfit}
        runningTenders={runningTenders}
      />

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Executive Dashboard</h2>

            <p className="muted-text">
              Finance, projects, invoices, workers and operational
              priorities in one live company overview.
            </p>
          </div>

          <ExportButtons
            filename="dashboard-summary"
            title="Executive Dashboard Summary"
            subtitle="Construction Portal company performance snapshot"
            rows={dashboardExportRows}
            columns={dashboardExportColumns}
            summary={dashboardExportSummary}
          />
        </div>

        <section className="quick-actions">
          {quickActions.map((action) => (
            <Link key={action.path} to={action.path}>
              <strong>{action.label}</strong>
              <small>{action.description}</small>
            </Link>
          ))}
        </section>
      </section>

      <section className="cards dashboard-cards">
        <AnimatedStatCard
          title="Total Income"
          value={totalIncome}
          currency
        />

        <AnimatedStatCard
          title="Total Expense"
          value={totalExpense}
          currency
        />

        <AnimatedStatCard
          title="Net Profit"
          value={netProfit}
          currency
        />

        <AnimatedStatCard
          title="Month Income"
          value={monthIncome}
          currency
        />

        <AnimatedStatCard
          title="Month Expense"
          value={monthExpense}
          currency
        />

        <AnimatedStatCard
          title="Month Profit"
          value={monthProfit}
          currency
        />

        <AnimatedStatCard
          title="GST Outstanding"
          value={gstPending}
          currency
        />

        <AnimatedStatCard
          title="Company Charge Outstanding"
          value={companyChargePending}
          currency
        />

        <AnimatedStatCard
          title="Invoice Outstanding"
          value={pendingInvoiceTotal}
          currency
        />

        <AnimatedStatCard
          title="Cash Position"
          value={cashPosition}
          currency
        />

        <AnimatedStatCard
          title="Running Tenders"
          value={runningTenders}
        />

        <AnimatedStatCard
          title="Active Workers"
          value={activeWorkers}
        />
      </section>

      <section className="dashboard-grid two-column-dashboard">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Today's Finance</h2>
              <p className="muted-text">
                Transactions recorded today.
              </p>
            </div>

            <Link to="/payments">Open Finance</Link>
          </div>

          <section className="summary-cards">
            <div className="card highlight-success">
              <p>Today's Income</p>
              <h2>{money(todayIncome)}</h2>
            </div>

            <div className="card highlight-danger">
              <p>Today's Expense</p>
              <h2>{money(todayExpense)}</h2>
            </div>

            <div
              className={
                todayIncome - todayExpense >= 0
                  ? "card highlight-success"
                  : "card highlight-danger"
              }
            >
              <p>Today's Net</p>
              <h2>
                {money(todayIncome - todayExpense)}
              </h2>
            </div>
          </section>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Project Portfolio</h2>
              <p className="muted-text">
                Tender pipeline and portfolio value.
              </p>
            </div>

            <Link to="/tenders">View Tenders</Link>
          </div>

          <section className="summary-cards">
            <div className="card highlight-success">
              <p>Running</p>
              <h2>{runningTenders}</h2>
            </div>

            <div className="card highlight-warning">
              <p>Pending</p>
              <h2>{pendingTenders}</h2>
            </div>

            <div className="card">
              <p>Completed</p>
              <h2>{completedTenders}</h2>
            </div>

            <div className="card highlight-danger">
              <p>Overdue</p>
              <h2>{overdueTenders.length}</h2>
            </div>
          </section>
        </div>
      </section>

      <FinanceTrendChart payments={payments} />

      <section className="dashboard-grid two-column-dashboard">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Finance Health</h2>
              <p className="muted-text">
                Company profitability and obligations.
              </p>
            </div>

            <Link to="/payments">Open Finance</Link>
          </div>

          <table>
            <tbody>
              <tr>
                <td>Total Income</td>
                <td className="amount-cell">
                  {money(totalIncome)}
                </td>
              </tr>

              <tr>
                <td>Total Expense</td>
                <td className="amount-cell">
                  {money(totalExpense)}
                </td>
              </tr>

              <tr>
                <td>Net Profit</td>
                <td className="amount-cell">
                  {money(netProfit)}
                </td>
              </tr>

              <tr>
                <td>Profit Margin</td>
                <td className="amount-cell">
                  {profitMargin.toFixed(2)}%
                </td>
              </tr>

              <tr>
                <td>Expense Ratio</td>
                <td className="amount-cell">
                  {expenseRatio.toFixed(2)}%
                </td>
              </tr>

              <tr>
                <td>GST Outstanding</td>
                <td className="amount-cell">
                  {money(gstPending)}
                </td>
              </tr>

              <tr>
                <td>Company Charge Outstanding</td>
                <td className="amount-cell">
                  {money(companyChargePending)}
                </td>
              </tr>

              <tr>
                <td>Estimated Cash Position</td>
                <td className="amount-cell">
                  <strong>{money(cashPosition)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Invoice Health</h2>
              <p className="muted-text">
                Billing and collection overview.
              </p>
            </div>

            <Link to="/invoices">View Invoices</Link>
          </div>

          <table>
            <tbody>
              <tr>
                <td>Total Invoice Value</td>
                <td className="amount-cell">
                  {money(invoiceTotal)}
                </td>
              </tr>

              <tr>
                <td>Paid Invoice Value</td>
                <td className="amount-cell">
                  {money(paidInvoiceTotal)}
                </td>
              </tr>

              <tr>
                <td>Outstanding Invoice Value</td>
                <td className="amount-cell">
                  {money(pendingInvoiceTotal)}
                </td>
              </tr>

              <tr>
                <td>Overdue Invoice Value</td>
                <td className="amount-cell">
                  {money(overdueInvoiceTotal)}
                </td>
              </tr>

              <tr>
                <td>Paid Invoices</td>
                <td className="number-cell">
                  {paidInvoices.length}
                </td>
              </tr>

              <tr>
                <td>Pending Invoices</td>
                <td className="number-cell">
                  {pendingInvoices.length}
                </td>
              </tr>

              <tr>
                <td>Overdue Invoices</td>
                <td className="number-cell">
                  {overdueInvoices.length}
                </td>
              </tr>

              <tr>
                <td>Collection Rate</td>
                <td className="amount-cell">
                  {invoiceCollectionRate.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-grid two-column-dashboard">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Project Status</h2>
              <p className="muted-text">
                Tender performance and current workload.
              </p>
            </div>

            <Link to="/tenders">View Tenders</Link>
          </div>

          <table>
            <tbody>
              <tr>
                <td>Total Tenders</td>
                <td className="number-cell">
                  {tenders.length}
                </td>
              </tr>

              <tr>
                <td>Running</td>
                <td className="number-cell">
                  {runningTenders}
                </td>
              </tr>

              <tr>
                <td>Pending</td>
                <td className="number-cell">
                  {pendingTenders}
                </td>
              </tr>

              <tr>
                <td>Completed / Passed</td>
                <td className="number-cell">
                  {completedTenders}
                </td>
              </tr>

              <tr>
                <td>Due Soon</td>
                <td className="number-cell">
                  {dueSoonTenders.length}
                </td>
              </tr>

              <tr>
                <td>Overdue</td>
                <td className="number-cell">
                  {overdueTenders.length}
                </td>
              </tr>

              <tr>
                <td>Completion Rate</td>
                <td className="amount-cell">
                  {tenderCompletionRate.toFixed(2)}%
                </td>
              </tr>

              <tr>
                <td>Running Tender Value</td>
                <td className="amount-cell">
                  {money(runningTenderValue)}
                </td>
              </tr>

              <tr>
                <td>Total Estimated Value</td>
                <td className="amount-cell">
                  {money(estimatedTenderValue)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Operational Capacity</h2>
              <p className="muted-text">
                Workforce, sites and subcontractor coverage.
              </p>
            </div>
          </div>

          <table>
            <tbody>
              <tr>
                <td>Total Workers</td>
                <td className="number-cell">
                  {workers.length}
                </td>
              </tr>

              <tr>
                <td>Active Workers</td>
                <td className="number-cell">
                  {activeWorkers}
                </td>
              </tr>

              <tr>
                <td>Inactive Workers</td>
                <td className="number-cell">
                  {inactiveWorkers}
                </td>
              </tr>

              <tr>
                <td>Total Sites</td>
                <td className="number-cell">
                  {sites.length}
                </td>
              </tr>

              <tr>
                <td>Active Sites</td>
                <td className="number-cell">
                  {activeSites}
                </td>
              </tr>

              <tr>
                <td>Inactive Sites</td>
                <td className="number-cell">
                  {inactiveSites}
                </td>
              </tr>

              <tr>
                <td>Total Subcontractors</td>
                <td className="number-cell">
                  {subcontractors.length}
                </td>
              </tr>

              <tr>
                <td>Active Subcontractors</td>
                <td className="number-cell">
                  {activeSubcontractors}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-grid two-column-dashboard">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Recent Payments</h2>
              <p className="muted-text">
                Latest income and expense entries.
              </p>
            </div>

            <Link to="/payments">View all</Link>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                {recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      {dateOnly(
                        payment.payment_date ||
                          payment.created_at
                      )}
                    </td>

                    <td>
                      <span
                        className={getStatusClass(
                          payment.payment_type
                        )}
                      >
                        {payment.payment_type || "-"}
                      </span>
                    </td>

                    <td>
                      {payment.description ||
                        payment.details ||
                        payment.payment_sub_type ||
                        "-"}
                    </td>

                    <td className="amount-cell">
                      {money(payment.amount)}
                    </td>
                  </tr>
                ))}

                {recentPayments.length === 0 && (
                  <tr>
                    <td
                      colSpan="4"
                      className="empty-table-message"
                    >
                      No payments added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Upcoming Tenders</h2>
              <p className="muted-text">
                Tenders due in the next seven days.
              </p>
            </div>

            <Link to="/tenders">View all</Link>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Tender</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Value</th>
                </tr>
              </thead>

              <tbody>
                {dueSoonTenders
                  .slice(0, 6)
                  .map((tender) => (
                    <tr key={tender.id}>
                      <td>
                        <Link
                          to={`/tenders/${tender.id}`}
                          className="table-link-button"
                        >
                          {tender.title ||
                            tender.tender_name ||
                            "-"}
                        </Link>
                      </td>

                      <td>
                        <span
                          className={getStatusClass(
                            tender.status
                          )}
                        >
                          {tender.status || "-"}
                        </span>
                      </td>

                      <td>{dateOnly(tender.due_date)}</td>

                      <td className="amount-cell">
                        {money(tender.estimated_value)}
                      </td>
                    </tr>
                  ))}

                {dueSoonTenders.length === 0 && (
                  <tr>
                    <td
                      colSpan="4"
                      className="empty-table-message"
                    >
                      No tenders are due in the next seven days.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="dashboard-grid two-column-dashboard">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Recent Invoices</h2>
              <p className="muted-text">
                Latest billing records and statuses.
              </p>
            </div>

            <Link to="/invoices">View all</Link>
          </div>

          <div className="table-wrapper">
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
                    <td>
                      {invoice.invoice_number || "-"}
                    </td>

                    <td className="amount-cell">
                      {money(invoice.amount)}
                    </td>

                    <td>
                      <span
                        className={getStatusClass(
                          invoice.status
                        )}
                      >
                        {invoice.status || "-"}
                      </span>
                    </td>

                    <td>
                      {dateOnly(invoice.created_at)}
                    </td>
                  </tr>
                ))}

                {recentInvoices.length === 0 && (
                  <tr>
                    <td
                      colSpan="4"
                      className="empty-table-message"
                    >
                      No invoices added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Recent Tenders</h2>
              <p className="muted-text">
                Recently created or updated tenders.
              </p>
            </div>

            <Link to="/tenders">View all</Link>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Tender</th>
                  <th>Status</th>
                  <th>Value</th>
                  <th>Due</th>
                </tr>
              </thead>

              <tbody>
                {recentTenders.map((tender) => (
                  <tr key={tender.id}>
                    <td>
                      <Link
                        to={`/tenders/${tender.id}`}
                        className="table-link-button"
                      >
                        {tender.title ||
                          tender.tender_name ||
                          "-"}
                      </Link>
                    </td>

                    <td>
                      <span
                        className={getStatusClass(
                          tender.status
                        )}
                      >
                        {tender.status || "-"}
                      </span>
                    </td>

                    <td className="amount-cell">
                      {money(tender.estimated_value)}
                    </td>

                    <td>{dateOnly(tender.due_date)}</td>
                  </tr>
                ))}

                {recentTenders.length === 0 && (
                  <tr>
                    <td
                      colSpan="4"
                      className="empty-table-message"
                    >
                      No tenders added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="dashboard-grid two-column-dashboard">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Recent Workers</h2>
              <p className="muted-text">
                Latest worker records in the portal.
              </p>
            </div>

            <Link to="/workers">View all</Link>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Role</th>
                  <th>Salary</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {recentWorkers.map((worker) => (
                  <tr key={worker.id}>
                    <td>{worker.full_name || "-"}</td>
                    <td>{worker.role || "-"}</td>

                    <td className="amount-cell">
                      {money(worker.salary)}
                    </td>

                    <td>
                      <span
                        className={getStatusClass(
                          worker.status
                        )}
                      >
                        {worker.status || "-"}
                      </span>
                    </td>
                  </tr>
                ))}

                {recentWorkers.length === 0 && (
                  <tr>
                    <td
                      colSpan="4"
                      className="empty-table-message"
                    >
                      No workers added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Recent Sites</h2>
              <p className="muted-text">
                Latest construction sites in the portal.
              </p>
            </div>

            <Link to="/sites">View all</Link>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Type</th>
                  <th>Address</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {recentSites.map((site) => (
                  <tr key={site.id}>
                    <td>
                      <Link
                        to={`/sites/${site.id}`}
                        className="table-link-button"
                      >
                        {site.site_name || "-"}
                      </Link>
                    </td>

                    <td>{site.site_type || "-"}</td>
                    <td>{site.address || "-"}</td>

                    <td>
                      <span
                        className={getStatusClass(
                          site.status
                        )}
                      >
                        {site.status || "-"}
                      </span>
                    </td>
                  </tr>
                ))}

                {recentSites.length === 0 && (
                  <tr>
                    <td
                      colSpan="4"
                      className="empty-table-message"
                    >
                      No sites added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Suggested Next Actions</h2>

            <p className="muted-text">
              Items that may need operational or financial attention.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Open Items</th>
                <th>Priority</th>
                <th>Open Module</th>
              </tr>
            </thead>

            <tbody>
              {nextActions.map((action) => (
                <tr key={action.label}>
                  <td>{action.label}</td>

                  <td className="number-cell">
                    {action.value}
                  </td>

                  <td>
                    <span
                      className={
                        action.urgent && action.value > 0
                          ? "badge red"
                          : action.value > 0
                          ? "badge yellow"
                          : "badge green"
                      }
                    >
                      {action.urgent && action.value > 0
                        ? "Attention"
                        : action.value > 0
                        ? "Review"
                        : "Clear"}
                    </span>
                  </td>

                  <td>
                    <Link to={action.path}>Open</Link>
                  </td>
                </tr>
              ))}

              <tr>
                <td>Generate executive company report</td>
                <td className="number-cell">—</td>
                <td>
                  <span className="badge blue">
                    Reporting
                  </span>
                </td>
                <td>
                  <Link to="/reports">
                    Open Reports Centre
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default DashboardPage;