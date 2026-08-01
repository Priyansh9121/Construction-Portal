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
