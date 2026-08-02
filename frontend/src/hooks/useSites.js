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
