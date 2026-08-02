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



export default {
  getPayments,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentHierarchy,
};
