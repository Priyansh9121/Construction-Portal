import { Navigate } from "react-router-dom";

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

function RoleRoute({
  user,
  allowedRoles = [],
  children,
}) {
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