/** Route guard for feature-gated pages. Mirrors the existing RequireRole
 *  pattern. Admin bypasses (admin has every feature implicitly). Non-admin
 *  users whose `me.permissions` (the 3-layer effective set) doesn't include
 *  the required feature see the 404 view INSIDE AppLayout (sidebar + header
 *  kept, so they can still log out).
 *
 *  Usage in App.tsx:
 *    <Route element={<RequireFeature feature="achats" />}>
 *      <Route path={ROUTES.ACHATS} element={<AchatsPage />} />
 *    </Route>
 */
import { Navigate, Outlet } from "react-router-dom";

import { useMe } from "@/hooks/useMe";
import NotFoundPage from "@/pages/auth/not-found";
import { ROLES, ROUTES } from "@/types";
import type { Feature } from "@/types";


export function RequireFeature({ feature }: { feature: Feature }) {
  const { me, isLoading } = useMe();
  if (isLoading) return null;
  if (!me) return <Navigate to={ROUTES.LOGIN} replace />;
  if (me.role === ROLES.ADMIN) return <Outlet />;
  if (!me.permissions.includes(feature)) return <NotFoundPage embedded />;
  return <Outlet />;
}
