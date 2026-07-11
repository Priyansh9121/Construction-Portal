import {
  useMemo,
} from "react";

import {
  NavLink,
} from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import PageTransition from "../components/PageTransition";
import AppBackground from "../components/AppBackground";
import FloatingActionButton from "../components/FloatingActionButton";
import CommandPalette from "../components/CommandPalette";

function getRole(user) {
  return String(user?.role || "")
    .trim()
    .toLowerCase();
}

function AppLayout({
  children,
  activePage,
  user,
  tenders = [],
  invoices = [],
  payments = [],
}) {
  const role = getRole(user);

  const mobileLinks = useMemo(() => {
    const commonLinks = [
      {
        label: "Dashboard",
        path: "/dashboard",
      },
      {
        label: "Finance",
        path: "/payments",
      },
      {
        label: "Invoices",
        path: "/invoices",
      },
      {
        label: "Workers",
        path: "/workers",
      },
      {
        label: "Worker Money",
        shortLabel: "Money",
        path: "/worker-money",
      },
      {
        label: "Subcontractors",
        shortLabel: "Subs",
        path: "/subcontractors",
      },
      {
        label: "Sites",
        path: "/sites",
      },
      {
        label: "Tenders",
        path: "/tenders",
      },
      {
        label: "Daily Updates",
        shortLabel: "Updates",
        path: "/daily-site-updates",
      },
      {
        label: "Reports",
        path: "/reports",
      },
      {
        label: "Settings",
        path: "/settings",
      },
    ];

    if (role !== "admin") {
      return commonLinks;
    }

    const dailyUpdateIndex =
      commonLinks.findIndex(
        (link) =>
          link.path ===
          "/daily-site-updates"
      );

    const adminLinks = [
      ...commonLinks,
    ];

    /*
     * Insert approvals directly after Daily Updates.
     */
    adminLinks.splice(
      dailyUpdateIndex + 1,
      0,
      {
        label: "Update Approvals",
        shortLabel: "Approvals",
        path:
          "/daily-update-approvals",
      }
    );

    /*
     * User management remains available only to administrators.
     */
    adminLinks.splice(
      6,
      0,
      {
        label: "Users",
        path: "/users",
      }
    );

    return adminLinks;
  }, [role]);

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

        <nav
          className="mobile-page-nav"
          aria-label="Mobile page navigation"
        >
          {mobileLinks.map(
            (link) => (
              <NavLink
                key={link.path}
                to={link.path}
                end={
                  link.path ===
                  "/dashboard"
                }
                className={({
                  isActive,
                }) =>
                  isActive
                    ? "mobile-page-active"
                    : ""
                }
              >
                {link.shortLabel ||
                  link.label}
              </NavLink>
            )
          )}
        </nav>

        <div className="page-content">
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </main>

      <FloatingActionButton />

      <CommandPalette />
    </div>
  );
}

export default AppLayout;