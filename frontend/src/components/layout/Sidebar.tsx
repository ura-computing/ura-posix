import { NavLink, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";

import { PharmagestIcon } from "@/components/shared/PharmagestIcon";
import { PharmagestWordmark } from "@/components/shared/PharmagestWordmark";
import { Tooltip } from "@/components/shared/Tooltip";
import { useLogout } from "@/hooks/useLogout";
import { ROUTES } from "@/types";
import type { Role } from "@/types";
import { cn } from "@/utils/cn";

import { visibleGroups, ACCOUNT_ITEM, SETTINGS_ITEM } from "./navConfig";
import type { NavItem } from "./navConfig";

interface SidebarProps {
  role:             Role;
  collapsed:        boolean;
  onToggleCollapse: () => void;
  mobileOpen:       boolean;
  onCloseMobile:    () => void;
}

function itemClasses(isActive: boolean, collapsed: boolean) {
  return cn(
    "flex items-center gap-[11px] rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors max-md:py-3 max-md:text-sm",
    collapsed && "md:justify-center md:px-0",
    isActive
      ? "bg-accent text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

function NavRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  // Tooltip only fires when collapsed — labels are visible inline when expanded.
  // Mobile keeps native title since hover doesn't apply there.
  const tooltipLabel = collapsed ? (item.ready === false ? `${item.label} · Bientôt disponible` : item.label) : "";

  const inner = item.ready === false ? (
    <div
      aria-disabled
      className={cn(itemClasses(false, collapsed), "cursor-not-allowed opacity-45")}
    >
      <item.icon className="size-[18px] shrink-0" aria-hidden />
      <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
    </div>
  ) : (
    <NavLink
      to={item.to}
      end={item.to === ROUTES.RAPPORT}
      className={({ isActive }) => itemClasses(isActive, collapsed)}
    >
      <item.icon className="size-[18px] shrink-0" aria-hidden />
      <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
    </NavLink>
  );

  return <Tooltip label={tooltipLabel} placement="right" className="relative block">{inner}</Tooltip>;
}

export function Sidebar({
  role, collapsed, onToggleCollapse, mobileOpen, onCloseMobile,
}: SidebarProps) {
  const { handleLogout } = useLogout();
  const groups = visibleGroups(role);

  return (
    <>
      {/* Backdrop: opacity transition (not display:none/block) so it fades in/out
          with the drawer. pointer-events disabled when closed so the page below
          stays clickable. */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 transition-opacity duration-300 ease-out md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
        aria-hidden
      />
      <aside
        style={{ willChange: "transform" }}
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-card",
          // Mobile: only transform animates (slide). Desktop: width animates on collapse.
          "transition-transform duration-300 ease-out md:transition-[width] md:duration-200",
          "w-[264px] md:static md:h-auto md:min-h-screen md:translate-x-0",
          collapsed ? "md:w-14" : "md:w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? "Étendre le menu" : "Réduire le menu"}
          aria-label={collapsed ? "Étendre le menu" : "Réduire le menu"}
          className="absolute -right-[13px] top-[50px] z-10 hidden size-[26px] cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground md:flex"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>

        <Link
          to={ROUTES.HOME}
          className="flex h-16 shrink-0 items-center gap-[11px] border-b border-border px-4"
        >
          {collapsed ? (
            <PharmagestIcon className="size-[26px] text-primary md:mx-auto" />
          ) : (
            <PharmagestWordmark iconSize={26} />
          )}
        </Link>

        <nav className="flex flex-1 flex-col gap-3.5 overflow-auto p-2.5">
          {groups.map((group, gi) => (
            <div key={group.title ?? gi} className="flex flex-col gap-0.5">
              {group.title && (
                <span className={`px-3 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground ${collapsed ? "md:hidden" : ""}`}>
                  {group.title}
                </span>
              )}
              {group.items.map((item) => (
                <NavRow key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          ))}
        </nav>

        <div className="flex shrink-0 flex-col gap-0.5 border-t border-border p-2.5">
          <NavRow item={SETTINGS_ITEM} collapsed={collapsed} />
          <NavRow item={ACCOUNT_ITEM} collapsed={collapsed} />
          <Tooltip label={collapsed ? "Déconnexion" : ""} placement="right" className="relative block">
            <button
              type="button"
              onClick={() => handleLogout()}
              className={cn(itemClasses(false, collapsed), "w-full cursor-pointer")}
            >
              <LogOut className="size-[18px] shrink-0" aria-hidden />
              <span className={collapsed ? "md:hidden" : ""}>Déconnexion</span>
            </button>
          </Tooltip>
        </div>
      </aside>
    </>
  );
}