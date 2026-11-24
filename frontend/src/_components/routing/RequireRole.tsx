/** Route guard for role-gated pages. Renders nothing while `useMe` is loading;
 *  wrong role, or an account not accepted yet (`pending`) → the 404 page INSIDE the layout
 *  (sidebar stays, like RequireFeature).
 *
 *  App.tsx puts each role's pages (`ROLE_ROUTES`) inside `<RequireRole role={role} />`. */
import { ROUTES } from "@/routes";
import { Navigate, Outlet } from "react-router-dom";

import { useMe } from "@/hooks/useMe";
import NotFoundPage from "@/pages/common/not-found";
import { STATUSES } from "@/types";
import type { Role } from "@/types";
import { PageSkeleton } from "@/_components/molecules/Skeletons";

export function RequireRole({ role }: { role: Role | Role[] }) {
  const { me, isLoading } = useMe();
  if (isLoading) return <PageSkeleton />;
  const allowed = Array.isArray(role) ? role : [role];
  if (!me) return <Navigate to={ROUTES.LOGIN} replace />;
  const pending = me.status === STATUSES.PENDING;
  if (!allowed.includes(me.role as Role) || pending) return <NotFoundPage embedded pending={pending} />;
  return <Outlet />;
}
