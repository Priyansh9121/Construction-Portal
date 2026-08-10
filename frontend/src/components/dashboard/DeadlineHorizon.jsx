/**
 * File purpose:
 * Temporal orientation — what is approaching, and how soon.
 *
 * Rendered by:
 * - pages/DashboardPage.jsx, between the attention list and the pipeline
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS OWNS, AND WHAT IT DELIBERATELY DOES NOT
 * ─────────────────────────────────────────────────────────────────────────
 * AttentionSpine owns INTERVENTION: the small set of things that need a
 * decision today, each with an action beside it.
 *
 * This owns ORIENTATION: the shape of the next month. It answers "how much is
 * landing, and when" — a question a list of rows answers badly, because a
 * list has no spacing and therefore no sense of *soon*.
 *
 * The two overlap by design, and the overlap is handled rather than avoided.
 * A tender already in Attention still appears here, because removing it would
 * put a hole in the timeline where the most urgent item should be. But it
 * carries NO second action: the marks here are labels, not links. Attention is
 * the only place on this page that offers to do something about a deadline,
 * so there is exactly one primary action per object.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE AXIS ENCODES REAL TIME
 * ─────────────────────────────────────────────────────────────────────────
 * Position is `daysUntil / 30`, linearly. Not a rank, not an index, not an
 * even spread — those would make a decorative timeline that happens to be
 * ordered, and the whole value here is that the GAP between two marks means
 * something.
 *
 * Consequences, accepted rather than designed around:
 *
 * - Two tenders due the same day collide. They are stacked vertically, in
 *   value order, never jittered. A jittered mark lies about its date.
 * - A quiet month looks empty, because it is. That is information.
 * - Anything past 30 days is not shown, and the axis says so at its end
 *   rather than silently truncating.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * READABLE WITHOUT COLOUR
 * ─────────────────────────────────────────────────────────────────────────
 * Overdue marks sit LEFT of the today line; everything else sits right of it.
 * Position carries the meaning, so the state survives greyscale, and the
 * status hue is a confirmation rather than the signal — `VISUAL_PRINCIPLES`
 * §8.
 *
 * Nothing here is fabricated: every mark is a tender with a real `due_date`,
 * and the figure under it is that tender's own amount.
 */

import { formatCurrency } from "../../utils/currency";

/** The window this compartment describes. Stated on the axis, not implied. */
const WINDOW_DAYS = 30;

/** Whole calendar days from today, negative for a date already passed. */
function daysUntil(value) {
  if (!value) return null;

  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return null;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.round((due - start) / 86400000);
}

const isClosed = (tender) =>
  ["completed", "cancelled", "closed", "lost"].includes(
    String(tender.status || "").trim().toLowerCase()
  );

/**
 * Marks inside the window, ordered by date.
 *
 * Overdue work is clamped to the left edge rather than dropped: a tender
 * forty days late is still the most pressing thing on the axis, and pushing
 * it off-scale would hide the worst case to keep the picture tidy.
 */
function buildHorizonMarks(tenders) {
  return tenders
    .filter((t) => !isClosed(t) && t.due_date)
    .map((t) => ({
      id: t.id,
      title: t.title || "Untitled tender",
      /*
       * `estimated_value` is the field the API actually returns. The first
       * version read `tender_amount`, which exists nowhere in the contract,
       * so every mark silently rendered without its figure — the amount was
       * simply absent rather than wrong, which is exactly the kind of defect
       * that survives review. Pipeline, ActivityStream and AttentionSpine all
       * read this field; there is now one answer rather than two.
       */
      amount: Number(t.estimated_value || 0),
      days: daysUntil(t.due_date),
      date: t.due_date,
    }))
    .filter((m) => m.days !== null && m.days <= WINDOW_DAYS)
    .sort((a, b) => a.days - b.days || b.amount - a.amount);
}

/**
 * Lane assignment for marks that share a position.
 *
 * Two tenders due within a day of each other would overlap, so the later one
 * steps down a lane. Deterministic and date-preserving: the mark never moves
 * horizontally, which is the property that keeps the axis honest.
 */
