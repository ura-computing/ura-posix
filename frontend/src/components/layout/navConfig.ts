import {
  LayoutDashboard, ShoppingCart, TrendingUp, Boxes, BarChart3,
  Bell, Coins, Star, UsersRound, Building2, BookOpen,
  Tags, CircleUser, Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ROLES, ROUTES } from "@/types";
import type { Feature, Role } from "@/types";

export interface NavItem {
  label:  string;
  to:     string;
  icon:   LucideIcon;
  roles:  Role[];
  /** Render disabled (cursor-not-allowed, opacity-45) until the page exists. */
  ready?: boolean;
  /** Hide for non-admin users who don't have this feature in their effective
   *  permission set (3-layer intersection from /me). Admins bypass. Omit on
   *  role-only items like /rapports or admin entries. */
  feature?: Feature;
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
      { label: "Rapports", to: ROUTES.RAPPORT, icon: LayoutDashboard, roles: ALL, ready: true, feature: "rapports" },
    ],
  },
  {
    title: "Exploitation",
    items: [
      { label: "Achats",             to: ROUTES.ACHATS,            icon: ShoppingCart,   roles: DATA, ready: true, feature: "achats" },
      { label: "Ventes",             to: ROUTES.VENTES,            icon: TrendingUp,     roles: DATA, ready: true, feature: "ventes" },
      { label: "Stock",              to: ROUTES.STOCK,             icon: Boxes,          roles: DATA, ready: true, feature: "stock" },
      { label: "Analyses",           to: ROUTES.ANALYSES,          icon: BarChart3,      roles: DATA, ready: true, feature: "analyse" },
      { label: "Alertes",            to: ROUTES.ALERTES,           icon: Bell,           roles: DATA, ready: true, feature: "alertes" },
      { label: "Comptabilité",       to: ROUTES.COMPTABILITE,      icon: Coins,          roles: DATA, ready: true, feature: "accounting" },
      { label: "Produits spéciaux",  to: ROUTES.PRODUITS_SPECIAUX, icon: Star,           roles: DATA, ready: true, feature: "special_products" },
    ],
  },
  {
    title: "Gestion",
    items: [
      { label: "Gérer mon équipe", to: ROUTES.OWNER_EMPLOYEES, icon: UsersRound, roles: [ROLES.OWNER], ready: true },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Pharmacies",            to: ROUTES.ADMIN_PHARMACIES, icon: Building2, roles: [ROLES.ADMIN], ready: true },
      { label: "Catalogue",             to: ROUTES.ADMIN_CATALOGUE,  icon: BookOpen,  roles: [ROLES.ADMIN], ready: true },
      { label: "Catégories",            to: ROUTES.ADMIN_CATEGORIES, icon: Tags,      roles: [ROLES.ADMIN], ready: true },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  label: "Gestion des imports", to: ROUTES.IMPORTS, icon: Settings, roles: ALL, ready: true,
  feature: "import",
};

export const ACCOUNT_ITEM: NavItem = {
  label: "Mon compte", to: ROUTES.ME, icon: CircleUser, roles: ALL, ready: true,
};

/** Filter the nav for a given user. Admin sees every entry their role allows
 *  (feature flags don't gate admin). Non-admin: drops any entry whose `feature`
 *  isn't in their effective permission set (from /me — already the 3-layer
 *  intersection). Role-only entries (no `feature`) stay visible. */
export function visibleGroups(role: Role, permissions: readonly string[] = []): NavGroup[] {
  const perms = new Set(permissions);
  const isAdmin = role === ROLES.ADMIN;
  return NAV_GROUPS
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        if (!i.roles.includes(role)) return false;
        if (isAdmin) return true;
        if (!i.feature) return true;
        return perms.has(i.feature);
      }),
    }))
    .filter((g) => g.items.length > 0);
}

export function navTitle(pathname: string): string {
  const all = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM, ACCOUNT_ITEM];
  const match = all.find((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));
  return match?.label ?? "Tableau de bord";
}