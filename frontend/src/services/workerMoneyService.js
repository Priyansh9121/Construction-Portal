/**
 * File purpose:
 * Worker allocations and the expenses recorded against them.
 *
 * API endpoints:
 * - GET/POST/PUT/DELETE /worker-allocations, plus approve and reject
 * - GET/POST/PUT/DELETE /worker-expenses, plus approve and reject
 *
 * Connected to:
 * - useWorkerMoney.js -> WorkerMoneyPage.jsx
 * - Backed by backend/modules/workerMoney/
 * - Uses api/axiosClient.js, which attaches the bearer token and
 *   signs the user out on a 401.
 *
 * Important notes:
 * - Office-only. A worker sees their own money through /worker-portal.
 * - Allocations are the credit side (money advanced), expenses the debit
 * - side (what it was spent on). An expense hangs off an allocation.
 * - Every mutation is audited on the backend.
 */

import axiosClient from "../api/axiosClient";

/*
|--------------------------------------------------------------------------
| Allocations
|--------------------------------------------------------------------------
*/

export const getAllocations = async () => {
  const res = await axiosClient.get("/worker-allocations");
  return res.data.allocations;
};

export const createAllocation = async (payload) => {
  const res = await axiosClient.post(
    "/worker-allocations",
    payload
  );

  return res.data;
};

export const updateAllocation = async (id, payload) => {
  const res = await axiosClient.put(
    `/worker-allocations/${id}`,
    payload
  );

  return res.data;
};

export const deleteAllocation = async (id) => {
  const res = await axiosClient.delete(
    `/worker-allocations/${id}`
  );

  return res.data;
};

/*
|--------------------------------------------------------------------------
| Expenses
|--------------------------------------------------------------------------
*/

export const getExpenses = async () => {
  const res = await axiosClient.get("/worker-expenses");
  return res.data.expenses;
};

export const createExpense = async (payload) => {
  const res = await axiosClient.post(
    "/worker-expenses",
    payload
  );

  return res.data;
};

export const updateExpense = async (id, payload) => {
  const res = await axiosClient.put(
    `/worker-expenses/${id}`,
    payload
  );

  return res.data;
};

export const deleteExpense = async (id) => {
  const res = await axiosClient.delete(
    `/worker-expenses/${id}`
  );

  return res.data;
};

/*
|--------------------------------------------------------------------------
| Approval
|--------------------------------------------------------------------------
*/

export const approveExpense = async (
  id,
  admin_comment = ""
) => {
  const res = await axiosClient.post(
    `/worker-expenses/${id}/approve`,
    {
      admin_comment,
    }
  );

  return res.data;
};

export const rejectExpense = async (
  id,
  admin_comment = ""
) => {
  const res = await axiosClient.post(
    `/worker-expenses/${id}/reject`,
    {
      admin_comment,
    }
  );

  return res.data;
};
/*
|--------------------------------------------------------------------------
| Allocation approval
|--------------------------------------------------------------------------
|
| An allocation is created pending, and a worker cannot spend against one
| until it is approved. Both endpoints existed; neither had a caller, so
| every allocation stayed pending and the money could never be drawn.
|
*/

export const approveAllocation = async (
  id,
  admin_comment = ""
) => {
  const res = await axiosClient.post(
    `/worker-allocations/${id}/approve`,
    {
      admin_comment,
    }
  );

  return res.data;
};

export const rejectAllocation = async (
  id,
  admin_comment = ""
) => {
  const res = await axiosClient.post(
    `/worker-allocations/${id}/reject`,
    {
      admin_comment,
    }
  );

  return res.data;
};
