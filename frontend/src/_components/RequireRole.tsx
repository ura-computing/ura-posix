/** Route guard for role-gated pages. Renders nothing while `useMe` is loading;
 *  wrong role, or an account not accepted yet (`pending`) → the 404 page INSIDE the layout
 *  (sidebar stays, like RequireFeature).
 *
 *  Usage in App.tsx:
 *    <Route element={<RequireRole role={ROLES.ADMIN} />}>            // single
 *      <Route path={ROUTES.ADMIN_CATALOGUE} element={<CataloguePage />} />
 *    </Route>
 *    <Route element={<RequireRole role={[ROLES.DEVELOPER, ROLES.ADMIN]} />}>  // any-of
 *      <Route path="/dev" element={<DevDashboard />} />
 *    </Route>
 */
import { Navigate, Outlet } from "react-router-dom";

import { useMe } from "@/hooks/useMe";
import NotFoundPage from "@/pages/auth/not-found";
import { ROUTES, STATUSES } from "@/types";
import type { Role } from "@/types";

export function RequireRole({ role }: { role: Role | Role[] }) {
  const { me, isLoading } = useMe();
  if (isLoading) return null; // AppLayout already renders the shell; brief blank is fine
  const allowed = Array.isArray(role) ? role : [role];
  if (!me) return <Navigate to={ROUTES.LOGIN} replace />;
  const pending = me.status === STATUSES.PENDING;
  if (!allowed.includes(me.role as Role) || pending) return <NotFoundPage embedded pending={pending} />;
  return <Outlet />;
}
