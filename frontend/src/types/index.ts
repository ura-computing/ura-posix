// Roles, features, routes (urls + query keys: api/api.ts). Domain shapes live in one file per domain
// (same names as the backend `schemas.py` files) and are re-exported here: import from "@/types".

export const ROLES = {
  ADMIN: "admin",
  SUPPORT: "support",
  OWNER: "owner",
  EMPLOYEE: "employee",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];
/** The APCM team: Support has the same rights as the admin (backend `STAFF_ROLES`). */
export const STAFF: Role[] = [ROLES.ADMIN, ROLES.SUPPORT];
export const isStaff = (role: string | null | undefined): boolean => STAFF.includes(role as Role);

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

  // Owner — « Ma boutique en ligne »: ask for the store (step by step), then follow it
  STORE_WEBSITE: "/ma-boutique",

  // Staff (admin + Support) — « Boutiques en ligne »: the queue, a request, its editor
  STORE_REQUESTS: "/admin/boutiques",
  STORE_REQUEST: "/admin/boutiques/:id",
  STORE_EDITOR: "/admin/boutiques/:id/editeur",

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
export * from "./notifications";
