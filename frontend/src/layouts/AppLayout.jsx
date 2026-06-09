import { NavLink } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

function AppLayout({ children, activePage }) {
  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <Topbar activePage={activePage} />

        {/* MOBILE NAVIGATION */}
        <div className="mobile-page-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive ? "mobile-page-active" : ""
            }
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/payments"
            className={({ isActive }) =>
              isActive ? "mobile-page-active" : ""
            }
          >
            Payments
          </NavLink>

          <NavLink
            to="/workers"
            className={({ isActive }) =>
              isActive ? "mobile-page-active" : ""
            }
          >
            Workers
          </NavLink>

          <NavLink
            to="/sites"
            className={({ isActive }) =>
              isActive ? "mobile-page-active" : ""
            }
          >
            Sites
          </NavLink>

          <NavLink
            to="/tenders"
            className={({ isActive }) =>
              isActive ? "mobile-page-active" : ""
            }
          >
            Tenders
          </NavLink>

          <NavLink
            to="/invoices"
            className={({ isActive }) =>
              isActive ? "mobile-page-active" : ""
            }
          >
            Invoices
          </NavLink>
        </div>

        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}

export default AppLayout;