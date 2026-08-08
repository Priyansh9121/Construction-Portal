/**
 * File purpose:
 * The Dashboard's opening block, and the answer to the only question worth
 * asking on arrival: what needs me right now?
 *
 * Rendered by:
 * - DashboardPage
 *
 * WHY THIS REPLACED COUNT CARDS (D1)
 * The previous opening block showed six count tiles — "3 overdue invoices",
 * "2 tenders due within 7 days" — and 900 lines lower a "Suggested Next
 * Actions" panel showed the SAME six counts again as table rows. Both are
 * absorbed here.
 *
 * A count is not actionable. "3 overdue invoices" tells the user a number and
 * then requires a navigation, a scan and a comparison before anything can be
 * decided. The rows are already in props; the old page reduced them to a
 * length and threw the objects away. This shows the object.
 *
 * ONE LIST, NOT A GRID
 * Equal-sized cards give every item equal weight, so the user must read all of
 * them to find the worst one. A single ordered list has hierarchy for free:
 * the first row is the most urgent, and that ordering is the design. Items are
 * sorted by how overdue they are, then by value, so the largest exposure at
 * the longest delay leads.
 *
 * HONESTY ABOUT WHAT THE DATA KNOWS
 * Tenders carry `due_date`, so their timing is stated as fact: "due 12 days
 * ago", "due in 3 days".
 *
 * Invoices carry NO due date — only `created_at`, `invoice_number`, `amount`
 * and `status`. So an overdue invoice is described as "raised 12 days ago",
 * never "12 days overdue". The status is the server's claim; the date is the
 * only date that exists. Inventing a due date from `created_at` would be
 * fabricating a backend field, and it would be wrong the moment payment terms
 * differ from 0 days.
 *
 * STATUS COLOUR
 * Only two tones are used, and only for genuine operational state: `danger`
 * for something already past its date, `warning` for something approaching
 * one. Amounts, names and clients are neutral — they are facts, not states.
 * Nothing here is coloured because it is money.
 *
 * Tone is never the only signal: each row states its condition in words
 * ("Overdue", "Due soon") and the ordering repeats it positionally.
 *
 * CAPPED, DELIBERATELY
 * At most `VISIBLE_LIMIT` rows render. An attention list that can grow without
 * bound becomes the metric wall it replaced. The remainder is summarised as a
 * single link, which is the one place a count is the honest representation:
 * there is no single object left to name.
 */

import { useMemo } from "react";

import AppLink from "../ui/AppLink";
import EmptyState from "./EmptyState";
import Icon from "./../ui/Icon";
import { formatCurrency } from "../../utils/currency";

/** Beyond this the list stops being a shortlist and becomes a register. */
const VISIBLE_LIMIT = 4;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight today, so "days" compares dates rather than times. */
function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Whole days between a date and today. Negative is in the past.
 * Returns null for anything unparseable, so callers can omit the phrase
 * rather than print "NaN days".
 */
function daysFromToday(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - startOfToday().getTime()) / DAY_MS);
}

/** "12 days ago" / "in 3 days" / "today", from a signed day count. */
function relativeDays(days) {
  if (days === null) return null;
  if (days === 0) return "today";
  if (days > 0) return `in ${days} ${days === 1 ? "day" : "days"}`;

  const past = Math.abs(days);
  return `${past} ${past === 1 ? "day" : "days"} ago`;
}

const normalise = (value) => String(value || "").trim().toLowerCase();

const isClosedTender = (tender) =>
  ["completed", "passed"].includes(normalise(tender.status));

/**
 * Everything currently asking for the user's attention, most urgent first.
 *
 * Ordering is the hierarchy, so it is defined once here rather than being
 * implied by section order in the markup:
 *   1. already past its date, longest first
 *   2. then approaching a date, soonest first
 *   3. value breaks ties, so the larger exposure leads
 */
