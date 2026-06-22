/** Route guard for role-gated pages. Renders nothing while `useMe` is loading,
 *  redirects to ROUTES.HOME if the resolved role doesn't match.
 *
 *  Usage in App.tsx:
 *    <Route element={<RequireRole role={ROLES.ADMIN} />}>
 *      <Route path={ROUTES.ADMIN_CATALOGUE} element={<CataloguePage />} />
 *    </Route>
 */
import { Navigate, Outlet } from "react-router-dom";

import { useMe } from "@/hooks/useMe";
import { ROUTES } from "@/types";
import type { Role } from "@/types";


export function RequireRole({ role }: { role: Role }) {
  const { me, isLoading } = useMe();
  if (isLoading) return null;       // AppLayout already renders the shell; brief blank is fine
  if (!me || me.role !== role) return <Navigate to={ROUTES.HOME} replace />;
  return <Outlet />;
}
