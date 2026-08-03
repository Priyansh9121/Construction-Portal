/**
 * File purpose:
 * The sites register.
 *
 * API endpoints:
 * - GET    /sites
 * - GET    /sites/:id
 * - POST   /sites
 * - PUT    /sites/:id
 * - DELETE /sites/:id
 *
 * Connected to:
 * - useSites.js, and TenderSitesTab.jsx
 * - Backed by backend/modules/sites/site.controller.js
 * - Uses api/axiosClient.js, which attaches the bearer token and
 *   signs the user out on a 401.
 *
 * Important notes:
 * - Office-only. Supervisors record activity AGAINST sites through
 * - /site-operations but cannot create or edit the sites themselves.
 * - DELETE returns 409 when daily updates or payments still reference the
 * - site — the only register that refuses rather than soft-deleting.
 */

import axiosClient from "../api/axiosClient";

export const getSites = async () => {
  const res = await axiosClient.get("/sites");
  return res.data.sites;
};

export const createSite = async (data) => {
  const res = await axiosClient.post("/sites", data);
  return res.data;
};

export const deleteSite = async (id) => {
  const res = await axiosClient.delete(`/sites/${id}`);
  return res.data;
};