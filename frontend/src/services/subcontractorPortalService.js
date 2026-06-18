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