/**
 * File purpose:
 * Daily site updates, from the office side.
 *
 * API endpoints:
 * - GET    /site-logs
 * - POST   /site-logs
 * - DELETE /site-logs/:id
 *
 * Connected to:
 * - useSiteLogs.js -> DailySiteUpdatesPage.jsx
 * - TenderDailyProgressTab.jsx
 * - Backed by backend/modules/siteLogs/siteLog.controller.js
 * - Uses api/axiosClient.js, which attaches the bearer token and
 *   signs the user out on a 401.
 *
 * Important notes:
 * - Office-only. An update created here skips the approval queue, unlike
 * - one submitted through the worker portal.
 * - There is no update call: correcting a log means deleting it and adding
 * - another, so the history shows two acts.
 * - The backdating window applies — see F-13.
 */

import axiosClient from "../api/axiosClient";

export const getSiteLogs = async () => {
  const res = await axiosClient.get("/site-logs");
  return res.data.siteLogs;
};

export const createSiteLog = async (data) => {
  const res = await axiosClient.post("/site-logs", data);
  return res.data;
};

export const deleteSiteLog = async (id) => {
  const res = await axiosClient.delete(`/site-logs/${id}`);
  return res.data;
};