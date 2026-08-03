/**
 * File purpose:
 * The subcontractor's own view of their assigned work.
 *
 * API endpoints:
 * - GET /subcontractor-portal/me
 * - GET /subcontractor-portal/tenders
 * - GET /subcontractor-portal/tenders/:id
 * - GET /subcontractor-portal/documents
 * - GET /subcontractor-portal/daily-updates
 *
 * Connected to:
 * - SubcontractorPortalPage.jsx
 * - Backed by backend/modules/subcontractorPortal/
 * - Uses api/axiosClient.js, which attaches the bearer token and
 *   signs the user out on a 401.
 *
 * Important notes:
 * - Read-only. A subcontractor cannot reach /subcontractors, not even for
 * - their own row.
 * - Visibility follows tender_subcontractors: assigning a subcontractor to
 * - a tender is what makes it appear here, and removing the assignment
 * - revokes it.
 */

import axiosClient from "../api/axiosClient";

export const getSubcontractorProfile = async () => {
  const response = await axiosClient.get("/subcontractor-portal/me");
  return response.data;
};

export const getSubcontractorTenders = async () => {
  const response = await axiosClient.get("/subcontractor-portal/tenders");
  return response.data;
};

export const getSubcontractorTenderDetails = async (tenderId) => {
  const response = await axiosClient.get(
    `/subcontractor-portal/tenders/${tenderId}`
  );

  return response.data;
};

export const createSubcontractorDailyUpdate = async (payload) => {
  const response = await axiosClient.post(
    "/subcontractor-portal/daily-updates",
    payload
  );

  return response.data;
};

export const addSubcontractorTenderDocument = async (payload) => {
  const response = await axiosClient.post(
    "/subcontractor-portal/documents",
    payload
  );

  return response.data;
};