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
