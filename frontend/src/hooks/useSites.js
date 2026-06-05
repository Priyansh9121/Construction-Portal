import { useEffect, useState } from "react";

import {
  getSites,
  createSite,
  deleteSite,
} from "../services/siteService";

export default function useSites(user) {
  const [sites, setSites] = useState([]);

  const fetchSites = async () => {
    try {
      const data = await getSites();
      setSites(data);
    } catch (err) {
      console.error("Failed to load sites", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSites();
    }
  }, [user]);

  const addSite = async (site) => {
    await createSite(site);
    fetchSites();
  };

  const removeSite = async (id) => {
    await deleteSite(id);
    fetchSites();
  };

  return {
    sites,
    addSite,
    removeSite,
    fetchSites,
  };
}