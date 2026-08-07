/**
 * File purpose:
 * The main navigation, filtered by role. Renders as a permanent sidebar on
 * laptops and above, and as an off-canvas drawer below 1024px.
 *
 * Props:
 * - user   the signed-in user; decides which sections appear
 * - open   whether the drawer is showing (ignored at >= 1024px, where CSS
 *          pins the sidebar open regardless)
 * - onClose  called when the user dismisses the drawer
 *
 * State and hooks:
 * - No local state. Open/closed is owned by AppLayout so the topbar button
 *   and the scrim can both drive it.
 *
 * Rendered by:
 * - AppLayout.jsx
 *
 * Navigation model:
 * The fifteen destinations are grouped into five labelled sections rather
 * than presented as one flat list. A flat list of fifteen forces the user to
 * read every label to find one; grouping lets them jump to the right
 * neighbourhood first. The groups mirror how the business is organised —
 * Overview, Projects, People, Finance, Administration — not how the code is.
 *
 * There is deliberately no separate "Sites" entry: `/sites` is a redirect to
 * `/tenders` (see AppRoutes.jsx), because sites are managed inside the tender
 * that owns them. A second link to the same destination would be noise.
 *
 * Accessibility:
 * - The drawer is a <nav> labelled "Main navigation".
 * - Each group is its own <nav> with an accessible name taken from its
 *   heading, so a screen reader can skip a whole section.
 * - The current route carries aria-current="page" (NavLink's default), plus a
 *   colour change AND a left bar — so it is never signalled by colour alone.
 * - While the drawer is closed below 1024px it is `inert`, which removes its
 *   links from the tab order entirely. Without it Tab walks into an
 *   off-canvas panel the user cannot see. At >= 1024px it is never inert,
 *   because the sidebar is permanently visible there.
 *
 * Important notes:
 * - Role filtering here is PRESENTATION only. Hiding a link does not protect
 *   the endpoint behind it — RoleRoute decides which screen renders, and
 *   roleMiddleware on the backend decides what data comes back.
 * - The admin-only entries (User Management, Update Approvals) match the
 *   AdminLayout guard in AppRoutes.jsx exactly. Changing one without the
 *   other produces a link that leads to a redirect.
 */

import { AppNavLink } from "./ui/AppLink";

import Icon from "./ui/Icon";

/**
 * Builds the grouped navigation for a role.
 *
 * Returns an array of { heading, items } where items is
 * { label, path, icon }. Groups that end up empty are dropped, so a role
 * never sees a heading with nothing under it.
 */
function buildGroups(user) {
  const isAdmin = user?.role === "admin";

  const groups = [
    {
      heading: "Overview",
      items: [
        { label: "Dashboard", path: "/dashboard", icon: "dashboard" },
      ],
    },
    {
      heading: "Projects",
      items: [
        { label: "Tenders", path: "/tenders", icon: "tenders" },
        { label: "Site Operations", path: "/site-operations", icon: "operations" },
        { label: "Site Updates", path: "/daily-site-updates", icon: "updates" },

        // Admin-only, matching AdminLayout in AppRoutes.jsx.
        ...(isAdmin
          ? [{ label: "Update Approvals", path: "/daily-update-approvals", icon: "approvals" }]
          : []),
      ],
    },
    {
      heading: "People",
      items: [
        { label: "Workforce", path: "/workers", icon: "workers" },
        { label: "Subcontractors", path: "/subcontractors", icon: "subcontractors" },

        // Admin-only, matching AdminLayout in AppRoutes.jsx.
        ...(isAdmin
          ? [{ label: "User Management", path: "/users", icon: "users" }]
          : []),
      ],
    },
    {
      heading: "Finance",
      items: [
        { label: "Finance", path: "/payments", icon: "finance" },
        { label: "Invoices", path: "/invoices", icon: "invoices" },
        { label: "Worker Money", path: "/worker-money", icon: "money" },
      ],
    },
    {
      heading: "Administration",
      items: [
        { label: "Master Data", path: "/masters", icon: "masters" },
        { label: "Analytics & Reports", path: "/reports", icon: "reports" },
        { label: "Activity Log", path: "/activity", icon: "activity" },
        { label: "Settings", path: "/settings", icon: "settings" },
      ],
    },
  ];

  return groups.filter((group) => group.items.length > 0);
}

/** First letter of each of the first two words, for the avatar. */
function initialsOf(name) {
  return String(name || "User")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function Sidebar({
  user,
  open = false,
  onClose,
}) {
  const groups = buildGroups(user);

  return (
    <>
      {/*
        Scrim. A real <button> rather than a div so it is keyboard
        operable and announced, and so dismissing the drawer does not
        depend on a pointer.
      */}
      <button
        type="button"
        className="sidebar-scrim"
        data-open={open ? "true" : "false"}
        aria-label="Close navigation menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />

      <aside
        id="app-sidebar"
        className="sidebar"
        data-open={open ? "true" : "false"}
      >
        <div className="sidebar-head">
          <span className="sidebar-brand">
            <span className="sidebar-brand-mark" aria-hidden="true" />
            Construction Portal
          </span>

          <button
            type="button"
            className="sidebar-close"
            aria-label="Close navigation menu"
            onClick={onClose}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="sidebar-scroll">
          {groups.map((group) => (
            <nav
              key={group.heading}
              className="sidebar-group"
              aria-label={group.heading}
            >
              <h2 className="sidebar-group-heading">
                {group.heading}
              </h2>

              {group.items.map((item) => (
                <AppNavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    isActive ? "sidebar-link active-link" : "sidebar-link"
                  }
                  onClick={onClose}
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </AppNavLink>
              ))}
            </nav>
          ))}
        </div>

        {/*
          Identity footer. Pinned below the scrolling nav so it stays
          reachable on a phone without scrolling to the end of fifteen links.
        */}
        <div className="sidebar-user">
          <span className="sidebar-avatar" aria-hidden="true">
            {initialsOf(user?.full_name)}
          </span>

          <span className="sidebar-user-text">
            <strong>{user?.full_name || "User"}</strong>
            <small>{user?.role || "—"}</small>
          </span>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
