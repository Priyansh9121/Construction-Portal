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
 * - Renders AttentionSpine, BusinessHealth, Pipeline, FinanceInstrument
 * - and ActivityStream.
 *
 * Important notes:
 * - Office-only. Workers and subcontractors land on their portals instead —
 * - see getHomePath in RoleRoute.jsx.
 * - Figures here are derived client-side from rows already loaded, so they
 * - reflect what this session has fetched rather than a server aggregate.
 */

import FinanceInstrument from "../components/finance/FinanceInstrument";
import AttentionSpine from "../components/dashboard/AttentionSpine";
import DashboardHorizon from "../components/dashboard/DashboardHorizon";
import World from "../components/environment/World";
import useWorldParallax from "../components/environment/useWorldParallax";
import DeadlineHorizon from "../components/dashboard/DeadlineHorizon";
import SheetFooter from "../components/dashboard/SheetFooter";
import BusinessHealth from "../components/dashboard/BusinessHealth";
import Pipeline from "../components/dashboard/Pipeline";
import ActivityStream from "../components/dashboard/ActivityStream";
import ExportButtons from "../components/export/ExportButtons";
import { formatCurrency } from "../utils/currency";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSubcontractors } from "../services/subcontractorService";
import { useAuth } from "../contexts/authContext";


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

  const activeSites = sites.filter(
    (site) => normaliseStatus(site.status) === "active"
  ).length;

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

  const invoiceTotal = invoices.reduce(
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

  const activeSubcontractors = (
    Array.isArray(subcontractors)
      ? subcontractors
      : []
  ).filter(
    (subcontractor) =>
      normaliseStatus(subcontractor.status) === "active"
  ).length;

  const profitMargin =
    totalIncome > 0
      ? (netProfit / totalIncome) * 100
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

  /* One scheduler for the world's depth. Passive listeners, one rAF per
   * frame, two custom properties, no layout read, no React state. */
  const navigate = useNavigate();
  const roomRef = useRef(null);
  useWorldParallax(roomRef, { scroll: 0.4, pointer: 1 });

  /*
   * The occlusion contract is switched on for this route and removed when it
   * is left, the same route-scoped mechanism `data-scheme` uses. It cannot be
   * a class on the returned fragment: the compartments it governs are
   * siblings inside the shell's `.page-content`, not descendants of anything
   * this page owns.
   */
  useEffect(() => {
    document.body.classList.add("ui-world-page");

    /* The arrival marker is added on mount and never removed while the route
     * lives, so the establishment plays once. Re-renders do not replay it:
     * the animations are `both`-filled and keyed to the element, not to state. */
    document.body.classList.add("ui-arrive");

    return () => {
      document.body.classList.remove("ui-world-page");
      document.body.classList.remove("ui-arrive");
    };
  }, []);

  return (
    <>
      {/*
        THE ROOM.

        A fixed five-plane construction world behind the entire route. It does
        not scroll: its PLANES translate against the scroll offset at five
        different rates, which is what produces depth rather than a background
        sliding past.

        `ui-world-page` is what switches on the occlusion contract — every
        operational compartment becomes an opaque sheet with a ring of its own
        surface, so the world is read AROUND the composition and never behind
        a figure. The class is on this page only; no other route inherits a
        world it did not ask for.

        Pointer parallax is on and deliberately shallow. The scheduler attaches
        nothing at all under reduced motion, so a user who asked for less
        motion does not pay for work that is then discarded.
      */}
      <div className="ui-world ui-world--room" ref={roomRef}>
        <World
          variant="operations"
          surface="room"
          lights
          /* The site is lit by the Dashboard's own figures: bays under work
           * come from the running-tender count, the beacon from the overdue
           * count. Neither invents progress, a location or a completion. */
          active={runningTenders.length}
          alert={overdueTenders.length}
        />
      </div>

      {/*
        D1. The page opens with the OBJECTS that need the user, not counts of
        them. This replaced DashboardHero's six count tiles and absorbed the
        "Suggested Next Actions" table 900 lines below, which showed the same
        six counts a second time.

        It takes the tender and invoice rows directly, because the objects it
        names live in them. Nothing new is fetched and no figure elsewhere on
        the page changed.
      */}
      {/*
        PHASE 3. The attention section now opens inside the environmental
        band: a measured orthographic elevation of a site, drawn in line,
        which the threshold's retracting floor plates hand over to.

        The drawing is clipped above the rows, so atmosphere sits behind the
        greeting and the headline — words — and never behind a figure. That
        division is the whole reason an operational route is allowed to move
        at all. See EXPERIENCE_LANGUAGE section 6, as amended.
      */}
      <DashboardHorizon
        active={runningTenders.length}
        alert={overdueTenders.length}
      >
        <AttentionSpine
          userName={user?.full_name || ""}
          tenders={tenders}
          invoices={invoices}
        />
      </DashboardHorizon>

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
      {/*
        DASH-002. Moved up from between Pipeline and Activity, where deleting
        the three legacy panels had stranded it. It is the only financial
        section outside Business Health, and it answers something D2 cannot:
        trajectory over months rather than position now. Keeping the two
        adjacent means the page tells one financial story instead of
        interrupting Pipeline with a second one.
      */}
      <FinanceInstrument
        payments={payments}
        onRecordPayment={() => navigate("/payments")}
      />

      {/*
        Temporal orientation, between intervention and the pipeline.

        AttentionSpine says what needs a decision today; this says what the
        next thirty days look like. A list is ordered but not spaced, so it
        cannot show that two things land in one week and nothing else does for
        a fortnight — which is the only reason this compartment exists.

        Items already in Attention appear here too, deliberately: removing
        them would put a hole in the timeline exactly where the most urgent
        work is. They carry no second action, so each object still has exactly
        one primary action on the page.
      */}
      <DeadlineHorizon tenders={tenders} />

      <Pipeline tenders={tenders} />


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


      {/*
        The title block. Closure and identity: a page that simply stops leaves
        the reader unsure they have seen everything, which is the residue of
        suspicion PRODUCT_SOUL section 5 says the product must not leave.

        Every field is derived. No revision, no drawn-by, no scale — the
        product does not have those, and a title block full of invented
        metadata would be forgery dressed as craft. The open count is passed
        from the figures this page already derived rather than recomputed.
      */}
      <SheetFooter
        dueCount={dueSoonTenders.length + overdueTenders.length}
      />

    </>
  );
}

export default DashboardPage;