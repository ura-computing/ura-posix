/** The sidebar's links: groups, roles and features that show each one, the page titles. */

import { ROLES, ROUTES, STAFF, isStaff } from "@/types";
import {
  LayoutDashboard,
  ShoppingCart,
  TrendingUp,
  Boxes,
  Package,
  BarChart3,
  Bell,
  Coins,
  Star,
  UsersRound,
  History,
  Building2,
  BookOpen,
  Tags,
  CircleUser,
  Settings,
  RefreshCw,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Feature, Role } from "@/types";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  roles: Role[];
  /** Render disabled (cursor-not-allowed, opacity-45) until the page exists. */
  ready?: boolean;
  /** Hide for non-admin users who don't have this feature in their effective
   *  permission set (3-layer intersection from /me). Admins bypass. Omit on
   *  role-only items like /rapports or admin entries. */
  feature?: Feature;
}
interface NavGroup {
  title?: string;
  items: NavItem[];
}

const ALL: Role[] = [...STAFF, ROLES.OWNER, ROLES.EMPLOYEE];
const DATA: Role[] = [ROLES.OWNER, ROLES.EMPLOYEE];

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        label: "nav.dashboard",
        to: ROUTES.RAPPORT,
        icon: LayoutDashboard,
        roles: ALL,
        ready: true,
        feature: "rapports",
      },
    ],
  },
  {
    title: "nav.groupExploitation",
    items: [
      { label: "nav.achats", to: ROUTES.ACHATS, icon: ShoppingCart, roles: DATA, ready: true, feature: "achats" },
      { label: "nav.ventes", to: ROUTES.VENTES, icon: TrendingUp, roles: DATA, ready: true, feature: "ventes" },
      { label: "nav.stock", to: ROUTES.STOCK, icon: Boxes, roles: DATA, ready: true, feature: "stock" },
      { label: "nav.produits", to: ROUTES.PRODUITS, icon: Package, roles: DATA, ready: true, feature: "produits" },
      { label: "nav.analyses", to: ROUTES.ANALYSES, icon: BarChart3, roles: DATA, ready: true, feature: "analyse" },
      { label: "nav.alertes", to: ROUTES.ALERTES, icon: Bell, roles: DATA, ready: true, feature: "alertes" },
      {
        label: "nav.comptabilite",
        to: ROUTES.COMPTABILITE,
        icon: Coins,
        roles: DATA,
        ready: true,
        feature: "accounting",
      },
      {
        label: "nav.produitsSpeciaux",
        to: ROUTES.PRODUITS_SPECIAUX,
        icon: Star,
        roles: DATA,
        ready: true,
        feature: "special_products",
      },
    ],
  },
  {
    title: "nav.groupGestion",
    items: [
      { label: "nav.equipe", to: ROUTES.OWNER_EMPLOYEES, icon: UsersRound, roles: [ROLES.OWNER], ready: true },
      { label: "nav.historique", to: ROUTES.HISTORY, icon: History, roles: [ROLES.OWNER], ready: true },
      {
        label: "nav.sobrus",
        to: ROUTES.SOBRUS,
        icon: RefreshCw,
        roles: [ROLES.OWNER],
        ready: true,
        feature: "sobrus",
      },
      { label: "nav.myStore", to: ROUTES.STORE_WEBSITE, icon: Globe, roles: [ROLES.OWNER], ready: true },
    ],
  },
  {
    title: "nav.groupAdministration",
    items: [
      { label: "nav.pharmacies", to: ROUTES.ADMIN_PHARMACIES, icon: Building2, roles: STAFF, ready: true },
      { label: "nav.catalogue", to: ROUTES.ADMIN_CATALOGUE, icon: BookOpen, roles: STAFF, ready: true },
      { label: "nav.categories", to: ROUTES.ADMIN_CATEGORIES, icon: Tags, roles: STAFF, ready: true },
      { label: "nav.boutiques", to: ROUTES.STORE_REQUESTS, icon: Globe, roles: STAFF, ready: true },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  label: "nav.imports",
  to: ROUTES.IMPORTS,
  icon: Settings,
  roles: ALL,
  ready: true,
  feature: "import",
};

export const ACCOUNT_ITEM: NavItem = {
  label: "nav.compte",
  to: ROUTES.ME,
  icon: CircleUser,
  roles: ALL,
  ready: true,
};

/** Filter the nav for a given user. Staff (admin, Support) sees every entry their role allows
 *  (feature flags don't gate staff). Others: drops any entry whose `feature`
 *  isn't in their effective permission set (from /me — already the 3-layer
 *  intersection). Role-only entries (no `feature`) stay visible. */
export function visibleGroups(role: Role, permissions: readonly string[] = []): NavGroup[] {
  const perms = new Set(permissions);
  const staff = isStaff(role);
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      if (!i.roles.includes(role)) return false;
      if (staff) return true;
      if (!i.feature) return true;
      return perms.has(i.feature);
    }),
  })).filter((g) => g.items.length > 0);
}

export function navTitle(pathname: string): string {
  const all = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM, ACCOUNT_ITEM];
  const match = all.find((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));
  return match?.label ?? "nav.dashboard";
}
