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

import { useEffect, useRef, useState } from "react";

import { formatCurrency } from "../../utils/currency";

/** The window this compartment describes. Stated on the axis, not implied. */
const WINDOW_DAYS = 30;

/*
 * ONE NUMBER GOVERNS BOTH THE LABEL AND THE GAP.
 *
 * A mark cannot overlap its neighbour if the space it is allotted is the same
 * space it is allowed to occupy. Two earlier versions each set one of these
 * independently and overprinted for it:
 *
 *   1. A fixed 11% lane gap — 121px of a 1440 axis, 39px of a 390 one. At
 *      field width seven marks collided into "Metro Depot ExtensioHarbour
 *      Yard FitoSubstation".
 *   2. A 132px gap against a label free to grow to 62% of the axis (222px at
 *      390). Fewer collisions, same defect.
 *
 * So `labelWidth` is computed once from the measured axis and drives BOTH: it
 * caps the label, and the lane gap is that cap plus a hair of clearance. The
 * bounds keep a name recognisable on a phone and stop a wide axis spending
 * everything on one tender.
 */
const LABEL_MIN_PX = 120;
const LABEL_MAX_PX = 200;
const LABEL_SHARE = 0.18;

/** Clearance between one mark's label and the next mark's stem. */
const CLEARANCE_PX = 10;

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

/*
 * Lane assignment by OCCUPIED SPAN, not by distance.
 *
 * A mark does not occupy its date — it occupies its date plus its label, and
 * which SIDE the label hangs on decides which way that span runs. Marks past
 * the midpoint hang left so a late-month item cannot push the page wider than
 * the viewport; everything else hangs right.
 *
 * The first version compared `pct - lastPct` and so only ever looked
 * rightward. A left-hanging mark at 60% and a right-hanging mark at 40% were
 * 20 points apart and passed the test, then printed on top of each other. The
 * measurement said 3 overlaps at 390 and 1 at 768 while every assertion
 * passed.
 *
 * Intervals fix it because they are the actual geometry. And `side` is
 * decided HERE, once, then handed to the renderer — deciding it in both
 * places is what let the two disagree.
 */
const HANGS_LEFT_PAST = 55;

function withLanes(marks, spanPct, clearancePct) {
  const lanes = [];

  return marks.map((m) => {
    const at = position(m.days);
    const left = at > HANGS_LEFT_PAST;
    const span = left ? [at - spanPct, at] : [at, at + spanPct];

    let lane = 0;
    for (;;) {
      const taken = lanes[lane] || (lanes[lane] = []);

      const collides = taken.some(
        ([start, end]) =>
          span[0] < end + clearancePct && start < span[1] + clearancePct
      );

      if (!collides) {
        taken.push(span);
        break;
      }

      lane += 1;
    }

    return { ...m, at, lane, side: left ? "left" : "right" };
  });
}

/** Left offset as a percentage. Overdue clamps to the left margin. */
function position(days) {
  if (days < 0) return 0;
  return (days / WINDOW_DAYS) * 100;
}

function DeadlineHorizon({ tenders = [] }) {
  /*
   * The axis measures itself.
   *
   * Everything about this compartment is a function of how wide it actually
   * is: the same seven tenders need one lane on a 1104px axis and four on a
   * 358px one. Deriving the lane gap from a breakpoint would guess at that;
   * observing the element knows it, and keeps working inside a narrowed
   * sidebar layout no media query describes.
   */
  const axisRef = useRef(null);
  const [axisWidth, setAxisWidth] = useState(0);

  useEffect(() => {
    const el = axisRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(([entry]) => {
      setAxisWidth(entry.contentRect.width);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const labelWidth = Math.round(
    Math.min(LABEL_MAX_PX, Math.max(LABEL_MIN_PX, axisWidth * LABEL_SHARE))
  );

  /* Before the first measurement the axis width is unknown; the fallback is
   * the ratio a desktop axis settles at, so the first paint is close and the
   * observer corrects it rather than reflowing from something absurd. */
  const spanPct = axisWidth > 0 ? (labelWidth / axisWidth) * 100 : 18;
  const clearancePct = axisWidth > 0 ? (CLEARANCE_PX / axisWidth) * 100 : 1;

  const marks = withLanes(buildHorizonMarks(tenders), spanPct, clearancePct);
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
        ref={axisRef}
        className="ui-dl__axis"
        style={{ "--lanes": lanes, "--mark-max": `${labelWidth}px` }}
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
             * Side and lane both come from `withLanes`, which is the only
             * thing that knows how much room a mark takes. Computing the side
             * here as well is exactly how the axis came to place marks the
             * lane logic thought were somewhere else.
             */
            data-side={m.side}
            style={{ "--at": `${m.at}%`, "--lane": m.lane }}
          >
            <span className="ui-dl__stem" aria-hidden="true" />

            <span className="ui-dl__label">
              <span className="ui-dl__name">{m.title}</span>

              {/*
                * Timing and amount are two spans rather than one string,
                * because on a narrow axis they need to be able to fall onto
                * two lines. As one `nowrap` string the figure painted straight
                * out of the box the lane logic had allotted the mark — the
                * marks did not overlap, their text did, which is a distinction
                * only a screenshot makes.
                *
                * They wrap rather than truncate. A clipped name is recoverable
                * from the row below; a clipped rupee figure is a misread
                * number, and this page does not truncate money.
                */}
              <span className="ui-dl__when">
                <span>
                  {m.days < 0
                    ? `${Math.abs(m.days)}d overdue`
                    : m.days === 0
                    ? "today"
                    : `${m.days}d`}
                </span>

                {m.amount > 0 ? (
                  <span className="ui-dl__amount">
                    {formatCurrency(m.amount)}
                  </span>
                ) : null}
              </span>
            </span>
          </span>
        ))}

        {/* The scale. Three stops, because a scale with more is a ruler. */}
        <span className="ui-dl__rule" aria-hidden="true" />

        {/*
          * The three stops carry modifier classes rather than being addressed
          * positionally. `:first-of-type` counts SPANS, and every mark on the
          * axis is a span too — so the rule meant for this tick was landing on
          * a mark, leaving "Today" hanging half off the left edge, and the
          * narrow-width rule that should hide the middle stop was hiding a
          * tender instead.
          */}
        <span
          className="ui-dl__tick ui-dl__tick--start"
          style={{ "--at": "0%" }}
          aria-hidden="true"
        >
          Today
        </span>

        <span
          className="ui-dl__tick ui-dl__tick--mid"
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
