/**
 * File purpose:
 * The worker's own view of themselves.
 *
 * API endpoints:
 * - GET  /worker-portal/me
 * - GET  /worker-portal/assignments
 * - GET  /worker-portal/daily-updates
 * - POST /worker-portal/daily-updates
 * - GET  /worker-portal/money
 * - GET  /worker-portal/expenses
 *
 * Connected to:
 * - WorkerPortalPage.jsx
 * - Backed by backend/modules/workerPortal/
 * - Uses api/axiosClient.js, which attaches the bearer token and
 *   signs the user out on a 401.
 *
 * Important notes:
 * - A worker's entire surface. They cannot reach /workers, /payments or any
 * - other register.
 * - The backend resolves the caller's own worker record from their user id
 * - and filters everything on it — the role gate alone establishes that the
 * - caller is a worker, not which one.
 * - A daily update submitted here goes to the office approval queue, unlike
 * - one the office records directly through /site-logs.
 */

import axiosClient from "../api/axiosClient";

export const getWorkerProfile = async () => {
  const response = await axiosClient.get("/worker-portal/me");
  return response.data;
};

export const getWorkerAssignments = async () => {
  const response = await axiosClient.get("/worker-portal/assignments");
  return response.data;
};

export const getWorkerDailyUpdates = async () => {
  const response = await axiosClient.get("/worker-portal/daily-updates");
  return response.data;
};

export const createWorkerDailyUpdate = async (payload) => {
  const response = await axiosClient.post(
    "/worker-portal/daily-updates",
    payload
  );

  return response.data;
};

export const getWorkerTenderDocuments = async (tenderId) => {
  const response = await axiosClient.get(
    `/worker-portal/tenders/${tenderId}/documents`
  );

  return response.data;
};

export const getWorkerMoney = async () => {
  const response = await axiosClient.get("/worker-portal/money");
  return response.data;
};

export const createWorkerPortalExpense = async (payload) => {
  const response = await axiosClient.post(
    "/worker-portal/expenses",
    payload
  );

  return response.data;
};