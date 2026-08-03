/**
 * File purpose:
 * The auth context object and its useAuth hook, kept separate from the
 * provider component.
 *
 * Responsibilities:
 * - Create the React context
 * - Expose useAuth(), which throws if used outside the provider
 *
 * Connected to:
 * - AuthProvider.jsx supplies the value
 * - Consumed by RoleRoute, AppLayout, Sidebar, Topbar, LoginPage,
 *   RegisterPage, SettingsPage and every page needing the current user
 *
 * Important notes:
 * - The split from AuthProvider.jsx is not stylistic — see the banner
 *   below. A module exporting both a component and other values cannot be
 *   hot-reloaded on its own, so keeping the provider component alone in
 *   its file is what preserves fast refresh.
 * - useAuth throws rather than returning null for a missing provider. A
 *   clear error at the point of misuse beats a null-reference crash three
 *   components deeper.
 */

import {
  createContext,
  useContext,
} from "react";

/*
|--------------------------------------------------------------------------
| Auth context
|--------------------------------------------------------------------------
|
| The context object and its hook live apart from the provider component so
| that AuthProvider.jsx exports nothing but a component. A module that
| mixes components with other exports cannot be hot-reloaded on its own, so
| every edit to the provider forced a full page reload — and with it a lost
| form, a lost scroll position, and a re-fetch of everything on screen.
|
*/

export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }

  return context;
}
