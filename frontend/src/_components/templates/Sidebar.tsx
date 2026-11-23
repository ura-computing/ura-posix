/** The menu on the left: the links the account may open (role + features), collapsible, a drawer on phones. */
import type { ComponentType } from "react";
import { NavLink, Link } from "react-router-dom";

import { ROUTES, isStaff } from "@/types";
import { ChevronLeft, ChevronRight, Lock, LogOut } from "lucide-react";
import type { Role } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { PharmagestIcon } from "@/_components/atoms/PharmagestIcon";
import { Tooltip } from "@/_components/atoms/Tooltip";
import { useLockNow } from "@/hooks/useLockScreen";
import { useLogout } from "@/hooks/useLogout";
import { useMe } from "@/hooks/useMe";
import { PharmagestWordmark } from "@/_components/atoms/PharmagestWordmark";
import { ACCOUNT_ITEM, SETTINGS_ITEM, visibleGroups, type NavItem } from "@/_components/templates/nav";

export interface SidebarProps {
  role: Role;
  /** User's effective permissions (3-layer intersection from /me). Drives the
   *  feature-flag filter on nav items. Admin's bypass is handled inside
   *  visibleGroups; this prop is still required (pass [] for admin). */
  permissions: readonly string[];
  /** Signed up, not accepted yet: no menu entry (only « Mon compte » + « Déconnexion »). */
  pending: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function itemClasses(isActive: boolean, collapsed: boolean) {
  return cn(
    "flex items-center gap-[11px] rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors max-md:py-3 max-md:text-sm",
    collapsed && "md:justify-center md:px-0",
    isActive ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

function NavRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const t = useT();
  const label = t(item.label);
  // Tooltip only fires when collapsed — labels are visible inline when expanded.
  // Mobile keeps native title since hover doesn't apply there.
  const tooltipLabel = collapsed ? (item.ready === false ? `${label} · ${t("nav.soon")}` : label) : "";

  const inner =
    item.ready === false ? (
      <div aria-disabled className={cn(itemClasses(false, collapsed), "cursor-not-allowed opacity-45")}>
        <item.icon className="size-[18px] shrink-0" aria-hidden />
        <span className={collapsed ? "md:hidden" : ""}>{label}</span>
      </div>
    ) : (
      <NavLink
        to={item.to}
        end={item.to === ROUTES.RAPPORT}
        aria-label={collapsed ? label : undefined} // icons only: its name stays (screen readers)
        className={({ isActive }) => cn(itemClasses(isActive, collapsed), "relative")}
      >
        <item.icon className="size-[18px] shrink-0" aria-hidden />
        <span className={collapsed ? "md:hidden" : ""}>{label}</span>
      </NavLink>
    );

  return (
    <Tooltip label={tooltipLabel} placement="right" className="relative block">
      {inner}
    </Tooltip>
  );
}

/** A row of the sidebar's foot that acts (lock, log out) instead of opening a page: the same look as `NavRow`. */
function ActionRow({
  icon: Icon,
  label,
  collapsed,
  disabled,
  onClick,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  collapsed: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip label={collapsed ? label : ""} placement="right" className="relative block">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={collapsed ? label : undefined} // icon only: its name stays
        className={cn(itemClasses(false, collapsed), "w-full cursor-pointer")}
      >
        <Icon className="size-[18px] shrink-0" aria-hidden />
        <span className={collapsed ? "md:hidden" : ""}>{label}</span>
      </button>
    </Tooltip>
  );
}

export function Sidebar({
  role,
  permissions,
  pending,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const t = useT();
  const { handleLogout } = useLogout();
  const { me } = useMe();
  const { lockNow, isLocking } = useLockNow();
  // « Verrouiller l'écran »: only once the lock is on and has its code (« Mon compte » → « Verrouillage »).
  const canLock = !!me?.lock.enabled && me.lock.has_pin;
  const groups = pending ? [] : visibleGroups(role, permissions);

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
          title={collapsed ? t("nav.expand") : t("nav.collapse")}
          aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          className="absolute -right-[13px] top-[50px] z-10 hidden size-[26px] cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground md:flex"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>

        <Link to={ROUTES.HOME} className="flex h-16 shrink-0 items-center gap-[11px] border-b border-border px-4">
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
                <span
                  className={`px-3 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground ${collapsed ? "md:hidden" : ""}`}
                >
                  {t(group.title)}
                </span>
              )}
              {group.items.map((item) => (
                <NavRow key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          ))}
        </nav>

        <div className="flex shrink-0 flex-col gap-0.5 border-t border-border p-2.5">
          {(isStaff(role) || !SETTINGS_ITEM.feature || permissions.includes(SETTINGS_ITEM.feature)) && (
            <NavRow item={SETTINGS_ITEM} collapsed={collapsed} />
          )}
          <NavRow item={ACCOUNT_ITEM} collapsed={collapsed} />
          {canLock && (
            <ActionRow
              icon={Lock}
              label={t("header.lock")}
              collapsed={collapsed}
              disabled={isLocking}
              onClick={lockNow}
            />
          )}
          <ActionRow icon={LogOut} label={t("header.logout")} collapsed={collapsed} onClick={handleLogout} />
        </div>
      </aside>
    </>
  );
}

/**
 * Bottom-right widget (in the corner stack of `AppLayout`, under the Sobrus card) — renders one
 * card per non-dismissed job on EVERY route, including /upload-file. With concurrency=1 we typically see: 1
 * running + N queued + recent successes fading out. Auto-dismiss for
 * "success" is owned by the upload provider (`hooks/useUpload.tsx`) (per-job timer); cancelled/error stay
 * until the user closes them.
 *
 * The wizard at /upload-file shows ONE doc-type's job inline as a bigger
 * card — that's the same data as one of the widget cards, intentional
 * duplication for full visibility per the user's request.
 *
 * Click a card body → /upload-file?type=<docType> so the wizard rehydrates
 * onto the matching job.
 */
