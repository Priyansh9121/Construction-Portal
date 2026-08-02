import axiosClient from "../api/axiosClient";

export const getSites = async () => {
  const res = await axiosClient.get("/sites");
  return res.data.sites;
};

export const createSite = async (data) => {
  const res = await axiosClient.post("/sites", data);
  return res.data;
};

export const deleteSite = async (id) => {
  const res = await axiosClient.delete(`/sites/${id}`);
  return res.data;
};