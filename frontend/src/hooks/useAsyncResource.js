/**
 * File purpose:
 * A generic async-fetch hook for single resources, as opposed to
 * useCollection's role-gated registers.
 *
 * Returns:
 * the resource, its loading and error state, and a reload function.
 *
 * Connected to:
 * - usePaymentSections.js, and other one-off fetches
 * - Uses react-hot-toast to surface failures to the user
 *
 * Important notes:
 * - Distinct from useCollection: no role gate, no per-identity caching. Use
 *   this for a resource that is not a company register — the payment
 *   hierarchy, for instance, which is the same for everyone.
 * - Failures raise a toast as well as returning an error, so a caller does
 *   not have to render its own error state for every incidental fetch.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import toast from "react-hot-toast";

/*
|--------------------------------------------------------------------------
| useAsyncResource
|--------------------------------------------------------------------------
|
| The "load this page's records, show a spinner, keep the error" block that
| six pages had each written out by hand — approvals, subcontractors,
| users, tender details, and the two portals. Around forty lines apiece,
| identical apart from the service call and the wording.
|
| The one piece of behaviour worth keeping from those copies is the
| distinction between a first load and a background refresh: the first
| shows a spinner and leaves the error on the page, a refresh after a save
| shows neither and reports failure as a toast instead, so the table does
| not blink or empty underneath the user.
|
| `loading` starts true when the resource loads on mount, so the first
| render already shows the spinner. Nothing has to be set on the way in,
| which spares a render and keeps the mount path free of synchronous state
| updates.
|
*/

export function useAsyncResource(
  load,
  {
    label = "records",
    initial = [],
    auto = true,
  } = {}
) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(auto);
  const [error, setError] = useState("");

  // Only the newest load may write, so a slow first response cannot
  // overwrite a refresh that has already landed.
  const ticket = useRef(0);

  /*
   * Runs the fetch and settles the state. Every update sits inside a
   * promise callback, so this is safe to start from an effect.
   */
  const run = useCallback(
    (showLoader) => {
      const mine = ticket.current + 1;
      ticket.current = mine;

      return Promise.resolve(load()).then(
        (result) => {
          if (ticket.current !== mine) {
            return result;
          }

          setData(result);
          setLoading(false);
          setError("");

          return result;
        },
        (caught) => {
          console.error(
            `Failed to load ${label}:`,
            caught?.response?.data || caught
          );

          if (ticket.current !== mine) {
            return undefined;
          }

          const message =
            caught?.response?.data?.message ||
            caught?.message ||
            `Failed to load ${label}.`;

          setLoading(false);

          if (showLoader) {
            setError(message);
          } else {
            // A background refresh must not blank a page that is already
            // showing good data.
            toast.error(message);
          }

          return undefined;
        }
      );
    },
    [load, label]
  );

  const reload = useCallback(
    ({ showLoader = true } = {}) => {
      if (showLoader) {
        setLoading(true);
        setError("");
      }

      return run(showLoader);
    },
    [run]
  );

  useEffect(() => {
    if (auto) {
      run(true);
    }
  }, [auto, run]);

  return {
    data,
    setData,
    loading,
    error,
    setError,
    reload,
  };
}

export default useAsyncResource;
