import { UserAvatar } from "@/components/refine-ui/layout/user-avatar";
import { ThemeToggle } from "@/components/refine-ui/theme/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useNotifications, type ApcmNotification } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { useLogout } from "@refinedev/core";
import { useMe } from "@/hooks/use-me";
import { Bell, CheckCheck, LogOutIcon, Package, Receipt, Trash2, UploadCloud, UserRound } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Tableau de Bord", subtitle: "Vue d'ensemble de votre pharmacie" },
  "/dashboard/upload-file": { title: "Tableau de Bord", subtitle: "Vue d'ensemble de votre pharmacie" },
  "/achat": { title: "Achat", subtitle: "Gestion des achats" },
  "/ventes/create": { title: "Ventes", subtitle: "Nouvelle vente" },
  "/stock": { title: "Alertes Stock", subtitle: "État du stock" },
  "/rapports": { title: "Tableau de Bord", subtitle: "Vue d'ensemble de votre pharmacie" },
  "/parametres": { title: "Paramètres", subtitle: "Configuration" },
};

function getPageTitle(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/achat")) return { title: "Achat", subtitle: "Gestion des achats" };
  if (pathname.startsWith("/ventes")) return { title: "Ventes", subtitle: "" };
  if (pathname.startsWith("/stock")) return { title: "Alertes Stock", subtitle: "État du stock" };
  if (pathname.startsWith("/rapports")) return { title: "Tableau de Bord", subtitle: "Vue d'ensemble de votre pharmacie" };
  if (pathname.startsWith("/parametres")) return { title: "Paramètres", subtitle: "Configuration" };
  return { title: "Tableau de Bord", subtitle: "Vue d'ensemble de votre pharmacie" };
}

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  admin: {
    label: "Administrateur",
    className: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  },
  owner: {
    label: "Propriétaire",
    className: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
  },
  employee: {
    label: "Employé",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  },
};

function RoleBadge() {
  const { data: user } = useMe();
  if (!user?.role) return null;
  const cfg = ROLE_CONFIG[user.role];
  if (!cfg) return null;
  return (
    <span className={cn("hidden sm:inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium shrink-0", cfg.className)}>
      {cfg.label}
    </span>
  );
}

export const Header = () => {
  const { isMobile } = useSidebar();
  return <>{isMobile ? <MobileHeader /> : <DesktopHeader />}</>;
};

function DesktopHeader() {
  const { pathname } = useLocation();
  const { title, subtitle } = getPageTitle(pathname);

  return (
    <header
      className={cn(
        "sticky top-0 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-4 lg:px-6 z-40"
      )}
    >
      <div className="flex flex-1 items-center gap-4 min-w-0">
        <h1 className="text-xl font-bold text-foreground truncate">{title}</h1>
        <RoleBadge />
        {subtitle && (
          <p className="text-sm text-muted-foreground hidden lg:block truncate">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <NotificationBell />
        <ThemeToggle className="border-border text-muted-foreground hover:text-foreground" />
        <UserDropdown />
      </div>
    </header>
  );
}

function MobileHeader() {
  const { pathname } = useLocation();
  const { title } = getPageTitle(pathname);
  const { open, isMobile } = useSidebar();

  return (
    <header
      className={cn(
        "sticky top-0 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background pr-3 z-40"
      )}
    >
      <SidebarTrigger
        className={cn("text-muted-foreground rotate-180 ml-1", {
          "opacity-0": open,
          "opacity-100": !open || isMobile,
          "pointer-events-auto": !open || isMobile,
          "pointer-events-none": open && !isMobile,
        })}
      />
      <h1 className="text-base font-bold truncate flex-1 min-w-0">{title}</h1>
      <ThemeToggle className="border-border text-muted-foreground" />
      <UserDropdown />
    </header>
  );
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

function NotificationItem({
  n,
  onDismiss,
}: {
  n: ApcmNotification;
  onDismiss: (id: string) => void;
}) {
  const section = n.fileType === "achat" ? "Achats" : "Ventes";
  const Icon = n.fileType === "achat" ? Package : Receipt;
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group",
        !n.read && "bg-primary/5"
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">
          {n.inserted} ligne(s) importée(s) dans{" "}
          <span className="text-primary">{section}</span>
        </p>
        {n.skipped > 0 && (
          <p className="text-xs text-muted-foreground">{n.skipped} doublon(s) ignoré(s)</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.timestamp)}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(n.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive shrink-0"
        aria-label="Supprimer"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function NotificationBell() {
  const { notifications, unreadCount, clearAll, dismiss, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v && unreadCount > 0) markAllRead();
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Notifications</span>
            {notifications.length > 0 && (
              <span className="text-xs text-muted-foreground">({notifications.length})</span>
            )}
          </div>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Tout effacer
            </button>
          )}
        </div>

        {/* List */}
        {notifications.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
            <Bell className="h-8 w-8 opacity-30" />
            <p className="text-sm">Aucune notification</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {notifications.map((n) => (
              <NotificationItem key={n.id} n={n} onDismiss={dismiss} />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const UserDropdown = () => {
  const { data: user } = useMe();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const navigate = useNavigate();

  const canImport = user?.role !== "admin" && user?.permissions?.import !== false;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full ring-2 ring-border focus:ring-2 focus:ring-ring"
          aria-label="Menu utilisateur"
        >
          <UserAvatar />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-3 py-2">
          <p className="text-sm font-semibold">{user?.name ?? "Utilisateur"}</p>
          {user?.email && (
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/profile")}>
          <UserRound className="h-4 w-4" />
          <span className="ml-2">Mon profil</span>
        </DropdownMenuItem>
        {canImport && (
          <DropdownMenuItem onClick={() => navigate("/dashboard/upload-file")}>
            <UploadCloud className="h-4 w-4" />
            <span className="ml-2">Importer Achats / Ventes</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()}>
          <LogOutIcon className="text-destructive h-4 w-4" />
          <span className="text-destructive ml-2">
            {isLoggingOut ? "Déconnexion..." : "Déconnexion"}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

Header.displayName = "Header";
DesktopHeader.displayName = "DesktopHeader";
MobileHeader.displayName = "MobileHeader";
