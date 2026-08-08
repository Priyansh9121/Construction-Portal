/**
 * File purpose:
 * The Dashboard's fourth question: what changed?
 *
 * Rendered by:
 * - DashboardPage
 *
 * WHAT THIS REPLACED (D4)
 * A tab strip over six tables — Recent Payments, Recent Invoices, Recent
 * Tenders, Recent Workers, Recent Sites (and Upcoming Tenders, already removed
 * in D3). Six interfaces organised by database table, each requiring a tab
 * switch, each with its own heading and its own "View all".
 *
 * Organising by table answers "what kinds of record exist". Nobody asks that.
 * This is one chronological stream, which answers the question actually being
 * asked.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHICH SOURCES CAN HONESTLY APPEAR, AND WHICH CANNOT
 * ─────────────────────────────────────────────────────────────────────────
 *
 * An activity stream makes a claim about TIME. That claim has to be backed by
 * a real field, so each source was checked rather than assumed:
 *
 *   payments  — `created_at` present.  INCLUDED
 *   invoices  — `created_at` present.  INCLUDED
 *   tenders   — `created_at` present.  INCLUDED
 *
 *   workers   — fields are id, full_name, phone, role, salary, status.
 *               NO timestamp of any kind.  EXCLUDED
 *   sites     — fields are id, site_name, site_type, address, status,
 *               progress_percent, is_deleted.
 *               NO timestamp of any kind.  EXCLUDED
 *
 * The old "Recent Workers" and "Recent Sites" tables sorted by `id` descending
 * and called the result recent. A higher id usually does mean a later insert,
 * but that is an assumption about the database, not a field the API returns.
 * Rendering "Raj Patel joined 2 hours ago" from a row id would be inventing an
 * event that nothing proves happened. So those two sources are dropped rather
 * than guessed at, and their absence is stated in the section's own footnote
 * so a reader is not left wondering where workforce went.
 *
 * The old tender sort used `created_at || due_date`. That is worse than a
 * missing field: `due_date` is in the FUTURE, so a tender lacking `created_at`
 * would sort into a "recent" list by its deadline. Only `created_at` is used
 * here, and a row without it is excluded.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PRECISION THE TIMESTAMP ACTUALLY CARRIES
 * ─────────────────────────────────────────────────────────────────────────
 * "42 minutes ago" requires a clock. If `created_at` is a bare date
 * (`2026-08-07`), the parsed value is local midnight and any hour figure
 * derived from it is fabricated. `hasClockTime` checks the RAW string for a
 * time component and only then is a sub-day relative phrase used. Date-only
 * values fall back to the day grouping, which is all they support.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THE EVENT SENTENCE MAY SAY
 * ─────────────────────────────────────────────────────────────────────────
 * `created_at` proves one thing: the record was created. So every sentence is
 * a creation sentence — "Invoice raised", "Payment recorded", "Tender created".
 * Nothing here says "updated", because no source carries `updated_at`, and
 * nothing says "approved" or "completed", because no source carries a
 * transition time. The current status is NOT rendered: status is present-tense
 * state, and mixing it into a past-tense feed is what made the old tables read
 * as a register rather than as history.
 *
 * That is also why `getStatusClass` dies with those tables (SHELL-029): this
 * section has no status to colour.
 *
 * BOUNDARIES WITH D1 AND D3
 * D1 owns intervention ("INV-104 is 12 days overdue"). D3 owns current
 * movement ("Project Alpha, running, 62%"). D4 owns only the factual change
 * ("Invoice INV-104 was raised yesterday"). The same object may legitimately
 * appear in two sections saying two different things; what must not happen is
 * two sections saying the SAME thing, which is why no status or urgency
 * styling appears here.
 */

import { useMemo } from "react";

import AppLink from "../ui/AppLink";
import EmptyState from "./EmptyState";
import Icon from "../ui/Icon";
import { formatCurrency } from "../../utils/currency";

/** Deliberately shallow. The Activity Log owns real history. */
const VISIBLE_LIMIT = 8;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Does the raw value carry a clock, or only a calendar day?
 *
 * Checked on the STRING, not the parsed Date: `new Date("2026-08-07")` is a
 * valid Date at midnight, and is indistinguishable after parsing from a
 * timestamp that genuinely landed at midnight.
 */
function hasClockTime(raw) {
  return typeof raw === "string" && /[T ]\d{2}:\d{2}/.test(raw);
}

