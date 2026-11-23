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
import { ROUTES, STATUSES, isStaff } from "@/types";
import type { Feature } from "@/types";
import { PageSkeleton } from "@/_components/molecules/Skeletons";

export function RequireFeature({ feature }: { feature: Feature }) {
  const { me, isLoading } = useMe();
  if (isLoading) return <PageSkeleton />;
  if (!me) return <Navigate to={ROUTES.LOGIN} replace />;
  if (isStaff(me.role)) return <Outlet />;
  if (!me.permissions.includes(feature)) {
    return <NotFoundPage embedded pending={me.status === STATUSES.PENDING} />;
  }
  return <Outlet />;
}
