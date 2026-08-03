/**
 * File purpose:
 * Holds the signed-in user for the whole application and keeps that copy
 * honest against the server.
 *
 * Responsibilities:
 * - Restore a cached session from localStorage on load
 * - Re-verify it against GET /auth/me and replace it with the server's copy
 * - Keep React state and localStorage in step
 * - Expose user, setUser, logout, isLoading and isAuthenticated
 *
 * Provides context to:
 * - RoleRoute, which decides which screens a role may see
 * - AppLayout, Sidebar and Topbar, for the user menu and navigation
 * - LoginPage and RegisterPage, which call setUser after authenticating
 * - SettingsPage, and any page that needs the current user or company
 *
 * Connected to:
 * - GET /api/auth/me — backend/modules/auth/auth.controller.js
 * - Writes the "token" and "user" keys that axiosClient reads and clears
 * - Mounted in main.jsx, above App
 *
 * Important notes:
 * - The cached user is a RENDERING convenience, never a source of truth.
 *   Anyone can edit localStorage and set their own role to admin. That
 *   changes what the UI draws and nothing else — the backend re-reads the
 *   role from the database on every request. See the note on the effect.
 * - isLoading exists so route guards do not redirect before the real role
 *   is known. Without it a legitimate admin would be bounced off an admin
 *   page for the moment between mount and the /auth/me response.
 */

import {
  useState,
  useEffect,
  useCallback,
} from "react";

import axiosClient from "../api/axiosClient";

import { AuthContext } from "./authContext";

/**
 * Reads the cached user from localStorage without ever throwing.
 *
 * The previous implementation called JSON.parse directly inside useState,
 * so a malformed value — or the literal string "undefined", which is what
 * JSON.stringify(undefined) leaves behind — threw before React mounted.
 * That produced a permanent white screen the user could not clear without
 * opening devtools.
 */
const readStoredUser = () => {
  try {
    const raw = localStorage.getItem("user");

    if (!raw || raw === "undefined" || raw === "null") {
      return null;
    }

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    // Corrupt value — drop it rather than crashing on every load.
    localStorage.removeItem("user");
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(readStoredUser);

  // True until the cached session has been checked against the server.
  const [isLoading, setIsLoading] = useState(
    Boolean(localStorage.getItem("token"))
  );

  /**
   * Keeps React state and localStorage in step.
   */
  const setUser = useCallback((nextUser) => {
    setUserState(nextUser);

    if (nextUser) {
      localStorage.setItem("user", JSON.stringify(nextUser));
    } else {
      localStorage.removeItem("user");
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUserState(null);
  }, []);

  /**
   * Re-reads the user from the server on mount.
   *
   * The cached copy in localStorage is a rendering convenience, not a source
   * of truth: anyone can edit it and set their own role. Routing decisions
   * should follow what the server says, so this replaces the cached value
   * with the authoritative one as soon as the app loads.
   *
   * The backend still enforces authorisation on every request, so this is
   * about the UI showing the right thing rather than about access control.
   */
  useEffect(() => {
    const token = localStorage.getItem("token");

    // isLoading is initialised from the presence of a token, so with no
    // token it is already false — setting it here would only trigger an
    // extra render.
    if (!token) return undefined;

    let cancelled = false;

    axiosClient
      .get("/auth/me")
      .then(
        ({ data }) => {
          if (cancelled) return;

          const freshUser = data?.user ?? data;

          if (freshUser && typeof freshUser === "object") {
            setUser(freshUser);
          }
        },
        (error) => {
          if (cancelled) return;

          // 401 is already handled by the axios interceptor, which clears
          // storage and redirects. Anything else (server down, network drop)
          // should not sign the user out — keep the cached copy and let the
          // individual screens surface their own errors.
          if (error?.response?.status === 401) {
            setUserState(null);
          }
        }
      )
      .then(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        logout,
        isLoading,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
