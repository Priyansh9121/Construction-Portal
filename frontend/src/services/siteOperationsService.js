import axiosClient from "../api/axiosClient";

/*
|--------------------------------------------------------------------------
| Site operations
|--------------------------------------------------------------------------
|
| Material received on site, the labour ledger, the supervisor's banking
| float, and the access requests that allow a backdated entry.
|
| Every function returns the response body's data directly, so callers get
| a predictable shape rather than having to remember which key each
| endpoint used.
|
*/

const base = "/site-operations";

/*
|--------------------------------------------------------------------------
| Materials
|--------------------------------------------------------------------------
*/

export const getMaterialCatalog = async () => {
  const { data } = await axiosClient.get(`${base}/materials/catalog`);

  return {
    materials: data.materials ?? [],
    sections: data.sections ?? {},
  };
};

export const getMaterialEntries = async (params = {}) => {
  const { data } = await axiosClient.get(`${base}/materials`, { params });

  return {
    entries: data.entries ?? [],
    pagination: data.pagination ?? null,
  };
};

export const getMaterialSummary = async (params = {}) => {
  const { data } = await axiosClient.get(`${base}/materials/summary`, {
    params,
  });

  return data.summary ?? [];
};

/**
 * Records a material delivery.
 *
 * `photo_source` must be "camera" or "gallery" — the office uses it to tell
 * a live capture from a re-upload, so it is worth setting honestly.
 */
export const createMaterialEntry = async (payload) => {
  const { data } = await axiosClient.post(`${base}/materials`, payload);

  return data.entry;
};

export const deleteMaterialEntry = async (id) => {
  const { data } = await axiosClient.delete(`${base}/materials/${id}`);

  return data;
};

export const approveMaterialEntry = async (id, admin_comment = "") => {
  const { data } = await axiosClient.post(
    `${base}/materials/${id}/approve`,
    { admin_comment }
  );

  return data.entry;
};

export const rejectMaterialEntry = async (id, admin_comment = "") => {
  const { data } = await axiosClient.post(
    `${base}/materials/${id}/reject`,
    { admin_comment }
  );

  return data.entry;
};

/*
|--------------------------------------------------------------------------
| Labour
|--------------------------------------------------------------------------
*/

export const getLabourCategories = async () => {
  const { data } = await axiosClient.get(`${base}/labour/categories`);

  return data.categories ?? [];
};

export const getLabour = async (params = {}) => {
  const { data } = await axiosClient.get(`${base}/labour`, { params });

  return data.labour ?? [];
};

export const createLabour = async (payload) => {
  const { data } = await axiosClient.post(`${base}/labour`, payload);

  return data.labour;
};

export const updateLabour = async (id, payload) => {
  const { data } = await axiosClient.put(`${base}/labour/${id}`, payload);

  return data.labour;
};

export const deleteLabour = async (id) => {
  const { data } = await axiosClient.delete(`${base}/labour/${id}`);

  return data;
};

/**
 * One labourer's account: every dated entry plus running totals.
 */
export const getLabourLedger = async (id) => {
  const { data } = await axiosClient.get(`${base}/labour/${id}/ledger`);

  return {
    labour: data.labour ?? null,
    entries: data.entries ?? [],
    summary: data.summary ?? null,
  };
};

export const createLabourWorkEntry = async (labourId, payload) => {
  const { data } = await axiosClient.post(
    `${base}/labour/${labourId}/entries`,
    payload
  );

  return data.entry;
};

/*
|--------------------------------------------------------------------------
| Banking
|--------------------------------------------------------------------------
*/

export const getBankingSummary = async (params = {}) => {
  const { data } = await axiosClient.get(`${base}/banking/summary`, {
    params,
  });

  return {
    summary: data.summary ?? null,
    breakdown: data.expense_breakdown ?? [],
  };
};

export const getFundReceipts = async (params = {}) => {
  const { data } = await axiosClient.get(`${base}/banking/receipts`, {
    params,
  });

  return {
    receipts: data.receipts ?? [],
    pagination: data.pagination ?? null,
  };
};

/**
 * Records money issued to a supervisor. Office-only.
 *
 * receipt_type is one of "bank", "cash" or "gst_cash".
 */
export const createFundReceipt = async (payload) => {
  const { data } = await axiosClient.post(
    `${base}/banking/receipts`,
    payload
  );

  return data.receipt;
};

export const getSupervisorExpenses = async (params = {}) => {
  const { data } = await axiosClient.get(`${base}/banking/expenses`, {
    params,
  });

  return {
    expenses: data.expenses ?? [],
    pagination: data.pagination ?? null,
  };
};

export const createSupervisorExpense = async (payload) => {
  const { data } = await axiosClient.post(
    `${base}/banking/expenses`,
    payload
  );

  return data.expense;
};

export const approveSupervisorExpense = async (id, admin_comment = "") => {
  const { data } = await axiosClient.post(
    `${base}/banking/expenses/${id}/approve`,
    { admin_comment }
  );

  return data.expense;
};

export const rejectSupervisorExpense = async (id, admin_comment = "") => {
  const { data } = await axiosClient.post(
    `${base}/banking/expenses/${id}/reject`,
    { admin_comment }
  );

  return data.expense;
};

/*
|--------------------------------------------------------------------------
| Access requests
|--------------------------------------------------------------------------
|
| Entries older than the allowed window need the office to grant access
| for that specific date.
|
*/

export const getAccessRequests = async (params = {}) => {
  const { data } = await axiosClient.get(`${base}/access-requests`, {
    params,
  });

  return data.requests ?? [];
};

/**
 * Asks the office for permission to record a backdated entry.
 *
 * `module` is one of: material, labour, banking, expense, daily_update.
 */
export const createAccessRequest = async (payload) => {
  const { data } = await axiosClient.post(`${base}/access-requests`, payload);

  return data;
};

export const grantAccessRequest = async (id, payload = {}) => {
  const { data } = await axiosClient.post(
    `${base}/access-requests/${id}/grant`,
    payload
  );

  return data;
};

export const denyAccessRequest = async (id, admin_comment = "") => {
  const { data } = await axiosClient.post(
    `${base}/access-requests/${id}/deny`,
    { admin_comment }
  );

  return data;
};

export default {
  getMaterialCatalog,
  getMaterialEntries,
  getMaterialSummary,
  createMaterialEntry,
  deleteMaterialEntry,
  approveMaterialEntry,
  rejectMaterialEntry,

  getLabourCategories,
  getLabour,
  createLabour,
  updateLabour,
  deleteLabour,
  getLabourLedger,
  createLabourWorkEntry,

  getBankingSummary,
  getFundReceipts,
  createFundReceipt,
  getSupervisorExpenses,
  createSupervisorExpense,
  approveSupervisorExpense,
  rejectSupervisorExpense,

  getAccessRequests,
  createAccessRequest,
  grantAccessRequest,
  denyAccessRequest,
};
