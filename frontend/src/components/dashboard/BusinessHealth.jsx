/**
 * File purpose:
 * The Dashboard's second question: are we healthy?
 *
 * Rendered by:
 * - DashboardPage
 *
 * WHAT THIS REPLACED (D2)
 * Twelve equal-weight metric cards and a "Today's Finance" panel — twenty-one
 * figures between them, of which nine were arithmetic restatements of the
 * others. Income, expense and profit each appeared three times, differing only
 * in timeframe, because the page rendered the cross-product of
 * {metric × timeframe} as sibling cards.
 *
 * POSITIONS ARE NOT FLOWS
 * The central idea, and the reason this is one section rather than three:
 *
 *   A POSITION is true at a moment. Cash position does not have a "this month"
 *   version — what you hold is what you hold. Attaching a timeframe to it
 *   would be meaningless.
 *
 *   A FLOW happens over a period. Money in, money out and net are only
 *   meaningful WITH a timeframe.
 *
 * The old page conflated them, which is why it needed twelve cards: it had no
 * way to say "this one is a level, that one is a rate". Here the position is
 * stated once and permanently, and the flows sit behind a single timeframe
 * control. One metric, one place, the user changes the lens.
 *
 * WHY CASH POSITION LEADS
 * It is the only figure that answers "can we keep operating", because it is
 * the sole number that already nets off money that is legally not ours —
 * outstanding GST and unpaid company charge. Net profit does not do that, so
 * a healthy-looking profit can sit alongside an inability to pay wages. The
 * obligations are named directly beneath it rather than being given their own
 * cards, because they are the explanation of the headline, not peers of it.
 *
 * HONEST ABOUT PRECISION
 * Every figure is derived client-side from the payment and invoice rows this
 * session has already loaded. There is no server aggregate. The section
 * therefore says "from records loaded in this session" rather than implying a
 * closed-books figure, and no trend or delta is shown, because the data
 * carries no history to compare against. Inventing one would be fabricating
 * backend capability.
 *
 * STATUS COLOUR
 * None of these figures is coloured for being income or expense. The only
 * conditional colour is on cash position when it is NEGATIVE, which is a
 * genuine operational state — the business cannot cover its obligations — and
 * on overdue receivables. A negative position is also stated in words, so the
 * colour is never the only signal.
 */

import { useMemo, useState } from "react";

import AppLink from "../ui/AppLink";
import { formatCurrency } from "../../utils/currency";

/*
 * The lens. Deliberately three options, not five: "this week" would need a
 * week-start convention the backend does not define, and inventing one would
 * make the figure wrong for anyone whose week starts elsewhere.
 */
