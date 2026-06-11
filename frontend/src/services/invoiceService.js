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