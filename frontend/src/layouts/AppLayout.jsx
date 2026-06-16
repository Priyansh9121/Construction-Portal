import { NavLink } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

function AppLayout({ children, activePage, user }) {
  return (
    <div className="app-layout">
      <Sidebar user={user} />

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
            to="/subcontractors"
            className={({ isActive }) =>
              isActive ? "mobile-page-active" : ""
            }
          >
            Subs
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

          <NavLink
            to="/daily-site-updates"
            className={({ isActive }) =>
              isActive ? "mobile-page-active" : ""
            }
          >
            Daily Updates
          </NavLink>

          <NavLink
            to="/reports"
            className={({ isActive }) =>
              isActive ? "mobile-page-active" : ""
            }
          >
            Reports
          </NavLink>

          {user?.role === "admin" && (
            <NavLink
              to="/users"
              className={({ isActive }) =>
                isActive ? "mobile-page-active" : ""
              }
            >
              Users
            </NavLink>
          )}

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              isActive ? "mobile-page-active" : ""
            }
          >
            Settings
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