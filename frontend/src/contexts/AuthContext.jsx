import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

import axiosClient from "../api/axiosClient";

const AuthContext = createContext();

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
    if (!token) return;

    let cancelled = false;

    (async () => {
      try {
        const { data } = await axiosClient.get("/auth/me");

        if (cancelled) return;

        const freshUser = data?.user ?? data;

        if (freshUser && typeof freshUser === "object") {
          setUser(freshUser);
        }
      } catch (error) {
        if (cancelled) return;

        // 401 is already handled by the axios interceptor, which clears
        // storage and redirects. Anything else (server down, network drop)
        // should not sign the user out — keep the cached copy and let the
        // individual screens surface their own errors.
        if (error?.response?.status === 401) {
          setUserState(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

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

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }

  return context;
}
