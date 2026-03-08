import { ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  PackagePlus,
  ShoppingCart,
  ShoppingBasket,
  TriangleAlert,
  Settings,
  Users,
} from "lucide-react";

// Page imports
import Dashboard from "./pages/dashboard";
import DashboardUploadFile from "./pages/dashboard/upload-file";
import { Login } from "./pages/login";
import { Register } from "./pages/register";
import AchatList from "./pages/achat";
import VentesList from "./pages/ventes";
import StockList from "./pages/stock";
import ParametresList from "./pages/parametres";
import RapportsPage from "./pages/rapports";
import ProfileSetup from "./pages/profile/setup";
import ProfilePage from "./pages/profile/index";
import PendingApproval from "./pages/pending";
import PharmaciesAdminPage from "./pages/admin/pharmacies";
import AdminCatalogRequestsPage from "./pages/admin/catalog-requests";
import AdminCatalogPage from "./pages/admin/catalog";
import OwnerEmployeesPage from "./pages/owner/employees";
import CatalogRequestsPage from "./pages/catalog-requests";
import { UserRole } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RouteConfig = {
  path: string;
  element: ReactNode;
  requireAuth: boolean;
  layout?: "sidebar" | "none"; // "sidebar" = with sidebar, "none" = no sidebar
};

export type ResourceConfig = {
  name: string;
  list: string;
  meta: {
    label: string;
    icon: ReactNode;
    allowed: UserRole[];
  };
};

// ─── All Routes ───────────────────────────────────────────────────────────────

export const routes: RouteConfig[] = [
  // Public routes (no auth required)
  { path: "/login", element: <Login />, requireAuth: false },
  { path: "/register", element: <Register />, requireAuth: false },

  // Auth required, no sidebar
  {
    path: "/profile/setup",
    element: <ProfileSetup />,
    requireAuth: true,
    layout: "none",
  },
  {
    path: "/pending",
    element: <PendingApproval />,
    requireAuth: true,
    layout: "none",
  },

  // Private routes (auth required, with sidebar)
  { path: "/", element: <Dashboard />, requireAuth: true, layout: "sidebar" },
  {
    path: "/dashboard/upload-file",
    element: <DashboardUploadFile />,
    requireAuth: true,
    layout: "sidebar",
  },
  {
    path: "/achat",
    element: <AchatList />,
    requireAuth: true,
    layout: "sidebar",
  },
  {
    path: "/ventes",
    element: <VentesList />,
    requireAuth: true,
    layout: "sidebar",
  },
  {
    path: "/stock",
    element: <StockList />,
    requireAuth: true,
    layout: "sidebar",
  },
  {
    path: "/rapports",
    element: <RapportsPage />,
    requireAuth: true,
    layout: "sidebar",
  },
  {
    path: "/parametres",
    element: <ParametresList />,
    requireAuth: true,
    layout: "sidebar",
  },
  {
    path: "/profile",
    element: <ProfilePage />,
    requireAuth: true,
    layout: "sidebar",
  },
  {
    path: "/admin/pharmacies",
    element: <PharmaciesAdminPage />,
    requireAuth: true,
    layout: "sidebar",
  },
  {
    path: "/admin/catalog-requests",
    element: <AdminCatalogRequestsPage />,
    requireAuth: true,
    layout: "sidebar",
  },
  {
    path: "/admin/catalog",
    element: <AdminCatalogPage />,
    requireAuth: true,
    layout: "sidebar",
  },
  {
    path: "/owner/employees",
    element: <OwnerEmployeesPage />,
    requireAuth: true,
    layout: "sidebar",
  },
  {
    path: "/catalog-requests",
    element: <CatalogRequestsPage />,
    requireAuth: true,
    layout: "sidebar",
  },
];

// ─── Refine Resources (Sidebar Navigation) ───────────────────────────────────

export const resources: ResourceConfig[] = [
  {
    name: "dashboard",
    list: "/",
    meta: {
      label: "Tableau de bord",
      icon: <LayoutDashboard />,
      allowed: ["admin", "owner", "employee"],
    },
  },
  {
    name: "achat",
    list: "/achat",
    meta: {
      label: "achat",
      icon: <ShoppingCart />,
      // notAdmin: true,
      allowed: ["owner", "employee"],
    },
  },
  {
    name: "ventes",
    list: "/ventes",
    meta: {
      label: "Ventes",
      icon: <ShoppingBasket />,
      // notAdmin: true,
      allowed: ["owner", "employee"],
    },
  },
  {
    name: "stock",
    list: "/stock",
    meta: {
      label: "Alertes Stock",
      icon: <TriangleAlert />,
      allowed: ["owner", "employee"],
    },
  },
  {
    name: "rapports",
    list: "/rapports",
    meta: {
      label: "Rapports",
      icon: <BarChart3 />,
      allowed: ["admin", "owner", "employee"],
    },
  },
  {
    name: "parametres",
    list: "/parametres",
    meta: {
      label: "Paramètres",
      icon: <Settings />,
      allowed: ["owner"],
    },
  },
  {
    name: "admin-pharmacies",
    list: "/admin/pharmacies",
    meta: {
      label: "Pharmacies",
      icon: <Building2 />,
      // adminOnly: true,
      allowed: ["admin"],
    },
  },
  {
    name: "admin-catalog-requests",
    list: "/admin/catalog-requests",
    meta: {
      label: "Demandes catalogue",
      icon: <ClipboardCheck />,
      // adminOnly: true,
      allowed: ["admin"],
    },
  },
  {
    name: "admin-catalog",
    list: "/admin/catalog",
    meta: {
      label: "Catalogue",
      icon: <BookOpen />,
      // adminOnly: true,
      allowed: ["admin"],
    },
  },
  {
    name: "owner-employees",
    list: "/owner/employees",
    meta: {
      label: "Mes employés",
      icon: <Users />,
      // ownerOnly: true,
      allowed: ["owner"],
    },
  },
  {
    name: "catalog-requests",
    list: "/catalog-requests",
    meta: {
      label: "Demandes catalogue",
      icon: <PackagePlus />,
      // ownerOnly: true,
      allowed: ["owner"],
    },
  },
];
