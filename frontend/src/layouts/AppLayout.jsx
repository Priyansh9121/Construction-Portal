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
    { label: "Invoices", path: "/invoices" },
  ];

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <Topbar />
        {children}
      </main>

      <nav className="mobile-bottom-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={
              location.pathname === item.path ? "mobile-nav-active" : ""
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default AppLayout;