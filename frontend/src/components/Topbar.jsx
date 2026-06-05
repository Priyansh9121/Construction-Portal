import { useAuth } from "../contexts/AuthContext";

function Topbar({ activePage }) {
  const { user, logout } = useAuth();

  return (
    <header className="topbar">
      <div>
        <h1>{activePage}</h1>

        <p>
          Welcome back, {user?.full_name}
        </p>
      </div>

      <button onClick={logout}>
        Logout
      </button>
    </header>
  );
}

export default Topbar;