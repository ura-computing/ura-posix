import { ReactNode } from "react";
import {
  BarChart3,
  Building2,
  LayoutDashboard,
  ShoppingCart,
  ShoppingBasket,
  TriangleAlert,
  Settings,
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
import PharmaciesAdminPage from "./pages/admin/pharmacies";

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
  };
};

// ─── All Routes ───────────────────────────────────────────────────────────────

export const routes: RouteConfig[] = [
  // Public routes (no auth required)
  { path: "/login", element: <Login />, requireAuth: false },
  { path: "/register", element: <Register />, requireAuth: false },

  // Profile setup (auth required, no sidebar)
  { path: "/profile/setup", element: <ProfileSetup />, requireAuth: true, layout: "none" },

  // Private routes (auth required, with sidebar)
  { path: "/", element: <Dashboard />, requireAuth: true, layout: "sidebar" },
  { path: "/dashboard/upload-file", element: <DashboardUploadFile />, requireAuth: true, layout: "sidebar" },
  { path: "/achat", element: <AchatList />, requireAuth: true, layout: "sidebar" },
  { path: "/ventes", element: <VentesList />, requireAuth: true, layout: "sidebar" },
  { path: "/stock", element: <StockList />, requireAuth: true, layout: "sidebar" },
  { path: "/rapports", element: <RapportsPage />, requireAuth: true, layout: "sidebar" },
  { path: "/parametres", element: <ParametresList />, requireAuth: true, layout: "sidebar" },
  { path: "/profile", element: <ProfilePage />, requireAuth: true, layout: "sidebar" },
  { path: "/admin/pharmacies", element: <PharmaciesAdminPage />, requireAuth: true, layout: "sidebar" },
];

// ─── Refine Resources (Sidebar Navigation) ───────────────────────────────────

export const resources: ResourceConfig[] = [
  {
    name: "dashboard",
    list: "/",
    meta: { label: "Tableau de bord", icon: <LayoutDashboard /> },
  },
  {
    name: "achat",
    list: "/achat",
    meta: { label: "achat", icon: <ShoppingCart /> },
  },
  {
    name: "ventes",
    list: "/ventes",
    meta: { label: "Ventes", icon: <ShoppingBasket /> },
  },
  {
    name: "stock",
    list: "/stock",
    meta: { label: "Alertes Stock", icon: <TriangleAlert /> },
  },
  {
    name: "rapports",
    list: "/rapports",
    meta: { label: "Rapports", icon: <BarChart3 /> },
  },
  {
    name: "parametres",
    list: "/parametres",
    meta: { label: "Paramètres", icon: <Settings /> },
  },
  {
    name: "admin-pharmacies",
    list: "/admin/pharmacies",
    meta: { label: "Pharmacies", icon: <Building2 />, adminOnly: true },
  },
];
