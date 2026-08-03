/**
 * File purpose:
 * The subcontractors register.
 *
 * API endpoints:
 * - GET    /subcontractors          list, with MASKED payment identifiers
 * - GET    /subcontractors/:id      one record, full details, admin only
 * - POST   /subcontractors
 * - PUT    /subcontractors/:id
 * - DELETE /subcontractors/:id
 *
 * Connected to:
 * - SubcontractorsPage.jsx, and the picker on TenderSubcontractorsTab
 * - Backed by backend/modules/subcontractors/
 * - Uses api/axiosClient.js, which attaches the bearer token and
 *   signs the user out on a 401.
 *
 * Important notes:
 * - Office-only. The list response includes plain-text banking columns,
 * - which the page uses for its edit form, detail modal and CSV export —
 * - see F-12 for why that exposure is wider than it needs to be.
 * - No getById call; the backend does not route one (F-10).
 */

import axiosClient from "../api/axiosClient";

export const getSubcontractors = async () => {
  const response = await axiosClient.get(
    "/subcontractors"
  );

  return response.data;
};

export const createSubcontractor = async (
  payload
) => {
  const response = await axiosClient.post(
    "/subcontractors",
    payload
  );

  return response.data;
};

/**
 * Fetches ONE subcontractor with its full, unmasked payment details.
 *
 * Purpose:
 * The list endpoint returns masked identifiers (F-12), so this is where
 * the real account number and IFSC come from — one record at a time, and
 * only for a role permitted to see them.
 *
 * Parameters:
 * id - the subcontractor
 *
 * Returns:
 * The full subcontractor record.
 *
 * Throws:
 * The axios error. Callers must distinguish:
 *   403 the user may not see payment details — show the masked view
 *   404 no such record in this company
 *
 * Important:
 * Do not cache what this returns into shared application state. Fetch it
 * when a detail or edit view opens, and clear it when that view closes.
 */
export const getSubcontractorById = async (
  id
) => {
  const response =
    await axiosClient.get(
      `/subcontractors/${id}`
    );

  return response.data.subcontractor;
};

export const deleteSubcontractor = async (
  id
) => {
  const response =
    await axiosClient.delete(
      `/subcontractors/${id}`
    );

  return response.data;
};

export const updateSubcontractor = async (
  id,
  payload
) => {
  const response =
    await axiosClient.put(
      `/subcontractors/${id}`,
      payload
    );

  return response.data;
};