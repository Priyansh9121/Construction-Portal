import axios from "axios";

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

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

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

    return Promise.reject(error);
  }
);

export default axiosClient;
