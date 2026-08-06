/**
 * File purpose:
 * Worker assignments on a tender.
 *
 * API endpoints:
 * - GET    /tenders/:id/workers
 * - POST   /tenders/:id/workers
 * - PUT    /tenders/:id/workers/:assignmentId
 * - DELETE /tenders/:id/workers/:assignmentId
 *
 * Connected to:
 * - TenderWorkersTab.jsx
 * - Backed by backend/modules/tenders/tender.controller.js
 * - Uses api/axiosClient.js, which attaches the bearer token and
 *   signs the user out on a 401.
 *
 * Important notes:
 * - Split out from tenderDetailsService because worker assignments are read
 * - by more than the detail page.
 * - Assigning is a grant of ACCESS as well as a record: /worker-portal
 * - reads these rows to decide which tenders a worker can see.
 * - An active assignment also blocks the tender from being deleted.
 */

import axiosClient from "../api/axiosClient";
import { tenderPath } from "./tenderDetailsService";

/*
|--------------------------------------------------------------------------
| Tender worker assignments
|--------------------------------------------------------------------------
|
| Nested under the tender that owns them, for the same reason as the other
| child resources in tenderDetailsService: the server can confirm the
| parent belongs to the caller's company before touching a child row.
|
| These previously went through /api/tender-workers, an adapter whose own
| header described it as temporary and which rewrote the parameters before
| forwarding to this same controller.
|
*/

/*
 * Composed from the canonical helper in tenderDetailsService rather than
 * redefined. This file used to carry a byte-identical copy of the id
 * validation — same Number()/Number.isNaN guard, same error message — with
 * only "/workers" baked in, so the rule lived in two places.
 */
const workerPath = (tenderId, suffix = "") =>
  tenderPath(tenderId, `/workers${suffix}`);

export const getTenderWorkers = async (tenderId) => {
  const response = await axiosClient.get(workerPath(tenderId));

  return response.data;
};

export const assignWorkerToTender = async ({ tender_id, ...payload }) => {
  const response = await axiosClient.post(
    workerPath(tender_id),
    payload
  );

  return response.data;
};


export const removeTenderWorker = async (tenderId, assignmentId) => {
  const response = await axiosClient.delete(
    workerPath(tenderId, `/${assignmentId}`)
  );

  return response.data;
};
