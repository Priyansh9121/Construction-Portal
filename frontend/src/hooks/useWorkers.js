/**
 * File purpose:
 * Loads the workers register.
 *
 * API endpoints:
 * - GET/POST/PUT/DELETE /workers, via services/workerService.js
 *
 * Connected to:
 * - App.jsx loads this once for the session and threads it down
 * - WorkersPage.jsx, TenderWorkersTab.jsx, the WorkerMoney pickers
 * - Built on useCollection.js
 *
 * Important notes:
 * - Office-only. A worker reads their own record through the worker portal.
 * - Create and update must send name, phone, salary, role AND status —
 *   the backend requires all five, so a partial payload is rejected.
 */

import { useCallback } from "react";

import {
  getWorkers,
  createWorker,
  deleteWorker,
} from "../services/workerService";

import { useCollection } from "./useCollection";

export default function useWorkers(user) {
  const {
    items: workers,
    loading,
    error,
    refresh,
  } = useCollection(user, {
    fetcher: getWorkers,
    label: "workers",
  });

  const addWorker = useCallback(
    async (worker) => {
      const result = await createWorker(worker);
      await refresh();

      return result;
    },
    [refresh]
  );

  const removeWorker = useCallback(
    async (id) => {
      const result = await deleteWorker(id);
      await refresh();

      return result;
    },
    [refresh]
  );

  return {
    workers,
    loading,
    error,
    addWorker,
    removeWorker,
    fetchWorkers: refresh,
  };
}
