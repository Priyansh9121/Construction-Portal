/**
 * File purpose:
 * `useAppNavigate` — programmatic navigation that cross-fades the content
 * region, for route changes the user asked for.
 *
 * Lives apart from AppLink.jsx because a module that exports both components
 * and non-components breaks React Fast Refresh, which the lint rule
 * `react-refresh/only-export-components` enforces.
 *
 * See components/ui/AppLink.jsx for the full ownership model — which
 * navigations animate and, more importantly, which must not.
 *
 * Use for: returning to a register after an action, command-palette jumps,
 * any navigation a user gesture caused.
 *
 * Do NOT use for: auth redirects (`/login` after register, reset or
 * sign-out), permission and role redirects, or the 401 handler. Import
 * `useNavigate` directly there, so the intent is visible at the call site.
 */

import { useNavigate } from "react-router-dom";

import { prefersReducedMotion } from "./prefersReducedMotion";

export default function useAppNavigate() {
  const navigate = useNavigate();

  return (to, options = {}) =>
    navigate(to, {
      ...options,
      viewTransition: options.viewTransition ?? !prefersReducedMotion(),
    });
}