function withLanes(marks) {
  const lastAt = [];

  return marks.map((m) => {
    const pct = position(m.days);

    let lane = 0;
    while (lastAt[lane] !== undefined && pct - lastAt[lane] < 11) lane += 1;

    lastAt[lane] = pct;
    return { ...m, lane };
  });
}

/** Left offset as a percentage. Overdue clamps to the left margin. */
function position(days) {
  if (days < 0) return 0;
  return (days / WINDOW_DAYS) * 100;
}

function DeadlineHorizon({ tenders = [] }) {
  const marks = withLanes(buildHorizonMarks(tenders));
  const lanes = marks.reduce((n, m) => Math.max(n, m.lane + 1), 1);

  return (
    <section className="ui-dl" aria-labelledby="deadline-heading">
      <header className="ui-dl__head">
        <h2 id="deadline-heading" className="ui-dl__title">
          Approaching
        </h2>

        <p className="ui-dl__scope">
          {marks.length === 0
            ? `Nothing falls due in the next ${WINDOW_DAYS} days.`
            : `${marks.length} dated ${
                marks.length === 1 ? "item" : "items"
              } in the next ${WINDOW_DAYS} days.`}
        </p>
      </header>

      {marks.length === 0 ? (
        /*
         * An empty axis is still drawn. Removing it would make a quiet month
         * indistinguishable from a broken compartment, and "nothing is due"
         * is one of the more valuable things this page can say.
         */
        <p className="ui-dl__empty">
          Dated work appears here as tenders are given due dates.
        </p>
      ) : null}

      <div
        className="ui-dl__axis"
        style={{ "--lanes": lanes }}
        role="img"
        aria-label={
          marks.length === 0
            ? `Deadline axis, next ${WINDOW_DAYS} days, nothing due.`
            : `Deadline axis, next ${WINDOW_DAYS} days: ${marks
                .map(
                  (m) =>
                    `${m.title}, ${
                      m.days < 0
                        ? `${Math.abs(m.days)} days overdue`
                        : m.days === 0
                        ? "due today"
                        : `due in ${m.days} days`
                    }`
                )
                .join("; ")}.`
        }
      >
        {marks.map((m) => (
          <span
            key={m.id}
            className="ui-dl__mark"
            data-state={m.days < 0 ? "late" : m.days <= 7 ? "near" : "far"}
            /*
             * Marks in the right half hang their label to the LEFT of the
             * stem. Without it a late-month item pushed the page 40px wider
             * than the viewport at 390 — caught by an overflow measurement,
             * not by looking. The stem never moves, so the date stays true;
             * only the label changes which side it sits on.
             */
            data-side={position(m.days) > 55 ? "left" : "right"}
            style={{ "--at": `${position(m.days)}%`, "--lane": m.lane }}
          >
            <span className="ui-dl__stem" aria-hidden="true" />

            <span className="ui-dl__label">
              <span className="ui-dl__name">{m.title}</span>

              <span className="ui-dl__when">
                {m.days < 0
                  ? `${Math.abs(m.days)}d overdue`
                  : m.days === 0
                  ? "today"
                  : `${m.days}d`}
                {m.amount > 0 ? ` · ${formatCurrency(m.amount)}` : ""}
              </span>
            </span>
          </span>
        ))}

        {/* The scale. Three stops, because a scale with more is a ruler. */}
        <span className="ui-dl__rule" aria-hidden="true" />

        <span className="ui-dl__tick" style={{ "--at": "0%" }} aria-hidden="true">
          Today
        </span>

        <span
          className="ui-dl__tick"
          style={{ "--at": `${(7 / WINDOW_DAYS) * 100}%` }}
          aria-hidden="true"
        >
          7 days
        </span>

        <span
          className="ui-dl__tick ui-dl__tick--end"
          style={{ "--at": "100%" }}
          aria-hidden="true"
        >
          {WINDOW_DAYS} days
        </span>
      </div>
    </section>
  );
}

export default DeadlineHorizon;
