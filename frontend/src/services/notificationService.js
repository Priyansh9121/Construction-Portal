/**
 * File purpose:
 * The notification queue and the activity feed.
 *
 * API endpoints:
 * - GET /notifications
 * - GET /notifications/unread-count
 * - PUT /notifications/:id/read
 * - PUT /notifications/read-all
 * - GET /activity
 *
 * Connected to:
 * - NotificationCenter.jsx, Topbar.jsx (the unread badge)
 * - ActivityPage.jsx for the audit feed
 * - Backed by backend/modules/notifications/
 * - Uses api/axiosClient.js, which attaches the bearer token and
 *   signs the user out on a 401.
 *
 * Important notes:
 * - Notifications are per USER, not per company — the backend filters on
 * - the authenticated user id, so this only ever returns the caller's own.
 * - /activity is the audit trail and is admin-only; the two are grouped
 * - here because both feed the notification area of the UI.
 */

import axiosClient from "../api/axiosClient";

/*
|--------------------------------------------------------------------------
| Notifications and audit trail
|--------------------------------------------------------------------------
*/

export const getNotifications = async (params = {}) => {
  const { data } = await axiosClient.get("/notifications", { params });

  return {
    notifications: data.notifications ?? [],
    unreadCount: data.unread_count ?? 0,
  };
};

export const markNotificationRead = async (id) => {
  const { data } = await axiosClient.post(`/notifications/${id}/read`);

  return data;
};

export const markAllNotificationsRead = async () => {
  const { data } = await axiosClient.post("/notifications/read-all");

  return data;
};

/**
 * The audit trail. Office-only — the API returns 403 for other roles.
 */
export const getActivityLog = async (params = {}) => {
  const { data } = await axiosClient.get("/activity", { params });

  return {
    activity: data.activity ?? [],
    pagination: data.pagination ?? null,
  };
};

export default {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getActivityLog,
};
