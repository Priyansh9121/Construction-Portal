import axiosClient from "../api/axiosClient";

export const getTenders = async () => {
  const res = await axiosClient.get("/tenders");
  return res.data.tenders;
};

export const createTender = async (data) => {
  const res = await axiosClient.post("/tenders", data);
  return res.data;
};

export const deleteTender = async (id) => {
  const res = await axiosClient.delete(`/tenders/${id}`);
  return res.data;
};

export const updateTender = async (id, payload) => {
  const response = await axiosClient.put(
    `/tenders/${id}`,
    payload
  );

  return response.data;
};