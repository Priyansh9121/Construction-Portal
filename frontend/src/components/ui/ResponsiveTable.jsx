/**
 * File purpose:
 * The wrapper every data table sits inside. It owns the two things a table
 * needs that the table itself cannot provide: a keyboard-reachable scroll
 * region, and — when the table is a register of entities — the per-cell
 * labels that let it become a stack of cards on a phone.
 *
 * Props:
 * - mobile   "cards" | "scroll"  (default "scroll")
 *            "cards"  — below 768px each row becomes a labelled card.
 *                       Correct when a row is one independent entity:
 *                       a worker, a user, an invoice, a tender.
 *            "scroll" — the table keeps its columns and scrolls sideways.
 *                       Correct for financial matrices, where seeing the
 *                       columns beside each other IS the information.
 * - label    accessible name for the scroll region. Only meaningful for
 *            "scroll"; a card stack has nothing to scroll.
 * - children the <table>.
 *
 * ---------------------------------------------------------------------------
 * Why the labels are derived rather than written by hand
 * ---------------------------------------------------------------------------
 * The card layout works by printing each cell's column name beside its value,
 * read from `data-label`. The obvious implementation is to hand-write
 * `data-label="Status"` on every `<td>`. Across this codebase that is roughly
 * 500 attributes spread over 24 files — and, worse, it is a duplicate of the
 * `<th>` text sitting three lines above. The two drift: someone renames a
 * column, the header updates, the mobile label silently does not, and the
 * card now lies to the user.
 *
 * So the labels are taken from the `<thead>` at runtime and stamped onto the
 * cells by index. There is exactly one source of truth for a column's name —
 * its `<th>` — which is where it should have been all along.
 *
 * The stamping is a DOM write from an effect, which is worth being explicit
 * about: it is presentational only, it never changes what React renders, and
 * React will not fight it because `data-label` is not an attribute any of
 * these components set. A MutationObserver re-runs it when rows change, so a
 * filtered or paginated table stays labelled.
 *
 * ---------------------------------------------------------------------------
 * Accessibility
 * ---------------------------------------------------------------------------
 * - `tabIndex={0}` on a scrolling wrapper. axe's `scrollable-region-focusable`
 *   flagged 19 of these across 13 routes: a region that scrolls but cannot be
 *   focused is unreachable for anyone using a keyboard. Only applied when the
 *   region actually scrolls — a card stack does not, and an unnecessary tab
 *   stop is its own small harm.
 * - `role="region"` + `aria-label` only when a label is supplied. A region
 *   without an accessible name is itself a violation, so the role is opt-in
 *   rather than always-on.
 * - In card mode `<thead>` stays in the accessibility tree (`sr-only` in
 *   responsive.css, not `display: none`), so the table is still announced as
 *   a table.
 */

import { useCallback, useEffect, useRef } from "react";

function ResponsiveTable({
  mobile = "scroll",
  label,
  children,
  className = "",
  ...rest
}) {
  const ref = useRef(null);
  const isCards = mobile === "cards";

  /**
   * Copies each column's header text onto the cells beneath it.
   *
   * Indexed rather than matched by name, because that is the only thing a
   * table guarantees: the nth cell belongs to the nth column. Cells carrying
   * a colSpan are skipped — a spanning cell has no single column and
   * labelling it with the first one would be wrong.
   */
  const stampLabels = useCallback(() => {
    const root = ref.current;

    if (!root || !isCards) {
      return;
    }

    const table = root.querySelector("table");

    if (!table) {
      return;
    }

    const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
      th.textContent.trim()
    );

    if (headers.length === 0) {
      return;
    }

    table.querySelectorAll("tbody tr").forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        if (cell.tagName !== "TD") {
          return;
        }

        if (cell.colSpan > 1) {
          // Spans several columns — e.g. an "empty register" message. It has
          // no one column name, and a card shows it as a plain full-width row.
          cell.removeAttribute("data-label");
          return;
        }

        const header = headers[index];

        if (header) {
          cell.setAttribute("data-label", header);
        }
      });
    });
  }, [isCards]);

  useEffect(() => {
    if (!isCards) {
      return undefined;
    }

    stampLabels();

    const root = ref.current;

    if (!root) {
      return undefined;
    }

    /*
     * Rows are replaced whenever the user searches, filters or pages. Without
     * this the new rows would render unlabelled — which on a phone means a
     * card of bare values with nothing saying what they are.
     */
    const observer = new MutationObserver(stampLabels);

    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [isCards, stampLabels, children]);

  const classes = [
    "table-wrapper",
    isCards ? "table-wrapper--cards" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={ref}
      className={classes}
      // A card stack does not scroll sideways, so it needs neither a tab stop
      // nor a region role.
      tabIndex={isCards ? undefined : 0}
      role={!isCards && label ? "region" : undefined}
      aria-label={!isCards && label ? label : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

export default ResponsiveTable;
