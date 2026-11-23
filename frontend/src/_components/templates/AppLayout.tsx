import { Suspense, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { useIdleLock } from "@/hooks/useLockScreen";
import { useMe } from "@/hooks/useMe";
import { ROLES, ROUTES, STATUSES, isStaff } from "@/types";
import { Skeleton } from "@/_components/atoms/Skeleton";
import { LockScreen } from "@/_components/organisms/LockScreen";
import { SobrusBanner } from "@/_components/organisms/SobrusBanner";
import { PageSkeleton } from "@/_components/molecules/Skeletons";
import { CornerStack } from "@/_components/templates/CornerStack";
import { Header } from "@/_components/templates/Header";
import { Sidebar } from "@/_components/templates/Sidebar";

const COLLAPSE_KEY = "pg-sidebar-collapsed";

export function AppLayout() {
  const { me, isLoading, isError } = useMe();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  // Lock screen: idle → this device locks; locked → the code over the page (the page stays mounted under it).
  useIdleLock(me?.lock);

  if (isLoading) return <AppShellSkeleton />;
  if (isError || !me) return <Navigate to={ROUTES.LOGIN} replace />;
  // « Connexion Sobrus » (an access the admin gives): owners with it see its problems (banner) and runs (corner card).
  const sobrusOwner = me.role === ROLES.OWNER && me.permissions.includes("sobrus");

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        role={me.role}
        permissions={me.permissions}
        pending={me.status === STATUSES.PENDING}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto p-7">
          {/* « Connexion Sobrus » stopped working: owners with that access see it on every page. */}
          {sobrusOwner && <SobrusBanner />}
          {/* Pages load on first visit (App.tsx lazy): sidebar + header stay meanwhile. */}
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <CornerStack sobrusOwner={sobrusOwner} admin={isStaff(me.role)} />
      {me.lock.locked && <LockScreen name={me.name} />}
    </div>
  );
}

/** While the account loads (first visit, slow connection): the shell's shape, never a blank screen. */
function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen bg-background" aria-busy>
      <div className="hidden w-60 shrink-0 flex-col gap-3 border-r border-border bg-card p-4 md:flex">
        <Skeleton className="h-9 w-36" />
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-16 border-b border-border bg-card" />
        <div className="flex-1 p-7">
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}
