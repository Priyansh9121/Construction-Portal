/**
 * File purpose:
 * Presentation primitives for the field-user portals — a compact header, a
 * current-assignment card, a required-actions panel and a summary tile.
 *
 * Why these exist:
 * The Worker Portal opened with four office-style KPI tiles (My Projects,
 * Pending Updates, Pending Expenses, Available Balance) and a five-tab strip.
 * It never showed the two things a worker actually opens it to check — which
 * site they are on today, and what they still owe. These primitives put that
 * first.
 *
 * Built for the phone. A worker reads this outdoors, one-handed, often with
 * gloves: large targets, flat surfaces, strong contrast, no gradients, and
 * plain words rather than the product's internal vocabulary.
 *
 * Rules these follow:
 * - No business logic. Every figure is computed by the page and passed in.
 * - No API calls, no data fetching.
 * - Status is never colour alone — a tone always travels with a text label.
 * - Money uses tabular figures so columns of amounts line up.
 *
 * Shared with the Subcontractor Portal later; that is why they live under
 * `portal/` rather than inside the Worker Portal page.
 */

import Icon from "../ui/Icon";

/* ==========================================================================
 * HEADER
 * ======================================================================== */

/**
 * The portal header.
 *
 * Compact by design: name, one line of context, and the account actions. The
 * old header spent three lines on a greeting plus a sentence explaining what
 * the portal is for — text a worker who opens this every morning does not
 * need to read again.
 *
 * `actions` is a slot rather than fixed buttons so the page keeps ownership
 * of what they do (export, logout) and their handlers.
 */
export function PortalHeader({ name, context, actions = null }) {
  return (
    <header className="portal-header">
      <div className="portal-header-identity">
        <h1>{name}</h1>
        {context ? <p>{context}</p> : null}
      </div>

      {actions ? <div className="portal-header-actions">{actions}</div> : null}
    </header>
  );
}

/* ==========================================================================
 * CURRENT ASSIGNMENT
 * ======================================================================== */

/**
 * Where the worker is today.
 *
 * This did not exist before. The portal listed assignment *counts* in a KPI
 * tile and buried the actual site and project inside a select element in the
 * update form — so the first question a worker has ("which site am I on?")
 * was the one thing the screen would not answer.
 *
 * Props:
 * - assignment  { site_name, tender_title, status, … } or null/undefined
 * - count       how many assignments exist, for the "and N more" line
 * - onViewAll   optional; shown only when there is more than one
 *
 * The no-assignment case is a real state, not an error: a worker between jobs
 * sees a plain explanation rather than an empty card.
 */
