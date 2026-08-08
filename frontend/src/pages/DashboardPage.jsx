/**
 * File purpose:
 * The landing screen for office users: headline figures and recent activity.
 *
 * State:
 * - Mostly derived. Receives the shared collections from App.jsx.
 *
 * Hooks and context:
 * - useFinanceStatistics to derive the finance cards
 *
 * API endpoints:
 * - Reads data already loaded by App.jsx's hooks; calls subcontractorService
 * - directly for its own counts
 *
 * Parent:
 * - AppLayout, via AppRoutes
 *
 * Navigation and children:
 * - Renders AttentionSpine, BusinessHealth, Pipeline, FinanceTrendChart
 * - and ActivityStream.
 *
 * Important notes:
 * - Office-only. Workers and subcontractors land on their portals instead —
 * - see getHomePath in RoleRoute.jsx.
 * - Figures here are derived client-side from rows already loaded, so they
 * - reflect what this session has fetched rather than a server aggregate.
 */

import { Link } from "react-router-dom";
import FinanceTrendChart from "../components/charts/FinanceTrendChart";
import AttentionSpine from "../components/dashboard/AttentionSpine";
import BusinessHealth from "../components/dashboard/BusinessHealth";
import Pipeline from "../components/dashboard/Pipeline";
import ActivityStream from "../components/dashboard/ActivityStream";
import ExportButtons from "../components/export/ExportButtons";
import { formatCurrency } from "../utils/currency";
import { useEffect, useState } from "react";
import { getSubcontractors } from "../services/subcontractorService";
import { useAuth } from "../contexts/authContext";


/**
 * A bullet-style ratio row.
 *
 * UI/UX Pro Max returns Bullet Chart for "multiple KPIs side by side;
 * space-constrained contexts where a gauge is too large" — which is exactly
 * these four percentages, previously rendered as bare text in a table cell.
 * A number alone gives no sense of position; a bar does, at a glance, in the
 * same vertical space.
 *
 * Not a gauge, donut or progress circle: all three cost far more width for
 * less precision, and none of them sit inside a table row.
 *
 * The fill animates from 0 to its value once, on mount, via a CSS transition
 * on inline-size. Under reduced motion the transition is dropped and the bar
 * is simply already at its value — nothing is lost, because the bar itself is
 * the information, not its arrival.
 *
 * `role="img"` with an aria-label gives a screen reader the value as a
 * sentence rather than a decorative bar. The exact figure is still printed
 * beside it, so nothing depends on the graphic.
 */
function RatioRow({ label, value, tone }) {
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    // Next frame, so the browser paints 0 first and the transition runs.
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

  return (
    <tr>
      <td>{label}</td>
      <td className="amount-cell">
        <span className="v2-ratio">
          <span
            className="v2-ratio__track"
            role="img"
            aria-label={`${label}: ${safe.toFixed(2)} percent`}
          >
            <span
              className="v2-ratio__fill"
              data-tone={tone}
              style={{ inlineSize: grown ? `${safe}%` : "0%" }}
            />
          </span>

          <span className="v2-ratio__value">{safe.toFixed(2)}%</span>
        </span>
      </td>
    </tr>
  );
}


function DashboardPage({
  payments = [],
  workers = [],
  sites = [],
  tenders = [],
  invoices = [],
}) {
  // Presentation only — the greeting needs a name. No permission or data
  // decision is taken from this.
  const { user } = useAuth();

  const money = formatCurrency;

  const normaliseStatus = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

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

  const [
    subcontractors,
    setSubcontractors,
  ] = useState([]);

  useEffect(() => {
    let cancelled = false;
  
    const loadSubcontractors =
      async () => {
        try {
          const data =
            await getSubcontractors();
  
          const records =
            Array.isArray(data)
              ? data
              : data?.subcontractors ||
                data?.data
                  ?.subcontractors ||
                data?.data ||
                [];
  
          if (!cancelled) {
            setSubcontractors(
              Array.isArray(records)
                ? records
                : []
            );
          }
        } catch (error) {
          console.error(
            "Failed to load subcontractors:",
            error.response?.data ||
              error
          );
  
          if (!cancelled) {
            setSubcontractors([]);
          }
        }
      };
  
    loadSubcontractors();
  
    return () => {
      cancelled = true;
    };
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

  const activeSubcontractors = (
    Array.isArray(subcontractors)
      ? subcontractors
      : []
  ).filter(
    (subcontractor) =>
      normaliseStatus(subcontractor.status) === "active"
  ).length;

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

  return (
    <>
  
      {/*
        D1. The page opens with the OBJECTS that need the user, not counts of
        them. This replaced DashboardHero's six count tiles and absorbed the
        "Suggested Next Actions" table 900 lines below, which showed the same
        six counts a second time.

        It takes the tender and invoice rows directly, because the objects it
        names live in them. Nothing new is fetched and no figure elsewhere on
        the page changed.
      */}
      <AttentionSpine
        userName={user?.full_name || ""}
        tenders={tenders}
        invoices={invoices}
      />

      {/*
        D2. Twelve equal-weight metric cards and a "Today's Finance" panel
        stood here: twenty-one figures, nine of them arithmetic restatements of
        the others, with income, expense and profit each appearing three times
        because the page rendered {metric x timeframe} as sibling cards.

        BusinessHealth states the POSITION once and puts the FLOWS behind a
        single timeframe control. It derives its own figures from the same
        payment and invoice rows, so nothing new is fetched.
      */}
      <BusinessHealth
        payments={payments}
        invoices={invoices}
        actions={
          <ExportButtons
            filename="dashboard-summary"
            title="Executive Dashboard Summary"
            subtitle="Construction Portal company performance snapshot"
            rows={dashboardExportRows}
            columns={dashboardExportColumns}
            summary={dashboardExportSummary}
          />
        }
      />

      {/*
        D3. "Project Portfolio" (4 filled status tiles), "Project Status" (9
        table rows) and "Upcoming Tenders" (a table of the next seven days)
        stood here and below. Between them Running was counted twice, Pending
        twice, Completed three times, Overdue twice and Due Soon twice.

        Crucially, "Upcoming Tenders" rendered `dueSoonTenders`, which is
        exactly the set the attention spine already shows as objects at the top
        of this page. Pipeline therefore takes the COMPLEMENT of the attention
        window: work that is running now or due beyond it, so no tender is ever
        shown twice.
      */}
      <Pipeline tenders={tenders} />

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

              <RatioRow
                label="Profit Margin"
                value={profitMargin}
                tone="success"
              />

              <RatioRow
                label="Expense Ratio"
                value={expenseRatio}
                tone="warning"
              />

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

              <RatioRow
                label="Collection Rate"
                value={invoiceCollectionRate}
                tone="success"
              />
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-grid">
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


      {/*
        D4. A tab strip over six tables stood here: Recent Payments, Recent
        Invoices, Recent Tenders, Recent Workers and Recent Sites. Six
        interfaces organised by database table, each with its own heading and
        its own "View all".

        ActivityStream is one chronological stream. Workers and sites are
        deliberately absent: neither carries any timestamp, and the old tables
        sorted them by row id and called the result "recent". See the
        component header.
      */}
      <ActivityStream
        payments={payments}
        invoices={invoices}
        tenders={tenders}
      />

    </>
  );
}

export default DashboardPage;