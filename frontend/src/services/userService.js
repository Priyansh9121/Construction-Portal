import axiosClient from "../api/axiosClient";

export const getUsers = async () => {
  const res = await axiosClient.get("/auth/users");
  return res.data;
};

export const createUser = async (data) => {
  const res = await axiosClient.post("/auth/users", data);
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

/*
 * The counterpart to disableUser. The endpoint existed with no caller, so
 * an account disabled by mistake could not be turned back on from the app
 * — the row simply read "Disabled" with nothing to click.
 */
export const enableUser = async (id) => {
  const res = await axiosClient.put(`/auth/users/${id}/enable`);
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