function parseEventTime(raw) {
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

/** Local calendar day key. Never string-sliced, so it follows the viewer. */
function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * "Today" / "Yesterday" / "8 Aug 2026", from local date components.
 */
function groupLabel(date) {
  const today = startOfToday();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dayKey(date) === dayKey(today)) return "Today";
  if (dayKey(date) === dayKey(yesterday)) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * A short relative phrase, but ONLY at a precision the source supports.
 * Date-only values return null and rely on the day heading instead.
 */
function relativeTime(date, precise) {
  if (!precise) return null;

  const elapsed = Date.now() - date.getTime();
  if (elapsed < 0) return null;

  if (elapsed < MINUTE_MS) return "just now";
  if (elapsed < HOUR_MS) {
    const mins = Math.floor(elapsed / MINUTE_MS);
    return `${mins} min ago`;
  }
  if (elapsed < 24 * HOUR_MS) {
    const hours = Math.floor(elapsed / HOUR_MS);
    return `${hours} hr ago`;
  }

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Normalise the three timestamped sources into one shape.
 *
 * Presentation only: source arrays are read, never mutated, and each mapping
 * names the exact field it trusts.
 */
function buildEvents({ payments, invoices, tenders }) {
  const events = [];

  const push = (raw, event) => {
    const date = parseEventTime(raw);
    if (!date) return;

    events.push({ ...event, date, precise: hasClockTime(raw) });
  };

  for (const payment of payments) {
    const income = String(payment.payment_type || "").toLowerCase() === "income";

    push(payment.created_at, {
      key: `payment-${payment.id}`,
      icon: "finance",
      /* `created_at` proves the record was made. It does not prove money
       * moved on that date, so the sentence says "recorded". */
      action: income ? "Income recorded" : "Expense recorded",
      subject: payment.description || payment.details || null,
      amount: Number(payment.amount || 0) || null,
      to: "/payments",
    });
  }

  for (const invoice of invoices) {
    push(invoice.created_at, {
      key: `invoice-${invoice.id}`,
      icon: "invoices",
      action: "Invoice raised",
      subject: invoice.invoice_number ? `INV ${invoice.invoice_number}` : null,
      amount: Number(invoice.amount || 0) || null,
      to: "/invoices",
    });
  }

  for (const tender of tenders) {
    /* `created_at` ONLY. The previous sort fell back to `due_date`, which is
     * a future deadline and would place a tender in "recent" by when it is
     * owed rather than when it appeared. */
    push(tender.created_at, {
      key: `tender-${tender.id}`,
      icon: "tenders",
      action: "Tender created",
      subject: tender.tender_name || tender.title || null,
      amount: Number(tender.estimated_value || 0) || null,
      to: "/tenders",
    });
  }

  /* Newest first. `key` breaks ties so the order is stable across renders
   * when two records share a timestamp. */
  events.sort((a, b) => b.date - a.date || a.key.localeCompare(b.key));

  return events.slice(0, VISIBLE_LIMIT);
}

/** Consecutive events sharing a local calendar day. */
function groupByDay(events) {
  const groups = [];

  for (const event of events) {
    const key = dayKey(event.date);
    const last = groups[groups.length - 1];

    if (last && last.key === key) last.events.push(event);
    else groups.push({ key, label: groupLabel(event.date), events: [event] });
  }

  return groups;
}

function ActivityStream({ payments = [], invoices = [], tenders = [] }) {
  const groups = useMemo(
    () => groupByDay(buildEvents({ payments, invoices, tenders })),
    [payments, invoices, tenders]
  );

  const isEmpty = groups.length === 0;

  return (
    <section className="ui-activity" aria-labelledby="activity-heading">
      <div className="ui-activity__head">
        <h2 id="activity-heading" className="ui-activity__title">
          What changed
        </h2>

        {/* One route to full history, not one per record type. */}
        <AppLink to="/activity" className="ui-activity__all">
          Full activity log
        </AppLink>
      </div>

      {isEmpty ? (
        /*
         * No action offered, deliberately. Activity fills as a SIDE EFFECT of
         * work done elsewhere; there is nothing a user can do to "add an
         * activity", so inventing a button here would be a false affordance.
         */
        <EmptyState
          title="Nothing has happened yet"
          description="Payments, invoices and tenders appear here as they are recorded, newest first."
        />
      ) : (
        <ol className="ui-activity__groups">
          {groups.map((group) => (
            <li key={group.key} className="ui-activity__group">
              <h3 className="ui-activity__day">{group.label}</h3>

              <ul className="ui-activity__list">
                {group.events.map((event) => {
                  const relative = relativeTime(event.date, event.precise);

                  return (
                    <li key={event.key} className="ui-activity__item">
                      <AppLink to={event.to} className="ui-activity__row">
                        <span className="ui-activity__mark" aria-hidden="true">
                          <Icon name={event.icon} size={16} />
                        </span>

                        <span className="ui-activity__detail">
                          <span className="ui-activity__action">
                            {event.action}
                            {event.subject ? (
                              <span className="ui-activity__subject">
                                {" "}
                                · {event.subject}
                              </span>
                            ) : null}
                          </span>

                          {event.amount ? (
                            <span className="ui-activity__amount">
                              {formatCurrency(event.amount)}
                            </span>
                          ) : null}
                        </span>

                        {/*
                          `dateTime` carries the machine-readable instant even
                          when the visible text is a day heading only.
                        */}
                        <time
                          className="ui-activity__time"
                          dateTime={event.date.toISOString()}
                        >
                          {relative ?? group.label}
                        </time>
                      </AppLink>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {/*
        Stated rather than silently omitted: workforce and site records carry
        no timestamp, so they cannot be placed on a timeline honestly.
      */}
      <p className="ui-activity__note">
        Workforce and site records carry no change timestamp, so they are not
        shown here.
      </p>
    </section>
  );
}

export default ActivityStream;
