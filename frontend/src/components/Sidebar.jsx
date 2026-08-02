import { NavLink } from "react-router-dom";

function Sidebar({ user }) {
  const links = [
    { label: "Dashboard", path: "/dashboard" },

    { label: "Finance", path: "/payments" },
    { label: "Invoices", path: "/invoices" },

    { label: "Workforce", path: "/workers" },
    { label: "Worker Money", path: "/worker-money" },
    { label: "Subcontractors", path: "/subcontractors" },

    ...(user?.role === "admin"
      ? [{ label: "User Management", path: "/users" }]
      : []),

    // Sites are managed inside the tender that owns them, so this points
    // at the project register rather than the removed standalone page.
    { label: "Projects", path: "/tenders" },

    { label: "Site Updates", path: "/daily-site-updates" },

    // Material received, labour ledger, supervisor banking, and the
    // backdated-entry access queue.
    { label: "Site Operations", path: "/site-operations" },

    ...(user?.role === "admin"
      ? [{ label: "Update Approvals", path: "/daily-update-approvals" }]
      : []),

    // Investors, suppliers and clients.
    { label: "Master Data", path: "/masters" },

    // Who changed what.
    { label: "Activity Log", path: "/activity" },

    { label: "Analytics & Reports", path: "/reports" },
    { label: "Settings", path: "/settings" },
  ];

  return (
    <aside className="sidebar">
      <h2>Construction Portal</h2>

      <nav>
        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;