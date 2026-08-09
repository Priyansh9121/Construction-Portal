/**
 * File purpose:
 * The audit trail.
 *
 * State:
 * - Local: filters for module, action, user and date range.
 *
 * Hooks and context:
 * - None; loads through notificationService
 *
 * API endpoints:
 * - GET /activity via services/notificationService.js
 *
 * Parent:
 * - AppLayout
 *
 * Important notes:
 * - Admin-only.
 * - The column is labelled 'Details' rather than 'Change' deliberately: the
 * - backend records what a record BECAME, not what it was before, so there
 * - is no before/after to show. See F-05.
 * - Credentials and account numbers are redacted before storage, so they
 * - cannot appear here even if a payload contained them.
 */

import {
  useCallback,
  useMemo,
  useState,
} from "react";

import ExportButtons from "../components/export/ExportButtons";
import ActivityStream from "../components/activity/ActivityStream";

import useAsyncResource from "../hooks/useAsyncResource";

import { getActivityLog } from "../services/notificationService";

/*
|--------------------------------------------------------------------------
| Activity log
|--------------------------------------------------------------------------
|
| Who changed what. Every mutation on payments, worker allocations and
| expenses, daily update approvals, tenders and their children, and user
| management writes a row here.
|
| The table and this endpoint both existed with nothing writing to them, so
| it served an empty list; the writer is now attached and this is the view
| onto it. Reading it shows activity across the whole company, so the API
| restricts it to admins and managers.
|
*/

const MODULES = [
  "payments",
  "tenders",
  "tender_documents",
  "tender_materials",
  "tender_banking",
  "tender_subcontractors",
  "tender_finance",
  "worker_assignments",
  "worker_allocations",
  "worker_expenses",
  "daily_update_approvals",
  "users",
];

const ACTIONS = [
  "create",
  "update",
  "delete",
  "restore",
  "approve",
  "reject",
  "assign",
  "remove",
];

/*
 * Fields that say nothing about what a person did.
 */
const NOISE = new Set([
  "id",
  "company_id",
  "created_at",
  "updated_at",
  "is_deleted",
  "deleted_at",
  "deleted_by",
]);

/**
 * Renders one stored value.
 *
 * Nested rows arrive as objects and arrays — a tender carries its sites,
 * for instance — and String() turns those into "[object Object]".
 */
const show = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }

  if (typeof value === "object") {
    return JSON.stringify(value).slice(0, 60);
  }

  return String(value);
};

/**
 * Summarises what the row records.
 *
 * The writer sits on the response, so for a create or an update it sees
 * the record as it ended up rather than a before/after pair. That still
 * answers who touched what and what it became; it is not a field-level
 * diff, and the column is labelled accordingly.
 */
const describeChange = (row) => {
  const before = row.old_data ?? {};
  const after = row.new_data ?? {};

  const keys = [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ]
    .filter((key) => !NOISE.has(key))
    .filter((key) => after[key] !== null && after[key] !== "")
    .slice(0, 6);

  if (keys.length === 0) {
    return "—";
  }

  return keys
    .map((key) => {
      const was = before[key];
      const now = after[key];

      const label = key.replace(/_/g, " ");

      if (was === undefined || String(was) === String(now)) {
        return `${label}: ${show(now)}`;
      }

      return `${label}: ${show(was)} → ${show(now)}`;
    })
    .join("  ·  ");
};

/*
 * The API answers with a page and cannot report a total, so a full page and a
 * truncated one are indistinguishable unless the interface says which it is.
 * Named rather than inlined because the scope line has to quote it.
 */
const PAGE_LIMIT = 200;

