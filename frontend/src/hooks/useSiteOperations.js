import { useState, useCallback, useEffect } from "react";

import siteOperationsService from "../services/siteOperationsService";

/*
|--------------------------------------------------------------------------
| useSiteOperations
|--------------------------------------------------------------------------
|
| State for the supervisor screens. Modelled on useTenders, which is the
| most complete hook in the codebase: explicit loading and error state,
| memoised fetchers, and no fetching until asked.
|
| Each section loads independently, so opening the Materials tab does not
| pull the labour ledger and the banking float as well.
|
*/

export function useSiteOperations() {
  const [catalog, setCatalog] = useState({
    materials: [],
    sections: {},
  });

  const [materials, setMaterials] = useState([]);
  const [labour, setLabour] = useState([]);
  const [labourCategories, setLabourCategories] = useState([]);
  const [banking, setBanking] = useState(null);
  const [accessRequests, setAccessRequests] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Wraps a fetch so every caller gets consistent loading and error
   * handling instead of repeating try/catch at each call site.
   */
  const run = useCallback(async (task) => {
    setLoading(true);
    setError(null);

    try {
      return await task();
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Something went wrong.";

      setError(message);

      // Rethrow so a caller that needs to react to failure still can.
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalog = useCallback(
    () =>
      run(async () => {
        const result =
          await siteOperationsService.getMaterialCatalog();

        setCatalog(result);

        return result;
      }),
    [run]
  );

  const loadMaterials = useCallback(
    (params) =>
      run(async () => {
        const { entries } =
          await siteOperationsService.getMaterialEntries(params);

        setMaterials(entries);

        return entries;
      }),
    [run]
  );

  const addMaterial = useCallback(
    (payload) =>
      run(async () => {
        const entry =
          await siteOperationsService.createMaterialEntry(payload);

        setMaterials((prev) => [entry, ...prev]);

        return entry;
      }),
    [run]
  );

  const loadLabour = useCallback(
    (params) =>
      run(async () => {
        const rows =
          await siteOperationsService.getLabour(params);

        setLabour(rows);

        return rows;
      }),
    [run]
  );

  const loadLabourCategories = useCallback(
    () =>
      run(async () => {
        const rows =
          await siteOperationsService.getLabourCategories();

        setLabourCategories(rows);

        return rows;
      }),
    [run]
  );

  const addLabour = useCallback(
    (payload) =>
      run(async () => {
        const row =
          await siteOperationsService.createLabour(payload);

        setLabour((prev) => [...prev, row]);

        return row;
      }),
    [run]
  );

  const addLabourWork = useCallback(
    (labourId, payload) =>
      run(async () => {
        const entry =
          await siteOperationsService.createLabourWorkEntry(
            labourId,
            payload
          );

        // The list carries running totals, so refresh it rather than
        // trying to patch the aggregate client-side.
        await siteOperationsService
          .getLabour()
          .then(setLabour)
          .catch(() => {});

        return entry;
      }),
    [run]
  );

  const loadBanking = useCallback(
    (params) =>
      run(async () => {
        const result =
          await siteOperationsService.getBankingSummary(params);

        setBanking(result);

        return result;
      }),
    [run]
  );

  const addExpense = useCallback(
    (payload) =>
      run(async () => {
        const expense =
          await siteOperationsService.createSupervisorExpense(payload);

        // The float changes, so pull the summary again.
        await siteOperationsService
          .getBankingSummary()
          .then(setBanking)
          .catch(() => {});

        return expense;
      }),
    [run]
  );

  const loadAccessRequests = useCallback(
    (params) =>
      run(async () => {
        const rows =
          await siteOperationsService.getAccessRequests(params);

        setAccessRequests(rows);

        return rows;
      }),
    [run]
  );

  const requestAccess = useCallback(
    (payload) =>
      run(async () => {
        const result =
          await siteOperationsService.createAccessRequest(payload);

        await siteOperationsService
          .getAccessRequests()
          .then(setAccessRequests)
          .catch(() => {});

        return result;
      }),
    [run]
  );

  return {
    catalog,
    materials,
    labour,
    labourCategories,
    banking,
    accessRequests,

    loading,
    error,
    clearError: () => setError(null),

    loadCatalog,
    loadMaterials,
    addMaterial,

    loadLabour,
    loadLabourCategories,
    addLabour,
    addLabourWork,

    loadBanking,
    addExpense,

    loadAccessRequests,
    requestAccess,
  };
}

/*
|--------------------------------------------------------------------------
| useLabourLedger
|--------------------------------------------------------------------------
|
| One labourer's account — the "click a name to see their total" view from
| the notes. Kept separate so the list screen does not hold every
| labourer's full history in memory.
|
*/

export function useLabourLedger(labourId) {
  // The loaded id is stored alongside the data, so everything the caller
  // needs can be derived rather than assigned. Nothing is set synchronously
  // inside the effect, which is what causes cascading renders: "loading" is
  // simply "the id I was asked for is not the id I have".
  const [state, setState] = useState({
    labourId: null,
    ledger: null,
    error: null,
  });

  useEffect(() => {
    if (!labourId) return;

    let cancelled = false;

    siteOperationsService
      .getLabourLedger(labourId)
      .then((result) => {
        if (cancelled) return;

        setState({
          labourId,
          ledger: result,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;

        setState({
          labourId,
          ledger: null,
          error:
            err?.response?.data?.message ||
            "Could not load this labourer's account.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [labourId]);

  // Only surface data that belongs to the id currently being asked for,
  // so switching labourers never briefly shows the previous one's account.
  const matches =
    Boolean(labourId) && state.labourId === labourId;

  return {
    ledger: matches ? state.ledger : null,
    error: matches ? state.error : null,
    loading: Boolean(labourId) && !matches,
  };
}

export default useSiteOperations;
