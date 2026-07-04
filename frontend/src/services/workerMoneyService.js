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