function ActivityPage() {
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const load = useCallback(async () => {
    const { activity } = await getActivityLog({
      limit: PAGE_LIMIT,
      ...(moduleFilter ? { module: moduleFilter } : {}),
      ...(actionFilter ? { action: actionFilter } : {}),
    });

    return activity;
  }, [moduleFilter, actionFilter]);

  const {
    data: rows,
    loading,
    error,
    loadedAt,
    reload,
  } = useAsyncResource(load, { label: "activity" });

  const filtered = Boolean(moduleFilter || actionFilter);

  /*
   * The scope, in words.
   *
   * `INTERACTION_LANGUAGE` §5.8: a ledger with an unstated scope is not
   * evidence. Everything in this sentence is something the client can defend
   * — the count it received, the filters it sent, and the moment a response
   * landed. Nothing here is inferred.
   */
  const scope = useMemo(() => {
    const parts = [];

    parts.push(
      moduleFilter
        ? `changes to ${moduleFilter.replace(/_/g, " ")}`
        : "changes across every module"
    );

    if (actionFilter) {
      parts.push(`${actionFilter} only`);
    }

    return parts.join(", ");
  }, [moduleFilter, actionFilter]);

  const exportRows = useMemo(
    () =>
      rows.map((row) => ({
        When: row.created_at,
        Who: row.user_name || "—",
        Action: row.action,
        Module: row.module,
        Record: row.record_id ?? "—",
        Details: describeChange(row),
      })),
    [rows]
  );

  return (
    <>
      <section className="ledger">
        <div className="ledger__head">
          <div>
            <h2 className="ledger__title">Activity log</h2>

            {/*
              The scope statement. It replaces a descriptive blurb that said
              what the route was FOR; this says what is on screen right now,
              which is the thing a person auditing a change actually needs
              before they read a single row.
            */}
            <p className="ledger__scope">
              {rows.length > 0 ? (
                <>
                  <b>{rows.length}</b>
                  {" most recent "}
                  {scope}
                  {". Credentials are never recorded."}
                </>
              ) : (
                <>
                  Showing {scope}. Credentials are never recorded.
                </>
              )}

              {rows.length >= PAGE_LIMIT ? (
                <span className="ledger__cap">
                  This view stops at {PAGE_LIMIT} records, so older changes
                  are not shown. Narrow it by module or action to reach them.
                </span>
              ) : null}
            </p>
          </div>

          <ExportButtons
            filename="activity-log"
            title="Activity Log"
            subtitle="Construction Portal audit trail"
            rows={exportRows}
            columns={[
              "When",
              "Who",
              "Action",
              "Module",
              "Record",
              "Details",
            ]}
          />
        </div>

        <div className="ledger__filters">
          <label className="ledger__filter" htmlFor="activity-module">
            <span>Module</span>

            <select
              className="field"
              id="activity-module"
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
            >
              <option value="">All</option>

              {MODULES.map((name) => (
                <option key={name} value={name}>
                  {name.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>

          <label className="ledger__filter" htmlFor="activity-action">
            <span>Action</span>

            <select
              className="field"
              id="activity-action"
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
            >
              <option value="">All</option>

              {ACTIONS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <div className="ledger__filter-actions">
            {/*
              Clearing is its own action and undoes only its own effect
              (§8.4). It appears only when there is something to clear —
              a permanently-present control that does nothing most of the
              time is one more thing to read past.
            */}
            {filtered ? (
              <button
                type="button"
                className="ctl ctl--quiet"
                onClick={() => {
                  setModuleFilter("");
                  setActionFilter("");
                }}
              >
                Clear filters
              </button>
            ) : null}

            {/*
              The label does not change while it works. Replacing it removes
              the only text confirming what is happening, at the moment the
              user most wants it (§4.3). `disabled` is §4.2's first
              exception — the same request already in flight — and it is
              stated in words rather than left to look broken.
            */}
            <button
              type="button"
              className="ctl ctl--secondary"
              onClick={() => reload()}
              disabled={loading}
              aria-busy={loading}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="ledger__body">
          {/*
            FAILURE, in the content region and above whatever survived it
            (§10). Records already on screen are still true; this message is
            about what could not be added to them, so it never replaces them
            and never blanks the ledger.
          */}
          {error ? (
            <p className="ledger__failure" role="alert">
              {error}
            </p>
          ) : null}

          {/*
            STALE. Shown only when a refresh failed while records were
            already on screen — that is the one condition under which this
            view is knowably out of date. `loadedAt` is measured, never
            assumed: a view that has never loaded has no time to quote.
          */}
          {error && rows.length > 0 && loadedAt ? (
            <p className="ledger__stale">
              Still showing what was read at{" "}
              <time dateTime={loadedAt.toISOString()}>
                {loadedAt.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              . Nothing recorded since then is included.
            </p>
          ) : null}

          {/*
            LOADING. Only when there is nothing true to show — a refresh over
            existing records never blanks them (§13), so the busy state lives
            on the Refresh control instead and the ledger stays readable.
          */}
          {loading && rows.length === 0 && !error ? (
            <p className="ledger__state">Reading the audit trail…</p>
          ) : null}

          {/*
            EMPTY. It names what was searched, because "nothing found" and
            "the search is broken" are otherwise indistinguishable, and on an
            audit trail that difference matters a great deal (§8.2).
          */}
          {!loading && !error && rows.length === 0 ? (
            <p className="ledger__state">
              No <b>{scope}</b> have been recorded.
              {filtered
                ? " Clearing the filters will widen this."
                : " Activity appears here as soon as anyone changes a record."}
            </p>
          ) : null}

        {/*
          The audit trail is a date-grouped stream, not a table.

          It is read chronologically — "what happened, newest first" — and
          nothing on it benefits from column alignment, which is the only
          thing a table buys. The old six-column layout also had to squeeze
          onto a phone, and its Details column held a run-on string
          ("salary: 24000 → 26000 · status: active") that is the least
          readable possible form for structured data. That data is now a
          proper key/value list behind a keyboard-accessible disclosure.

          The same component serves both widths — the stream is already
          one column, so there is no separate mobile markup to drift.
        */}
          {rows.length > 0 && <ActivityStream rows={rows} />}
        </div>
      </section>
    </>
  );
}

export default ActivityPage;
