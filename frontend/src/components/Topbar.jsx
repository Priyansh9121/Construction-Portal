/**
 * File purpose:
 * The header bar: navigation toggle, page context, notifications and the
 * account menu.
 *
 * Props:
 * - activePage  the page title
 * - onOpenMenu  opens the navigation drawer (small screens only)
 * - menuOpen    whether the drawer is open, for aria-expanded
 * - toggleRef   so AppLayout can restore focus to the button after the
 *               drawer closes
 *
 * State and hooks:
 * - Local account-menu open state; renders NotificationCenter
 *
 * Rendered by:
 * - AppLayout.jsx
 *
 * The overflow this fixes:
 * The actions cluster used to be a bare Logout button plus the notification
 * bell, laid out with `flex: 0 0 auto`. Measured in Chromium it was 343px
 * wide inside a 375px viewport, which pushed its right edge to 427px and
 * gave EVERY authenticated route a 52px horizontal overflow on a phone —
 * the single most widespread defect in the audit. Logout now lives inside an
 * account menu behind a fixed-size trigger, and the cluster is allowed to
 * shrink, so the actions occupy a constant ~96px regardless of the user's
 * name length.
 *
 * Accessibility:
 * - The menu button is hidden at >= 1024px in CSS, where the sidebar is
 *   permanently visible. It carries aria-expanded and aria-controls
 *   pointing at the sidebar's id.
 * - Icon-only controls take their accessible name from aria-label.
 * - The account menu is a real disclosure: aria-expanded on the trigger,
 *   Escape closes it, and clicking outside dismisses it. Focus returns to
 *   the trigger on close so a keyboard user is not stranded.
 *
 * Important notes:
 * - Logout clears the token and user through AuthProvider. It does not call
 *   the API — there is no server-side session to end, since auth is a bearer
 *   token. The token remains technically valid until it expires, which is
 *   why a password change bumps token_version to invalidate it properly.
 */

import {
  useCallback,
  useRef,
  useState,
} from "react";

import { useAuth } from "../contexts/authContext";

import NotificationCenter from "./NotificationCenter";
import Icon from "./ui/Icon";
import useDismissableOverlay from "../hooks/useDismissableOverlay";

/** First letter of each of the first two words, for the avatar. */
function initialsOf(name) {
  return String(name || "User")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function Topbar({
  activePage,
  onOpenMenu,
  menuOpen = false,
  toggleRef,
}) {
  const { user, logout } = useAuth();

  const [accountOpen, setAccountOpen] = useState(false);

  const accountRef = useRef(null);
  const accountTriggerRef = useRef(null);

  const closeAccount = useCallback(() => {
    setAccountOpen(false);
  }, []);

  /*
   * Dismiss on outside click and on Escape.
   *
   * This was the reference implementation for `useDismissableOverlay`
   * (V2-I023) and now uses it. Behaviour is unchanged: listeners attach only
   * while the menu is open, and focus returns to the trigger on Escape. What
   * it gains is arbitration — it no longer competes with the notification
   * panel or the command palette for the key.
   */
  useDismissableOverlay({
    open: accountOpen,
    onDismiss: closeAccount,
    containerRef: accountRef,
    triggerRef: accountTriggerRef,
  });

  const handleLogout = () => {
    // logout() already clears the token and the cached user.
    logout();

    window.location.href = "/";
  };

  return (
    <header className="topbar">
      <button
        type="button"
        ref={toggleRef}
        className="sidebar-toggle"
        aria-label="Open navigation menu"
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
        onClick={onOpenMenu}
      >
        <Icon name="menu" size={20} />
      </button>

      <div className="topbar-heading">
        <h1>{activePage}</h1>
      </div>

      <div className="topbar-actions">
        <NotificationCenter />

        <div className="account-menu" ref={accountRef}>
          <button
            type="button"
            ref={accountTriggerRef}
            className="account-trigger"
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            aria-label={`Account menu for ${user?.full_name || "User"}`}
            onClick={() => setAccountOpen((previous) => !previous)}
          >
            <span className="account-avatar" aria-hidden="true">
              {initialsOf(user?.full_name)}
            </span>

            <Icon name="chevron-down" size={16} className="account-caret" />
          </button>

          {accountOpen ? (
            <div className="account-panel" role="menu">
              <div className="account-identity">
                <strong>{user?.full_name || "User"}</strong>
                <small>{user?.email || ""}</small>
                <span className="badge badge--neutral">
                  {user?.role || "—"}
                </span>
              </div>

              <button
                type="button"
                role="menuitem"
                className="account-action account-action--danger"
                onClick={() => {
                  closeAccount();
                  handleLogout();
                }}
              >
                <Icon name="logout" size={18} />
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
