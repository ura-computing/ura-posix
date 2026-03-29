import { ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  PackageX,
  ShoppingCart,
  ShoppingBasket,
  TriangleAlert,
  Settings,
  Users,
} from "lucide-react";

// Page imports
import DashboardUploadFile from "./pages/dashboard/upload-file";
import { Login } from "./pages/login";
import { Signup } from "./pages/signup";
import AchatList from "./pages/achat";
import VentesList from "./pages/ventes";
import StockList from "./pages/stock";
import ParametresList from "./pages/parametres";
import RapportsPage from "./pages/rapports";
import ProfilePage from "./pages/profile/index";
import PendingApproval from "./pages/pending";
import PharmaciesAdminPage from "./pages/admin/pharmacies";
import AdminCatalogRequestsPage from "./pages/admin/catalogRequests";
import AdminCatalogPage from "./pages/admin/catalog";
import OwnerEmployeesPage from "./pages/owner/employees";
import CatalogRequestsPage from "./pages/catalogRequests";
import WelcomePage from "./pages/welcome";
import ForgotPasswordPage from "./pages/forgotPassword";
import ResetPasswordPage from "./pages/resetPassword";
import { Navigate } from "react-router";
import { UserRole, eUserRole } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RouteConfig = {
  path: string;
  element: ReactNode;
  requireAuth: boolean;
  layout?: "sidebar" | "none" | "universal"; // "sidebar" = with sidebar, "none" = no sidebar, "universal" = no auth required
  allowed?: UserRole[];
  permission?: string; // feature key, e.g. "rapports" — checked against identity.permissions
};

export type ResourceConfig = {
  name: string;
  list: string;
  meta: {
    label: string;
    icon: ReactNode;
    allowed: UserRole[];
    permission?: string;
  };
};

// ─── All Routes ───────────────────────────────────────────────────────────────

export const routes: RouteConfig[] = [
  // Universal route (accessible to all, no sidebar)
  { path: "/", element: <WelcomePage />, requireAuth: false, layout: "universal" },

  // Public routes (no auth required, redirect to dashboard if authenticated)
  { path: "/login", element: <Login />, requireAuth: false },
  { path: "/signup", element: <Signup />, requireAuth: false },
  { path: "/forgot-password", element: <ForgotPasswordPage />, requireAuth: false },
  { path: "/reset-password", element: <ResetPasswordPage />, requireAuth: false },

  // Auth required, no sidebar
  {
    path: "/pending",
    element: <PendingApproval />,
    requireAuth: true,
    layout: "none",
  },

  // Private routes (auth required, with sidebar)
  { path: "/dashboard", element: <Navigate to="/rapports" replace />, requireAuth: true, layout: "sidebar", allowed: [eUserRole.ADMIN, eUserRole.OWNER, eUserRole.EMPLOYEE] },
  {
    path: "/dashboard/upload-file",
    element: <DashboardUploadFile />,
    requireAuth: true,
    layout: "sidebar",
    allowed: [eUserRole.OWNER, eUserRole.EMPLOYEE],
    permission: "import",
  },
  {
    path: "/achat",
    element: <AchatList />,
    requireAuth: true,
    layout: "sidebar",
    allowed: [eUserRole.OWNER, eUserRole.EMPLOYEE],
    permission: "achat",
  },
  {
    path: "/ventes",
    element: <VentesList />,
    requireAuth: true,
    layout: "sidebar",
    allowed: [eUserRole.OWNER, eUserRole.EMPLOYEE],
    permission: "ventes",
  },
  {
    path: "/stock",
    element: <StockList />,
    requireAuth: true,
    layout: "sidebar",
    allowed: [eUserRole.OWNER, eUserRole.EMPLOYEE],
    permission: "stock",
  },
  {
    path: "/rapports",
    element: <RapportsPage />,
    requireAuth: true,
    layout: "sidebar",
    allowed: [eUserRole.ADMIN, eUserRole.OWNER, eUserRole.EMPLOYEE],
  },
  {
    path: "/parametres",
    element: <ParametresList />,
    requireAuth: true,
    layout: "sidebar",
    allowed: [eUserRole.OWNER],
  },
  {
    path: "/profile",
    element: <ProfilePage />,
    requireAuth: true,
    layout: "sidebar",
    allowed: [eUserRole.ADMIN, eUserRole.OWNER, eUserRole.EMPLOYEE],
  },
  {
    path: "/admin/pharmacies",
    element: <PharmaciesAdminPage />,
    requireAuth: true,
    layout: "sidebar",
    allowed: [eUserRole.ADMIN],
  },
  {
    path: "/admin/catalog-requests",
    element: <AdminCatalogRequestsPage />,
    requireAuth: true,
    layout: "sidebar",
    allowed: [eUserRole.ADMIN],
  },
  {
    path: "/admin/catalog",
    element: <AdminCatalogPage />,
    requireAuth: true,
    layout: "sidebar",
    allowed: [eUserRole.ADMIN],
  },
  {
    path: "/owner/employees",
    element: <OwnerEmployeesPage />,
    requireAuth: true,
    layout: "sidebar",
    allowed: [eUserRole.OWNER],
  },
  {
    path: "/catalog-requests",
    element: <CatalogRequestsPage />,
    requireAuth: true,
    layout: "sidebar",
    allowed: [eUserRole.OWNER],
  },
];

