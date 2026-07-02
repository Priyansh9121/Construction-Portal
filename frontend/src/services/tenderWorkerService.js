import axiosClient from "../api/axiosClient";

export const getTenderWorkers = async (tenderId) => {
  const response = await axiosClient.get(`/tender-workers/${tenderId}`);
  return response.data;
};

export const assignWorkerToTender = async (payload) => {
  const response = await axiosClient.post("/tender-workers", payload);
  return response.data;
};

export const removeTenderWorker = async (id) => {
  const response = await axiosClient.delete(`/tender-workers/${id}`);
  return response.data;
};