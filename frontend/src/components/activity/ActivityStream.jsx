/**
 * File purpose:
 * The Activity Log's audit trail, rendered as a date-grouped stream rather
 * than a six-column table.
 *
 * Why this replaced the table:
 * An audit trail is read chronologically — "what happened, most recent
 * first" — not compared column-by-column. The table forced six columns onto
 * a phone, and its widest column (Details) held a run-on string like
 * `full name: Ravi · salary: 24000 → 26000 · status: active`, which is the
 * least readable possible form for structured data. Nothing on the page
 * benefited from column alignment, which is the only thing a table buys.
 *
 * Pattern reference (21st.dev, adapted — not installed; all of these are
 * shadcn/Tailwind and this project is neither):
 *   - List (7632) and Chrono Board (9216) — grouped chronological stream
 *   - Interactive Logs Table (10635) — expandable row detail
 *   - Timeline (1074) — the marker-and-rail spine
 * Deliberately NOT taken: the comment and reply affordances in Activity Feed
 * (19073). The portal has no such feature and inventing one would be a lie
 * about what the audit trail is.
 *
 * Props:
 * - rows  the activity records, newest first, exactly as the API returns them
 *
 * Grouping:
 * Records are bucketed by calendar day into "Today", "Yesterday" or a
 * formatted date. Buckets are derived by comparing local date components,
 * not by string-matching the timestamp — a substring compare breaks the
 * moment the API's format or the viewer's timezone shifts.
 *
 * Accessibility:
 * - Each day is a <section> labelled by its own <h3>, so a screen reader can
 *   move day by day.
 * - The stream is an ordered list: the order carries meaning.
 * - `<time dateTime>` carries the machine-readable timestamp.
 * - Metadata is a real disclosure — a <button> with aria-expanded and
 *   aria-controls, so it works from the keyboard and announces its state.
 *   It is collapsed by default; the summary line above it already answers
 *   "who did what to which record".
 * - The action is a word, never colour alone. It reads the row's `data-tone`
 *   for its frame colour, but the word itself is the carrier.
 *
 * Important notes:
 * - Presentational. It performs no fetching, no filtering and no permission
 *   decision; ActivityPage owns all of that and passes rows straight through.
 */

import { useId, useMemo, useState } from "react";

import Icon from "../ui/Icon";

/** Bookkeeping columns nobody auditing a change needs to read. */
const NOISE = new Set([
  "id",
  "company_id",
  "created_at",
  "updated_at",
  "password",
  "password_hash",
  "token",
  "reset_token",
  "reset_token_expires",
]);

/** Which icon and tone an action gets. Text always accompanies it. */
const ACTION_TONE = {
  CREATE: { tone: "success", icon: "plus" },
  UPDATE: { tone: "info", icon: "updates" },
  DELETE: { tone: "danger", icon: "alert" },
  LOGIN: { tone: "neutral", icon: "logout" },
  LOGOUT: { tone: "neutral", icon: "logout" },
};

function toneFor(action) {
  return ACTION_TONE[String(action || "").toUpperCase()] || {
    tone: "neutral",
    icon: "activity",
  };
}

/**
 * The day bucket a timestamp belongs to.
 *
 * Compares local calendar components rather than formatted strings, so it
 * stays correct across timezones and whatever format the API sends.
 */
function dayKeyOf(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { key: "unknown", label: "Unknown date", date: null };
  }

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const startOfRow = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const dayDelta = Math.round(
    (startOfToday - startOfRow) / (24 * 60 * 60 * 1000)
  );

  if (dayDelta === 0) {
    return { key: startOfRow.toISOString(), label: "Today", date };
  }

  if (dayDelta === 1) {
    return { key: startOfRow.toISOString(), label: "Yesterday", date };
  }

  return {
    key: startOfRow.toISOString(),
    label: date.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
    }),
    date,
  };
}

