import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { UploadProgressWidget } from "@/components/shared/UploadProgressWidget";
import { useMe } from "@/hooks/useMe";
import { ROUTES } from "@/types";

const COLLAPSE_KEY = "pg-sidebar-collapsed";

export function AppLayout() {
  const { me, isLoading, isError } = useMe();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1",
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading) return null;
  if (isError || !me) return <Navigate to={ROUTES.LOGIN} replace />;

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
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto p-7">
          <Outlet />
        </main>
      </div>
      <UploadProgressWidget />
    </div>
  );
}