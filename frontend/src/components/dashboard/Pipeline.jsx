/**
 * File purpose:
 * The Dashboard's third question: what's moving?
 *
 * Rendered by:
 * - DashboardPage
 *
 * WHAT THIS REPLACED (D3)
 * Three sections that overlapped: "Project Portfolio" (four filled status
 * tiles), "Project Status" (nine table rows) and "Upcoming Tenders" (a table
 * of the next seven days). Between them: Running counted twice, Pending twice,
 * Completed three times, Overdue twice, Due Soon twice, and three separate
 * links to the same register.
 *
 * THE BOUNDARY WITH D1, WHICH DECIDES THIS DESIGN
 * `dueSoonTenders` — the source of the old "Upcoming Tenders" panel — is
 * exactly the set the attention spine already renders as objects. That panel
 * was a strictly worse duplicate of a section higher up the same page: same
 * rows, less identity, no action.
 *
 * So the split is NOT "D1 takes some tenders, D3 takes the rest by type". It
 * is by CONDITION:
 *
 *   D1 owns work that needs intervention — overdue, due inside 7 days, or
 *   awaiting submission.
 *
 *   D3 owns work that is moving normally — running now, or due beyond that
 *   horizon.
 *
 * `ATTENTION_HORIZON_DAYS` is therefore shared with the spine's own window by
 * construction: this section takes the COMPLEMENT of it, so no tender can ever
 * appear in both places. If that horizon changes, both must change together,
 * which is why the constant carries this comment.
 *
 * NO STATUS COLOUR, BY CONSTRUCTION
 * Every item here is, by definition, not late. Running and pending are
 * ordinary lifecycle states and are painted neutrally. Anything genuinely late
 * is in D1, where red still means something. This section introduces no
 * semantic colour at all — which is the point: the old tiles made routine work
 * louder than real risk.
 *
 * PROGRESS IS REAL DATA
 * `progress_percent` is a source field on the tender row, so the progress rail
 * reflects recorded progress. It is only rendered when the field is actually
 * present and numeric — never inferred from dates or status, which would be
 * fabricating a measurement.
 *
 * ORDERING
 * Deterministic and documented: soonest due date first, undated last, and
 * estimated value breaking ties with the larger commitment first.
 */

import { useMemo } from "react";

import AppLink from "../ui/AppLink";
import EmptyState from "./EmptyState";
import { formatCurrency } from "../../utils/currency";

/**
 * Days of lookahead that belong to the ATTENTION spine, not here.
 *
 * Must stay in step with `AttentionSpine`'s own window. This section renders
 * the complement, so a mismatch would either duplicate a tender across two
 * sections or drop it from both.
 */
const ATTENTION_HORIZON_DAYS = 7;

/** Beyond this the section stops being a summary and becomes the register. */
const VISIBLE_LIMIT = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

const normalise = (value) => String(value || "").trim().toLowerCase();

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysFromToday(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - startOfToday().getTime()) / DAY_MS);
}

