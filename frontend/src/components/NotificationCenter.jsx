/**
 * File purpose:
 * The notification panel: unread items, and marking them read.
 *
 * Props:
 * - open state and a close handler
 *
 * State and hooks:
 * - Loads and refreshes through notificationService
 *
 * Rendered by:
 * - Topbar.jsx
 *
 * Important notes:
 * - Notifications are PER USER, not per company. The backend filters on the
 * - authenticated user id, so this only ever shows the caller's own.
 * - The unread count drives the badge in Topbar; marking read updates both.
 */

import { useCallback, useRef, useState } from "react";
import AppLink from "./ui/AppLink";
import { AnimatePresence, motion } from "framer-motion";

import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notificationService";

import useAsyncResource from "../hooks/useAsyncResource";
import Icon from "./ui/Icon";
import useDismissableOverlay from "../hooks/useDismissableOverlay";

/*
|--------------------------------------------------------------------------
| Notification centre
|--------------------------------------------------------------------------
|
| Reads GET /api/notifications.
|
| It used to derive its list on the client from whatever tenders, invoices
| and payments the page happened to be holding, which meant it could only
| ever report on rows already downloaded, said nothing on screens that do
| not load them, and had no notion of read or unread. Meanwhile the server
| was already writing real notifications — access requests and their
| grants among them — that nobody could see.
|
*/

/**
 * Reduces a link to a safe in-app path.
 *
 * Anything that could leave the origin — a scheme, a protocol-relative
 * "//host", or the backslash form that React Router 7.12–8.2 mishandles —
 * falls back to the dashboard rather than navigating away.
 */
function toInternalPath(value) {
  const path = String(value || "").trim();

  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/\\") ||
    path.includes("\\") ||
    /^[a-z][a-z0-9+.-]*:/i.test(path)
  ) {
    return "/dashboard";
  }

  return path;
}

function NotificationCenter() {
  const [open, setOpen] = useState(false);

  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  const closePanel = useCallback(() => {
    setOpen(false);
  }, []);

  /*
   * V2-I023. This panel previously had no Escape handling at all — it stayed
   * open behind the command palette with focus in an ambiguous place. It now
   * shares the account menu's dismiss behaviour: Escape closes it, focus
   * returns to the bell, a pointer-down outside closes it, and a modal
   * surface outranks it. Notification loading, marking and navigation are
   * untouched.
   */
  useDismissableOverlay({
    open,
    onDismiss: closePanel,
    containerRef: panelRef,
    triggerRef,
  });

  const load = useCallback(async () => {
    const { notifications } = await getNotifications({ limit: 20 });

    return notifications;
  }, []);

  const {
    data: notifications,
    setData: setNotifications,
    reload,
  } = useAsyncResource(load, {
    label: "notifications",
  });

  const unreadCount = notifications.filter(
    (item) => !item.is_read
  ).length;

  const openPanel = () => {
    setOpen((previous) => {
      // Re-read on the way open so the panel is not showing a list from
      // whenever the page last mounted.
      if (!previous) {
        reload({ showLoader: false });
      }

      return !previous;
    });
  };

  const handleOpenItem = async (item) => {
    setOpen(false);

    if (item.is_read) {
      return;
    }

    // Mark it read locally first: the panel has already closed, and a
    // failed request should not leave the badge stuck.
    setNotifications((rows) =>
      rows.map((row) =>
        row.id === item.id ? { ...row, is_read: true } : row
      )
    );

    try {
      await markNotificationRead(item.id);
    } catch (error) {
      console.error("Failed to mark the notification read", error);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((rows) =>
      rows.map((row) => ({ ...row, is_read: true }))
    );

    try {
      await markAllNotificationsRead();
    } catch (error) {
      console.error("Failed to mark notifications read", error);

      // Put the real state back rather than leaving a wrong badge.
      reload({ showLoader: false });
    }
  };

  return (
    <div className="notification-center" ref={panelRef}>
      <button
        type="button"
        ref={triggerRef}
        className="notification-button"
        onClick={openPanel}
        aria-expanded={open}
        aria-controls="notification-panel"
        aria-haspopup="dialog"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
      >
        {/*
          An SVG rather than the 🔔 emoji this used to render. An emoji is
          font-dependent, renders differently on every platform, cannot take
          the surrounding colour, and is announced as "bell" by screen
          readers on top of the button's own label.
        */}
        <Icon name="bell" size={20} />

        {unreadCount > 0 && <span>{unreadCount}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="notification-panel"
            className="notification-panel"
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
          >
            <h3>Notifications</h3>

            {unreadCount > 0 && (
              <button
                type="button"
                className="link-button"
                onClick={handleMarkAllRead}
              >
                Mark all as read
              </button>
            )}

            {notifications.map((item) => (
              <AppLink
                key={item.id}
                // Notification links come from the database, so they are
                // the one place in this app where a route target is not a
                // literal. React Router 7.12–8.2 has an open-redirect issue
                // where a backslash-prefixed target escapes the origin, so
                // the value is constrained to an in-app path here rather
                // than trusted as-is.
                to={toInternalPath(item.link)}
                className={item.is_read ? "" : "unread"}
                onClick={() => handleOpenItem(item)}
              >
                <strong>{item.title}</strong>
                <span>{item.message}</span>
              </AppLink>
            ))}

            {notifications.length === 0 && <p>No active alerts.</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NotificationCenter;
