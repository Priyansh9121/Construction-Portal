/**
 * File purpose:
 * The workers register.
 *
 * API endpoints:
 * - GET    /workers
 * - POST   /workers
 * - PUT    /workers/:id
 * - DELETE /workers/:id
 *
 * Connected to:
 * - useWorkers.js -> WorkersPage.jsx
 * - The worker pickers on TenderWorkersTab and the WorkerMoney screens
 * - Backed by backend/modules/workers/, built on createScopedCrud
 * - Uses api/axiosClient.js, which attaches the bearer token and
 *   signs the user out on a 401.
 *
 * Important notes:
 * - Office-only. A worker sees their own record through /worker-portal.
 * - Create and update require name, phone, salary, role AND status — the
 * - backend validation demands all five, so this is a full replace rather
 * - than a patch.
 * - DELETE is soft, because payments and allocations reference the worker.
 */

import axiosClient from "../api/axiosClient";

export const getWorkers = async () => {
  const res = await axiosClient.get("/workers");
  return res.data.workers;
};

export const createWorker = async (data) => {
  const res = await axiosClient.post("/workers", data);
  return res.data;
};

export const deleteWorker = async (id) => {
  const res = await axiosClient.delete(`/workers/${id}`);
  return res.data;
};

export const updateWorker = async (id, payload) => {
  const response = await axiosClient.put(
    `/workers/${id}`,
    payload
  );

  return response.data;
};

