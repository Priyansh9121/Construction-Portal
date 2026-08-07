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
 * The destination list and its role visibility live in config/navigation.js,
 * shared with the command palette so the two cannot disagree about where a
 * user can go (SHELL-018). This file renders that model; it does not define
 * it.
 *
 * The destinations are grouped into five labelled sections rather
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

import { buildNavigationGroups } from "../config/navigation";

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
  const groups = buildNavigationGroups(user);

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
