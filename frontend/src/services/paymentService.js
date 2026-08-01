import axiosClient from "../api/axiosClient";

/*
|--------------------------------------------------------------------------
| Payments
|--------------------------------------------------------------------------
|
| The Add Payment surface: income and expense, each with its own
| scope/sub-type tree.
|
*/

export const getPayments = async (filters = {}) => {
  const res = await axiosClient.get("/payments", {
    params: filters,
  });

  // Tolerate both the paginated envelope and a bare array, so this keeps
  // working whichever shape the endpoint returns.
  return Array.isArray(res.data)
    ? res.data
    : res.data.payments ?? [];
};

/**
 * Same call, but keeps the pagination metadata.
 */
export const getPaymentsPage = async (filters = {}) => {
  const res = await axiosClient.get("/payments", { params: filters });

  return {
    payments: res.data.payments ?? [],
    pagination: res.data.pagination ?? null,
  };
};

export const createPayment = async (data) => {
  const res = await axiosClient.post("/payments", data);

  return res.data;
};

export const deletePayment = async (id) => {
  const res = await axiosClient.delete(`/payments/${id}`);

  return res.data;
};

export const updatePayment = async (id, payload) => {
  const response = await axiosClient.put(`/payments/${id}`, payload);

  return response.data;
};

/**
 * The Add Payment tree, served by the API.
 *
 * Fetching it rather than keeping a second copy in the frontend means the
 * form and the server's validation cannot disagree about which
 * scope/sub-type combinations exist.
 */
export const getPaymentHierarchy = async () => {
  const res = await axiosClient.get("/payments/hierarchy");

  return res.data.hierarchy ?? { income: [], expense: [] };
};

/**
 * Income, expense and balance, broken down by scope and sub-type.
 */
export const getPaymentSummary = async (params = {}) => {
  const res = await axiosClient.get("/payments/summary", { params });

  return {
    summary: res.data.summary ?? null,
    breakdown: res.data.breakdown ?? [],
  };
};

/**
 * Investor money with interest accrued to today.
 *
 * Interest is computed per request rather than stored, because it keeps
 * running for as long as the money is outstanding.
 */
export const getInvestorInterest = async () => {
  const res = await axiosClient.get("/payments/investor-interest");

  return {
    entries: res.data.entries ?? [],
    summary: res.data.summary ?? null,
  };
};

export default {
  getPayments,
  getPaymentsPage,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentHierarchy,
  getPaymentSummary,
  getInvestorInterest,
};
