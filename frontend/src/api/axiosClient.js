/**
 * File purpose:
 * The single HTTP client every frontend service uses. Attaches the bearer
 * token to outgoing requests and handles session expiry on the way back.
 *
 * Responsibilities:
 * - Configure the API base URL from the build environment
 * - Attach the stored JWT to every request
 * - Detect an expired session (401) and sign the user out
 * - Preserve the current location so the user returns after signing in
 *
 * Connected to:
 * - Imported by every file in src/services/. Nothing in the application
 *   should call axios or fetch directly — doing so bypasses both
 *   interceptors, so the request would go out unauthenticated and a 401
 *   would not sign the user out.
 * - Talks to the Express API in backend/server.js. The Authorization
 *   header set here is what backend/middleware/authMiddleware.js verifies.
 * - AuthProvider writes the "token" and "user" keys this file reads.
 *
 * Important notes:
 * - Auth is a bearer token in localStorage, not a cookie. The backend sets
 *   `credentials: false` in its CORS options accordingly, which is also
 *   why the API has no CSRF surface — nothing is sent automatically by the
 *   browser.
 * - localStorage is readable by any script on the origin, so an XSS bug
 *   would expose the token. That is the accepted trade-off of this design;
 *   the mitigation is that the token is short-lived and revocable through
 *   the `tv` claim (see createAccessToken in auth.service.js).
 * - VITE_ variables are compiled into the published bundle and are public.
 *   Only the API URL belongs here — never a secret.
 */

import axios from "axios";

/*
 * Where the API lives.
 *
 * Vite inlines import.meta.env at BUILD time, not run time, so this value
 * is baked into the bundle. Changing the API URL means a rebuild, not a
 * restart — which is why Vercel needs VITE_API_URL set before the build
 * rather than as a runtime variable.
 *
 * The localhost fallback keeps `npm run dev` working with no .env at all.
 * It includes the /api prefix, so service files write paths relative to
 * it: "/auth/login", not "/api/auth/login".
 */
const baseURL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:5051/api";

const axiosClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Paths where a 401 is an expected outcome rather than an expired session.
 *
 * Without this, a mistyped password on the login screen triggered the
 * session-expiry path below: storage was cleared and the page hard-reloaded,
 * so the user never saw the "invalid credentials" message.
 */
const AUTH_ENDPOINTS = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
];

const isAuthEndpoint = (url = "") =>
  AUTH_ENDPOINTS.some((path) => url.includes(path));

/*
 * Attach the token to every outgoing request.
 *
 * Read from localStorage per request rather than captured once, so a token
 * refreshed by a password change is picked up immediately without
 * recreating the client.
 */
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/*
 * Handle an expired or rejected session.
 *
 * A 401 from any endpoint EXCEPT the credential ones means the token is no
 * longer good — expired, or invalidated by a password change bumping
 * token_version. The only sensible response is to clear it and send the
 * user to sign in again.
 *
 * The exclusion is the important part. Without it, a mistyped password on
 * the login screen would trigger this path: storage cleared, page
 * hard-reloaded, and the user never sees "invalid credentials" because the
 * component that would render it is destroyed by the reload.
 */
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";

    if (status === 401 && !isAuthEndpoint(url)) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // Preserve where the user was so they can be returned there after
      // signing back in, and avoid redirect-looping on /login itself.
      if (!window.location.pathname.startsWith("/login")) {
        const next = encodeURIComponent(
          window.location.pathname + window.location.search
        );

        window.location.replace(`/login?next=${next}`);
      }
    }

    /*
     * Re-reject regardless. Handling the session-expiry side effect does
     * not mean the caller's promise should resolve — a service awaiting
     * this needs to know its request failed, and swallowing the error here
     * would make every failed call look successful and return undefined.
     */
    return Promise.reject(error);
  }
);

export default axiosClient;
