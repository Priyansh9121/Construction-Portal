/**
 * File purpose:
 * The drawing sheet's title block, at the foot of the page.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY A PAGE NEEDS A BOTTOM
 * ─────────────────────────────────────────────────────────────────────────
 * A dashboard that simply stops leaves the reader unsure whether they have
 * seen everything — precisely the residue of suspicion `PRODUCT_SOUL` §5 says
 * the product must not leave. A title block closes it.
 *
 * It also does the identity work no logo is doing. Every construction drawing
 * carries one, and a reader who has held a drawing recognises the convention
 * before reading a word of it.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * EVERY FIELD IS DERIVED
 * ─────────────────────────────────────────────────────────────────────────
 * A title block full of invented metadata would be the worst thing this
 * product could put on a page: the convention's whole authority comes from a
 * real one being accurate.
 *
 * So there is no revision number, no drawn-by, no scale and no project code.
 * The product does not have those, and inventing them would be forgery
 * dressed as craft. What is here is what can be defended:
 *
 *   route   where you are
 *   date    today, from the device clock
 *   due     dated work overdue or falling due soon, passed in from the
 *           figures the page already derived rather than recomputed
 *
 * The label names what the number counts. An earlier version said "OPEN"
 * against a count of dated work, which disagreed with the attention headline
 * above it — that headline counts undated work too. One word, two
 * derivations. A title block that contradicts the page is worse than no
 * title block.
 */

const SHEET = "OPERATIONS / DASHBOARD";

/** `10 AUG 2026` — drawing-sheet order, localised month name. */
function sheetDate(date) {
  const parts = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";

  return `${get("day")} ${get("month")} ${get("year")}`.toUpperCase();
}

function SheetFooter({ dueCount = 0 }) {
  const today = new Date();

  return (
    <footer className="ui-sheet" aria-label="Sheet reference">
      <span className="ui-sheet__id">{SHEET}</span>

      <span className="ui-sheet__meta">
        {/*
          Day-month-year, in that order, assembled from parts rather than
          taken from `toLocaleDateString`. The locale form renders
          "AUG 10, 2026" under en-US; a drawing sheet reads "10 AUG 2026", and
          the convention is the point of the element.

          `formatToParts` keeps the month name localised while the ORDER stays
          fixed — the same technique the currency formatter uses to keep the
          Indian grouping while segmenting the figure.
        */}
        <time dateTime={today.toISOString().slice(0, 10)}>
          {sheetDate(today)}
        </time>

        <span aria-hidden="true"> · </span>

        {/*
          "DUE", not "OPEN".

          The first version said OPEN and was handed
          `dueSoonTenders + overdueTenders` — which counts dated work only.
          The attention headline counts a wider set, including tenders
          awaiting submission that carry no date. So the page read "3 things
          need you today" above and "2 OPEN" below: one word, two
          derivations, drifting on the first render.

          Caught by reading the whole page rather than the component. The
          label now names exactly what the number counts.
        */}
        <span>{dueCount} DUE</span>
      </span>
    </footer>
  );
}

export default SheetFooter;
