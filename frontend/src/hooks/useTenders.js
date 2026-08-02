import { useCallback } from "react";

import {
  createTender,
  deleteTender,
  getTenders,
} from "../services/tenderService";

import { useCollection } from "./useCollection";

export default function useTenders(user) {
  const {
    items: tenders,
    loading,
    error,
    refresh,
  } = useCollection(user, {
    fetcher: getTenders,
    label: "projects",
  });

  const addTender = useCallback(
    async (tenderData) => {
      const createdTender = await createTender(tenderData);
      await refresh();

      return createdTender;
    },
    [refresh]
  );

  const removeTender = useCallback(
    async (id) => {
      const result = await deleteTender(id);
      await refresh();

      return result;
    },
    [refresh]
  );

  return {
    tenders,
    loading,
    error,
    fetchTenders: refresh,
    addTender,
    removeTender,
  };
}
