import axiosClient from "../api/axiosClient";

export const loginUser = async (data) => {
  const res = await axiosClient.post("/auth/login", data);
  return res.data;
};

export const registerUser = async (data) => {
  const res = await axiosClient.post("/auth/register", data);
  return res.data;
};

export const changePassword = async (passwordData) => {
  const response = await API.put("/auth/change-password", passwordData);
  return response.data;
};