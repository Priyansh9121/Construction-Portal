/**
 * File purpose:
 * Company user management and the password flows.
 *
 * API endpoints:
 * - GET  /auth/users
 * - POST /auth/users
 * - PUT  /auth/users/:userId
 * - PUT  /auth/users/:userId/disable
 * - PUT  /auth/users/:userId/enable
 * - PUT  /auth/change-password
 * - POST /auth/forgot-password
 * - POST /auth/reset-password
 *
 * Connected to:
 * - UsersPage.jsx, SettingsPage.jsx
 * - ForgotPasswordPage.jsx, ResetPasswordPage.jsx
 * - Backed by backend/modules/auth/auth.controller.js
 * - Uses api/axiosClient.js, which attaches the bearer token and
 *   signs the user out on a 401.
 *
 * Important notes:
 * - User management is admin-only, and creating or promoting an ADMIN
 * - additionally requires being the company owner.
 * - forgot-password always reports success, whether or not the address is
 * - registered — the response deliberately reveals nothing.
 * - Disabling a user bumps token_version, so their existing sessions stop
 * - working immediately rather than at token expiry.
 */

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