function buildAttentionItems({ tenders, invoices }) {
  const items = [];

  for (const tender of tenders) {
    if (isClosedTender(tender)) continue;

    const days = daysFromToday(tender.due_date);

    const overdue = days !== null && days < 0;
    const dueSoon = days !== null && days >= 0 && days <= 7;

    /*
     * A tender still in `pending` is awaiting submission, which is work the
     * user owes regardless of whether a date is attached. Filtering purely on
     * due date dropped it, which lost a real action the previous hero did
     * surface — so lateness and outstanding work are two separate reasons to
     * appear here, not one.
     */
    const awaitingSubmission = normalise(tender.status) === "pending";

    if (!overdue && !dueSoon && !awaitingSubmission) continue;

    let tone = "neutral";
    let state = "Awaiting submission";

    if (overdue) {
      tone = "danger";
      state = "Overdue";
    } else if (dueSoon) {
      tone = "warning";
      state = awaitingSubmission ? "Submission due soon" : "Due soon";
    }

    items.push({
      key: `tender-${tender.id}`,
      tone,
      state,
      icon: "tenders",
      title: tender.tender_name || tender.title || `Tender #${tender.id}`,
      meta: tender.client_name || null,
      amount: Number(tender.estimated_value || 0) || null,
      /* Only stated when a real due date exists; never inferred. */
      timing: days === null ? null : `Due ${relativeDays(days)}`,
      to: "/tenders",
      action: "Review",
      /* Undated work sits after everything with a date, but ahead of
       * invoices merely awaiting payment. */
      sortDays: days === null ? 8 : days,
      sortValue: Number(tender.estimated_value || 0),
    });
  }

  for (const invoice of invoices) {
    const status = normalise(invoice.status);
    if (status !== "overdue" && status !== "pending") continue;

    const overdue = status === "overdue";

    /*
     * `created_at` is the ONLY date an invoice carries. It is reported as the
     * raising date, never converted into a due date or an overdue duration.
     */
    const raised = relativeDays(daysFromToday(invoice.created_at));

    items.push({
      key: `invoice-${invoice.id}`,
      tone: overdue ? "danger" : "warning",
      state: overdue ? "Overdue" : "Awaiting payment",
      icon: "invoices",
      title: invoice.invoice_number
        ? `Invoice ${invoice.invoice_number}`
        : `Invoice #${invoice.id}`,
      meta: null,
      amount: Number(invoice.amount || 0) || null,
      timing: raised ? `Raised ${raised}` : null,
      to: "/invoices",
      action: overdue ? "Chase" : "Review",
      /* Overdue sorts with past-dated work; pending sits after it. */
      sortDays: overdue ? -1 : 9,
      sortValue: Number(invoice.amount || 0),
    });
  }

  return items.sort(
    (a, b) => a.sortDays - b.sortDays || b.sortValue - a.sortValue
  );
}

function greetingFor(date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function AttentionSpine({ userName = "", tenders = [], invoices = [] }) {
  /* No work of any kind has been created. Distinct from "nothing is wrong". */
  const firstRun = tenders.length === 0 && invoices.length === 0;

  const items = useMemo(
    () => buildAttentionItems({ tenders, invoices }),
    [tenders, invoices]
  );

  const visible = items.slice(0, VISIBLE_LIMIT);
  const remaining = items.length - visible.length;

  const greeting = `${greetingFor(new Date())}${userName ? `, ${userName}` : ""}`;

  return (
    <section className="ui-attention" aria-labelledby="attention-heading">
      <header className="ui-attention__head">
        <p className="ui-attention__greeting">{greeting}</p>

        <h2 id="attention-heading" className="ui-attention__headline">
          {items.length === 0
            ? firstRun
              ? "Let's get your first project set up."
              : "Nothing needs you right now."
            : `${items.length} ${items.length === 1 ? "thing needs" : "things need"} you today.`}
        </h2>
      </header>

      {items.length === 0 ? (
        firstRun ? (
          /*
           * DASH-005. "Nothing needs you right now" is TRUE for a brand-new
           * company and completely misleading: it implies work exists and is
           * under control. Nothing exists. An empty attention list means two
           * different things and must say two different things.
           */
          <EmptyState
            title="Nothing to track yet"
            description="Once you create a tender or raise an invoice, anything overdue or awaiting you appears here first."
            action={{ to: "/tenders", label: "Create your first tender" }}
          />
        ) : (
          /*
           * Genuinely caught up. An achievement, not a gap, so it is stated as
           * one and given a plain surface rather than the sunken well used for
           * "nothing here yet".
           */
          <div className="ui-attention__clear">
            <span className="ui-attention__clear-mark" aria-hidden="true">
              <Icon name="approvals" size={20} />
            </span>

            <p className="ui-attention__clear-text">
              Nothing overdue, nothing awaiting submission, and no tender
              deadlines inside the next seven days.
            </p>

            <AppLink to="/tenders" className="ui-attention__clear-link">
              Open the tender pipeline
            </AppLink>
          </div>
        )
      ) : (
        <ul className="ui-attention__list">
          {visible.map((item) => (
            <li key={item.key} className="ui-attention__item" data-tone={item.tone}>
              <AppLink to={item.to} className="ui-attention__row">
                <span className="ui-attention__mark" aria-hidden="true">
                  <Icon name={item.icon} size={18} />
                </span>

                <span className="ui-attention__detail">
                  <span className="ui-attention__title">{item.title}</span>

                  <span className="ui-attention__facts">
                    {/* Stated in words as well as tone, never colour alone. */}
                    <span className="ui-attention__state">{item.state}</span>

                    {item.meta ? (
                      <span className="ui-attention__meta">{item.meta}</span>
                    ) : null}

                    {item.amount ? (
                      <span className="ui-attention__amount">
                        {formatCurrency(item.amount)}
                      </span>
                    ) : null}

                    {item.timing ? (
                      <span className="ui-attention__timing">{item.timing}</span>
                    ) : null}
                  </span>
                </span>

                <span className="ui-attention__action">
                  {item.action}
                  <Icon name="chevron-right" size={16} />
                </span>
              </AppLink>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 ? (
        /*
         * The one honest use of a count: there is no single object left to
         * name, so the number IS the information.
         */
        <AppLink to="/tenders" className="ui-attention__more">
          {`${remaining} more ${remaining === 1 ? "item" : "items"} need attention`}
        </AppLink>
      ) : null}
    </section>
  );
}

export default AttentionSpine;