function relativeDue(days) {
  if (days === null) return "No due date";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

/**
 * Recorded progress, or null.
 *
 * Null and zero are deliberately different: a tender with no recorded progress
 * shows no rail at all, rather than an empty rail implying a measured 0%.
 */
function progressOf(tender) {
  const raw = tender.progress_percent;
  if (raw === null || raw === undefined || raw === "") return null;

  const value = Number(raw);
  if (!Number.isFinite(value)) return null;

  return Math.max(0, Math.min(100, value));
}

/** Soonest first, undated last, larger value breaking ties. */
function byDueThenValue(a, b) {
  const aDays = a.days === null ? Number.POSITIVE_INFINITY : a.days;
  const bDays = b.days === null ? Number.POSITIVE_INFINITY : b.days;

  return aDays - bDays || b.value - a.value;
}

function toItem(tender) {
  return {
    id: tender.id,
    title: tender.tender_name || tender.title || `Tender #${tender.id}`,
    client: tender.client_name || null,
    value: Number(tender.estimated_value || 0),
    days: daysFromToday(tender.due_date),
    progress: progressOf(tender),
    /* Printed verbatim. The status is the server's word, never remapped and
     * never given a colour by fallback. */
    status: String(tender.status || "").trim(),
  };
}

function PipelineRow({ item }) {
  return (
    <li className="ui-pipe__item">
      <AppLink to={`/tenders/${item.id}`} className="ui-pipe__row">
        <span className="ui-pipe__detail">
          <span className="ui-pipe__item-title">{item.title}</span>

          <span className="ui-pipe__facts">
            {item.client ? <span>{item.client}</span> : null}
            {item.value > 0 ? (
              <span className="ui-pipe__value">{formatCurrency(item.value)}</span>
            ) : null}
            <span>{relativeDue(item.days)}</span>
          </span>
        </span>

        {item.progress !== null ? (
          <span className="ui-pipe__progress">
            <span
              className="ui-pipe__progress-rail"
              role="img"
              aria-label={`${item.progress} percent complete`}
            >
              <span
                className="ui-pipe__progress-fill"
                style={{ inlineSize: `${item.progress}%` }}
              />
            </span>
            <span className="ui-pipe__progress-value">{item.progress}%</span>
          </span>
        ) : null}
      </AppLink>
    </li>
  );
}

function Pipeline({ tenders = [] }) {
  const { active, next, committed } = useMemo(() => {
    const open = tenders.filter(
      (tender) => !["completed", "passed"].includes(normalise(tender.status))
    );

    const activeItems = [];
    const nextItems = [];

    for (const tender of open) {
      const item = toItem(tender);
      const status = normalise(tender.status);

      /*
       * The complement of the attention window. A tender that is overdue, due
       * inside the horizon, or awaiting submission belongs to D1 and is
       * skipped here so it is never shown twice.
       */
      const needsAttention =
        status === "pending" ||
        (item.days !== null && item.days <= ATTENTION_HORIZON_DAYS);

      if (needsAttention) continue;

      if (status === "running") activeItems.push(item);
      else nextItems.push(item);
    }

    activeItems.sort(byDueThenValue);
    nextItems.sort(byDueThenValue);

    return {
      active: activeItems,
      next: nextItems,
      committed: activeItems.reduce((total, item) => total + item.value, 0),
    };
  }, [tenders]);

  const nothingMoving = active.length === 0 && next.length === 0;

  return (
    <section className="ui-pipe" aria-labelledby="pipeline-heading">
      <div className="ui-pipe__head">
        <h2 id="pipeline-heading" className="ui-pipe__title">
          Work in flight
        </h2>

        {committed > 0 ? (
          <p className="ui-pipe__context">
            {formatCurrency(committed)} committed across {active.length}{" "}
            {active.length === 1 ? "project" : "projects"}
          </p>
        ) : null}
      </div>

      {nothingMoving ? (
        tenders.length === 0 ? (
          /* Never started: the next step is creating work. */
          /*
           * DASH-007. No action here, deliberately. On a first-run page the
           * attention spine already offers "Create your first tender", and
           * repeating the same destination two sections later is the
           * duplicated-workflow problem this programme has been removing. One
           * primary action per page; this section explains, and lets the spine
           * ask.
           */
          <EmptyState
            title="No work in flight"
            description="Tenders you create appear here while they are running, so you can see what is progressing without opening the register."
          />
        ) : (
          /*
           * Tenders exist, but all of them are either urgent (and therefore in
           * the attention spine above) or closed. Not a first-run state, so it
           * points at where they actually are rather than telling the user to
           * create something they already have.
           */
          <EmptyState
            title="Nothing running right now"
            description="Every open tender either needs you at the top of this page or is due within the next seven days."
          />
        )
      ) : (
        <div className="ui-pipe__groups">
          {active.length > 0 ? (
            <div className="ui-pipe__group">
              <h3 className="ui-pipe__group-title">Running now</h3>

              <ul className="ui-pipe__list">
                {active.slice(0, VISIBLE_LIMIT).map((item) => (
                  <PipelineRow key={item.id} item={item} />
                ))}
              </ul>
            </div>
          ) : null}

          {next.length > 0 ? (
            <div className="ui-pipe__group">
              <h3 className="ui-pipe__group-title">Coming up</h3>

              <ul className="ui-pipe__list">
                {next.slice(0, VISIBLE_LIMIT).map((item) => (
                  <PipelineRow key={item.id} item={item} />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {/*
        One link out of this section, not the three the replaced panels had
        between them — and none at all when the section is empty, since the
        empty state above already explains where work comes from and a link to
        an empty register helps nobody (DASH-007).
      */}
      {nothingMoving ? null : (
        <AppLink to="/tenders" className="ui-pipe__all">
          Open the tender register
        </AppLink>
      )}
    </section>
  );
}

export default Pipeline;
