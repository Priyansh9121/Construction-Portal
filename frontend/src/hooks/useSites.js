/**
 * File purpose:
 * Loads the sites register.
 *
 * API endpoints:
 * - GET/POST/PUT/DELETE /sites, via services/siteService.js
 *
 * Connected to:
 * - App.jsx loads this once for the session and threads it down
 * - TenderSitesTab.jsx, and the site pickers on the payment forms
 * - Built on useCollection.js
 *
 * Important notes:
 * - Office-only.
 * - Deleting a site can fail with 409 when daily updates or payments still
 *   reference it — the calling screen must surface that rather than
 *   assuming success.
 */

import { useCallback } from "react";

import {
  getSites,
  createSite,
  deleteSite,
} from "../services/siteService";

import { useCollection } from "./useCollection";

export default function useSites(user) {
  const {
    items: sites,
    loading,
    error,
    refresh,
  } = useCollection(user, {
    fetcher: getSites,
    label: "sites",
  });

  const addSite = useCallback(
    async (site) => {
      const result = await createSite(site);
      await refresh();

      return result;
    },
    [refresh]
  );

  const removeSite = useCallback(
    async (id) => {
      const result = await deleteSite(id);
      await refresh();

      return result;
    },
    [refresh]
  );

  return {
    sites,
    loading,
    error,
    addSite,
    removeSite,
    fetchSites: refresh,
  };
}
