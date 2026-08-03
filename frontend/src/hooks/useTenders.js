/**
 * File purpose:
 * Loads the tender register.
 *
 * API endpoints:
 * - GET/POST/PUT/DELETE /tenders, via services/tenderService.js
 *
 * Connected to:
 * - App.jsx loads this once for the session and threads it down
 * - TendersPage.jsx, and the tender pickers across the payment and
 *   worker-money forms
 * - Built on useCollection.js
 *
 * Important notes:
 * - Office-only.
 * - The tender DETAIL page does not use this hook — it calls
 *   tenderDetailsService for the full nested payload instead.
 */

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
