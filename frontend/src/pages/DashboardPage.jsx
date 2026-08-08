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
 * - Renders AttentionSpine, AnimatedStatCard and FinanceTrendChart.
 *
 * Important notes:
 * - Office-only. Workers and subcontractors land on their portals instead —
 * - see getHomePath in RoleRoute.jsx.
 * - Figures here are derived client-side from rows already loaded, so they
 * - reflect what this session has fetched rather than a server aggregate.
 */

import { Link } from "react-router-dom";
import AppLink from "../components/ui/AppLink";
import AnimatedStatCard from "../components/AnimatedStatCard";
import FinanceTrendChart from "../components/charts/FinanceTrendChart";
import AttentionSpine from "../components/dashboard/AttentionSpine";
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


/**
 * The metric grid's loading state.
 *
 * It reuses the real grid classes and renders the real number of cards, so
 * the skeleton occupies exactly the box the content will occupy. That is the
 * point: a skeleton whose shape differs from its content is a layout shift
 * with extra steps.
 *
 * No spinner. A spinner says "something is happening"; this says "twelve
 * figures are coming, and here is where they will be".
 */
function MetricSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="v2-metrics v2-metrics--primary">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card v2-metric-skeleton">
            <span className="v2-skeleton v2-skeleton--label" />
            <span className="v2-skeleton v2-skeleton--value" />
          </div>
        ))}
      </div>

      <div className="v2-metrics v2-metrics--secondary">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="card v2-metric-skeleton">
            <span className="v2-skeleton v2-skeleton--label" />
            <span className="v2-skeleton v2-skeleton--value" />
          </div>
        ))}
      </div>
    </div>
  );
}

const RECENT_TABS = [
  { key: "payments", label: "Payments & deadlines" },
  { key: "invoices", label: "Invoices & tenders" },
  { key: "workforce", label: "Workforce & sites" },
];

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

  /*
   * Which recent-activity tab is showing. Local presentation state only —
   * every table below still receives exactly the data it always did.
   */
  const [recentTab, setRecentTab] = useState("payments");

  const [
    subcontractors,
    setSubcontractors,
  ] = useState([]);

  /*
   * V2-I033. First-load signal, inferred locally.
   *
   * The five register arrays arrive as props and carry no loading flag, so
   * "empty" and "not yet fetched" are indistinguishable from here — a company
   * with no records would otherwise skeleton forever.
   *
   * This page already runs its own request, so that is used as the signal
   * instead: while it is in flight the first load has not finished, and when
   * it settles (either way) the skeleton clears. True for an empty account as
   * well as a full one, and it needs nothing threaded from AppRoutes — so no
   * data-flow or business-logic change was required.
   */
  const [firstLoad, setFirstLoad] = useState(true);
  
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
            setFirstLoad(false);
          }
        } catch (error) {
          console.error(
            "Failed to load subcontractors:",
            error.response?.data ||
              error
          );
  
          if (!cancelled) {
            setSubcontractors([]);
            setFirstLoad(false);
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

  const activeSubcontractors = (
    Array.isArray(subcontractors)
      ? subcontractors
      : []
  ).filter(
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
      label: "Add Tender",
      description: "Create a tender for a personal or subcontractor site",
      path: "/tenders",
    },
  ];

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
        V2-I032. This was a full bordered panel wrapping a heading, a sentence
        of description and six links. The heading restated the page the user
        had just navigated to, and the description described the product to
        someone already inside it. Both are gone; the export control and the
        quick actions remain, now as a plain row.

        Typography and spacing carry the hierarchy here instead of a border —
        one less box between the user and the first real figure.
      */}
      <section className="v2-dash__zone" aria-label="Quick actions">
        <div className="v2-dash__zone-head">
          <h2 className="v2-dash__zone-title">Jump to</h2>

          <ExportButtons
            filename="dashboard-summary"
            title="Executive Dashboard Summary"
            subtitle="Construction Portal company performance snapshot"
            rows={dashboardExportRows}
            columns={dashboardExportColumns}
            summary={dashboardExportSummary}
          />
        </div>

        <div className="v2-dash__actions">
          {quickActions.map((action) => (
            <AppLink
              key={action.path}
              to={action.path}
              className="v2-dash__action"
            >
              <span className="v2-dash__action-text">
                <strong>{action.label}</strong>
                <span>{action.description}</span>
              </span>
            </AppLink>
          ))}
        </div>
      </section>

      {/*
        V2-I027. These twelve figures used to render in one flat
        `repeat(4, 1fr)` grid — Cash Position and Month Expense at identical
        size and weight, so nothing read as important and the user had to
        scan all twelve to find out whether anything was wrong.

        They are now tiered. The primary row is what someone opens the
        product to check: how much money there is, whether it is profitable,
        what is owed, and how much work is running. The rest is the
        supporting band — still present, still exact, just no longer
        competing with the headline.

        No figure was removed and none changed its source.
      */}
      {firstLoad ? <MetricSkeleton /> : null}

      <section
        className="v2-metrics v2-metrics--primary"
        aria-label="Key position"
        hidden={firstLoad}
      >
        <AnimatedStatCard
        title="Cash Position"
        value={cashPosition}
        currency
        />

        <AnimatedStatCard
        title="Net Profit"
        value={netProfit}
        currency
        />

        <AnimatedStatCard
        title="Invoice Outstanding"
        value={pendingInvoiceTotal}
        currency
        />

        <AnimatedStatCard
        title="Running Tenders"
        value={runningTenders}
        />
      </section>

      <section
        className="v2-metrics v2-metrics--secondary"
        aria-label="Supporting figures"
        hidden={firstLoad}
      >
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

              <RatioRow
                label="Completion Rate"
                value={tenderCompletionRate}
                tone="info"
              />

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


      {/*
        V2-I028. Six "Recent X" tables used to stack vertically here, about
        four of the page's five screens of scroll. Nothing is removed — the
        same three sections, the same six tables, the same links — they are
        now one at a time behind a tab strip.

        Real tab semantics: role="tablist", aria-selected, aria-controls, and
        each panel is a labelled tabpanel, so a screen reader announces "tab 2
        of 3" rather than meeting three unexplained regions.
      */}
      <section className="v2-dash__zone" aria-labelledby="recent-activity-heading">
        <div className="v2-dash__zone-head">
          <h2 className="v2-dash__zone-title" id="recent-activity-heading">
            Recent activity
          </h2>
        </div>

        <div className="tabs" role="tablist" aria-label="Recent activity">
          {RECENT_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`recent-tab-${tab.key}`}
              aria-selected={recentTab === tab.key}
              aria-controls={`recent-panel-${tab.key}`}
              tabIndex={recentTab === tab.key ? 0 : -1}
              className={recentTab === tab.key ? "active-tab" : undefined}
              onClick={() => setRecentTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          className="v2-recent__panel"
          role="tabpanel"
          id={`recent-panel-${recentTab}`}
          aria-labelledby={`recent-tab-${recentTab}`}
          tabIndex={0}
        >
        {recentTab === "payments" && (
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

          <div className="table-wrapper" tabIndex={0}>
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

          <div className="table-wrapper" tabIndex={0}>
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
        )}

        {recentTab === "invoices" && (
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

          <div className="table-wrapper" tabIndex={0}>
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

          <div className="table-wrapper" tabIndex={0}>
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
        )}

        {recentTab === "workforce" && (
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

          <div className="table-wrapper" tabIndex={0}>
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

          <div className="table-wrapper" tabIndex={0}>
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
        )}
        </div>
      </section>
    </>
  );
}

export default DashboardPage;