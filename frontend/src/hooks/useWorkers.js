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
