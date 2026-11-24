import { ROUTES } from "@/routes";
import { Navigate, Outlet } from "react-router-dom";

import { PharmagestIcon } from "@/_components/atoms/PharmagestIcon";
import { useMe } from "@/hooks/useMe";

/**
 * Inverse of AppLayout's auth guard. Wraps routes that should only be visible
 * to UNauthenticated visitors (`GUEST_ROUTES`: /login, /signup, /forgot-password, /set-password).
 * Logged-in users are bounced to the home page so they don't see the login form again.
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
