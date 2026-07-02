import axiosClient from "../api/axiosClient";

export const getDailyUpdateApprovals = async (status = "pending") => {
    const response = await axiosClient.get(
      `/daily-update-approvals?status=${status}`
    );
    return response.data;
  };

export const approveDailyUpdate = async (
  id,
  admin_comment
) => {
  const response = await axiosClient.post(
    `/daily-update-approvals/${id}/approve`,
    {
      admin_comment,
    }
  );

  return response.data;
};

export const rejectDailyUpdate = async (id, admin_comment) => {
    const response = await axiosClient.post(
      `/daily-update-approvals/${id}/reject`,
      {
        admin_comment,
      }
    );
  
    return response.data;
  };