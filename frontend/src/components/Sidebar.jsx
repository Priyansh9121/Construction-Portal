import { NavLink } from "react-router-dom";

function Sidebar({ user }) {
  const links = [
    { label: "Dashboard", path: "/dashboard" },

    { label: "Finance", path: "/payments" },
    { label: "Invoices", path: "/invoices" },

    { label: "Workforce", path: "/workers" },
    { label: "Subcontractors", path: "/subcontractors" },

    ...(user?.role === "admin"
      ? [{ label: "User Management", path: "/users" }]
      : []),

    { label: "Sites / Projects", path: "/sites" },

    { label: "Site Updates", path: "/daily-site-updates" },

    ...(user?.role === "admin"
      ? [{ label: "Update Approvals", path: "/daily-update-approvals" }]
      : []),

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