const RANGES = [
  { key: "today", label: "Today" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

const num = (value) => Number(value || 0);

const normalise = (value) => String(value || "").trim().toLowerCase();

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/** A payment's effective date, preferring the recorded one over row creation. */
const paymentDate = (payment) => payment.payment_date || payment.created_at;

function withinRange(value, range) {
  if (range === "all") return true;
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = startOfToday();

  if (range === "today") {
    date.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime();
  }

  return (
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

const sumBy = (rows, pick) => rows.reduce((total, row) => total + num(pick(row)), 0);

function BusinessHealth({ payments = [], invoices = [], actions = null }) {
  const [range, setRange] = useState("month");

  const figures = useMemo(() => {
    const income = payments.filter((p) => p.payment_type === "Income");
    const expense = payments.filter((p) => p.payment_type === "Expense");

    /*
     * Obligations. Both are money collected or accrued that is owed onward, so
     * both are deducted from the position. Lifetime figures only: a "this
     * month" GST liability would be a different number from what is actually
     * owed, and the position must reflect the real obligation.
     */
    const gstCharged = sumBy(
      payments.filter((p) => p.payment_sub_type === "GOVERNMENT_BILL"),
      (p) => p.gst_amount || p.gst_total
    );
    const gstReturned = sumBy(
      payments.filter((p) => p.payment_sub_type === "GST_RETURN"),
      (p) => p.gst_done || p.amount
    );
    const gstOwed = Math.max(gstCharged - gstReturned, 0);

    const chargeAccrued = sumBy(
      payments.filter((p) => p.payment_sub_type === "COMPANY_CHARGE"),
      (p) => p.company_charge_total || p.gst_amount || p.amount
    );
    const chargePaid = sumBy(
      payments.filter((p) => p.payment_sub_type === "COMPANY_CHARGE_PAYMENT"),
      (p) => p.amount
    );
    const chargeOwed = Math.max(chargeAccrued - chargePaid, 0);

    const lifetimeIn = sumBy(income, (p) => p.amount);
    const lifetimeOut = sumBy(expense, (p) => p.amount);

    /* The position: everything received, less everything spent, less what is
     * owed onward. Always lifetime — see the header. */
    const cashPosition = lifetimeIn - lifetimeOut - gstOwed - chargeOwed;

    /* The flows: only these respond to the lens. */
    const rangeIn = sumBy(
      income.filter((p) => withinRange(paymentDate(p), range)),
      (p) => p.amount
    );
    const rangeOut = sumBy(
      expense.filter((p) => withinRange(paymentDate(p), range)),
      (p) => p.amount
    );

    const unpaid = invoices.filter((i) => normalise(i.status) !== "paid");
    const overdue = invoices.filter((i) => normalise(i.status) === "overdue");

    return {
      cashPosition,
      gstOwed,
      chargeOwed,
      rangeIn,
      rangeOut,
      rangeNet: rangeIn - rangeOut,
      owedToYou: sumBy(unpaid, (i) => i.amount),
      overdueValue: sumBy(overdue, (i) => i.amount),
      overdueCount: overdue.length,
      /* Movement exists at all? Used to decide between a real reading and
       * guidance, rather than printing a confident zero. */
      hasFlow: rangeIn > 0 || rangeOut > 0,
      hasAnyRecord: payments.length > 0,
    };
  }, [payments, invoices, range]);

  const negative = figures.cashPosition < 0;
  const obligations = figures.gstOwed + figures.chargeOwed;

  /* Proportional split of the two flow bars. Guarded so an all-zero period
   * renders empty rails rather than dividing by zero. */
  const flowPeak = Math.max(figures.rangeIn, figures.rangeOut, 1);
  const inWidth = (figures.rangeIn / flowPeak) * 100;
  const outWidth = (figures.rangeOut / flowPeak) * 100;

  const rangeLabel =
    RANGES.find((option) => option.key === range)?.label.toLowerCase() ?? "";

  return (
    <section className="ui-health" aria-labelledby="health-heading">
      <div className="ui-health__head">
        <h2 id="health-heading" className="ui-health__title">
          Business health
        </h2>

        <div className="ui-health__head-actions">
          {/*
            DASH-007. Suppressed before any payment exists. "Open finance" is a
            standing navigation utility; on a first-run page it points at an
            empty register, and the adjacent trend section already offers the
            same route as real guidance ("Record a payment"). Two links to
            /payments on a blank page is the duplicated-workflow problem in
            miniature. It returns as soon as there is finance to open.
          */}
          {figures.hasAnyRecord ? (
            <AppLink to="/payments" className="ui-health__link">
              Open finance
            </AppLink>
          ) : null}

          {/* The dashboard export lives here because 15 of its 18 rows are
              financial. It previously sat under a "Jump to" heading whose only
              other content was a link the sidebar already provides. */}
          {actions}
        </div>
      </div>

      <div className="ui-health__body">
        {/* The position. Stated once, never filtered by the lens. */}
        <div className="ui-health__position">
          <p className="ui-health__label">Cash position</p>

          <p
            className="ui-health__figure"
            data-state={negative ? "negative" : "neutral"}
          >
            {formatCurrency(figures.cashPosition)}
          </p>

          <p className="ui-health__context">
            {/*
              DASH-006. Zero has two meanings and they are not
              interchangeable. "Nothing owed onward in GST or company charge"
              is true for a company that has traded and cleared its
              obligations, and equally true for one that opened the product
              five minutes ago -- but only the first is a financial position.
              Stating it the same way in both cases tells a new company its
              balance is zero, when the honest statement is that nothing has
              been recorded yet.
            */}
            {!figures.hasAnyRecord ? (
              "No payments recorded yet, so this is a starting point rather than a balance."
            ) : obligations > 0 ? (
              <>
                After {formatCurrency(figures.gstOwed)} GST and{" "}
                {formatCurrency(figures.chargeOwed)} company charge still owed.
              </>
            ) : (
              "Nothing owed onward in GST or company charge."
            )}
          </p>

          {/* Never colour alone: the state is also written. */}
          {negative ? (
            <p className="ui-health__alarm">
              Obligations exceed what has been received.
            </p>
          ) : null}
        </div>

        {/* The flows. The only part the lens changes. */}
        <div className="ui-health__flow">
          <div className="ui-health__flow-head">
            <p className="ui-health__label">Money movement</p>

            <div className="ui-health__range" role="group" aria-label="Timeframe">
              {RANGES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className="ui-health__range-option"
                  aria-pressed={range === option.key}
                  onClick={() => setRange(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {figures.hasFlow ? (
            <dl className="ui-health__bars">
              <div className="ui-health__bar-row">
                <dt>In</dt>
                <dd>
                  <span className="ui-health__bar" aria-hidden="true">
                    <span
                      className="ui-health__bar-fill"
                      data-flow="in"
                      style={{ inlineSize: `${inWidth}%` }}
                    />
                  </span>
                  <span className="ui-health__bar-value">
                    {formatCurrency(figures.rangeIn)}
                  </span>
                </dd>
              </div>

              <div className="ui-health__bar-row">
                <dt>Out</dt>
                <dd>
                  <span className="ui-health__bar" aria-hidden="true">
                    <span
                      className="ui-health__bar-fill"
                      data-flow="out"
                      style={{ inlineSize: `${outWidth}%` }}
                    />
                  </span>
                  <span className="ui-health__bar-value">
                    {formatCurrency(figures.rangeOut)}
                  </span>
                </dd>
              </div>

              <div className="ui-health__bar-row ui-health__bar-row--net">
                <dt>Net</dt>
                <dd>
                  <span className="ui-health__bar-value">
                    {formatCurrency(figures.rangeNet)}
                  </span>
                </dd>
              </div>
            </dl>
          ) : (
            /* Guidance rather than a wall of confident zeros. */
            <p className="ui-health__quiet">
              {figures.hasAnyRecord
                ? `No money moved ${rangeLabel}.`
                : "No payments recorded yet. Finance figures appear once the first payment is logged."}
            </p>
          )}
        </div>
      </div>

      {/* Receivables: money that exists but is not yours yet. */}
      {figures.owedToYou > 0 ? (
        <AppLink to="/invoices" className="ui-health__receivable">
          <span className="ui-health__receivable-main">
            <strong>{formatCurrency(figures.owedToYou)}</strong> owed to you
            across unpaid invoices
          </span>

          {figures.overdueCount > 0 ? (
            <span className="ui-health__receivable-flag">
              {formatCurrency(figures.overdueValue)} overdue
            </span>
          ) : null}
        </AppLink>
      ) : null}
    </section>
  );
}

export default BusinessHealth;
