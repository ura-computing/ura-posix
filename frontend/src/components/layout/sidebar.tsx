"use client";

import { Button } from "@/components/ui/button";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent as ShadcnSidebarContent,
  SidebarHeader as ShadcnSidebarHeader,
  SidebarRail as ShadcnSidebarRail,
  SidebarTrigger as ShadcnSidebarTrigger,
  useSidebar as useShadcnSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/utils/cn";
import { ListIcon } from "lucide-react";
import { SidebarFooter as ShadcnSidebarFooter } from "@/components/ui/sidebar";
import React from "react";
import { Link, useLocation } from "react-router";
import { useMe } from "@/hooks/useMe";
import { eUserStatus } from "@/types";
import { resources, type ResourceConfig } from "@/routes";

export function Sidebar() {
  const { open } = useShadcnSidebar();
  const { me: identity } = useMe();
  const { pathname } = useLocation();
  const isPending = identity?.status !== eUserStatus.ACTIVE;

  const visibleItems = resources.filter((item: ResourceConfig) => {
    if (isPending) return false;
    if (!item.meta.allowed.includes(identity?.role as never)) return false;
    const permKey = item.meta.permission;
    if (permKey && identity?.permissions?.[permKey] === false) return false;
    return true;
  });

  return (
    <ShadcnSidebar
      collapsible="icon"
      className={cn("border-none")}
      style={
        {
          "--sidebar": "#071b2b",
          "--sidebar-foreground": "#e5e7eb",
          "--sidebar-border": "rgba(255,255,255,0.08)",
          "--sidebar-accent": "rgba(255,255,255,0.06)",
          "--sidebar-accent-foreground": "#ffffff",
          "--sidebar-primary": "#14b8a6",
          "--sidebar-primary-foreground": "#05201d",
        } as React.CSSProperties
      }
    >
      <ShadcnSidebarRail />
      <SidebarHeader />
      <ShadcnSidebarContent
        className={cn(
          "transition-discrete",
          "duration-200",
          "flex",
          "flex-col",
          "gap-2",
          "pt-2",
          "pb-2",
          {
            "px-3": open,
            "px-1": !open,
          }
        )}
      >
        {visibleItems.map((item: ResourceConfig) => (
          <SidebarItemLink
            key={item.name}
            item={item}
            isSelected={pathname === item.list || pathname.startsWith(item.list + "/")}
          />
        ))}
      </ShadcnSidebarContent>
      <ShadcnSidebarFooter className={cn(
        "mt-auto border-t border-sidebar-border py-4 transition-opacity duration-200",
        {
          "opacity-0": !open,
          "opacity-100": open,
        }
      )}>
        <p className="text-xs text-sidebar-foreground/70 px-3">© 2026 PharmaGest</p>
      </ShadcnSidebarFooter>
    </ShadcnSidebar>
  );
}

type SidebarItemLinkProps = {
  item: ResourceConfig;
  isSelected: boolean;
};

function SidebarItemLink({ item, isSelected }: SidebarItemLinkProps) {
  const { open } = useShadcnSidebar();
  const icon = item.meta.icon;

  return (
    <Button
      asChild
      variant="ghost"
      size="lg"
      className={cn(
        "flex w-full items-center justify-start gap-2 py-2 !px-3 text-sm rounded-xl",
        {
          "bg-sidebar-primary": isSelected,
          "hover:!bg-sidebar-primary/90": isSelected,
          "text-sidebar-primary-foreground": isSelected,
          "hover:text-sidebar-primary-foreground": isSelected,
          "hover:!bg-sidebar-accent": !isSelected,
        }
      )}
    >
      <Link to={item.list} className="flex w-full items-center gap-2">
        <div className={cn("w-4", {
          "text-sidebar-foreground/70": !isSelected,
          "text-sidebar-primary-foreground": isSelected,
        })}>
          {icon ?? <ListIcon />}
        </div>
        <span
          className={cn("tracking-[-0.00875rem] line-clamp-1 truncate", {
            "font-normal": !isSelected,
            "font-semibold": isSelected,
            "text-sidebar-primary-foreground": isSelected,
            "text-sidebar-foreground": !isSelected,
          })}
        >
          {item.meta.label}
        </span>
      </Link>
    </Button>
  );
}

function SidebarHeader() {
  const { open, isMobile, toggleSidebar } = useShadcnSidebar();

  return (
    <ShadcnSidebarHeader
      className={cn(
        "p-0",
        "h-16",
        "border-b",
        "border-sidebar-border",
        "flex-row",
        "items-center",
        "justify-between",
        "overflow-hidden"
      )}
    >
      <div
        className={cn(
          "whitespace-nowrap",
          "flex",
          "flex-row",
          "h-full",
          "items-center",
          "justify-start",
          "gap-2",
          "transition-discrete",
          "duration-200",
          {
            "pl-3": !open,
            "pl-5": open,
          }
        )}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            "flex items-center justify-center rounded-lg transition-colors hover:bg-sidebar-accent cursor-pointer"
          )}
          aria-label="Toggle sidebar"
        >
          <img src="/logo.png" alt="PharmaGest" className="h-8 w-8 shrink-0 object-contain mix-blend-screen rounded" />
        </button>
        <div className={cn("flex flex-col min-w-0", { "opacity-0 w-0 overflow-hidden": !open })}>
          <h2 className="text-sm font-bold text-sidebar-foreground">PharmaGest</h2>
          <span className="text-xs text-sidebar-foreground/70">Gestion Pharmacie</span>
        </div>
      </div>

      <ShadcnSidebarTrigger
        className={cn("text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", "mr-1.5", {
          "opacity-0": !open,
          "opacity-100": open || isMobile,
          "pointer-events-auto": open || isMobile,
          "pointer-events-none": !open && !isMobile,
        })}
      />
    </ShadcnSidebarHeader>
  );
}

Sidebar.displayName = "Sidebar";
