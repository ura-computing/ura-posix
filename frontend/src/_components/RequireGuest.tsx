import { Navigate, Outlet } from "react-router-dom";

import { PharmagestIcon } from "./PharmagestIcon";
import { useMe } from "@/hooks/useMe";
import { ROUTES } from "@/types";

/**
 * Inverse of AppLayout's auth guard. Wraps routes that should only be visible
 * to UNauthenticated visitors (/login, /auth/forgot-password, /auth/set-password).
 * Logged-in users are bounced to /home so they don't see the login form again.
 */
export function RequireGuest() {
  const { me, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <PharmagestIcon className="size-12 animate-pulse text-primary" />
      </div>
    );
  }
  if (me) return <Navigate to={ROUTES.HOME} replace />;

  return <Outlet />;
}