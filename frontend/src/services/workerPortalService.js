import axiosClient from "../api/axiosClient";

export const getWorkerProfile = async () => {
  const response = await axiosClient.get("/worker-portal/me");
  return response.data;
};

export const getWorkerAssignments = async () => {
  const response = await axiosClient.get("/worker-portal/assignments");
  return response.data;
};

export const getWorkerDailyUpdates = async () => {
  const response = await axiosClient.get("/worker-portal/daily-updates");
  return response.data;
};

export const createWorkerDailyUpdate = async (payload) => {
  const response = await axiosClient.post(
    "/worker-portal/daily-updates",
    payload
  );

  return response.data;
};

export const getWorkerTenderDocuments = async (tenderId) => {
  const response = await axiosClient.get(
    `/worker-portal/tenders/${tenderId}/documents`
  );

  return response.data;
};

export const getWorkerMoney = async () => {
  const response = await axiosClient.get("/worker-portal/money");
  return response.data;
};

export const createWorkerPortalExpense = async (payload) => {
  const response = await axiosClient.post(
    "/worker-portal/expenses",
    payload
  );

  return response.data;
};