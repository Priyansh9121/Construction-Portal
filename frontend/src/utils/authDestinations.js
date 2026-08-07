/**
 * File purpose:
 * Turns the `?next=` parameter on the login screen into a human-readable
 * destination name, so a user whose session expired mid-task can see that
 * their place was kept.
 *
 * Why this is presentation only:
 * `axiosClient` already writes `/login?next=<path>` when a 401 arrives, and
 * `App.jsx` already decides where to send the user after a successful sign-in.
 * This file reads that parameter and returns a LABEL. It performs no
 * navigation, changes no redirect, and is never consulted by any routing
 * decision. Deleting it would change what Login says and nothing about where
 * anyone goes.
 *
 * Security rules this enforces, deliberately:
 *
 * - ALLOW-LIST ONLY. A path is recognised only by exact match against the
 *   table below. Anything else returns null and Login shows its normal copy.
 *   There is no pattern matching and no fallback that echoes user input.
 *
 * - THE RAW VALUE IS NEVER RENDERED. The caller receives a fixed string from
 *   this file, never the parameter. A crafted `?next=` cannot put attacker
 *   text on the sign-in screen, which is the injection this shape of feature
 *   usually ships with.
 *
 * - NO IDs, NO PARAMETERS, NO QUERY STRINGS. `/tenders/482` does not match
 *   `/tenders`, so it returns null rather than leaking that tender 482 exists.
 *   Any path carrying extra segments is refused for the same reason.
 *
 * - NOTHING PRIVILEGED IS REVEALED. Every label names a screen that appears in
 *   the product's own navigation. Knowing the product has a Payments screen
 *   tells an unauthenticated visitor nothing they could not learn from the
 *   marketing of any construction tool, and the API refuses them regardless.
 *
 * Connected to:
 * - pages/LoginPage.jsx, the only consumer
 * - Route paths mirror routes/AppRoutes.jsx. If a route is renamed there and
 *   not here, the cue quietly stops appearing for it, which is the safe
 *   direction of failure.
 */

/**
 * Exact path to display name. Only these are ever recognised.
 */
const DESTINATIONS = {
  "/dashboard": "Dashboard",
  "/payments": "Payments",
  "/tenders": "Tenders",
  "/invoices": "Invoices",
  "/workers": "Workers",
  "/worker-money": "Worker Money",
  "/subcontractors": "Subcontractors",
  "/daily-site-updates": "Daily Site Updates",
  "/daily-update-approvals": "Daily Update Approvals",
  "/site-operations": "Site Operations",
  "/masters": "Master Data",
  "/users": "User Management",
  "/activity": "Activity Log",
  "/reports": "Reports",
  "/settings": "Settings",
  "/worker-portal": "the Worker Portal",
  "/subcontractor-portal": "the Subcontractor Portal",
};

/**
 * Resolve a `?next=` value to a display name, or null.
 *
 * Returns null for anything not on the allow-list, including absolute URLs,
 * protocol-relative URLs, paths with extra segments, and empty values. The
 * caller renders nothing in that case.
 *
 * @param {string | null | undefined} next raw parameter value
 * @returns {string | null} a fixed label from this file, never caller input
 */
export function describeDestination(next) {
  if (typeof next !== "string" || next === "") {
    return null;
  }

  /*
   * Refuse anything that is not a plain same-origin path before it reaches
   * the table. "//evil.example" and "https://evil.example" are both rejected
   * here rather than relying on them simply missing the allow-list.
   */
  if (!next.startsWith("/") || next.startsWith("//")) {
    return null;
  }

  // Drop any query string or fragment; only the path may be matched.
  const path = next.split(/[?#]/)[0].replace(/\/+$/, "") || "/";

  return Object.prototype.hasOwnProperty.call(DESTINATIONS, path)
    ? DESTINATIONS[path]
    : null;
}

export default describeDestination;
