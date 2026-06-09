import axiosClient from "../api/axiosClient";

export const getTenderDetails = async (id) => {
  const response = await axiosClient.get(`/tender-details/${id}`);
  return response.data;
};

export const addTenderMaterial = async (payload) => {
  const response = await axiosClient.post("/tender-details/materials", payload);
  return response.data;
};

export const deleteTenderMaterial = async (id) => {
  const response = await axiosClient.delete(`/tender-details/materials/${id}`);
  return response.data;
};

export const addTenderBanking = async (payload) => {
  const response = await axiosClient.post("/tender-details/banking", payload);
  return response.data;
};

export const deleteTenderBanking = async (id) => {
  const response = await axiosClient.delete(`/tender-details/banking/${id}`);
  return response.data;
};

export const addTenderDocument = async (payload) => {
  const response = await axiosClient.post("/tender-details/documents", payload);
  return response.data;
};

export const deleteTenderDocument = async (id) => {
  const response = await axiosClient.delete(`/tender-details/documents/${id}`);
  return response.data;
};

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append("photo", file);

  const response = await axiosClient.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export const addDailyProgress = async (payload) => {
  const response = await axiosClient.post("/site-logs", payload);
  return response.data;
};

export const deleteDailyProgress = async (id) => {
  const response = await axiosClient.delete(`/site-logs/${id}`);
  return response.data;
};