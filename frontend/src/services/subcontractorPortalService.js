import axiosClient from "../api/axiosClient";

export const getSubcontractorProfile = async () => {
  const response = await axiosClient.get("/subcontractor-portal/me");
  return response.data;
};

export const getSubcontractorTenders = async () => {
  const response = await axiosClient.get("/subcontractor-portal/tenders");
  return response.data;
};

export const getSubcontractorTenderDetails = async (tenderId) => {
  const response = await axiosClient.get(
    `/subcontractor-portal/tenders/${tenderId}`
  );

  return response.data;
};

export const createSubcontractorDailyUpdate = async (payload) => {
  const response = await axiosClient.post(
    "/subcontractor-portal/daily-updates",
    payload
  );

  return response.data;
};

export const addSubcontractorTenderDocument = async (payload) => {
  const response = await axiosClient.post(
    "/subcontractor-portal/documents",
    payload
  );

  return response.data;
};