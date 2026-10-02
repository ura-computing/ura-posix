/** Every TanStack Query key. Grouped like URLS (api/urls.ts); key = [group, name, ...args].
 *  `QUERIES.ventes.all` refreshes every ventes query; `xxxAll` refreshes every
 *  filter combo of one query (e.g. `QUERIES.stats.mainAll`). */
import type {
  AchatsFilters, CatalogFilters, DocType, MargeMode, StockFilters, VentesFilters, VentesFiltersKey,
} from "@/types";


const p = (df: string | null, dt: string | null) => [df ?? "", dt ?? ""] as const;

export const QUERIES = {
  auth: {
    me:            ["auth", "me"],
    validateToken: (token: string) => ["auth", "validate-token", token] as const,
  },
  sessions: {
    list: (userId: string) => ["sessions", "list", userId] as const,
  },

  stats: {
    all:                  ["stats"],
    main:                 (df: string | null, dt: string | null, ct: string, nd: boolean) => ["stats", "main", ...p(df, dt), ct, nd] as const,
    mainAll:              ["stats", "main"],
    marginAlerts:         (df: string | null, dt: string | null, ct: string) => ["stats", "margin-alerts", ...p(df, dt), ct] as const,
    marginAlertsAll:      ["stats", "margin-alerts"],
    ventesSansAchat:      (df: string | null, dt: string | null, ct: string) => ["stats", "ventes-sans-achat", ...p(df, dt), ct] as const,
    ventesSansAchatAll:   ["stats", "ventes-sans-achat"],
    stockSummary:         ["stats", "stock-summary"],
    // Stock page: "full" (class circles) + "filtered" (table) per dual-fetch pattern.
    stockAbcdFull:        (df: string | null, dt: string | null) => ["stats", "stock-abcd-full", ...p(df, dt)] as const,
    stockAbcdFullAll:     ["stats", "stock-abcd-full"],
    stockAbcdFiltered:    (f: StockFilters) => ["stats", "stock-abcd-filtered", f] as const,
    stockAbcdFilteredAll: ["stats", "stock-abcd-filtered"],
    peremptions:          ["stats", "peremptions"],
    analyseMarge:         (mode: MargeMode, df: string | null, dt: string | null, ct: string, product?: string | null) =>
      ["stats", "analyse-marge", mode, ...p(df, dt), ct, product ?? ""] as const,
    analyseMargeAll:      ["stats", "analyse-marge"],
    analyseListe:         (itemsKey: string, df: string | null, dt: string | null, ct: string) =>
      ["stats", "analyse-liste", itemsKey, ...p(df, dt), ct] as const,
    analyseListeAll:      ["stats", "analyse-liste"],
  },
  // Filter args are part of the key: each combo gets its own cache slot. Surveillance
  // counts drop sort / page; the discount gauge also drops surveillance.
  ventes: {
    all:             ["ventes"],
    list:            (f: VentesFilters) => ["ventes", "list", f] as const,
    listAll:         ["ventes", "list"],
    categories:      ["ventes", "categories"],
    tvaRates:        ["ventes", "tva-rates"],
    surveillance:    (f: VentesFiltersKey) => ["ventes", "surveillance", f] as const,
    surveillanceAll: ["ventes", "surveillance"],
    suggestions:     (q: string) => ["ventes", "suggestions", q] as const,
    discountSummary: (f: Omit<VentesFilters, "page" | "limit" | "sort_by" | "sort_order" | "surveillance">) =>
      ["ventes", "discount-summary", f] as const,
  },
  achats: {
    all:             ["achats"],
    list:            (f: AchatsFilters) => ["achats", "list", f] as const,
    listAll:         ["achats", "list"],
    categories:      ["achats", "categories"],
    tvaRates:        ["achats", "tva-rates"],
    supplierSummary: (f: Omit<AchatsFilters, "page" | "limit" | "sort_by" | "sort_order">) =>
      ["achats", "supplier-summary", f] as const,
    suggestions:     (q: string) => ["achats", "suggestions", q] as const,
  },

  imports: {
    all:  ["imports"],
    list: ["imports", "list"],
  },
  payments: {
    all:  ["payments"],
    list: (month?: string) => ["payments", "list", month ?? null] as const,
  },

  specialProducts: {
    list:           ["special-products", "list"],
    suggestions:    (q: string) => ["special-products", "suggestions", q] as const,
    suggestionsAll: ["special-products", "suggestions"],
  },
  blExclusions: {
    all:       ["bl-exclusions"],
    list:      ["bl-exclusions", "list"],
    search:    (q: string) => ["bl-exclusions", "search", q] as const,
    searchAll: ["bl-exclusions", "search"],
    detail:    (ref: string) => ["bl-exclusions", "detail", ref] as const,
  },
  supplierExclusions: {
    all:       ["supplier-exclusions"],
    list:      ["supplier-exclusions", "list"],
    search:    (q: string) => ["supplier-exclusions", "search", q] as const,
    searchAll: ["supplier-exclusions", "search"],
  },
  categorySuffixes: {
    list: ["category-suffixes", "list"],
  },
  employees: {
    list: ["employees", "list"],
  },

  admin: {
    stats:      ["admin", "stats"],
    // Prefix of every `pharmacy(id)`: refreshing the list refreshes each detail too.
    pharmacies: ["admin", "pharmacies"],
    pharmacy:   (id: number) => ["admin", "pharmacies", id] as const,
    pharmacyStats:   (id: number, df: string | null, dt: string | null, ct: string, nd: boolean) =>
      ["admin", "pharmacy-stats", id, ...p(df, dt), ct, nd] as const,
    pharmacyMarge:   (id: number, df: string | null, dt: string | null, ct: string) =>
      ["admin", "pharmacy-marge", id, ...p(df, dt), ct] as const,
    pharmacyStock:   (id: number) => ["admin", "pharmacy-stock", id] as const,
    pharmacyAnalyse: (id: number, mode: string, df: string | null, dt: string | null, ct: string) =>
      ["admin", "pharmacy-analyse", id, mode, ...p(df, dt), ct] as const,
    users:      ["admin", "users"],
    developers: ["admin", "developers"],
    catalog: {
      list:              (f: CatalogFilters) => ["admin", "catalog", "list", f] as const,
      listAll:           ["admin", "catalog", "list"],
      categories:        ["admin", "catalog", "categories"],
      unclassifiedCount: ["admin", "catalog", "unclassified-count"],
    },
  },

  storeWebsite: {
    requests:  ["store-website", "requests"],
    myRequest: ["store-website", "my-request"],
    request:   (id: string) => ["store-website", "request", id] as const,
    preview:   (id: string | null) => ["store-website", "preview", id] as const,
  },
} as const;


