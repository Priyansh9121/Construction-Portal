/**
 * File purpose:
 * Line chart of income and expense over time.
 *
 * Props:
 * - The payment rows to plot, and a date range
 *
 * State and hooks:
 * - Derives its series with useMemo
 *
 * Rendered by:
 * - DashboardPage.jsx, FinanceOverview.jsx
 *
 * Important notes:
 * - Plots rows already loaded rather than querying an aggregate endpoint, so
 * - it reflects what the session has fetched.
 */

import { useMemo } from "react";

import EmptyState from "../dashboard/EmptyState";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Legend,
  } from "recharts";
  
  /**
   * The two visual languages this chart can speak.
   *
   * Named by MEANING, not by migration history: "legacy" is the inherited
   * appearance, "finance" is the product's finance visual language. A caller
   * that says nothing keeps what it has today, so an unmigrated route needs no
   * edit to stay identical (F-03).
   *
   * Every value is a token name. The component holds no colour literals; F-02
   * moved the legacy hexes into `--ui-finance-legacy-*` precisely so this file
   * could stop carrying them.
   */
  const PALETTES = {
    legacy: {
      income: "--ui-finance-legacy-income",
      expense: "--ui-finance-legacy-expense",
      profit: "--ui-finance-legacy-profit",
      /* Inherited fill weights, reproduced exactly. */
      fill: { income: 0.35, expense: 0.3, profit: 0.35 },
      /* Profit is drawn as a third filled area, as it always was here. */
      profitFilled: true,
      profitDash: null,
      /* null means "leave Recharts' own defaults alone", which is what the
       * unmigrated appearance is. */
      grid: null,
      axis: null,
      /* The inherited plot height; unmigrated callers keep it exactly. */
      plotHeight: 340,
    },
    finance: {
      income: "--ui-finance-income",
      expense: "--ui-finance-expense",
      profit: "--ui-finance-profit",
      fill: {
        income: "--ui-series-fill-opacity",
        expense: "--ui-series-fill-opacity",
        profit: 0,
      },
      /*
       * Profit is `income - expense`, which on a chart already drawing both is
       * the GAP BETWEEN THEM. Filling it a third time draws the same
       * information twice and demands a third identity colour the palette
       * deliberately does not have. It becomes a thin dashed line in ink:
       * present and readable, visibly derived, and distinguished from the two
       * primary series by dash pattern as well as tone, so the three do not
       * depend on hue alone.
       */
      profitFilled: false,
      profitDash: "5 4",
      /* Chrome moves with the series. A chart whose lines are system tokens
       * and whose grid is still a library default speaks two languages at
       * once, which is the mixed-palette failure this unit exists to avoid. */
      grid: "--ui-finance-grid",
      axis: "--ui-finance-axis-label",
      /* Must match --ui-chart-plot-height in dashboard.css, or the plot
       * overflows the shell and `overflow: hidden` clips it. */
      plotHeight: 260,
    },
  };

  /**
   * Resolve token names against the live document.
   *
   * SVG presentation attributes do not accept `var()`, so the values have to be
   * real colours by the time they reach `stroke` and `stop-color`. Reading them
   * from the cascade keeps `finance.css` the single source of truth rather than
   * duplicating the ramp here.
   */
  function resolvePalette(name) {
    const spec = PALETTES[name] || PALETTES.legacy;
    const root =
      typeof document === "undefined"
        ? null
        : getComputedStyle(document.documentElement);

    const read = (token) =>
      typeof token === "string" && token.startsWith("--")
        ? root?.getPropertyValue(token).trim() || null
        : token;

    return {
      income: read(spec.income),
      expense: read(spec.expense),
      profit: read(spec.profit),
      fill: {
        income: Number(read(spec.fill.income)),
        expense: Number(read(spec.fill.expense)),
        profit: Number(read(spec.fill.profit)),
      },
      profitFilled: spec.profitFilled,
      profitDash: spec.profitDash,
      grid: read(spec.grid),
      axis: read(spec.axis),
      plotHeight: spec.plotHeight,
    };
  }

  function FinanceTrendChart({ payments = [], emptyState = null, palette = "legacy" }) {
    /* Resolved once per render, keyed on the palette name. */
    const paint = useMemo(() => resolvePalette(palette), [palette]);

    /*
     * Gradient ids are DOCUMENT-GLOBAL in SVG. Two charts on one page using
     * different palettes would otherwise share `incomeGradient`, and whichever
     * rendered last would silently repaint the other. Scoping by palette name
     * removes that latent collision (FIN-004).
     */
    const gid = (series) => `finance-${palette}-${series}`;

    const monthlyData = Object.values(
      payments.reduce((acc, payment) => {
        const date = payment.payment_date || payment.created_at;
        if (!date) return acc;
  
        const month = date.slice(0, 7);
  
        if (!acc[month]) {
          acc[month] = {
            month,
            income: 0,
            expense: 0,
            profit: 0,
          };
        }
  
        if (payment.payment_type === "Income") {
          acc[month].income += Number(payment.amount || 0);
        }
  
        if (payment.payment_type === "Expense") {
          acc[month].expense += Number(payment.amount || 0);
        }
  
        acc[month].profit = acc[month].income - acc[month].expense;
  
        return acc;
      }, {})
    ).sort((a, b) => a.month.localeCompare(b.month));
  
    /*
     * DASH-003. A trend needs at least two months to BE a trend.
     *
     * OPT-IN, because this component is NOT Dashboard-only. PaymentsPage
     * renders it too (DASH-008). The first version of this guard applied
     * unconditionally and put a "Record a payment" link -- pointing at
     * /payments -- onto the /payments page itself, and changed the appearance
     * of an unmigrated route. A caller now has to ask for the empty state and
     * supply its own action, so the Dashboard gets it and Payments is
     * untouched until the finance route group is migrated.
     *
     * The chart previously rendered its axes and an empty 340px plot whatever
     * the data, so a brand-new company met a void that was the largest element
     * on the Dashboard. Hiding the section outright was rejected: the user
     * would never learn the view exists, and the page would gain an unexplained
     * gap in its rhythm. Instead the section keeps its title and explains
     * itself in a fraction of the height.
     *
     * The threshold is two months, not zero payments, because a single point
     * is not a trend either — plotting one month draws a chart that cannot
     * show direction and implies a measurement it does not have.
     */
    if (emptyState && monthlyData.length < 2) {
      const noPayments = monthlyData.length === 0;

      return (
        <div className={`panel premium-chart-panel${palette === "finance" ? " ui-chart" : ""}`}>
          <div className="section-title-row">
            <div>
              <h2>Monthly Finance Trend</h2>
              <p className="muted-text">
                Income, expenses and profit by month
              </p>
            </div>
          </div>

          <EmptyState
            title={noPayments ? "No payments recorded yet" : "Not enough history yet"}
            description={
              noPayments
                ? "Once payments are recorded, this shows how income and expenses move month by month."
                : "A trend needs at least two months of records. This fills in as the next month is recorded."
            }
            action={noPayments ? emptyState.action ?? null : null}
          />
        </div>
      );
    }

    return (
      /*
       * `ui-chart` carries the system container styling and the Dashboard
       * entrance. It rides on the SAME opt-in as the palette rather than
       * introducing a second mechanism, so an unmigrated caller keeps legacy
       * panel chrome untouched (DASH-008).
       */
      <div className={`panel premium-chart-panel${palette === "finance" ? " ui-chart" : ""}`}>
        <div className="section-title-row">
          <div>
            <h2>Monthly Finance Trend</h2>
            <p className="muted-text">
              Income, expenses and profit by month
            </p>
          </div>
        </div>
  
        <div className="premium-chart-shell">
          <ResponsiveContainer width="100%" height={paint.plotHeight}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id={gid("income")} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={paint.income} stopOpacity={paint.fill.income} />
                  <stop offset="95%" stopColor={paint.income} stopOpacity={0} />
                </linearGradient>

                <linearGradient id={gid("expense")} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={paint.expense} stopOpacity={paint.fill.expense} />
                  <stop offset="95%" stopColor={paint.expense} stopOpacity={0} />
                </linearGradient>

                <linearGradient id={gid("profit")} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={paint.profit} stopOpacity={paint.fill.profit} />
                  <stop offset="95%" stopColor={paint.profit} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={paint.grid ?? undefined}
              />
              <XAxis dataKey="month" stroke={paint.axis ?? undefined} />
              <YAxis stroke={paint.axis ?? undefined} />
              <Tooltip />
              <Legend />

              <Area
                type="monotone"
                dataKey="income"
                stroke={paint.income}
                strokeWidth={3}
                fill={`url(#${gid("income")})`}
                activeDot={{ r: 6 }}
                animationDuration={1200}
              />

              <Area
                type="monotone"
                dataKey="expense"
                stroke={paint.expense}
                strokeWidth={3}
                fill={`url(#${gid("expense")})`}
                activeDot={{ r: 6 }}
                animationDuration={1400}
              />

              {/*
                Profit. Filled in the legacy language, a dashed derived line in
                the finance one -- see PALETTES.
              */}
              <Area
                type="monotone"
                dataKey="profit"
                stroke={paint.profit}
                strokeWidth={paint.profitFilled ? 3 : 2}
                strokeDasharray={paint.profitDash ?? undefined}
                fill={paint.profitFilled ? `url(#${gid("profit")})` : "none"}
                activeDot={{ r: 6 }}
                animationDuration={1600}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }
  
  export default FinanceTrendChart;