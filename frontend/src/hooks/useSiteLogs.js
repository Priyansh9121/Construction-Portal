/**
 * File purpose:
 * Loads daily site updates from the office side.
 *
 * API endpoints:
 * - GET/POST/DELETE /site-logs, via services/siteLogService.js
 *
 * Connected to:
 * - DailySiteUpdatesPage.jsx, TenderDailyProgressTab.jsx
 * - Built on useCollection.js
 *
 * Important notes:
 * - Office-only. A worker's own updates come from useWorkerPortal territory
 *   instead.
 * - There is no update operation: correcting a log means deleting it and
 *   adding another, so the history shows both acts.
 */

import { useCallback } from "react";

import {
  getSiteLogs,
  createSiteLog,
  deleteSiteLog,
} from "../services/siteLogService";

import { canLoadAdminData } from "../utils/roleAccess";

import { useCollection } from "./useCollection";

export default function useSiteLogs(user) {
  const {
    items: siteLogs,
    loading,
    error,
    refresh,
    patch,
  } = useCollection(user, {
    fetcher: getSiteLogs,
    label: "site logs",
  });

  const addSiteLog = useCallback(
    async (log) => {
      if (!canLoadAdminData(user)) {
        throw new Error(
          "Use the scoped worker or subcontractor portal to submit updates."
        );
      }

      const result = await createSiteLog(log);
      await refresh();

      return result;
    },
    [user, refresh]
  );

  const removeSiteLog = useCallback(
    async (id) => {
      if (!canLoadAdminData(user)) {
        throw new Error("You are not allowed to delete site logs.");
      }

      const result = await deleteSiteLog(id);

      patch((rows) => rows.filter((item) => Number(item.id) !== Number(id)));

      return result;
    },
    [user, patch]
  );

  return {
    siteLogs,
    loading,
    error,
    addSiteLog,
    removeSiteLog,
    fetchSiteLogs: refresh,
  };
}
