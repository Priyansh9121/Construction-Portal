/**
 * File purpose:
 * The tender detail page and its six child collections.
 *
 * API endpoints:
 * - GET /tenders/:id/details      everything in one request
 * - GET/POST/PUT/DELETE /tenders/:id/documents
 * - GET/POST/PUT/DELETE /tenders/:id/materials
 * - GET/POST/PUT/DELETE /tenders/:id/banking
 * - GET/POST/PUT/DELETE /tenders/:id/subcontractors
 * - GET/POST/PUT/DELETE /tenders/:id/workers
 * - GET/POST/PUT/DELETE /tenders/:id/finance
 *
 * Connected to:
 * - TenderDetailsPage.jsx and its nine tabs
 * - Backed by backend/modules/tenders/tender.controller.js
 * - Uses api/axiosClient.js, which attaches the bearer token and
 *   signs the user out on a 401.
 *
 * Important notes:
 * - Every child path is NESTED under its tender. That is not cosmetic: the
 * - backend verifies the parent belongs to the caller's company before
 * - touching a child, so a child id from another tender answers 404.
 * - An earlier flat shape — /tender-details/materials — could not express
 * - that parentage and no router served it. See the banner below.
 */

import axiosClient from "../api/axiosClient";

/*
|--------------------------------------------------------------------------
| Tender Details
|--------------------------------------------------------------------------
|
| Every sub-resource of a tender — documents, materials, banking and
| subcontractor assignments — is nested under the tender that owns it:
|
|     /api/tenders/:tenderId/materials/:materialId
|
| The tender id is part of the path rather than the body, so the server can
| confirm the parent belongs to the caller's company before it touches the
| child row. A flat "/tender-details/materials" shape cannot do that: it has
| to trust an id supplied by the client.
|
| Read access is a single call — GET /api/tenders/:id/details returns the
| tender with every tab's data attached, so opening the page is one request
| rather than nine.
|
*/

/**
 * Builds a path under a tender, validating the id first.
 *
 * Exported because tenderWorkerService needs the same rule. It previously
 * carried its own copy with identical validation and the same error
 * message, so a change to id handling had to be made in two places.
 */
export const tenderPath = (tenderId, suffix = "") => {
  const id = Number(tenderId);

  if (!id || Number.isNaN(id)) {
    throw new Error("A valid tender ID is required.");
  }

  return `/tenders/${id}${suffix}`;
};

/*
|--------------------------------------------------------------------------
| The whole record
|--------------------------------------------------------------------------
*/

export const getTenderDetails = async (id) => {
  const response = await axiosClient.get(tenderPath(id, "/details"));

  return response.data;
};

/*
|--------------------------------------------------------------------------
| Materials
|--------------------------------------------------------------------------
*/

export const addTenderMaterial = async ({ tender_id, ...payload }) => {
  const response = await axiosClient.post(
    tenderPath(tender_id, "/materials"),
    payload
  );

  return response.data;
};

export const deleteTenderMaterial = async (tenderId, materialId) => {
  const response = await axiosClient.delete(
    tenderPath(tenderId, `/materials/${materialId}`)
  );

  return response.data;
};

/*
|--------------------------------------------------------------------------
| Banking
|--------------------------------------------------------------------------
*/

export const addTenderBanking = async ({ tender_id, ...payload }) => {
  const response = await axiosClient.post(
    tenderPath(tender_id, "/banking"),
    payload
  );

  return response.data;
};

export const deleteTenderBanking = async (tenderId, bankingId) => {
  const response = await axiosClient.delete(
    tenderPath(tenderId, `/banking/${bankingId}`)
  );

  return response.data;
};

/*
|--------------------------------------------------------------------------
| Documents
|--------------------------------------------------------------------------
*/

export const addTenderDocument = async ({ tender_id, ...payload }) => {
  const response = await axiosClient.post(
    tenderPath(tender_id, "/documents"),
    payload
  );

  return response.data;
};

export const deleteTenderDocument = async (tenderId, documentId) => {
  const response = await axiosClient.delete(
    tenderPath(tenderId, `/documents/${documentId}`)
  );

  return response.data;
};

/*
|--------------------------------------------------------------------------
| Subcontractor assignments
|--------------------------------------------------------------------------
*/

export const assignTenderSubcontractor = async ({ tender_id, ...payload }) => {
  const response = await axiosClient.post(
    tenderPath(tender_id, "/subcontractors"),
    payload
  );

  return response.data;
};

export const updateTenderSubcontractor = async (
  tenderId,
  assignmentId,
  payload
) => {
  const response = await axiosClient.put(
    tenderPath(tenderId, `/subcontractors/${assignmentId}`),
    payload
  );

  return response.data;
};

export const removeTenderSubcontractor = async (tenderId, assignmentId) => {
  const response = await axiosClient.delete(
    tenderPath(tenderId, `/subcontractors/${assignmentId}`)
  );

  return response.data;
};
