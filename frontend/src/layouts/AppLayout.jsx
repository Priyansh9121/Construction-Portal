import { NavLink } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import PageTransition from "../components/PageTransition";
import AppBackground from "../components/AppBackground";
import FloatingActionButton from "../components/FloatingActionButton";
import CommandPalette from "../components/CommandPalette";

function AppLayout({
  children,
  activePage,
  user,
  tenders = [],
  invoices = [],
  payments = [],
}) {
  const mobileLinks = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Finance", path: "/payments" },
    { label: "Invoices", path: "/invoices" },
    { label: "Workforce", path: "/workers" },
    { label: "Money", path: "/worker-money" },
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
      <AppBackground />

      <Sidebar user={user} />

      <main className="main-content">
        <Topbar
          activePage={activePage}
          tenders={tenders}
          invoices={invoices}
          payments={payments}
        />

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

        <div className="page-content">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

      <FloatingActionButton />

      <CommandPalette />
    </div>
  );
}

export default AppLayout;