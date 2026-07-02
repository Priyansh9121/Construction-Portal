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

