/** Every address of the app, in one object: who opens each page, its file, its permission, its sidebar link.
 *  `App.tsx` makes the routes from it, the sidebar its links. A role's pages start with the role: /admin/…,
 *  /support/…, /owner/…, /employee/…. */
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Boxes,
  Building2,
  Coins,
  Globe,
  HandHeart,
  History,
  LayoutDashboard,
  Package,
  PackageX,
  RefreshCw,
  Settings,
  ShoppingCart,
  Star,
  Tags,
  TrendingUp,
  Truck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import type { Feature, Role } from "@/types";

/** The addresses other pages link to (pages of no single role). */
export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  FORGOT_PASSWORD: "/forgot-password",
  SET_PASSWORD: "/set-password",
  ME: "/compte",
  STORE_PREVIEW: "/preview/:template/:page",
} as const;

export interface AppRoute {
  path: string;
  /** The page file, loaded when first opened. */
  load: () => Promise<{ default: ComponentType }>;
  /** The permission it needs (owner / employee pages). */
  feature?: Feature;
  /** Its sidebar link; none = reached from another page. */
  nav?: {
    label: string;
    icon: LucideIcon;
    group: "top" | "exploitation" | "commandes" | "gestion" | "administration";
  };
}

export const ROLE_ROUTES: Record<"public" | "guest" | "signedIn" | Role, AppRoute[]> = {
  /** Anyone, logged in or not. */
  public: [
    { path: ROUTES.HOME, load: () => import("@/pages/common/home") },
    { path: ROUTES.STORE_PREVIEW, load: () => import("@/pages/common/preview") }, // a store as customers see it
  ],
  /** Only when NOT logged in. */
  guest: [
    { path: ROUTES.LOGIN, load: () => import("@/pages/common/login") },
    { path: ROUTES.FORGOT_PASSWORD, load: () => import("@/pages/common/forgot-password") },
    { path: ROUTES.SIGNUP, load: () => import("@/pages/common/signup") },
    { path: ROUTES.SET_PASSWORD, load: () => import("@/pages/common/set-password") },
  ],
  /** Every logged-in account. */
  signedIn: [{ path: ROUTES.ME, load: () => import("@/pages/common/compte") }],
  admin: [
    {
      path: "/admin/rapport",
      load: () => import("@/_components/pages/rapport"),
      nav: { label: "nav.dashboard", icon: LayoutDashboard, group: "top" },
    },
    {
      path: "/admin/pharmacies",
      load: () => import("@/_components/pages/pharmacies"),
      nav: { label: "nav.pharmacies", icon: Building2, group: "administration" },
    },
    { path: "/admin/pharmacies/:id", load: () => import("@/_components/pages/pharmacies/detail") },
    {
      path: "/admin/catalogue",
      load: () => import("@/_components/pages/catalogue"),
      nav: { label: "nav.catalogue", icon: BookOpen, group: "administration" },
    },
    {
      path: "/admin/fournisseurs",
      load: () => import("@/_components/pages/fournisseurs"),
      nav: { label: "nav.suppliers", icon: Truck, group: "administration" },
    },
    { path: "/admin/fournisseurs/:id", load: () => import("@/_components/pages/fournisseurs/sheet") },
    {
      path: "/admin/commandes-a-passer",
      load: () => import("@/_components/pages/commandes-a-passer"),
      nav: { label: "nav.ordersToPlace", icon: ClipboardCheck, group: "administration" },
    },
    {
      path: "/admin/categories",
      load: () => import("@/_components/pages/categories"),
      nav: { label: "nav.categories", icon: Tags, group: "administration" },
    },
    {
      path: "/admin/imports",
      load: () => import("@/_components/pages/imports/history"),
      nav: { label: "nav.imports", icon: Settings, group: "administration" },
    },
    { path: "/admin/upload-file", load: () => import("@/_components/pages/imports/upload") },
  ],
  support: [
    {
      path: "/support/rapport",
      load: () => import("@/_components/pages/rapport"),
      nav: { label: "nav.dashboard", icon: LayoutDashboard, group: "top" },
    },
    {
      path: "/support/pharmacies",
      load: () => import("@/_components/pages/pharmacies"),
      nav: { label: "nav.pharmacies", icon: Building2, group: "administration" },
    },
    { path: "/support/pharmacies/:id", load: () => import("@/_components/pages/pharmacies/detail") },
    {
      path: "/support/catalogue",
      load: () => import("@/_components/pages/catalogue"),
      nav: { label: "nav.catalogue", icon: BookOpen, group: "administration" },
    },
    {
      path: "/support/fournisseurs",
      load: () => import("@/_components/pages/fournisseurs"),
      nav: { label: "nav.suppliers", icon: Truck, group: "administration" },
    },
    { path: "/support/fournisseurs/:id", load: () => import("@/_components/pages/fournisseurs/sheet") },
    {
      path: "/support/commandes-a-passer",
      load: () => import("@/_components/pages/commandes-a-passer"),
      nav: { label: "nav.ordersToPlace", icon: ClipboardCheck, group: "administration" },
    },
    {
      path: "/support/categories",
      load: () => import("@/_components/pages/categories"),
      nav: { label: "nav.categories", icon: Tags, group: "administration" },
    },
    {
      path: "/support/boutiques",
      load: () => import("@/pages/support/boutiques"),
      nav: { label: "nav.boutiques", icon: Globe, group: "administration" },
    },
    { path: "/support/boutiques/:id", load: () => import("@/pages/support/boutique") },
    { path: "/support/boutiques/:id/editeur", load: () => import("@/pages/support/editeur") },
    {
      path: "/support/imports",
      load: () => import("@/_components/pages/imports/history"),
      nav: { label: "nav.imports", icon: Settings, group: "administration" },
    },
    { path: "/support/upload-file", load: () => import("@/_components/pages/imports/upload") },
  ],
  owner: [
    {
      path: "/owner/rapport",
      load: () => import("@/_components/pages/rapport"),
      feature: "rapports",
      nav: { label: "nav.dashboard", icon: LayoutDashboard, group: "top" },
    },
    {
      path: "/owner/achats",
      load: () => import("@/_components/pages/operations/achats"),
      feature: "achats",
      nav: { label: "nav.achats", icon: ShoppingCart, group: "exploitation" },
    },
    {
      path: "/owner/ventes",
      load: () => import("@/_components/pages/operations/ventes"),
      feature: "ventes",
      nav: { label: "nav.ventes", icon: TrendingUp, group: "exploitation" },
    },
    {
      path: "/owner/stock",
      load: () => import("@/_components/pages/analytics/stock"),
      feature: "stock",
      nav: { label: "nav.stock", icon: Boxes, group: "exploitation" },
    },
    {
      path: "/owner/produits",
      load: () => import("@/_components/pages/products/list"),
      feature: "produits",
      nav: { label: "nav.produits", icon: Package, group: "exploitation" },
    },
    { path: "/owner/produits/:id", load: () => import("@/_components/pages/products/sheet"), feature: "produits" },
    {
      path: "/owner/stock-abime",
      load: () => import("@/_components/pages/stock-abime"),
      feature: "damaged",
      nav: { label: "nav.stockAbime", icon: PackageX, group: "exploitation" },
    },
    {
      path: "/owner/promis",
      load: () => import("@/_components/pages/promis"),
      feature: "promis",
      nav: { label: "nav.promis", icon: HandHeart, group: "commandes" },
    },
    {
      path: "/owner/commandes",
      load: () => import("@/_components/pages/commandes"),
      feature: "orders",
      nav: { label: "nav.dailyOrders", icon: ClipboardList, group: "commandes" },
    },
    { path: "/owner/promis/nouveau", load: () => import("@/_components/pages/promis/new"), feature: "promis" },
    { path: "/owner/promis/:id", load: () => import("@/_components/pages/promis/sheet"), feature: "promis" },
    {
      path: "/owner/analyses",
      load: () => import("@/_components/pages/analytics/analyses"),
      feature: "analyse",
      nav: { label: "nav.analyses", icon: BarChart3, group: "exploitation" },
    },
    {
      path: "/owner/alertes",
      load: () => import("@/_components/pages/analytics/alertes"),
      feature: "alertes",
      nav: { label: "nav.alertes", icon: Bell, group: "exploitation" },
    },
    {
      path: "/owner/comptabilite",
      load: () => import("@/_components/pages/accounting/comptabilite"),
      feature: "accounting",
      nav: { label: "nav.comptabilite", icon: Coins, group: "exploitation" },
    },
    {
      path: "/owner/produits-speciaux",
      load: () => import("@/_components/pages/accounting/produits-speciaux"),
      feature: "special_products",
      nav: { label: "nav.produitsSpeciaux", icon: Star, group: "exploitation" },
    },
    {
      path: "/owner/equipe",
      load: () => import("@/pages/owner/equipe"),
      nav: { label: "nav.equipe", icon: UsersRound, group: "gestion" },
    },
    {
      path: "/owner/historique",
      load: () => import("@/pages/owner/historique"),
      nav: { label: "nav.historique", icon: History, group: "gestion" },
    },
    {
      path: "/owner/sobrus",
      load: () => import("@/pages/owner/sobrus"),
      feature: "sobrus",
      nav: { label: "nav.sobrus", icon: RefreshCw, group: "gestion" },
    },
    {
      path: "/owner/ma-boutique",
      load: () => import("@/pages/owner/ma-boutique"),
      nav: { label: "nav.myStore", icon: Globe, group: "gestion" },
    },
    {
      path: "/owner/imports",
      load: () => import("@/_components/pages/imports/history"),
      feature: "import",
      nav: { label: "nav.imports", icon: Settings, group: "gestion" },
    },
    { path: "/owner/upload-file", load: () => import("@/_components/pages/imports/upload"), feature: "import" },
  ],
  employee: [
    {
      path: "/employee/rapport",
      load: () => import("@/_components/pages/rapport"),
      feature: "rapports",
      nav: { label: "nav.dashboard", icon: LayoutDashboard, group: "top" },
    },
    {
      path: "/employee/achats",
      load: () => import("@/_components/pages/operations/achats"),
      feature: "achats",
      nav: { label: "nav.achats", icon: ShoppingCart, group: "exploitation" },
    },
    {
      path: "/employee/ventes",
      load: () => import("@/_components/pages/operations/ventes"),
      feature: "ventes",
      nav: { label: "nav.ventes", icon: TrendingUp, group: "exploitation" },
    },
    {
      path: "/employee/stock",
      load: () => import("@/_components/pages/analytics/stock"),
      feature: "stock",
      nav: { label: "nav.stock", icon: Boxes, group: "exploitation" },
    },
    {
      path: "/employee/produits",
      load: () => import("@/_components/pages/products/list"),
      feature: "produits",
      nav: { label: "nav.produits", icon: Package, group: "exploitation" },
    },
    { path: "/employee/produits/:id", load: () => import("@/_components/pages/products/sheet"), feature: "produits" },
    {
      path: "/employee/stock-abime",
      load: () => import("@/_components/pages/stock-abime"),
      feature: "damaged",
      nav: { label: "nav.stockAbime", icon: PackageX, group: "exploitation" },
    },
    {
      path: "/employee/promis",
      load: () => import("@/_components/pages/promis"),
      feature: "promis",
      nav: { label: "nav.promis", icon: HandHeart, group: "commandes" },
    },
    {
      path: "/employee/commandes",
      load: () => import("@/_components/pages/commandes"),
      feature: "orders",
      nav: { label: "nav.dailyOrders", icon: ClipboardList, group: "commandes" },
    },
    { path: "/employee/promis/nouveau", load: () => import("@/_components/pages/promis/new"), feature: "promis" },
    { path: "/employee/promis/:id", load: () => import("@/_components/pages/promis/sheet"), feature: "promis" },
    {
      path: "/employee/analyses",
      load: () => import("@/_components/pages/analytics/analyses"),
      feature: "analyse",
      nav: { label: "nav.analyses", icon: BarChart3, group: "exploitation" },
    },
    {
      path: "/employee/alertes",
      load: () => import("@/_components/pages/analytics/alertes"),
      feature: "alertes",
      nav: { label: "nav.alertes", icon: Bell, group: "exploitation" },
    },
    {
      path: "/employee/comptabilite",
      load: () => import("@/_components/pages/accounting/comptabilite"),
      feature: "accounting",
      nav: { label: "nav.comptabilite", icon: Coins, group: "exploitation" },
    },
    {
      path: "/employee/produits-speciaux",
      load: () => import("@/_components/pages/accounting/produits-speciaux"),
      feature: "special_products",
      nav: { label: "nav.produitsSpeciaux", icon: Star, group: "exploitation" },
    },
    {
      path: "/employee/imports",
      load: () => import("@/_components/pages/imports/history"),
      feature: "import",
      nav: { label: "nav.imports", icon: Settings, group: "gestion" },
    },
    { path: "/employee/upload-file", load: () => import("@/_components/pages/imports/upload"), feature: "import" },
  ],
};
