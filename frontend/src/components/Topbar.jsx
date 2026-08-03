/**
 * File purpose:
 * The header bar: user menu and notification badge.
 *
 * Props:
 * - user, and the logout handler
 *
 * State and hooks:
 * - Local menu open state; renders NotificationCenter
 *
 * Rendered by:
 * - AppLayout.jsx
 *
 * Renders:
 * - NotificationCenter.jsx
 *
 * Important notes:
 * - Logout clears the token and user through AuthProvider. It does not call
 * - the API — there is no server-side session to end, since auth is a bearer
 * - token. The token remains technically valid until it expires, which is
 * - why a password change bumps token_version to invalidate it properly.
 */

import { useAuth } from "../contexts/authContext";

import NotificationCenter from "./NotificationCenter";

function Topbar({ activePage }) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    // logout() already clears the token and the cached user.
    logout();

    window.location.href = "/";
  };

  return (
    <header className="topbar">
      <div>
        <h1>{activePage}</h1>

        <p>
          Welcome back, {user?.full_name || "User"}
        </p>
      </div>

      <div className="topbar-actions">
        <NotificationCenter />

        <button onClick={handleLogout}>Logout</button>
      </div>
    </header>
  );
}

export default Topbar;