/** Structured key/value pairs for the expanded panel. */
function metadataOf(row) {
  const before = row.old_data ?? {};
  const after = row.new_data ?? {};

  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => !NOISE.has(key))
    .filter((key) => after[key] !== null && after[key] !== "");

  return keys.map((key) => {
    const was = before[key];
    const now = after[key];

    return {
      key,
      label: key.replace(/_/g, " "),
      // A genuine change shows both sides; a create shows only the value.
      changed: was !== undefined && String(was) !== String(now),
      from: was,
      to: now,
    };
  });
}

/** Renders a single value without letting an object blow up the layout. */
function renderValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function ActivityItem({ row }) {
  const [open, setOpen] = useState(false);

  const panelId = useId();
  const { tone, icon } = toneFor(row.action);
  const metadata = useMemo(() => metadataOf(row), [row]);

  const timestamp = new Date(row.created_at);
  const validTime = !Number.isNaN(timestamp.getTime());

  return (
    <li className="activity-item" data-tone={tone}>
      <span className="activity-marker" aria-hidden="true">
        <Icon name={icon} size={16} />
      </span>

      <div className="activity-body">
        <p className="activity-headline">
          <strong className="activity-actor">{row.user_name || "System"}</strong>{" "}
          <span className="activity-action">{row.action}</span>{" "}
          <span className="activity-target">
            {row.module.replace(/_/g, " ")}
            {row.record_id != null ? ` #${row.record_id}` : ""}
          </span>
        </p>

        <p className="activity-meta">
          {validTime ? (
            <time dateTime={timestamp.toISOString()}>
              {timestamp.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          ) : (
            <span>Unknown time</span>
          )}

          {row.user_email ? (
            <>
              <span aria-hidden="true"> · </span>
              <span className="activity-email">{row.user_email}</span>
            </>
          ) : null}
        </p>

        {metadata.length > 0 ? (
          <>
            <button
              type="button"
              className="activity-disclosure"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((previous) => !previous)}
            >
              <Icon name={open ? "chevron-down" : "chevron-right"} size={16} />
              {open ? "Hide details" : `Show details (${metadata.length})`}
            </button>

            {/*
              Rendered only when open. Keeping a hidden copy in the DOM would
              double every field for a screen reader walking the page, and an
              audit trail of 200 rows would carry a lot of invisible text.
            */}
            {open ? (
              <dl className="activity-metadata" id={panelId}>
                {metadata.map((entry) => (
                  <div className="activity-metadata-row" key={entry.key}>
                    <dt>{entry.label}</dt>

                    <dd>
                      {entry.changed ? (
                        <>
                          <span className="activity-from">
                            {renderValue(entry.from)}
                          </span>
                          <Icon
                            name="arrow-right"
                            size={14}
                            className="activity-arrow"
                          />
                          <span className="activity-to">
                            {renderValue(entry.to)}
                          </span>
                        </>
                      ) : (
                        renderValue(entry.to)
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </>
        ) : null}
      </div>
    </li>
  );
}

function ActivityStream({ rows = [] }) {
  /*
   * Bucket into days, preserving the order the API sent (newest first). A
   * Map keeps insertion order, so no re-sorting is needed and the server
   * stays the authority on ordering.
   */
  const groups = useMemo(() => {
    const byDay = new Map();

    rows.forEach((row) => {
      const { key, label } = dayKeyOf(row.created_at);

      if (!byDay.has(key)) {
        byDay.set(key, { label, items: [] });
      }

      byDay.get(key).items.push(row);
    });

    return [...byDay.entries()].map(([key, value]) => ({ key, ...value }));
  }, [rows]);

  return (
    <div className="activity-stream">
      {groups.map((group) => (
        <section
          className="activity-day"
          key={group.key}
          aria-label={group.label}
        >
          <h3 className="activity-day-heading">
            {group.label}
            <span className="activity-day-count">
              {group.items.length}
              {group.items.length === 1 ? " event" : " events"}
            </span>
          </h3>

          <ol className="activity-list">
            {group.items.map((row) => (
              <ActivityItem key={row.id} row={row} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

export default ActivityStream;
