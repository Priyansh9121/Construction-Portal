import { NavLink } from "react-router-dom";

function Sidebar() {
  const links = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Payments", path: "/payments" },
    { label: "Workers", path: "/workers" },
    { label: "Subcontractors", path: "/subcontractors" },
    { label: "Users", path: "/users" },
    { label: "Sites", path: "/sites" },
    { label: "Tenders", path: "/tenders" },
    { label: "Invoices", path: "/invoices" },
    { label: "Daily Updates", path: "/daily-site-updates" },
    { label: "Reports", path: "/reports" },
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
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;