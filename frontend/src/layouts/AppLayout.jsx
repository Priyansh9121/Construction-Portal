import { Link, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

function AppLayout({ children }) {
  const location = useLocation();

  const navItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Payments", path: "/payments" },
    { label: "Workers", path: "/workers" },
    { label: "Sites", path: "/sites" },
    { label: "Tenders", path: "/tenders" },
    { label: "Invoices", path: "/invoices" },
    { label: "Reports", path: "/reports" },
    { label: "Settings", path: "/settings" },
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

        <nav className="mobile-page-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={isActive(item.path) ? "mobile-page-active" : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}

export default AppLayout;