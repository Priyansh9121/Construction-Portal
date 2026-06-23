import axiosClient from "../api/axiosClient";

export const getTenderFinanceRecords = async (tenderId) => {
  const res = await axiosClient.get(`/tender-finance/tender/${tenderId}`);
  return res.data;
};

export const getTenderFinanceSummary = async (tenderId) => {
  const res = await axiosClient.get(`/tender-finance/summary/${tenderId}`);
  return res.data;
};

export const createFinanceRecord = async (data) => {
  const res = await axiosClient.post("/tender-finance", data);
  return res.data;
};

export const updateFinanceRecord = async (id, payload) => {
  const res = await axiosClient.put(`/tender-finance/${id}`, payload);
  return res.data;
};

export const deleteFinanceRecord = async (id) => {
  const res = await axiosClient.delete(`/tender-finance/${id}`);
  return res.data;
};