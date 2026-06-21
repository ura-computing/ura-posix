import {
  LayoutDashboard, ShoppingCart, TrendingUp, Boxes, BarChart3,
  CalendarClock, Bell, Coins, Star, UsersRound, Building2, Users, BookOpen,
  Tags, Globe, CircleUser, Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ROLES, ROUTES } from "@/types";
import type { Role } from "@/types";

export interface NavItem {
  label:  string;
  to:     string;
  icon:   LucideIcon;
  roles:  Role[];
  /** Render disabled (cursor-not-allowed, opacity-45) until the page exists. */
  ready?: boolean;
}
export interface NavGroup {
  title?: string;
  items:  NavItem[];
}

const ALL:  Role[] = [ROLES.ADMIN, ROLES.OWNER, ROLES.EMPLOYEE];
const DATA: Role[] = [ROLES.OWNER, ROLES.EMPLOYEE];

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Rapports", to: ROUTES.RAPPORT, icon: LayoutDashboard, roles: ALL, ready: true },
    ],
  },
  {
    title: "Exploitation",
    items: [
      { label: "Achats",             to: ROUTES.ACHATS,            icon: ShoppingCart,   roles: DATA,         ready: true },
      { label: "Ventes",             to: ROUTES.VENTES,            icon: TrendingUp,     roles: DATA,         ready: true },
      { label: "Stock",              to: ROUTES.STOCK,             icon: Boxes,          roles: DATA,         ready: true },
      { label: "Analyses",           to: ROUTES.ANALYSES,          icon: BarChart3,      roles: DATA,         ready: true },
      { label: "Péremptions",        to: ROUTES.PEREMPTIONS,       icon: CalendarClock,  roles: DATA },
      { label: "Alertes",            to: ROUTES.ALERTES,           icon: Bell,           roles: DATA,         ready: true },
      { label: "Comptabilité",       to: ROUTES.COMPTABILITE,      icon: Coins,          roles: DATA },
      { label: "Produits spéciaux",  to: ROUTES.PRODUITS_SPECIAUX, icon: Star,           roles: DATA },
    ],
  },
  {
    title: "Gestion",
    items: [
      { label: "Gérer mon équipe", to: ROUTES.OWNER_EMPLOYEES, icon: UsersRound, roles: [ROLES.OWNER] },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Pharmacies",            to: ROUTES.ADMIN_PHARMACIES, icon: Building2, roles: [ROLES.ADMIN] },
      { label: "Utilisateurs",          to: ROUTES.ADMIN_USERS,      icon: Users,     roles: [ROLES.ADMIN] },
      { label: "Catalogue",             to: ROUTES.ADMIN_CATALOGUE,  icon: BookOpen,  roles: [ROLES.ADMIN] },
      { label: "Catégories",            to: ROUTES.ADMIN_CATEGORIES, icon: Tags,      roles: [ROLES.ADMIN] },
      { label: "Statistiques globales", to: ROUTES.ADMIN_STATS,      icon: Globe,     roles: [ROLES.ADMIN] },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  label: "Paramètres", to: ROUTES.PARAMETRES, icon: Settings, roles: ALL, ready: true,
};

export const ACCOUNT_ITEM: NavItem = {
  label: "Mon compte", to: ROUTES.ME, icon: CircleUser, roles: ALL, ready: true,
};

export function visibleGroups(role: Role): NavGroup[] {
  return NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);
}

export function navTitle(pathname: string): string {
  const all = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM, ACCOUNT_ITEM];
  const match = all.find((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));
  return match?.label ?? "Tableau de bord";
}