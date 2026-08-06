/**
 * File purpose:
 * The dashboard's opening block: a short page header, and the "needs
 * attention" strip that answers the first question a manager opens the
 * portal to ask.
 *
 * What this replaced, and why:
 * This used to be a full-bleed blue gradient banner containing the words
 * "Good Afternoon", the product's own name set at ~56px, a marketing
 * sentence ("Track finance, tenders, sites, workers and project progress in
 * one place"), and four glass tiles showing Income / Expense / Profit /
 * Running.
 *
 * Four things were wrong with it:
 *
 *   1. It told the user nothing. The product name is already in the sidebar
 *      and the topbar; restating it in the largest type on the screen spent
 *      the most valuable area on zero information.
 *   2. Its four figures were duplicates — Total Income, Total Expense and
 *      Net Profit all appear again as stat cards immediately below.
 *   3. On a phone it collapsed catastrophically: measured in Chromium at
 *      375px, "GOOD AFTERNOON" rendered one letter per line down the screen
 *      and the first tile sat outside the viewport.
 *   4. Oversized marketing headlines, gradient panels and decorative hero
 *      areas are all explicitly ruled out by the approved design direction.
 *
 * What it does now:
 * A restrained header, then only the things that need a human decision
 * today — overdue money, deadlines about to pass, and work waiting on
 * approval. Nothing is shown when there is nothing wrong: the strip
 * disappears entirely rather than rendering four reassuring green zeroes,
 * because a panel that is always present stops being read.
 *
 * Props:
 * - userName            for the greeting
 * - overdueInvoices     count of invoices past their due date
 * - overdueInvoiceTotal their combined value
 * - dueSoonTenders      count of tenders whose deadline is approaching
 * - overdueTenders      count of tenders whose deadline has passed
 * - pendingInvoices     count of invoices awaiting payment
 * - pendingTenders      count of tenders awaiting submission
 *
 * Rendered by:
 * - DashboardPage.jsx
 *
 * Accessibility:
 * - Each item states its condition in words. Severity is carried by an icon
 *   and the label, never by the colour alone.
 * - The strip is a <section> with an accessible name, so it can be reached
 *   and skipped as a unit.
 *
 * Important notes:
 * - Presentational. Every figure is computed in DashboardPage; this file
 *   performs no business logic and no formatting beyond currency.
 */

import { Link } from "react-router-dom";

import { formatCurrency } from "../utils/currency";
import Icon from "./ui/Icon";

/** Time-of-day greeting. Kept because it is one short line, not a banner. */
function greetingFor(date) {
  const hour = date.getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function DashboardHero({
  userName = "",
  overdueInvoices = 0,
  overdueInvoiceTotal = 0,
  dueSoonTenders = 0,
  overdueTenders = 0,
  pendingInvoices = 0,
  pendingTenders = 0,
}) {
  /*
   * Ordered by urgency, not by data source: money already late first, then
   * deadlines about to be missed, then the queue of things waiting.
   * `tone` drives the icon and the accent; the label carries the meaning.
   */
  const items = [
    {
      key: "overdue-invoices",
      tone: "danger",
      icon: "alert",
      count: overdueInvoices,
      label: overdueInvoices === 1 ? "Overdue invoice" : "Overdue invoices",
      detail: formatCurrency(overdueInvoiceTotal),
      to: "/invoices",
    },
    {
      key: "overdue-tenders",
      tone: "danger",
      icon: "alert",
      count: overdueTenders,
      label:
        overdueTenders === 1 ? "Tender past deadline" : "Tenders past deadline",
      detail: "Deadline passed",
      to: "/tenders",
    },
    {
      key: "due-soon",
      tone: "warning",
      icon: "clock",
      count: dueSoonTenders,
      label:
        dueSoonTenders === 1 ? "Tender closing soon" : "Tenders closing soon",
      detail: "Deadline approaching",
      to: "/tenders",
    },
    {
      key: "pending-invoices",
      tone: "warning",
      icon: "invoices",
      count: pendingInvoices,
      label:
        pendingInvoices === 1
          ? "Invoice awaiting payment"
          : "Invoices awaiting payment",
      detail: "Not yet settled",
      to: "/invoices",
    },
    {
      key: "pending-tenders",
      tone: "info",
      icon: "inbox",
      count: pendingTenders,
      label: pendingTenders === 1 ? "Tender to submit" : "Tenders to submit",
      detail: "Awaiting submission",
      to: "/tenders",
    },
  ].filter((item) => item.count > 0);

  return (
    <>
      <div className="page-intro">
        <p className="page-intro-greeting">
          {greetingFor(new Date())}
          {userName ? `, ${userName}` : ""}
        </p>

        <p className="page-intro-summary">
          {items.length === 0
            ? "Nothing needs attention right now."
            : `${items.length} ${
                items.length === 1 ? "item needs" : "items need"
              } attention.`}
        </p>
      </div>

      {items.length > 0 ? (
        <section className="attention-strip" aria-label="Needs attention">
          {items.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className="attention-card"
              data-tone={item.tone}
            >
              <span className="attention-icon" aria-hidden="true">
                <Icon name={item.icon} size={18} />
              </span>

              <span className="attention-body">
                <strong className="attention-count">{item.count}</strong>
                <span className="attention-label">{item.label}</span>
                <span className="attention-detail">{item.detail}</span>
              </span>

              <Icon
                name="chevron-right"
                size={16}
                className="attention-chevron"
              />
            </Link>
          ))}
        </section>
      ) : null}
    </>
  );
}

export default DashboardHero;
