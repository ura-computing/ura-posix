import { UserAvatar } from "@/components/refine-ui/layout/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useGetIdentity, useLogout } from "@refinedev/core";
import { Bell, LogOutIcon, Search, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import type { User } from "@/types";

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

const NOTIFICATION_COUNT = 3;

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
      <div className="flex flex-1 items-center gap-6 min-w-0">
        <h1 className="text-xl font-bold text-foreground truncate">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground hidden sm:block truncate">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative w-56 lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un produit..."
            className="pl-9 h-9 bg-muted/50 border-0"
          />
        </div>
        <button
          type="button"
          className="relative p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {NOTIFICATION_COUNT > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {NOTIFICATION_COUNT}
            </span>
          )}
        </button>
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
      <UserDropdown />
    </header>
  );
}

const UserDropdown = () => {
  const { data: user } = useGetIdentity<User>();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const navigate = useNavigate();

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
