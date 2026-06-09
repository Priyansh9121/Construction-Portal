import { Link, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

function AppLayout({ children }) {
  const location = useLocation();

  const navItems = [
    { label: "Home", path: "/dashboard" },
    { label: "Pay", path: "/payments" },
    { label: "Workers", path: "/workers" },
    { label: "Sites", path: "/sites" },
    { label: "Tenders", path: "/tenders" },
    { label: "More", path: "/reports" },
  ];

  const isActive = (path) => {
    if (path === "/tenders") {
      return location.pathname.startsWith("/tenders");
    }

    return location.pathname === path;
  };

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <Topbar />
        <div className="page-content">{children}</div>
      </main>

      <nav className="mobile-bottom-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={isActive(item.path) ? "mobile-nav-active" : ""}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default AppLayout;