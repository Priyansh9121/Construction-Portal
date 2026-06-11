import axiosClient from "../api/axiosClient";

export const getUsers = async () => {
  const res = await axiosClient.get("/auth/users");
  return res.data;
};

export const createUser = async (data) => {
  const res = await axiosClient.post("/auth/create-user", data);
  return res.data;
};

export const updateUser = async (id, data) => {
  const res = await axiosClient.put(`/auth/users/${id}`, data);
  return res.data;
};

export const disableUser = async (id) => {
  const res = await axiosClient.put(`/auth/users/${id}/disable`);
  return res.data;
};

export const changePassword = async (data) => {
  const res = await axiosClient.put("/auth/change-password", data);
  return res.data;
};


export const forgotPassword = async (data) => {
    const res = await axiosClient.post("/auth/forgot-password", data);
    return res.data;
};
  
export const resetPassword = async (data) => {
    const res = await axiosClient.post("/auth/reset-password", data);
    return res.data;
};