// ─── Refine Resources (Sidebar Navigation) ───────────────────────────────────

export const resources: ResourceConfig[] = [
  {
    name: "rapports",
    list: "/rapports",
    meta: {
      label: "Rapports",
      icon: <BarChart3 />,
      allowed: [eUserRole.ADMIN, eUserRole.OWNER, eUserRole.EMPLOYEE],
    },
  },
  {
    name: "achat",
    list: "/achat",
    meta: {
      label: "achat",
      icon: <ShoppingCart />,
      allowed: [eUserRole.OWNER, eUserRole.EMPLOYEE],
      permission: "achat",
    },
  },
  {
    name: "ventes",
    list: "/ventes",
    meta: {
      label: "Ventes",
      icon: <ShoppingBasket />,
      allowed: [eUserRole.OWNER, eUserRole.EMPLOYEE],
      permission: "ventes",
    },
  },
  {
    name: "stock",
    list: "/stock",
    meta: {
      label: "Alertes Stock",
      icon: <TriangleAlert />,
      allowed: [eUserRole.OWNER, eUserRole.EMPLOYEE],
      permission: "stock",
    },
  },
  {
    name: "parametres",
    list: "/parametres",
    meta: {
      label: "Paramètres",
      icon: <Settings />,
      allowed: [eUserRole.OWNER],
    },
  },
  {
    name: "admin-pharmacies",
    list: "/admin/pharmacies",
    meta: {
      label: "Pharmacies",
      icon: <Building2 />,
      // adminOnly: true,
      allowed: [eUserRole.ADMIN],
    },
  },
  {
    name: "admin-catalog-requests",
    list: "/admin/catalog-requests",
    meta: {
      label: "Demandes d'exclusion",
      icon: <ClipboardCheck />,
      // adminOnly: true,
      allowed: [eUserRole.ADMIN],
    },
  },
  {
    name: "admin-catalog",
    list: "/admin/catalog",
    meta: {
      label: "Catalogue",
      icon: <BookOpen />,
      // adminOnly: true,
      allowed: [eUserRole.ADMIN],
    },
  },
  {
    name: "owner-employees",
    list: "/owner/employees",
    meta: {
      label: "Mes employés",
      icon: <Users />,
      // ownerOnly: true,
      allowed: [eUserRole.OWNER],
    },
  },
  {
    name: "catalog-requests",
    list: "/catalog-requests",
    meta: {
      label: "Produits non déclarés",
      icon: <PackageX />,
      allowed: [eUserRole.OWNER],
    },
  },
];
