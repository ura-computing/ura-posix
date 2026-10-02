// Roles, features, routes, query keys. Domain shapes live in one file per domain
// (same names as backend/schemas/) and are re-exported here: import from "@/types".

import type { CatalogFilters } from "./catalog";
import type { MargeMode, StockFilters } from "./stats";
import type { AchatsFilters, VentesFilters, VentesFiltersKey } from "./transactions";


export const ROLES = {
  ADMIN:     "admin",
  OWNER:     "owner",
  EMPLOYEE:  "employee",
  DEVELOPER: "developer",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const STATUSES = {
  ACTIVE: "active",
  REVOKED: "revoked",
  PENDING: "pending",
  REJECTED: "rejected",
} as const;
export type Status = (typeof STATUSES)[keyof typeof STATUSES];

export const FEATURES = [
  "rapports", "import", "achats", "ventes",
  "stock", "analyse", "accounting", "alertes",
  "special_products",
] as const;
export type Feature = (typeof FEATURES)[number];

export const ROUTES = {
  HOME:              "/",
  LOGIN:             "/login",
  FORGOT_PASSWORD:   "/auth/forgot-password",
  SET_PASSWORD:      "/auth/set-password",
  ME:                "/auth/me",
  RAPPORT:           "/rapport",

  // Data modules (placeholders — sidebar items render disabled via ready:false until pages exist)
  ACHATS:            "/achats",
  VENTES:            "/ventes",
  STOCK:             "/stock",
  UPLOAD_FILE:       "/upload-file",
  ANALYSES:          "/analyses",
  RAPPORTS:          "/rapports",
  ALERTES:           "/alertes",
  COMPTABILITE:      "/comptabilite",
  PRODUITS_SPECIAUX: "/produits-speciaux",
  IMPORTS:           "/imports",

  // Gestion
  OWNER_EMPLOYEES:   "/owner/employees",

  // Admin
  ADMIN_PHARMACIES:  "/admin/pharmacies",
  ADMIN_PHARMACY:    "/admin/pharmacies/:id",
  ADMIN_CATALOGUE:   "/admin/catalogue",
  ADMIN_CATEGORIES:  "/admin/categories",
  ADMIN_DEVELOPERS:  "/admin/developers",

  // Owner — "Ma boutique en ligne" (3-tab page, gated by ?tab=)
  STORE_WEBSITE:     "/store-website",
  STORE_WEBSITE_NEW: "/store-website/new",

  // Developer — sibling top-level routes (not nested under /dev) so
  // "Demandes" and "Mes exports" feel independent in the URL too.
  DEV_DASHBOARD:     "/requests",
  DEV_REQUEST:       "/requests/:id",
  DEV_EDITOR:        "/requests/:id/editor",
  DEV_EXPORTS:       "/exports",

  // Public store preview (no app chrome, no auth)
  STORE_PREVIEW:     "/preview/:template/:page",
} as const;
export type Route = (typeof ROUTES)[keyof typeof ROUTES];

export const QUERY_KEYS = {
  ME:             ["me"] as const,
  DASHBOARD:      ["dashboard"] as const,
  VALIDATE_TOKEN: (token: string) => ["validate-token", token] as const,
  SESSIONS:       (userId: string) => ["sessions", userId] as const,
  IMPORTS:        ["imports"] as const,

  // Ventes (Page 3) — filter args part of key so each combo gets its own cache slot.
  // VENTES uses the full filter set (sort + page included). Surveillance counts strip
  // sort/page since they don't affect the count.
  VENTES:               (f: VentesFilters)    => ["ventes", f] as const,
  VENTES_CATEGORIES:    ["ventes-categories"] as const,
  VENTES_TVA_RATES:     ["ventes-tva-rates"] as const,
  VENTES_SURVEILLANCE:  (f: VentesFiltersKey) => ["ventes-surveillance", f] as const,
  VENTES_SUGGESTIONS:   (q: string)           => ["ventes-suggestions", q] as const,
  // Gauge ignores pagination, sort, AND surveillance — same filters as the
  // achat supplier-summary minus the sort/page axis.
  VENTES_DISCOUNT_SUMMARY: (f: Omit<VentesFilters, "page" | "limit" | "sort_by" | "sort_order" | "surveillance">) =>
    ["ventes-discount-summary", f] as const,

  // Achats (Page 4)
  ACHATS:                   (f: AchatsFilters) => ["achats", f] as const,
  ACHATS_CATEGORIES:        ["achats-categories"] as const,
  ACHATS_TVA_RATES:         ["achats-tva-rates"] as const,
  ACHATS_SUPPLIER_SUMMARY:  (f: Omit<AchatsFilters, "page" | "limit" | "sort_by" | "sort_order">) => ["achats-supplier-summary", f] as const,
  ACHATS_SUGGESTIONS:       (q: string) => ["achats-suggestions", q] as const,

  // Stock (Page 6) — separate "full" + "filtered" keys per dual-fetch pattern.
  STOCK_ABCD_FULL:     (df: string | null, dt: string | null) =>
    ["stock-abcd-full", df ?? "", dt ?? ""] as const,
  STOCK_ABCD_FILTERED: (f: StockFilters) => ["stock-abcd-filtered", f] as const,
  PEREMPTIONS:         ["peremptions"] as const,

  // Rapport — owner endpoints. Filter args are part of the key so each
  // (window, category) combo gets its own cache slot.
  STATS:          (df: string | null, dt: string | null, ct: string, nd: boolean) =>
    ["stats", df ?? "", dt ?? "", ct, nd] as const,
  MARGIN_ALERTS:  (df: string | null, dt: string | null, ct: string) =>
    ["margin-alerts", df ?? "", dt ?? "", ct] as const,
  VENTES_SANS_ACHAT: (df: string | null, dt: string | null, ct: string) =>
    ["ventes-sans-achat", df ?? "", dt ?? "", ct] as const,
  STOCK_SUMMARY:  ["stock-summary"] as const,

  // Rapport — admin endpoints.
  ADMIN_STATS:        ["admin-stats"] as const,
  ADMIN_PHARMACIES:   ["admin-pharmacies"] as const,
  ADMIN_PHARM_STATS:  (id: number, df: string | null, dt: string | null, ct: string, nd: boolean) =>
    ["admin-pharm-stats", id, df ?? "", dt ?? "", ct, nd] as const,
  ADMIN_PHARM_MARGE:  (id: number, df: string | null, dt: string | null, ct: string) =>
    ["admin-pharm-marge", id, df ?? "", dt ?? "", ct] as const,
  ADMIN_PHARM_STOCK:  (id: number) =>
    ["admin-pharm-stock", id] as const,
  ADMIN_PHARM_ANALYSE: (id: number, mode: string, df: string | null, dt: string | null, ct: string) =>
    ["admin-pharm-analyse", id, mode, df ?? "", dt ?? "", ct] as const,

  // Admin /admin/categories — global category-suffix mappings
  CATEGORY_SUFFIXES:  ["category-suffixes"] as const,

  // Analyse de marge (Page 11) — 7 group-by modes + Liste CSV upload.
  // Cache slot per (mode, window, categoryType). Liste keyed on items hash.
  ANALYSE_MARGE: (mode: MargeMode, df: string | null, dt: string | null, ct: string, product?: string | null) =>
    ["analyse-marge", mode, df ?? "", dt ?? "", ct, product ?? ""] as const,
  ANALYSE_LISTE: (itemsKey: string, df: string | null, dt: string | null, ct: string) =>
    ["analyse-liste", itemsKey, df ?? "", dt ?? "", ct] as const,

  // Admin catalog (F5) — Medicament CRUD + categories list.
  CATALOG:             (f: CatalogFilters) => ["catalog", f] as const,
  CATALOG_PREFIX:      ["catalog"] as const,                 // invalidation prefix
  CATALOG_CATEGORIES:  ["catalog-categories"] as const,

  // Produits spéciaux (F17) — owner-managed product exclusions + autocomplete.
  SPECIAL_PRODUCTS:        ["special-products"] as const,
  MEDICAMENT_SUGGESTIONS:  (q: string) => ["medicament-suggestions", q] as const,

  // BL exclusions (PG-007) — owner-managed delivery-note exclusions + search.
  BL_EXCLUSIONS:           ["bl-exclusions"] as const,
  BL_SEARCH:               (q: string) => ["bl-search", q] as const,
  BL_SEARCH_PREFIX:        ["bl-search"] as const,
  BL_DETAIL:               (ref: string) => ["bl-detail", ref] as const,

  // Supplier (fournisseur) exclusions — owner-managed, achats-side + search.
  SUPPLIER_EXCLUSIONS:     ["supplier-exclusions"] as const,
  SUPPLIER_SEARCH:         (q: string) => ["supplier-search", q] as const,
  SUPPLIER_SEARCH_PREFIX:  ["supplier-search"] as const,

  // Comptabilité — payment entries per (month, method).
  PAYMENTS:                (month?: string) => ["payments", month ?? null] as const,
  PAYMENTS_PREFIX:         ["payments"] as const,

  // Aggregate prefixes — used by produits-spéciaux to invalidate every cache
  // that filters via non_declared_sub when an exclusion is added/removed.
  STATS_PREFIX:           ["stats"] as const,
  MARGIN_ALERTS_PREFIX:   ["margin-alerts"] as const,
  VENTES_SANS_ACHAT_PREFIX: ["ventes-sans-achat"] as const,
  ANALYSE_MARGE_PREFIX:   ["analyse-marge"] as const,
  STOCK_ABCD_FULL_PREFIX: ["stock-abcd-full"] as const,
  STOCK_ABCD_FILTERED_PREFIX: ["stock-abcd-filtered"] as const,
  VENTES_PREFIX:          ["ventes"] as const,
  ACHATS_PREFIX:          ["achats"] as const,

  // Admin — pharmacy detail (starts with ADMIN_PHARMACIES: invalidating the list
  // refreshes every detail too), every account, catalogue badge, developers.
  ADMIN_PHARMACY:          (id: number) => ["admin-pharmacies", id] as const,
  ADMIN_USERS:             ["admin-users"] as const,
  UNCLASSIFIED_COUNT:      ["admin-catalog-unclassified-count"] as const,
  ADMIN_DEVELOPERS:        ["admin", "developers"] as const,

  // Owner — my team.
  OWNER_EMPLOYEES:         ["owner-employees"] as const,

  // Store website (hidden).
  STORE_REQUESTS:          ["store-website", "requests", "list"] as const,
  STORE_MY_REQUEST:        ["store-website", "my-request"] as const,
  STORE_REQUEST:           (id: string) => ["store-website", "request", id] as const,
  STORE_PREVIEW:           (id: string | null) => ["public-preview", id] as const,
} as const;

export * from "./auth";
export * from "./stats";
export * from "./catalog";
export * from "./imports";
export * from "./accounting";
export * from "./transactions";
export * from "./exclusions";
export * from "./members";
export * from "./storeWebsite";
