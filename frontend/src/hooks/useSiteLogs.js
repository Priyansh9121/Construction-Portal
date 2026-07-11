import { useEffect, useState } from "react";

import {
  getSiteLogs,
  createSiteLog,
  deleteSiteLog,
} from "../services/siteLogService";

import { canLoadAdminData } from "../utils/roleAccess";

export default function useSiteLogs(user) {
  const [siteLogs, setSiteLogs] = useState([]);

  const fetchSiteLogs = async () => {
    if (!canLoadAdminData(user)) {
      setSiteLogs([]);
      return [];
    }

    try {
      const data = await getSiteLogs();

      const rows = Array.isArray(data)
        ? data
        : data.siteLogs || data.logs || [];

      setSiteLogs(rows);
      return rows;
    } catch (error) {
      console.error(
        "Failed to load site logs",
        error.response?.data || error
      );

      setSiteLogs([]);
      throw error;
    }
  };

  useEffect(() => {
    if (canLoadAdminData(user)) {
      fetchSiteLogs();
    } else {
      setSiteLogs([]);
    }
  }, [user?.id, user?.role]);

  const addSiteLog = async (log) => {
    if (!canLoadAdminData(user)) {
      throw new Error(
        "Use the scoped worker or subcontractor portal to submit updates."
      );
    }

    const result = await createSiteLog(log);
    await fetchSiteLogs();

    return result;
  };

  const removeSiteLog = async (id) => {
    if (!canLoadAdminData(user)) {
      throw new Error("You are not allowed to delete site logs.");
    }

    const result = await deleteSiteLog(id);

    setSiteLogs((previous) =>
      previous.filter(
        (item) => Number(item.id) !== Number(id)
      )
    );

    return result;
  };

  return {
    siteLogs,
    addSiteLog,
    removeSiteLog,
    fetchSiteLogs,
  };
}