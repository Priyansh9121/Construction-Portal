/**
 * File purpose:
 * The invoices register.
 *
 * API endpoints:
 * - GET    /invoices
 * - POST   /invoices
 * - PUT    /invoices/:id
 * - DELETE /invoices/:id
 *
 * Connected to:
 * - useInvoices.js -> InvoicesPage.jsx, and the tender Finance tab
 * - Backed by backend/modules/invoices/, built on createScopedCrud
 * - Uses api/axiosClient.js, which attaches the bearer token and
 *   signs the user out on a 401.
 *
 * Important notes:
 * - Office-only. An invoice records what was BILLED; money RECEIVED lives
 * - in payments, and nothing reconciles the two automatically.
 * - There is no getById call because the backend does not route one (F-10).
 */

import axiosClient from "../api/axiosClient";

export const getInvoices = async () => {
  const res = await axiosClient.get("/invoices");
  return res.data.invoices;
};

export const createInvoice = async (data) => {
  const res = await axiosClient.post("/invoices", data);
  return res.data;
};

export const deleteInvoice = async (id) => {
  const res = await axiosClient.delete(`/invoices/${id}`);
  return res.data;
};

export const updateInvoice = async (id, payload) => {
  const response = await axiosClient.put(
    `/invoices/${id}`,
    payload
  );

  return response.data;
};