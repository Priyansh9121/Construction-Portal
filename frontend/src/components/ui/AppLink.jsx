/**
 * File purpose:
 * The navigation primitives for UI v2 — `AppLink`, `AppNavLink` and
 * `useAppNavigate`. Together they own which navigations animate.
 *
 * Why this exists (V2-I024):
 * Route transitions were opted in on the sidebar's `NavLink` only, so whether
 * the page cross-faded depended on how the user happened to move: the sidebar
 * animated, a dashboard card or a table link did not. Sprinkling
 * `viewTransition` across 21 call sites would have made that consistent and
 * left the policy scattered across 21 files, where the next link added would
 * silently opt out again.
 *
 * The ownership model
 * -------------------
 * ANIMATED — user-initiated navigation between content routes:
 *   sidebar navigation, dashboard cards and quick actions, table and detail
 *   links, breadcrumbs, notification links, command-palette navigation, and
 *   programmatic navigation that a user action caused (e.g. "back to tenders"
 *   after deleting one).
 *
 * NOT ANIMATED — and these must stay that way:
 *   - Auth redirects (`/login` after register, reset, or sign-out). Motion
 *     there delays the completion of authentication for no benefit.
 *   - Permission and role redirects (`RoleRoute`, `<Navigate>` in AppRoutes).
 *     A user being sent somewhere they did not ask to go should not have it
 *     dressed up as a transition.
 *   - The 401 handler in axiosClient. That is a security response and a full
 *     document load, not an SPA navigation.
 *   - Same-route state changes, anchors, downloads, exports, external links.
 *
 * Those exclusions are achieved by NOT using these components there — plain
 * `Link`, `<Navigate>` and `window.location` continue to be correct in those
 * places. The distinction is deliberate, not an oversight.
 *
 * Progressive enhancement:
 * React Router applies `document.startViewTransition` only where the browser
 * supports it, and navigation is never awaited on the animation. Under
 * `prefers-reduced-motion` the flag is dropped entirely, so the API is not
 * called at all — belt and braces with `view-transition-name: none`, which
 * the stylesheet already sets in that mode.
 *
 * Only `.page-content` carries a transition name, so the shell stays visually
 * static while the content region cross-fades.
 *
 * Programmatic navigation lives in hooks/useAppNavigate.js — a module cannot
 * export both components and a hook without breaking Fast Refresh.
 */

import { forwardRef } from "react";
import { Link, NavLink } from "react-router-dom";

import { prefersReducedMotion } from "../../hooks/prefersReducedMotion";

/**
 * A `Link` that cross-fades the content region.
 *
 * Pass `viewTransition={false}` for a link that must not animate — an export,
 * a download trigger, or navigation away from an auth flow.
 */
const AppLink = forwardRef(function AppLink(
  { viewTransition = true, ...props },
  ref
) {
  return (
    <Link
      ref={ref}
      viewTransition={viewTransition && !prefersReducedMotion()}
      {...props}
    />
  );
});

/** A `NavLink` with the same policy, for navigation that reports its own active state. */
export const AppNavLink = forwardRef(function AppNavLink(
  { viewTransition = true, ...props },
  ref
) {
  return (
    <NavLink
      ref={ref}
      viewTransition={viewTransition && !prefersReducedMotion()}
      {...props}
    />
  );
});

export default AppLink;
