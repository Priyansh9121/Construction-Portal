import { useAuth } from "../contexts/AuthContext";

import NotificationCenter from "./NotificationCenter";

function Topbar({ activePage, tenders = [], invoices = [], payments = [] }) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();

    localStorage.removeItem("token");
    localStorage.removeItem("user");

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
        <NotificationCenter
          tenders={tenders}
          invoices={invoices}
          payments={payments}
        />

        <button onClick={handleLogout}>Logout</button>
      </div>
    </header>
  );
}

export default Topbar;