// Roles, features (addresses: routes/paths.ts; urls + query keys: api/api.ts). Domain shapes live in one file per domain
// (same names as the backend `schemas.py` files) and are re-exported here: import from "@/types".

export const ROLES = {
  ADMIN: "admin",
  SUPPORT: "support",
  OWNER: "owner",
  EMPLOYEE: "employee",
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
