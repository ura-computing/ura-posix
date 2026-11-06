// Roles, features, routes (urls + query keys: api/api.ts). Domain shapes live in one file per domain
// (same names as the backend `schemas.py` files) and are re-exported here: import from "@/types".

export const ROLES = {
  ADMIN: "admin",
  OWNER: "owner",
  EMPLOYEE: "employee",
  DEVELOPER: "developer",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

/** User account status, same values as the backend (`auth/schemas.py` `UserOut`). `pending` =
 *  signed up, not accepted yet: logs in, no pharmacy, empty menu, 404 everywhere. */
export const STATUSES = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  PENDING: "pending",
} as const;
export type Status = (typeof STATUSES)[keyof typeof STATUSES];

export const FEATURES = [
  "rapports",
  "import",
  "achats",
  "ventes",
  "stock",
  "analyse",
  "accounting",
  "alertes",
  "special_products",
  "produits",
  "sobrus",
  "labels", // premium: « Étiquette » (product page)
  "orders", // premium: « Commander » (product page)
] as const;
export type Feature = (typeof FEATURES)[number];

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  FORGOT_PASSWORD: "/auth/forgot-password",
  SIGNUP: "/auth/signup",
  SET_PASSWORD: "/auth/set-password",
  ME: "/auth/me",
  RAPPORT: "/rapport",

  // Data modules (placeholders — sidebar items render disabled via ready:false until pages exist)
  ACHATS: "/achats",
  VENTES: "/ventes",
  STOCK: "/stock",
  UPLOAD_FILE: "/upload-file",
  ANALYSES: "/analyses",
  ALERTES: "/alertes",
  COMPTABILITE: "/comptabilite",
  PRODUITS_SPECIAUX: "/produits-speciaux",
  PRODUITS: "/produits",
  PRODUIT: "/produits/:id",
  IMPORTS: "/imports",
  SOBRUS: "/sobrus",

  // Gestion
  OWNER_EMPLOYEES: "/owner/employees",
  HISTORY: "/historique",

  // Admin
  ADMIN_PHARMACIES: "/admin/pharmacies",
  ADMIN_PHARMACY: "/admin/pharmacies/:id",
  ADMIN_CATALOGUE: "/admin/catalogue",
  ADMIN_CATEGORIES: "/admin/categories",
  ADMIN_DEVELOPERS: "/admin/developers",

  // Owner — "Ma boutique en ligne" (3-tab page, gated by ?tab=)
  STORE_WEBSITE: "/store-website",
  STORE_WEBSITE_NEW: "/store-website/new",

  // Developer — sibling top-level routes (not nested under /dev) so
  // "Demandes" and "Mes exports" feel independent in the URL too.
  DEV_DASHBOARD: "/requests",
  DEV_REQUEST: "/requests/:id",
  DEV_EDITOR: "/requests/:id/editor",
  DEV_EXPORTS: "/exports",

  // Public store preview (no app chrome, no auth)
  STORE_PREVIEW: "/preview/:template/:page",
} as const;
export type Route = (typeof ROUTES)[keyof typeof ROUTES];

export * from "./auth";
export * from "./stats";
export * from "./catalog";
export * from "./imports";
export * from "./accounting";
export * from "./transactions";
export * from "./exclusions";
export * from "./members";
export * from "./storeWebsite";
export * from "./products";
export * from "./history";
export * from "./sobrus";
