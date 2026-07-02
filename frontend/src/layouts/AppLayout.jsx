import { NavLink } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

function AppLayout({ children, activePage, user }) {
  const mobileLinks = [
    { label: "Dashboard", path: "/dashboard" },

    { label: "Finance", path: "/payments" },
    { label: "Invoices", path: "/invoices" },

    { label: "Workforce", path: "/workers" },
    { label: "Subs", path: "/subcontractors" },

    ...(user?.role === "admin"
      ? [{ label: "Users", path: "/users" }]
      : []),

    { label: "Sites", path: "/sites" },

    { label: "Updates", path: "/daily-site-updates" },

    ...(user?.role === "admin"
      ? [{ label: "Approvals", path: "/daily-update-approvals" }]
      : []),

    { label: "Reports", path: "/reports" },
    { label: "Settings", path: "/settings" },
  ];

  return (
    <div className="app-layout">
      <Sidebar user={user} />

      <main className="main-content">
        <Topbar activePage={activePage} />

        <div className="mobile-page-nav">
          {mobileLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                isActive ? "mobile-page-active" : ""
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}

export default AppLayout;