/**
 * File purpose:
 * Authentication calls: sign in, register, change password.
 *
 * API endpoints:
 * - POST /auth/login
 * - POST /auth/register
 * - PUT  /auth/change-password
 *
 * Connected to:
 * - LoginPage.jsx, RegisterPage.jsx, SettingsPage.jsx
 * - App.jsx imports loginUser for the legacy inline form
 * - Backed by backend/modules/auth/auth.controller.js
 * - Uses api/axiosClient.js, which attaches the bearer token and
 *   signs the user out on a 401.
 *
 * Important notes:
 * - login and register are the only calls here that work unauthenticated.
 * - A 401 from either is an expected outcome, not an expired session —
 * - axiosClient excludes these paths from its sign-out handling.
 * - changePassword returns a fresh token because the backend bumps
 * - token_version, signing out every other device.
 */

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
  const res = await axiosClient.put("/auth/change-password", passwordData);
  return res.data;
};