/** Queries whose backend route reads the table an import (or its undo) changes:
 *  achat → `achats`, vente → `ventes`, stock → `pharmacy_stock`. */
const IMPORT_STALE: Record<DocType, readonly (readonly string[])[]> = {
  achat: [
    QUERIES.imports.all, QUERIES.achats.all, QUERIES.ventes.listAll, QUERIES.ventes.surveillanceAll,
    QUERIES.stats.mainAll, QUERIES.stats.marginAlertsAll, QUERIES.stats.ventesSansAchatAll,
    QUERIES.stats.analyseMargeAll, QUERIES.stats.analyseListeAll,
    QUERIES.stats.stockAbcdFullAll, QUERIES.stats.stockAbcdFilteredAll,
    QUERIES.specialProducts.suggestionsAll, QUERIES.blExclusions.all, QUERIES.supplierExclusions.all,
  ],
  vente: [
    QUERIES.imports.all, QUERIES.ventes.all,
    QUERIES.stats.mainAll, QUERIES.stats.marginAlertsAll, QUERIES.stats.ventesSansAchatAll,
    QUERIES.stats.analyseMargeAll, QUERIES.stats.analyseListeAll,
    QUERIES.stats.stockAbcdFullAll, QUERIES.stats.stockAbcdFilteredAll, QUERIES.stats.stockSummary,
    QUERIES.specialProducts.suggestionsAll,
  ],
  stock: [
    QUERIES.imports.all, QUERIES.stats.stockAbcdFullAll, QUERIES.stats.stockAbcdFilteredAll,
    QUERIES.stats.peremptions, QUERIES.stats.stockSummary,
    QUERIES.stats.analyseMargeAll, QUERIES.stats.analyseListeAll,
  ],
};

/** `qc.invalidateQueries({ predicate: changedByImport("vente") })` after an import / undo. */
export const changedByImport = (docType: DocType) => (q: { queryKey: readonly unknown[] }): boolean =>
  IMPORT_STALE[docType].some((prefix) => prefix.every((part, i) => q.queryKey[i] === part));
