import {
  useCallback,
  useMemo,
  useState,
} from "react";

import ExportButtons from "../components/export/ExportButtons";

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

function ActivityPage() {
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const load = useCallback(async () => {
    const { activity } = await getActivityLog({
      limit: 200,
      ...(moduleFilter ? { module: moduleFilter } : {}),
      ...(actionFilter ? { action: actionFilter } : {}),
    });

    return activity;
  }, [moduleFilter, actionFilter]);

  const {
    data: rows,
    loading,
    error,
    reload,
  } = useAsyncResource(load, { label: "activity" });

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
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Activity Log</h2>

            <p className="muted-text">
              Who changed what, across payments, projects, worker money and
              user management. Credentials are never recorded.
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

        <div className="filter-row">
          <label htmlFor="activity-module">
            Module
            <select
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

          <label htmlFor="activity-action">
            Action
            <select
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

          <button
            type="button"
            className="secondary-btn"
            onClick={() => reload()}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </section>

      <section className="panel">
        {loading && <p className="muted-text">Loading activity...</p>}

        {error && !loading && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && rows.length === 0 && (
          <p className="muted-text">
            Nothing recorded yet for this filter.
          </p>
        )}

        {rows.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Record</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {new Date(row.created_at).toLocaleString()}
                    </td>

                    <td>
                      {row.user_name || "—"}

                      {row.user_email && (
                        <>
                          <br />
                          <small className="muted-text">
                            {row.user_email}
                          </small>
                        </>
                      )}
                    </td>

                    <td>
                      <span className={`badge badge--${row.action}`}>
                        {row.action}
                      </span>
                    </td>

                    <td>{row.module.replace(/_/g, " ")}</td>
                    <td>{row.record_id ?? "—"}</td>

                    <td>
                      <small>{describeChange(row)}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default ActivityPage;
