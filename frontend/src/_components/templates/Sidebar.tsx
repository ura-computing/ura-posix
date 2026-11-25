/** The menu on the left: the links the account may open (role + features), collapsible, a drawer on phones. */
import type { ComponentType } from "react";
import { NavLink, Link } from "react-router-dom";

import { ChevronLeft, ChevronRight, CircleUser, Lock, LogOut, type LucideIcon } from "lucide-react";
import type { Role } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { PharmagestIcon } from "@/_components/atoms/PharmagestIcon";
import { Tooltip } from "@/_components/atoms/Tooltip";
import { useLockNow } from "@/hooks/useLockScreen";
import { useLogout } from "@/hooks/useLogout";
import { useMe } from "@/hooks/useMe";
import { PharmagestWordmark } from "@/_components/atoms/PharmagestWordmark";
import { ROLE_ROUTES, ROUTES } from "@/routes";

export interface SidebarProps {
  role: Role;
  /** User's effective permissions (3-layer intersection from /me): an owner's / employee's page shows only with its
   *  permission (the admin's and Support's pages have none). */
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

function NavRow({
  to,
  label,
  icon: Icon,
  collapsed,
  end,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
  end?: boolean;
}) {
  const t = useT();
  const text = t(label);
  return (
    // Tooltip only when collapsed (labels show inline when expanded).
    <Tooltip label={collapsed ? text : ""} placement="right" className="relative block">
      <NavLink
        to={to}
        end={end}
        aria-label={collapsed ? text : undefined} // icons only: its name stays (screen readers)
        className={({ isActive }) => cn(itemClasses(isActive, collapsed), "relative")}
      >
        <Icon className="size-[18px] shrink-0" aria-hidden />
        <span className={collapsed ? "md:hidden" : ""}>{text}</span>
      </NavLink>
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
  // The role's pages with a sidebar link, without those its permissions close (owner / employee).
  const links = pending
    ? []
    : ROLE_ROUTES[role].filter((r) => r.nav && (!r.feature || permissions.includes(r.feature)));

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
          {(
            [
              ["top", null],
              ["exploitation", "nav.groupExploitation"],
              ["commandes", "nav.groupCommandes"],
              ["gestion", "nav.groupGestion"],
              ["administration", "nav.groupAdministration"],
            ] as const
          ).map(([group, title]) => {
            const items = links.filter((r) => r.nav?.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="flex flex-col gap-0.5">
                {title && (
                  <span
                    className={`px-3 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground ${collapsed ? "md:hidden" : ""}`}
                  >
                    {t(title)}
                  </span>
                )}
                {items.map((r) => (
                  <NavRow
                    key={r.path}
                    to={r.path}
                    label={r.nav!.label}
                    icon={r.nav!.icon}
                    collapsed={collapsed}
                    end={r.path.endsWith("/rapport")}
                  />
                ))}
              </div>
            );
          })}
        </nav>

        <div className="flex shrink-0 flex-col gap-0.5 border-t border-border p-2.5">
          {links
            .filter((r) => r.nav?.group === "bottom")
            .map((r) => (
              <NavRow key={r.path} to={r.path} label={r.nav!.label} icon={r.nav!.icon} collapsed={collapsed} />
            ))}
          <NavRow to={ROUTES.ME} label="nav.compte" icon={CircleUser} collapsed={collapsed} />
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
