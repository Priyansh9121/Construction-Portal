import axiosClient from "../api/axiosClient";

/*
|--------------------------------------------------------------------------
| Master data
|--------------------------------------------------------------------------
|
| Investors, suppliers and clients. These back the dropdowns on the Add
| Payment screens, so a payment can reference a real record rather than a
| free-text name.
|
*/

const base = "/masters";

const list = async (master, params = {}) => {
  const { data } = await axiosClient.get(`${base}/${master}`, { params });

  // The API returns both a named collection and a generic `items` key.
  return data.items ?? data[master] ?? [];
};

export const getInvestors = (params) => list("investors", params);
export const getSuppliers = (params) => list("suppliers", params);
export const getClients = (params) => list("clients", params);

export const createMaster = async (master, payload) => {
  const { data } = await axiosClient.post(`${base}/${master}`, payload);

  return data.item;
};

export const updateMaster = async (master, id, payload) => {
  const { data } = await axiosClient.put(`${base}/${master}/${id}`, payload);

  return data.item;
};

export const archiveMaster = async (master, id) => {
  const { data } = await axiosClient.delete(`${base}/${master}/${id}`);

  return data;
};

/**
 * Everything taken from and returned to one investor, across all tenders,
 * with interest accrued to today.
 */
export const getInvestorStatement = async (id) => {
  const { data } = await axiosClient.get(
    `${base}/investors/${id}/statement`
  );

  return {
    investor: data.investor ?? null,
    entries: data.entries ?? [],
    summary: data.summary ?? null,
  };
};

export default {
  getInvestors,
  getSuppliers,
  getClients,
  createMaster,
  updateMaster,
  archiveMaster,
  getInvestorStatement,
};
