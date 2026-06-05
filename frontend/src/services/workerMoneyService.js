import axiosClient from "../api/axiosClient";

export const getAllocations = async () => {
  const res = await axiosClient.get("/worker-allocations");
  return res.data.allocations;
};

export const createAllocation = async (data) => {
  const res = await axiosClient.post("/worker-allocations", data);
  return res.data;
};

export const getExpenses = async () => {
  const res = await axiosClient.get("/worker-expenses");
  return res.data.expenses;
};

export const createExpense = async (data) => {
  const res = await axiosClient.post("/worker-expenses", data);
  return res.data;
};