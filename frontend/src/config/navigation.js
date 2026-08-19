/**
 * File purpose:
 * The single definition of which destinations a role may navigate to, and how
 * they are grouped. Consumed by the sidebar and the command palette so the two
 * cannot disagree about where a user can go.
 *
 * THIS IS NAVIGATION VISIBILITY, NOT AUTHORISATION.
 * Hiding a destination does not protect it. `RoleRoute` decides which screen
 * renders and `roleMiddleware` on the backend decides what data comes back;
 * both remain authoritative and neither consults this file. What this controls
 * is whether the shell OFFERS a destination, which is a wayfinding question:
 * a shell that lists somewhere the user cannot reach is lying to them.
 *
 * WHY IT EXISTS (SHELL-018)
 * The sidebar had role-aware grouping while the command palette carried a
 * separate hard-coded array, and the two had drifted in both directions:
 *
 *   - the palette offered `/daily-update-approvals`, which AppRoutes restricts
 *     to admin through AdminLayout, so a MANAGER could select it and be
 *     bounced;
 *   - the palette offered `/sites`, which is a redirect to `/tenders`. The
 *     sidebar deliberately omits it, because a second entry pointing at one
 *     destination is noise;
 *   - the palette was MISSING Site Operations, Master Data and Activity Log,
 *     all of which the sidebar offers.
 *
 * Note on scope: portal roles are not affected. `/worker-portal` and
 * `/subcontractor-portal` render outside `AppLayout`, so a worker or
 * subcontractor never sees the shell, the sidebar or the palette at all. The
 * role that was actually being misled is `manager`.
 *
 * The admin-only entries below mirror `AdminLayout` in AppRoutes.jsx exactly.
 * Changing one without the other produces a link that leads to a redirect,
 * which is the defect this file exists to prevent.
 */

/**
 * Every destination the authenticated shell can offer, in the order the
 * sidebar presents them.
 *
 * `roles` mirrors the route wrapper in AppRoutes.jsx exactly, and is the
 * whole point of this file: an item offered to a role the router bounces
 * is a link that leads to a redirect.
 *
 *   OFFICE     -> AdminManagerLayout
 *   ADMIN_ONLY -> AdminLayout
 *   SITE_WORK  -> SiteWorkLayout, which admits supervisors
 *
 * Supervisors reach the shell as of 2026-08-19 and see exactly two
 * entries. Every other destination here would bounce them, so none of them
 * is offered.
 */
const OFFICE = ["admin", "manager"];
const ADMIN_ONLY = ["admin"];
const SITE_WORK = ["admin", "manager", "worker"];

const NAVIGATION_GROUPS = [
  {
    heading: "Overview",
    items: [{ label: "Dashboard", path: "/dashboard", icon: "dashboard" }],
  },
  {
    heading: "Projects",
    items: [
      { label: "Tenders", path: "/tenders", icon: "tenders" },
      {
        label: "Site Operations",
        path: "/site-operations",
        icon: "operations",
        roles: SITE_WORK,
      },
      {
        label: "Site Updates",
        path: "/daily-site-updates",
        icon: "updates",
        roles: SITE_WORK,
      },
      {
        label: "Update Approvals",
        path: "/daily-update-approvals",
        icon: "approvals",
        roles: ADMIN_ONLY,
      },
    ],
  },
  {
    heading: "People",
    items: [
      { label: "Workforce", path: "/workers", icon: "workers" },
      { label: "Subcontractors", path: "/subcontractors", icon: "subcontractors" },
      {
        label: "User Management",
        path: "/users",
        icon: "users",
        roles: ADMIN_ONLY,
      },
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

function normaliseRole(user) {
  return String(user?.role || "")
    .trim()
    .toLowerCase();
}

/**
 * The grouped navigation for a role.
 *
 * Groups that end up empty are dropped, so a role never sees a heading with
 * nothing under it.
 *
 * @param {object} user the signed-in user
 * @returns {Array<{heading: string, items: Array}>}
 */
export function buildNavigationGroups(user) {
  const role = normaliseRole(user);

  return NAVIGATION_GROUPS.map((group) => ({
    heading: group.heading,
    items: group.items.filter((item) =>
      (item.roles || OFFICE).includes(role)
    ),
  })).filter((group) => group.items.length > 0);
}

/**
 * The same destinations as one flat list, for the command palette.
 *
 * Derived from `buildNavigationGroups` rather than from a parallel array, so
 * the palette cannot offer something the sidebar says is unreachable. The
 * group heading rides along as `group`, which gives the palette the option of
 * showing where a destination lives without needing a second source.
 *
 * @param {object} user the signed-in user
 * @returns {Array<{label: string, path: string, icon: string, group: string}>}
 */
export function buildNavigationDestinations(user) {
  return buildNavigationGroups(user).flatMap((group) =>
    group.items.map((item) => ({ ...item, group: group.heading }))
  );
}

export default buildNavigationGroups;
