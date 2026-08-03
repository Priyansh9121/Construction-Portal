/**
 * File purpose:
 * The shared implementation behind every "load a register once the user is
 * ready" hook. Handles role gating, request racing, per-identity caching
 * and local patching in one place.
 *
 * Returns:
 * { items, loading, error, refresh, patch }
 *
 * Parameters:
 * - user     the signed-in user; nothing loads without one
 * - options  { fetcher, label, officeOnly }
 *
 * Connected to:
 * - Wrapped by useWorkers, useSites, useTenders, useInvoices, usePayments,
 *   useSiteLogs and useWorkerMoney
 * - Uses utils/roleAccess.js to decide whether this user may load at all
 *
 * Important notes:
 * - officeOnly defaults to TRUE. That default is the fix described in the
 *   banner below: hooks that only checked "is there a user" were firing
 *   office endpoints for worker and subcontractor logins, which the API
 *   now answers with 403.
 * - Rows are stored alongside the identity that loaded them, so a caller
 *   never sees the previous user's data after an account switch and
 *   nothing needs clearing on sign-out.
 * - `loading` is DERIVED from that pairing rather than held as its own
 *   state — one less thing to keep in step.
 * - The ticket ref discards out-of-order responses; see the comment there.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { canLoadAdminData } from "../utils/roleAccess";

/*
|--------------------------------------------------------------------------
| useCollection
|--------------------------------------------------------------------------
|
| One implementation behind every "load a register once the user is ready"
| hook. useWorkers, useSites, useInvoices, usePayments, useSiteLogs and
| useWorkerMoney were six copies of the same twenty lines, and they had
| drifted apart in the way copies do:
|
|   * three checked only that a user existed, three checked the user was
|     office staff. The three that did not fired GET /api/workers,
|     /api/sites, /api/tenders and /api/invoices for every worker and
|     subcontractor login — requests the API now answers with 403.
|
|   * some returned the rows, some returned undefined, some rethrew and
|     some swallowed, so callers could not treat them alike.
|
| Rows are stored together with the identity that loaded them, so a caller
| never sees the previous user's data during the gap between a sign-in and
| its first response, and nothing has to be cleared on the way out — the
| rows simply stop matching.
|
| "Loading" is derived from that same pairing rather than held in its own
| state: if there is someone to load for and the rows on hand are not
| theirs, a load is outstanding. One less state to keep in step, and no
| synchronous setState in the effect that starts the fetch.
|
*/

const NONE = [];

export function useCollection(
  user,
  {
    fetcher,
    label,
    officeOnly = true,
  }
) {
  const allowed = officeOnly
    ? canLoadAdminData(user)
    : Boolean(user);

  const identity = allowed
    ? `${user?.id ?? ""}:${user?.role ?? ""}`
    : null;

  const [loaded, setLoaded] = useState({
    identity: null,
    rows: NONE,
  });

  const [error, setError] = useState(null);

  /*
   * Ticket for the most recent load. Two fetches can be in flight after a
   * fast account switch, and they can settle out of order; only the newest
   * is allowed to write. Assigned inside the callback, never during
   * render.
   */
  const ticket = useRef(0);

  /*
   * Written as a promise chain rather than async/await so that every
   * setState is visibly inside a callback. It reads the same, and it lets
   * the effect below start a load without tripping the lint rule that
   * guards against synchronous state updates in effects.
   */
  const refresh = useCallback(() => {
    if (!identity) {
      return Promise.resolve(NONE);
    }

    const mine = ticket.current + 1;
    ticket.current = mine;

    return Promise.resolve(fetcher()).then(
      (data) => {
        const rows = Array.isArray(data) ? data : NONE;

        if (ticket.current === mine) {
          setLoaded({ identity, rows });
          setError(null);
        }

        return rows;
      },
      (caught) => {
        console.error(
          `Failed to load ${label}`,
          caught?.response?.data || caught
        );

        if (ticket.current === mine) {
          setLoaded({ identity, rows: NONE });
          setError(caught?.message || `Failed to load ${label}.`);
        }

        return NONE;
      }
    );
  }, [identity, fetcher, label]);

  useEffect(() => {
    if (identity) {
      refresh();
    }
  }, [identity, refresh]);

  /*
   * Apply a local change without a round trip — dropping a deleted row, or
   * showing a created one immediately. The identity is carried through, so
   * a patch can never resurrect rows for a user who has signed out.
   */
  const patch = useCallback((updater) => {
    setLoaded((previous) =>
      previous.identity === null
        ? previous
        : { identity: previous.identity, rows: updater(previous.rows) }
    );
  }, []);

  const isCurrent = Boolean(identity) && loaded.identity === identity;

  return {
    // Rows loaded for anyone else are not this user's to see.
    items: isCurrent ? loaded.rows : NONE,
    loading: Boolean(identity) && !isCurrent,
    error: isCurrent ? error : null,
    refresh,
    patch,
  };
}

export default useCollection;
