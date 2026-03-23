import React, { useContext } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { UserContext } from "../usercontext/UserContext";

/**
 * Renders nested routes only when a session token exists.
 * Redirects to /login with return location for post-login navigation.
 */
export default function RequireAuth() {
  const { token } = useContext(UserContext);
  const location = useLocation();

  if (!token) {
    return (
      <Navigate to="/login" replace state={{ from: location }} />
    );
  }

  return <Outlet />;
}
