import axiosClient from "../api/axiosClient";

export const getSiteLogs = async () => {
  const res = await axiosClient.get("/site-logs");
  return res.data.siteLogs;
};

export const createSiteLog = async (data) => {
  const res = await axiosClient.post("/site-logs", data);
  return res.data;
};

export const deleteSiteLog = async (id) => {
  const res = await axiosClient.delete(`/site-logs/${id}`);
  return res.data;
};