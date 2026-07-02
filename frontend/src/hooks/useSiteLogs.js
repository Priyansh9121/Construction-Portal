import { useEffect, useState } from "react";

import {
  getSiteLogs,
  createSiteLog,
  deleteSiteLog,
} from "../services/siteLogService";

export default function useSiteLogs(user) {
  const [siteLogs, setSiteLogs] = useState([]);

  const fetchSiteLogs = async () => {
    try {
      const data = await getSiteLogs();
      setSiteLogs(data);
    } catch (err) {
      console.error("Failed to load site logs", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSiteLogs();
    }
  }, [user]);

  const addSiteLog = async (log) => {
    await createSiteLog(log);
    fetchSiteLogs();
  };

  const removeSiteLog = async (id) => {
    await deleteSiteLog(id);
    fetchSiteLogs();
  };

  return {
    siteLogs,
    addSiteLog,
    removeSiteLog,
    fetchSiteLogs,
  };
}