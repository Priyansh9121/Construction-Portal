/**
 * File purpose:
 * The Site Operations context card and its operational module navigation —
 * the two things that orient a supervisor before they start entering data.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS DATE-ONLY
 * ---------------------------------------------------------------------------
 * The original design called for a tender selector and a site selector here
 * alongside the date. It does not have them, deliberately.
 *
 * Site Operations records are not attributed to a tender or a site today. The
 * API accepts `tender_id` and `site_id` on a material create (they default to
 * null) and offers tender filters on labour and banking, but the frontend has
 * never sent or filtered by either — every row in `site_material_entries` has
 * both columns null.
 *
 * Adding selectors would mean new entries start carrying attribution while
 * every historical row stays null, so any tender-filtered report would
 * silently exclude all prior data, and material entries carry an
 * `approval_status` whose routing could shift. That is a data-migration
 * decision, not a layout one — tracked as **SITE-OPS-DATA-01**.
 *
 * So this card shows the one dimension that genuinely exists: the working
 * date. It is presentational — it does not filter the register and does not
 * set the value any module submits. Each module keeps its own `entry_date`
 * field exactly as it was.
 *
 * Props:
 * - workingDate  ISO date string (YYYY-MM-DD) for the site's local today
 * - activeModule the module label currently open
 * - stats        optional [{ label, value }] shown as context chips
 *
 * Accessibility:
 * - `<time dateTime>` carries the machine-readable date.
 * - The module navigation is a real tablist: arrow keys move between tabs,
 *   Home/End jump to the ends, and only the active tab is in the tab order
 *   (the WAI-ARIA roving-tabindex pattern). Without this a keyboard user has
 *   to Tab through every module to reach the panel.
 */

import { useRef } from "react";

import Icon from "../ui/Icon";

/** Formats an ISO date for display without pulling in a date library. */
function formatWorkingDate(iso) {
  const date = new Date(`${iso}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return { label: iso, relative: "" };
  }

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const dayDelta = Math.round((startOfToday - date) / (24 * 60 * 60 * 1000));

  const label = date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (dayDelta === 0) return { label, relative: "Today" };
  if (dayDelta === 1) return { label, relative: "Yesterday" };
  if (dayDelta > 1) return { label, relative: `${dayDelta} days ago` };

  return { label, relative: "" };
}

export function SiteOpsContextCard({ workingDate, activeModule, stats = [] }) {
  const { label, relative } = formatWorkingDate(workingDate);

  return (
    <section className="ops-context" aria-label="Working context">
      <div className="ops-context-primary">
        <span className="ops-context-icon" aria-hidden="true">
          <Icon name="calendar" size={20} />
        </span>

        <div className="ops-context-date">
          <span className="ops-context-label">Working date</span>

          <strong>
            <time dateTime={workingDate}>{label}</time>
          </strong>
        </div>

        {relative ? (
          <span className="ops-context-relative">{relative}</span>
        ) : null}
      </div>

      <dl className="ops-context-meta">
        <div>
          <dt>Module</dt>
          <dd>{activeModule}</dd>
        </div>

        {stats.map((stat) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Operational module navigation.
 *
 * A horizontally scrolling tablist on a phone, a plain row on desktop.
 * Scrolling rather than wrapping, and never a "more" menu: every module has
 * to stay one tap away — burying Banking or Access Requests behind an
 * overflow control on the screen a supervisor uses on site is exactly the
 * kind of tidying that costs someone a job.
 */
export function ModuleTabs({ tabs, active, onChange }) {
  const listRef = useRef(null);

  /*
   * Roving tabindex. Arrow keys move between tabs, Home/End jump to the
   * ends, and focus follows selection — the standard WAI-ARIA tabs pattern.
   */
  const handleKeyDown = (event) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];

    if (!keys.includes(event.key)) {
      return;
    }

    event.preventDefault();

    const index = tabs.findIndex((tab) => tab.key === active);
    let next = index;

    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;

    onChange(tabs[next].key);

    // Move real focus too, so the user is on the tab they just selected.
    listRef.current
      ?.querySelectorAll('[role="tab"]')
      ?.[next]?.focus();
  };

  return (
    <nav
      className="ops-modules"
      ref={listRef}
      role="tablist"
      aria-label="Operational modules"
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`ops-tab-${tab.key}`}
            aria-selected={isActive}
            aria-controls={`ops-panel-${tab.key}`}
            // Only the active tab is reachable by Tab; arrows do the rest.
            tabIndex={isActive ? 0 : -1}
            className={`ops-module ${isActive ? "ops-module--active" : ""}`}
            onClick={() => onChange(tab.key)}
          >
            <Icon name={tab.icon} size={18} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default SiteOpsContextCard;
