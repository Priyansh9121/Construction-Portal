/**
 * File purpose:
 * Resolves the register record that a worker or subcontractor login belongs
 * to, at the moment the login is created.
 *
 * API endpoints:
 * - GET /workers          (via services/workerService.js)
 * - GET /subcontractors   (via services/subcontractorService.js)
 *
 * Connected to:
 * - UsersPage.jsx, in the create form and in the repair dialog
 * - Its output becomes the `profile` field on POST /auth/users, which
 *   backend/modules/auth/profileLink.service.js validates and applies
 *
 * Important notes:
 * - A `worker` or `subcontractor` login is refused by the server unless it
 *   resolves a record. That is deliberate: the worker portal and the tender
 *   picker both read the register, not the users table, so a login without
 *   one can sign in and then reach nothing. It was BUG-002.
 * - LINK is the default mode, not create. Payroll comes first in practice —
 *   someone is on the register for weeks before anyone decides they need
 *   portal access. In that case this collects no phone and no salary at
 *   all, because the record already has them.
 * - Only records with no login are offered. One record, one login; the
 *   database enforces it with a partial unique index on user_id.
 * - Roles absent from PROFILE_SOURCES need no record, and this renders
 *   nothing for them. Adding a role here is the only change needed to give
 *   it a profile — mirroring PROFILE_FOR_ROLE on the server.
 */

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  PROFILE_SOURCES,
} from "./profileSources";

function ProfileLinkField({
  role,
  value,
  onChange,
  fallbackName = "",
  disabled = false,
}) {
  const config =
    PROFILE_SOURCES[
      String(role || "").toLowerCase()
    ];

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");

  /*
   * Loading the register must never be what stops an admin creating an
   * account. If the request fails, the error is shown and the create-new
   * mode still works — so a register that is briefly unreachable degrades
   * one half of this control rather than blocking the whole form.
   */
  useEffect(() => {
    /*
     * Nothing to load for a role with no register. The component renders
     * null in that case, so leaving `records` as it is costs nothing and
     * avoids a setState in the effect body.
     */
    if (!config) {
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const data = await config.fetch();

        if (!cancelled) {
          setRecords(config.normalise(data));
        }
      } catch (error) {
        console.error(
          `Failed to load ${config.label} records:`,
          error.response?.data || error
        );

        if (!cancelled) {
          setRecords([]);
          setLoadError(
            `Could not load the ${config.label} list. You can still create a new record.`
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [config]);

  const unlinked = useMemo(() => {
    const term = search.trim().toLowerCase();

    return records
      .filter((record) => !record.user_id)
      .filter(
        (record) =>
          !term ||
          String(record.full_name || "")
            .toLowerCase()
            .includes(term)
      );
  }, [records, search]);

  if (!config) {
    return null;
  }

  const mode = value?.mode || "link";

  const setMode = (nextMode) => {
    onChange(
      nextMode === "link"
        ? { mode: "link", id: "" }
        : {
            mode: "create",
            full_name: fallbackName,
          }
    );
  };

  const setField = (name, fieldValue) => {
    onChange({
      ...value,
      mode,
      [name]: fieldValue,
    });
  };

  return (
    <fieldset className="panel profile-link-field">
      <legend>{config.noun} record</legend>

      <p className="muted-text">
        A {config.label} login needs a {config.label} record — the portal and
        the tender picker both read the register, not the account list.
      </p>

      <div className="form-grid">
        <label>
          How to resolve it
          <select
            value={mode}
            onChange={(event) =>
              setMode(event.target.value)
            }
            disabled={disabled}
          >
            <option value="link">
              Link an existing {config.label}
            </option>

            <option value="create">
              Create a new {config.label} record
            </option>
          </select>
        </label>

        {mode === "link" && (
          <>
            <label>
              Search
              <input
                type="search"
                className="search-input"
                value={search}
                placeholder={`Find a ${config.label} by name`}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                disabled={disabled || loading}
              />
            </label>

            <label>
              {config.noun}
              <select
                value={value?.id || ""}
                onChange={(event) =>
                  setField("id", event.target.value)
                }
                disabled={disabled || loading}
                required
              >
                <option value="">
                  {loading
                    ? "Loading…"
                    : `Select a ${config.label}`}
                </option>

                {unlinked.map((record) => (
                  <option
                    key={record.id}
                    value={record.id}
                  >
                    {record.full_name}
                    {record.phone
                      ? ` — ${record.phone}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {mode === "create" && (
          <>
            <label>
              {config.noun} name
              <input
                type="text"
                value={value?.full_name || ""}
                onChange={(event) =>
                  setField(
                    "full_name",
                    event.target.value
                  )
                }
                disabled={disabled}
                required
              />
            </label>

            {config.createFields.map((field) => (
              <label key={field.name}>
                {field.label}
                <input
                  type={field.type}
                  value={value?.[field.name] || ""}
                  onChange={(event) =>
                    setField(
                      field.name,
                      event.target.value
                    )
                  }
                  disabled={disabled}
                />
              </label>
            ))}
          </>
        )}
      </div>

      {loadError && (
        <small className="muted-text">{loadError}</small>
      )}

      {mode === "link" &&
        !loading &&
        !loadError &&
        unlinked.length === 0 && (
          <small className="muted-text">
            {search.trim()
              ? `No unlinked ${config.label} matches that name.`
              : `Every ${config.label} already has a login. Create a new record instead.`}
          </small>
        )}

      {mode === "create" && (
        <small className="muted-text">
          Pay and the rest of the {config.label}&apos;s details are filled in
          on the {config.noun} screen afterwards — this only creates the
          record the login points at.
        </small>
      )}
    </fieldset>
  );
}

export default ProfileLinkField;
