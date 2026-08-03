/**
 * File purpose:
 * The office's approval queue for worker-submitted daily updates.
 *
 * API endpoints:
 * - GET  /daily-update-approvals
 * - POST /daily-update-approvals/:id/approve
 * - POST /daily-update-approvals/:id/reject
 *
 * Connected to:
 * - DailyUpdateApprovalsPage.jsx
 * - Backed by backend/modules/dailyUpdateApprovals/
 * - Uses api/axiosClient.js, which attaches the bearer token and
 *   signs the user out on a 401.
 *
 * Important notes:
 * - Office-only, and that gate is what gives approval its meaning:
 * - submitting happens in the worker portal, approving happens here, so the
 * - two cannot be the same person.
 * - Updates the office records directly through /site-logs bypass this queue
 * - entirely.
 * - Every decision is audited on the backend.
 */

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