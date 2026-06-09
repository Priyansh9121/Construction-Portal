import { useAuth } from "../contexts/AuthContext";

function Topbar({ activePage }) {
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

      <button onClick={handleLogout}>
        Logout
      </button>
    </header>
  );
}

export default Topbar;