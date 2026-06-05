import { NavLink } from "react-router-dom";

function Sidebar() {
  const menuItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Payments", path: "/payments" },
    { label: "Workers", path: "/workers" },
    { label: "Worker Money", path: "/worker-money" },
    { label: "Sites", path: "/sites" },
    { label: "Daily Site Updates", path: "/daily-site-updates" },
    { label: "Tenders", path: "/tenders" },
    { label: "Invoices", path: "/invoices" },
    { label: "Reports", path: "/reports" },
    { label: "Settings", path: "/settings" },
  ];

  return (
    <aside className="sidebar">
      <h2>ConstructPro</h2>

      <nav>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;