export function CurrentAssignmentCard({
  assignment,
  count = 0,
  onViewAll = null,
}) {
  if (!assignment) {
    return (
      <section className="portal-assignment portal-assignment--empty">
        <span className="portal-assignment-icon" aria-hidden="true">
          <Icon name="site" size={22} />
        </span>

        <div>
          <h2>No current assignment</h2>

          <p>
            You have not been assigned to a site yet. Your supervisor will
            assign one — nothing is needed from you right now.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="portal-assignment" aria-label="Current assignment">
      <span className="portal-assignment-icon" aria-hidden="true">
        <Icon name="site" size={22} />
      </span>

      <div className="portal-assignment-body">
        <p className="portal-assignment-label">Currently assigned to</p>

        {/* The site is the headline — it is what the worker travels to. */}
        <h2>{assignment.site_name || "Site"}</h2>

        <p className="portal-assignment-project">
          {assignment.tender_title || "Project"}
        </p>

        {count > 1 && onViewAll ? (
          <button
            type="button"
            className="portal-assignment-more"
            onClick={onViewAll}
          >
            View all {count} assignments
            <Icon name="chevron-right" size={16} />
          </button>
        ) : null}
      </div>
    </section>
  );
}

/* ==========================================================================
 * CURRENT PROJECT — the subcontractor's equivalent
 * ======================================================================== */

/**
 * Which project the subcontractor is working on.
 *
 * A sibling of `CurrentAssignmentCard`, not a mode of it. The two answer
 * different first questions and the difference is the point:
 *
 *   Worker         "which site do I travel to?"  → site is the headline
 *   Subcontractor  "which project am I on?"      → project is the headline,
 *                  with the site and the contract value beneath it
 *
 * Collapsing them into one component with a `variant` prop would mean a
 * prop-heavy abstraction whose branches never share a line of logic. They
 * share the CSS instead, which is where the design language actually lives.
 *
 * Props:
 * - project   { title, site_name, assigned_amount, status, due_date } | null
 * - count     how many assigned projects exist
 * - onViewAll optional; shown only when there is more than one
 * - money     currency formatter supplied by the page, so this component
 *             carries no formatting policy of its own
 *
 * Deliberately absent: bank details. The API returns the caller's own
 * `account_number` and `ifsc_code`, and the portal has never displayed them.
 * Do not start.
 */
export function CurrentProjectCard({
  project,
  count = 0,
  onViewAll = null,
  money = (value) => value,
}) {
  if (!project) {
    return (
      <section className="portal-assignment portal-assignment--empty">
        <span className="portal-assignment-icon" aria-hidden="true">
          <Icon name="tenders" size={22} />
        </span>

        <div>
          <h2>No active project</h2>

          <p>
            You have not been assigned to a project yet. Nothing is needed
            from you right now.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="portal-assignment" aria-label="Current project">
      <span className="portal-assignment-icon" aria-hidden="true">
        <Icon name="tenders" size={22} />
      </span>

      <div className="portal-assignment-body">
        <p className="portal-assignment-label">Currently working on</p>

        {/* The project is the headline; long tender names wrap. */}
        <h2>
          {project.title ||
            project.tender_title ||
            project.tender_name ||
            "Project"}
        </h2>

        <dl className="portal-project-facts">
          {project.site_name ? (
            <div>
              <dt>Site</dt>
              <dd>{project.site_name}</dd>
            </div>
          ) : null}

          {project.assigned_amount != null ? (
            <div>
              <dt>Assigned value</dt>
              <dd className="portal-project-money">
                {money(project.assigned_amount)}
              </dd>
            </div>
          ) : null}

          {project.due_date ? (
            <div>
              <dt>Due</dt>
              <dd>{String(project.due_date).slice(0, 10)}</dd>
            </div>
          ) : null}
        </dl>

        {count > 1 && onViewAll ? (
          <button
            type="button"
            className="portal-assignment-more"
            onClick={onViewAll}
          >
            View all {count} projects
            <Icon name="chevron-right" size={16} />
          </button>
        ) : null}
      </div>
    </section>
  );
}

/* ==========================================================================
 * REQUIRED ACTIONS
 * ======================================================================== */

/**
 * What the worker still owes.
 *
 * Renders nothing when the list is empty. A panel that is always present —
 * showing "0 pending" every day — stops being read, and then it fails on the
 * day it matters.
 *
 * Every item must come from data the portal already has. Do not invent
 * requirements the backend does not track.
 *
 * Props:
 * - items  [{ key, tone, icon, count, label, detail, onAction, actionLabel }]
 */
export function RequiredActionsPanel({ items = [] }) {
  const live = items.filter((item) => item.count > 0);

  if (live.length === 0) {
    return null;
  }

  return (
    <section className="portal-actions" aria-label="Needs your attention">
      <h2 className="portal-actions-heading">Needs your attention</h2>

      <ul className="portal-actions-list">
        {live.map((item) => (
          <li
            key={item.key}
            className="portal-action"
            data-tone={item.tone || "warning"}
          >
            <span className="portal-action-icon" aria-hidden="true">
              <Icon name={item.icon || "alert"} size={18} />
            </span>

            <span className="portal-action-body">
              <strong>
                {item.count} {item.label}
              </strong>

              {item.detail ? <span>{item.detail}</span> : null}
            </span>

            {item.onAction ? (
              <button
                type="button"
                className="secondary-btn portal-action-btn"
                onClick={item.onAction}
              >
                {item.actionLabel || "Open"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ==========================================================================
 * SUMMARY TILE
 * ======================================================================== */

/**
 * One figure with a label.
 *
 * Replaces the bare `<div className="card"><p>…</p><h2>…</h2></div>` the
 * portals repeated: that markup put a `<h2>` on a *number*, which gives a
 * screen reader a heading called "3" and breaks the document outline.
 *
 * Props:
 * - label, value, detail, tone ("success" | "warning" | "danger" | undefined),
 *   money (use tabular figures)
 */
export function PortalSummaryCard({
  label,
  value,
  detail = null,
  tone = null,
  money = false,
}) {
  return (
    <div className="portal-summary" data-tone={tone || undefined}>
      <span className="portal-summary-label">{label}</span>

      <strong
        className={`portal-summary-value${money ? " portal-summary-value--money" : ""}`}
      >
        {value}
      </strong>

      {detail ? <span className="portal-summary-detail">{detail}</span> : null}
    </div>
  );
}

export default PortalHeader;
