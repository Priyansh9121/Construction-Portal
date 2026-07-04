import axiosClient from "../api/axiosClient";

export const getPayments = async (filters = {}) => {
  const res = await axiosClient.get("/payments", {
    params: filters,
  });

  return res.data.payments;
};

export const createPayment = async (data) => {
  const res = await axiosClient.post("/payments", data);
  return res.data;
};

export const deletePayment = async (id) => {
  const res = await axiosClient.delete(`/payments/${id}`);
  return res.data;
};

export const updatePayment = async (id, payload) => {
  const response = await axiosClient.put(`/payments/${id}`, payload);
  return response.data;
};