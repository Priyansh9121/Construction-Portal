/**
 * File purpose:
 * Route guard. Decides whether the signed-in user may see a given screen,
 * and where to send them if not.
 *
 * Props:
 * - user          optional; falls back to the auth context when omitted
 * - allowedRoles  array of role names permitted to render this route
 * - children      the screen to render when permitted
 *
 * Context used:
 * - useAuth() for the authoritative user and the isLoading flag
 *
 * Connected to:
 * - Wraps most routes in AppRoutes.jsx
 * - Reads the context provided by contexts/AuthProvider.jsx
 *
 * Navigation behaviour:
 * - No user            -> /login
 * - Wrong role         -> that role's home (getHomePath)
 * - Still verifying    -> a loading placeholder, NOT a redirect
 *
 * Important notes:
 * - This is a PRESENTATION guard only. It decides which screen to draw,
 *   not what data may be read. The backend enforces the real rule on every
 *   request through roleMiddleware, re-reading the role from the database.
 *   A user who edits localStorage can reach a screen they should not see;
 *   every API call that screen makes will still be refused.
 * - Holding the route while isLoading is what prevents a legitimate user
 *   being bounced away during the /auth/me round trip.
 */

import { Navigate } from "react-router-dom";

import { useAuth } from "../contexts/authContext";

function normaliseRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getHomePath(role) {
  if (role === "worker") {
    return "/worker-portal";
  }

  if (role === "subcontractor") {
    return "/subcontractor-portal";
  }

  return "/dashboard";
}

/**
 * Route guard.
 *
 * `user` may still be passed in by AppRoutes; when it is omitted the guard
 * falls back to the context, which is the authoritative copy refreshed from
 * GET /auth/me on mount.
 *
 * Note this is a presentation guard only. It decides which screen to render,
 * not what data the caller may read — the backend re-reads the user's role
 * from the database on every request and enforces it there.
 */
function RoleRoute({
  user: userProp,
  allowedRoles = [],
  children,
}) {
  const { user: contextUser, isLoading } = useAuth();

  const user = userProp ?? contextUser;

  // While the cached session is being verified against the server we do not
  // yet know the real role. Redirecting here would bounce a legitimate user
  // away from the page they asked for, so hold the route instead.
  if (isLoading) {
    return (
      <div
        className="route-guard-loading"
        role="status"
        aria-live="polite"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
        }}
      >
        <span>Loading…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const currentRole = normaliseRole(user.role);

  const permittedRoles = allowedRoles.map(normaliseRole);

  if (!permittedRoles.includes(currentRole)) {
    return (
      <Navigate
        to={getHomePath(currentRole)}
        replace
      />
    );
  }

  return children;
}

export default RoleRoute;
