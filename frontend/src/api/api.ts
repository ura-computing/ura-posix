/** Every backend call of the app, one entry per action, grouped like the backend `app/<area>/` folders.
 *
 *  - Read (GET):  `{ url, key }` — `key` = its TanStack Query cache slot. A key built
 *    from filters is a function, and `all` = the prefix of every slot of that read.
 *  - Write:       `{ url, refreshes }` — the reads it changes. After success call
 *    `refresh(qc, API.x.write)`: one call, nothing to forget.
 *  Same url with GET and POST = 2 entries, named by what they do (`list`, `exclude`).
 *  `url` is a function when it holds an id. Query strings go in `api.get(url, { params })`.
 *
 *    useQuery({ queryKey: API.ventes.list.key(filters), queryFn: () => api.get(API.ventes.list.url, { params: filters }) })
 *    api.post(API.specialProducts.exclude.url, body).then(() => refresh(qc, API.specialProducts.exclude))
 */
import type { QueryClient } from "@tanstack/react-query";

import type { CatalogFilters } from "@/types/catalog";
import type { DamageFilters } from "@/types/damaged";
import type { HistoryFilters } from "@/types/history";
import type { MovementsFilters, ProductsFilters } from "@/types/products";
import type { PromisFilters } from "@/types/promis";
import type { MargeMode, StockFilters } from "@/types/stats";
import type { SupplierFilters } from "@/types/suppliers";
import type { AchatsFilters, VentesFilters, VentesFiltersKey } from "@/types/transactions";

type Key = readonly unknown[];

/** A read as `refreshes` lists it: its `all` prefix if it has one, else its key. */
interface Read {
  key: Key | ((...args: never[]) => Key);
  all?: Key;
}

const p = (df: string | null, dt: string | null) => [df ?? "", dt ?? ""] as const;

// ── Reads the writes of several groups refresh ─────────────────────────────

/** Reads an import (or its undo) changes: achat → `achats`, vente → `ventes`,
 *  stock → `pharmacy_stock`. */
const afterImport = {
  achat: (): Read[] => [
    API.imports.list,
    ...achatsReads(),
    API.ventes.list,
    API.ventes.surveillance,
    API.stats.main,
    API.stats.marginAlerts,
    API.stats.ventesSansAchat,
    API.stats.analyseMarge,
    API.stats.stockAbcdFull,
    API.stats.stockAbcdFiltered,
    API.specialProducts.suggestions,
    API.products.list,
    API.products.sheet,
    API.products.stats,
    API.products.movements,
    API.products.history,
    API.history.list,
    ...blExclusionReads(),
    ...supplierExclusionReads(),
  ],
  vente: (): Read[] => [
    API.imports.list,
    ...ventesReads(),
    API.stats.main,
    API.stats.marginAlerts,
    API.stats.ventesSansAchat,
    API.stats.analyseMarge,
    API.stats.stockAbcdFull,
    API.stats.stockAbcdFiltered,
    API.stats.stockSummary,
    API.specialProducts.suggestions,
    API.products.list,
    API.products.sheet,
    API.products.stats,
    API.products.movements,
    API.products.history,
    API.history.list,
  ],
  stock: (): Read[] => [
    API.imports.list,
    API.stats.stockAbcdFull,
    API.stats.stockAbcdFiltered,
    API.stats.peremptions,
    API.stats.stockSummary,
    API.stats.analyseMarge,
    API.products.list,
    API.products.sheet,
    API.products.history,
    API.history.list,
  ],
};

/** An observation added / deleted: the window, the sheet's count, the list's icon. */
const notesReads = (): Read[] => [API.products.notes, API.products.sheet, API.products.list];

/** Reads an exclusion (product, BL, supplier) changes, besides its own list. */
const afterExclusion = (): Read[] => [
  API.stats.main,
  API.stats.marginAlerts,
  API.stats.analyseMarge,
  API.stats.stockSummary,
  API.stats.stockAbcdFull,
  API.stats.stockAbcdFiltered,
  API.ventes.list,
  API.achats.list,
];

const ventesReads = (): Read[] => [
  API.ventes.list,
  API.ventes.categories,
  API.ventes.tvaRates,
  API.ventes.surveillance,
  API.ventes.suggestions,
  API.ventes.discountSummary,
];
const achatsReads = (): Read[] => [
  API.achats.list,
  API.achats.categories,
  API.achats.tvaRates,
  API.achats.supplierSummary,
  API.achats.suggestions,
];
const blExclusionReads = (): Read[] => [
  API.blExclusions.list,
  API.blExclusions.search,
  API.blExclusions.detail,
  API.blLineExclusions.list,
];
const supplierExclusionReads = (): Read[] => [API.supplierExclusions.list, API.supplierExclusions.search];

export const API = {
  auth: {
    me: { url: "/auth/me", key: ["auth", "me"] },
    login: { url: "/auth/login" },
    logout: { url: "/auth/logout" },
    updateProfile: { url: "/auth/me", refreshes: (): Read[] => [API.auth.me] },
    // The backend ends every other session: the Sessions tab changes too.
    changePassword: {
      url: "/auth/change-password",
      refreshes: (): Read[] => [API.auth.me, API.sessions.list],
    },
    forgotPassword: { url: "/auth/forgot-password" },
    signup: { url: "/auth/signup" },
    validateToken: {
      url: "/auth/validate-token",
      key: (token: string) => ["auth", "validate-token", token] as const,
      all: ["auth", "validate-token"],
    },
    setPassword: { url: "/auth/set-password" },
    /** Lock screen: settings (« Mon compte »), lock this device (idle), unlock with the code. */
    lockSettings: { url: "/auth/me/lock", refreshes: (): Read[] => [API.auth.me] },
    lock: { url: "/auth/lock" },
    unlock: { url: "/auth/unlock" },
  },
  sessions: {
    list: {
      url: "/sessions",
      key: (userId: string) => ["sessions", "list", userId] as const,
      all: ["sessions", "list"],
    },
    end: {
      url: (id: string) => `/sessions/${id}`,
      refreshes: (): Read[] => [API.sessions.list],
    },
    endOthers: {
      url: "/sessions/revoke-others",
      refreshes: (): Read[] => [API.sessions.list],
    },
  },

  stats: {
    main: {
      url: "/stats",
      key: (df: string | null, dt: string | null, ct: string, nd: boolean) =>
        ["stats", "main", ...p(df, dt), ct, nd] as const,
      all: ["stats", "main"],
    },
    marginAlerts: {
      url: "/stats/margin-alerts",
      key: (df: string | null, dt: string | null, ct: string) => ["stats", "margin-alerts", ...p(df, dt), ct] as const,
      all: ["stats", "margin-alerts"],
    },
    ventesSansAchat: {
      url: "/stats/ventes-sans-achat",
      key: (df: string | null, dt: string | null, ct: string) =>
        ["stats", "ventes-sans-achat", ...p(df, dt), ct] as const,
      all: ["stats", "ventes-sans-achat"],
    },
    stockSummary: {
      url: "/stats/stock-summary",
      key: ["stats", "stock-summary"],
    },
    // Stock page, same url twice: "full" (class circles) + "filtered" (table).
    stockAbcdFull: {
      url: "/stats/stock-abcd",
      key: (df: string | null, dt: string | null) => ["stats", "stock-abcd-full", ...p(df, dt)] as const,
      all: ["stats", "stock-abcd-full"],
    },
    stockAbcdFiltered: {
      url: "/stats/stock-abcd",
      key: (f: StockFilters) => ["stats", "stock-abcd-filtered", f] as const,
      all: ["stats", "stock-abcd-filtered"],
    },
    peremptions: { url: "/stats/peremptions", key: ["stats", "peremptions"] },
    analyseMarge: {
      url: "/stats/analyse-marge",
      key: (mode: MargeMode, df: string | null, dt: string | null, ct: string, product?: string | null) =>
        ["stats", "analyse-marge", mode, ...p(df, dt), ct, product ?? ""] as const,
      all: ["stats", "analyse-marge"],
    },
    /** POST (the product list is the body), not cached. */
    analyseListe: { url: "/stats/analyse-liste" },
  },

  // Filter args are part of the key: each combo gets its own cache slot. Surveillance
  // counts drop sort / page; the discount gauge also drops surveillance.
  ventes: {
    list: {
      url: "/ventes",
      key: (f: VentesFilters) => ["ventes", "list", f] as const,
      all: ["ventes", "list"],
    },
    categories: { url: "/ventes/categories", key: ["ventes", "categories"] },
    tvaRates: { url: "/ventes/tva-rates", key: ["ventes", "tva-rates"] },
    surveillance: {
      url: "/ventes/surveillance-counts",
      key: (f: VentesFiltersKey) => ["ventes", "surveillance", f] as const,
      all: ["ventes", "surveillance"],
    },
    suggestions: {
      url: "/ventes/suggestions",
      key: (q: string) => ["ventes", "suggestions", q] as const,
      all: ["ventes", "suggestions"],
    },
    discountSummary: {
      url: "/ventes/discount-summary",
      key: (f: Omit<VentesFilters, "page" | "limit" | "sort_by" | "sort_order" | "surveillance">) =>
        ["ventes", "discount-summary", f] as const,
      all: ["ventes", "discount-summary"],
    },
  },
  achats: {
    list: {
      url: "/achats",
      key: (f: AchatsFilters) => ["achats", "list", f] as const,
      all: ["achats", "list"],
    },
    categories: { url: "/achats/categories", key: ["achats", "categories"] },
    tvaRates: { url: "/achats/tva-rates", key: ["achats", "tva-rates"] },
    supplierSummary: {
      url: "/achats/supplier-summary",
      key: (f: Omit<AchatsFilters, "page" | "limit" | "sort_by" | "sort_order">) =>
        ["achats", "supplier-summary", f] as const,
      all: ["achats", "supplier-summary"],
    },
    suggestions: {
      url: "/achats/suggestions",
      key: (q: string) => ["achats", "suggestions", q] as const,
      all: ["achats", "suggestions"],
    },
  },

  products: {
    list: {
      url: "/products",
      key: (f: ProductsFilters) => ["products", "list", f] as const,
      all: ["products", "list"],
    },
    sheet: {
      url: (id: number) => `/products/${id}`,
      key: (id: number) => ["products", "sheet", id] as const,
      all: ["products", "sheet"],
    },
    stats: {
      url: (id: number) => `/products/${id}/stats`,
      key: (id: number, from: string, to: string) => ["products", "stats", id, from, to] as const,
      all: ["products", "stats"],
    },
    /** « Scanner / Rechercher un code barre »: exact PID / barcode → the product's id (404 = none). */
    lookup: { url: "/products/lookup" },
    /** Owner's « Enregistrer » / « Revenir à la valeur importée ». */
    save: {
      url: (id: number) => `/products/${id}`,
      refreshes: (): Read[] => [
        API.products.list,
        API.products.sheet,
        API.products.history,
        API.history.list,
        API.stats.stockAbcdFull, // the owner's minimum / maximum show on the Stock page too
        API.stats.stockAbcdFiltered,
      ],
    },
    /** « Observations » of a product; add one, delete one (its author or the owner). */
    notes: {
      url: (id: number) => `/products/${id}/notes`,
      key: (id: number) => ["products", "notes", id] as const,
      all: ["products", "notes"],
    },
    addNote: {
      url: (id: number) => `/products/${id}/notes`,
      refreshes: (): Read[] => [notesReads(), API.products.history, API.history.list].flat(),
    },
    deleteNote: {
      url: (id: number, noteId: number) => `/products/${id}/notes/${noteId}`,
      refreshes: (): Read[] => [notesReads(), API.products.history, API.history.list].flat(),
    },
    /** Its « Historique » tab: its edits, observations, the imports that brought its lines. */
    history: {
      url: (id: number) => `/products/${id}/history`,
      key: (id: number, page: number) => ["products", "history", id, page] as const,
      all: ["products", "history"],
    },
    movements: {
      url: (id: number) => `/products/${id}/movements`,
      key: (id: number, f: MovementsFilters) => ["products", "movements", id, f] as const,
      all: ["products", "movements"],
    },
  },

  /** « Historique des modifications » (owner): every change of the pharmacy. */
  /** « Stock abîmé »: the page's list; « Déclarer des boîtes abîmées » (product sheet); a declaration's next state. */
  damaged: {
    list: {
      url: "/damaged",
      key: (f: DamageFilters) => ["damaged", "list", f] as const,
      all: ["damaged", "list"],
    },
    declare: {
      url: "/damaged",
      refreshes: (): Read[] => [API.damaged.list, API.products.sheet, API.products.history, API.history.list],
    },
    move: {
      url: (id: number) => `/damaged/${id}`,
      refreshes: (): Read[] => [API.damaged.list, API.products.sheet, API.products.history, API.history.list],
    },
  },
  /** « Promis »: the list; the wizard's customer + product searches; « Créer le promis ». */
  promis: {
    list: {
      url: "/promis",
      key: (f: PromisFilters) => ["promis", "list", f] as const,
      all: ["promis", "list"],
    },
    customers: {
      url: "/promis/customers",
      key: (search: string) => ["promis", "customers", search] as const,
      all: ["promis", "customers"],
    },
    products: {
      url: "/promis/products",
      key: (search: string) => ["promis", "products", search] as const,
      all: ["promis", "products"],
    },
    create: {
      url: "/promis",
      refreshes: (): Read[] => [API.promis.list, API.promis.customers],
    },
    sheet: {
      url: (id: number) => `/promis/${id}`,
      key: (id: number) => ["promis", "sheet", id] as const,
      all: ["promis", "sheet"],
    },
    /** One step (« Rendre prêt », « Retiré par le client »…): « Prêt » changes the products' free stock. */
    move: {
      url: (id: number) => `/promis/${id}/state`,
      refreshes: (): Read[] => [API.promis.list, API.promis.sheet, API.promis.products, API.products.sheet],
    },
  },
  history: {
    list: {
      url: "/history",
      key: (f: HistoryFilters) => ["history", "list", f] as const,
      all: ["history", "list"],
    },
  },
  /** « Connexion Sobrus » (owner): the robot imports the Sobrus achats + ventes. A run that ends
   *  refreshes what an achat + vente import refreshes (`afterImport`). */
  sobrus: {
    connection: { url: "/sobrus/connection", key: ["sobrus", "connection"] },
    save: {
      url: "/sobrus/connection",
      refreshes: (): Read[] => [API.sobrus.connection, API.sobrus.runs, API.history.list],
    },
    disconnect: {
      url: "/sobrus/connection",
      refreshes: (): Read[] => [API.sobrus.connection, API.sobrus.runs, API.history.list],
    },
    runs: { url: "/sobrus/runs", key: ["sobrus", "runs"] },
    startRun: { url: "/sobrus/runs", refreshes: (): Read[] => [API.sobrus.connection, API.sobrus.runs] },
    cancelRun: {
      url: (id: number) => `/sobrus/runs/${id}/cancel`,
      refreshes: (): Read[] => [API.sobrus.connection, API.sobrus.runs],
    },
    runEnded: {
      refreshes: (): Read[] => [API.sobrus.connection, API.sobrus.runs, ...afterImport.achat(), ...afterImport.vente()],
    },
  },

  uploads: {
    achat: { url: "/uploads/achat-json", refreshes: afterImport.achat },
    vente: { url: "/uploads/vente-json", refreshes: afterImport.vente },
    stock: { url: "/uploads/stock-json", refreshes: afterImport.stock },
    setBatchStatus: { url: (id: number) => `/uploads/batches/${id}` },
  },
  imports: {
    list: { url: "/data/imports", key: ["imports", "list"] },
    /** Same refreshes as the import of that type: `API.uploads[file_type]`. */
    undo: { url: (id: number) => `/data/imports/${id}` },
  },

  payments: {
    list: {
      url: "/accounting/payments",
      key: (month?: string) => ["payments", "list", month ?? null] as const,
      all: ["payments", "list"],
    },
    create: {
      url: "/accounting/payments",
      refreshes: (): Read[] => [API.payments.list],
    },
    remove: {
      url: (id: number) => `/accounting/payments/${id}`,
      refreshes: (): Read[] => [API.payments.list],
    },
  },

  /** « Clôture de caisse » (read-only, fetched by the Sobrus robot). */
  cashClosings: {
    list: {
      url: "/accounting/cash-closings",
      key: (month: string) => ["cash-closings", month] as const,
    },
  },
  /** Comptabilité « Retours clients (avoirs) » of one month (read-only, fetched by the Sobrus robot). */
  salesReturns: {
    list: {
      url: "/accounting/sales-returns",
      key: (month: string) => ["sales-returns", month] as const,
    },
  },

  specialProducts: {
    list: { url: "/special-products/", key: ["special-products", "list"] },
    suggestions: {
      url: "/special-products/suggestions",
      key: (q: string) => ["special-products", "suggestions", q] as const,
      all: ["special-products", "suggestions"],
    },
    // An excluded product is no longer suggested.
    exclude: {
      url: "/special-products/",
      refreshes: (): Read[] => [API.specialProducts.list, API.specialProducts.suggestions, ...afterExclusion()],
    },
    reintegrate: {
      url: "/special-products/reintegrate",
      refreshes: (): Read[] => [API.specialProducts.list, API.specialProducts.suggestions, ...afterExclusion()],
    },
    note: { url: "/special-products/note", refreshes: (): Read[] => [API.specialProducts.list] },
  },
  blExclusions: {
    list: { url: "/bl-exclusions/", key: ["bl-exclusions", "list"] },
    search: {
      url: "/bl-exclusions/search",
      key: (q: string) => ["bl-exclusions", "search", q] as const,
      all: ["bl-exclusions", "search"],
    },
    /** Every BL of one supplier (« BL par Fournisseur »): the same search with `supplier`. */
    ofSupplier: {
      url: "/bl-exclusions/search",
      key: (supplier: string) => ["bl-exclusions", "search", "supplier", supplier] as const,
    },
    detail: {
      url: "/bl-exclusions/detail",
      key: (ref: string) => ["bl-exclusions", "detail", ref] as const,
      all: ["bl-exclusions", "detail"],
    },
    exclude: {
      url: "/bl-exclusions/",
      refreshes: (): Read[] => [API.blExclusions.list, API.blExclusions.search, ...afterExclusion()],
    },
    reintegrate: {
      url: "/bl-exclusions/reintegrate",
      refreshes: (): Read[] => [API.blExclusions.list, API.blExclusions.search, ...afterExclusion()],
    },
    note: { url: "/bl-exclusions/note", refreshes: (): Read[] => [API.blExclusions.list] },
  },
  // « Exclure un produit d'un BL »: only those achat lines leave Comptabilité.
  blLineExclusions: {
    list: { url: "/bl-line-exclusions/", key: ["bl-line-exclusions", "list"] },
    exclude: {
      url: "/bl-line-exclusions/",
      refreshes: (): Read[] => [API.blLineExclusions.list, API.blExclusions.detail, ...afterExclusion()],
    },
    reintegrate: {
      url: "/bl-line-exclusions/reintegrate",
      refreshes: (): Read[] => [API.blLineExclusions.list, API.blExclusions.detail, ...afterExclusion()],
    },
    note: { url: "/bl-line-exclusions/note", refreshes: (): Read[] => [API.blLineExclusions.list] },
  },
  supplierExclusions: {
    list: {
      url: "/supplier-exclusions/",
      key: ["supplier-exclusions", "list"],
    },
    search: {
      url: "/supplier-exclusions/search",
      key: (q: string) => ["supplier-exclusions", "search", q] as const,
      all: ["supplier-exclusions", "search"],
    },
    exclude: {
      url: "/supplier-exclusions/",
      refreshes: (): Read[] => [API.supplierExclusions.list, API.supplierExclusions.search, ...afterExclusion()],
    },
    reintegrate: {
      url: "/supplier-exclusions/reintegrate",
      refreshes: (): Read[] => [API.supplierExclusions.list, API.supplierExclusions.search, ...afterExclusion()],
    },
    note: { url: "/supplier-exclusions/note", refreshes: (): Read[] => [API.supplierExclusions.list] },
  },
  categorySuffixes: {
    list: { url: "/category-suffixes", key: ["category-suffixes", "list"] },
    create: {
      url: "/category-suffixes",
      refreshes: (): Read[] => [API.categorySuffixes.list],
    },
    update: {
      url: (id: number) => `/category-suffixes/${id}`,
      refreshes: (): Read[] => [API.categorySuffixes.list],
    },
    remove: {
      url: (id: number) => `/category-suffixes/${id}`,
      refreshes: (): Read[] => [API.categorySuffixes.list],
    },
  },

  employees: {
    list: { url: "/owner/employees", key: ["employees", "list"] },
    create: {
      url: "/owner/employees",
      refreshes: (): Read[] => [API.employees.list],
    },
    setPermissions: {
      url: (id: number) => `/owner/employees/${id}/permissions`,
      refreshes: (): Read[] => [API.employees.list],
    },
    setStatus: {
      url: (id: number) => `/owner/employees/${id}/status`,
      refreshes: (): Read[] => [API.employees.list],
    },
    resetPassword: {
      url: (id: number) => `/owner/employees/${id}/reset-password`,
    },
    resetPin: {
      url: (id: number) => `/owner/employees/${id}/reset-pin`,
    },
    remove: {
      url: (id: number) => `/owner/employees/${id}`,
      refreshes: (): Read[] => [API.employees.list],
    },
  },

  admin: {
    stats: { url: "/admin/stats", key: ["admin", "stats"] },
    // `pharmacies` key = prefix of every `pharmacy` key: refreshing the list refreshes each detail too.
    pharmacies: { url: "/admin/pharmacies", key: ["admin", "pharmacies"] },
    pharmacy: {
      url: (id: number) => `/admin/pharmacies/${id}`,
      key: (id: number) => ["admin", "pharmacies", id] as const,
      all: ["admin", "pharmacies"],
    },
    createPharmacy: {
      url: "/admin/pharmacies",
      refreshes: (): Read[] => [API.admin.pharmacies],
    },
    updatePharmacy: {
      url: (id: number) => `/admin/pharmacies/${id}`,
      refreshes: (): Read[] => [API.admin.pharmacies],
    },
    archivePharmacy: {
      url: (id: number) => `/admin/pharmacies/${id}`,
      refreshes: (): Read[] => [API.admin.pharmacies, API.admin.users],
    },
    /** « Changer l'email Sobrus »: the pharmacy may connect another Sobrus account. */
    resetSobrusEmail: {
      url: (id: number) => `/admin/pharmacies/${id}/sobrus-email`,
      refreshes: (): Read[] => [API.admin.pharmacies],
    },
    setPharmacyFeatures: {
      url: (id: number) => `/admin/pharmacies/${id}/features`,
      refreshes: (): Read[] => [API.admin.pharmacies],
    },
    createUser: {
      url: (pharmacyId: number) => `/admin/pharmacies/${pharmacyId}/users`,
      refreshes: (): Read[] => [API.admin.pharmacies, API.admin.users],
    },
    pharmacyStats: {
      url: (id: number) => `/admin/pharmacy/${id}/stats`,
      key: (id: number, df: string | null, dt: string | null, ct: string, nd: boolean) =>
        ["admin", "pharmacy-stats", id, ...p(df, dt), ct, nd] as const,
      all: ["admin", "pharmacy-stats"],
    },
    pharmacyMarginAlerts: {
      url: (id: number) => `/admin/pharmacy/${id}/stats/margin-alerts`,
      key: (id: number, df: string | null, dt: string | null, ct: string) =>
        ["admin", "pharmacy-marge", id, ...p(df, dt), ct] as const,
      all: ["admin", "pharmacy-marge"],
    },
    pharmacyStock: {
      url: (id: number) => `/admin/pharmacy/${id}/stats/stock-summary`,
      key: (id: number) => ["admin", "pharmacy-stock", id] as const,
      all: ["admin", "pharmacy-stock"],
    },
    pharmacyAnalyse: {
      url: (id: number) => `/admin/pharmacy/${id}/stats/analyse-marge`,
      key: (id: number, mode: string, df: string | null, dt: string | null, ct: string) =>
        ["admin", "pharmacy-analyse", id, mode, ...p(df, dt), ct] as const,
      all: ["admin", "pharmacy-analyse"],
    },
    /** Catalogue « Importer les produits depuis Sobrus »: the last click's tries; start; « Arrêter ». */
    sobrusProducts: { url: "/admin/catalog/sobrus-products", key: ["admin", "sobrus-products", "last"] },
    /** « Gestion des imports » (admin), tab « Produits Sobrus »: every try, newest first. */
    sobrusProductsHistory: {
      url: "/admin/catalog/sobrus-products/history",
      key: ["admin", "sobrus-products", "history"],
    },
    startSobrusProducts: {
      url: "/admin/catalog/sobrus-products",
      refreshes: (): Read[] => [API.admin.sobrusProducts, API.admin.sobrusProductsHistory],
    },
    cancelSobrusProducts: {
      url: "/admin/catalog/sobrus-products/cancel",
      refreshes: (): Read[] => [API.admin.sobrusProducts, API.admin.sobrusProductsHistory],
    },
    /** « Fournisseurs » « Importer depuis Sobrus »: the last click's tries; start; « Arrêter ». */
    sobrusSuppliers: { url: "/admin/suppliers/sobrus", key: ["admin", "sobrus-suppliers", "last"] },
    startSobrusSuppliers: {
      url: "/admin/suppliers/sobrus",
      refreshes: (): Read[] => [API.admin.sobrusSuppliers],
    },
    cancelSobrusSuppliers: {
      url: "/admin/suppliers/sobrus/cancel",
      refreshes: (): Read[] => [API.admin.sobrusSuppliers],
    },
    /** « Fournisseurs »: the list shared by every pharmacy (one page, by name). */
    suppliers: {
      url: "/admin/suppliers",
      key: (f: SupplierFilters) => ["admin", "suppliers", f] as const,
      all: ["admin", "suppliers"],
    },
    /** A suppliers import ended (the corner card sees it on any page): the list reloads. */
    sobrusSuppliersEnded: { refreshes: (): Read[] => [API.admin.suppliers] },
    users: { url: "/admin/users", key: ["admin", "users"] },
    support: { url: "/admin/support", key: ["admin", "support"] },
    createSupport: { url: "/admin/support", refreshes: (): Read[] => [API.admin.support, API.admin.users] },
    signupRequests: { url: "/admin/signup-requests", key: ["admin", "signup-requests"] },
    // A new account (and maybe a new pharmacy): both admin lists change.
    acceptSignup: {
      url: (id: number) => `/admin/signup-requests/${id}/accept`,
      refreshes: (): Read[] => [API.admin.signupRequests, API.admin.pharmacies, API.admin.users],
    },
    refuseSignup: {
      url: (id: number) => `/admin/signup-requests/${id}/refuse`,
      refreshes: (): Read[] => [API.admin.signupRequests],
    },
    setUserPermissions: {
      url: (id: number) => `/admin/users/${id}/permissions`,
      refreshes: (): Read[] => [API.admin.pharmacy, API.admin.users],
    },
    setUserStatus: {
      url: (id: number) => `/admin/users/${id}/status`,
      refreshes: (): Read[] => [API.admin.pharmacy, API.admin.users, API.admin.support],
    },
    resetUserPassword: {
      url: (id: number) => `/admin/users/${id}/reset-password`,
    },
    resetUserPin: {
      url: (id: number) => `/admin/users/${id}/reset-pin`,
    },
    removeUser: {
      url: (id: number) => `/admin/users/${id}`,
      refreshes: (): Read[] => [API.admin.pharmacies, API.admin.users, API.admin.support],
    },
    // The account moves: both pharmacies' pages change.
    assignPharmacy: {
      url: (id: number) => `/admin/users/${id}/pharmacy`,
      refreshes: (): Read[] => [API.admin.pharmacies, API.admin.users],
    },
    catalog: {
      list: {
        url: "/admin/catalog",
        key: (f: CatalogFilters) => ["admin", "catalog", "list", f] as const,
        all: ["admin", "catalog", "list"],
      },
      categories: {
        url: "/admin/catalog/categories",
        key: ["admin", "catalog", "categories"],
      },
      /** Tiles on top of the Catalogue: every product, by type, the unclassified ones. */
      stats: { url: "/admin/catalog/stats", key: ["admin", "catalog", "stats"] },
      create: {
        url: "/admin/catalog",
        refreshes: (): Read[] => [
          API.admin.catalog.list,
          API.admin.catalog.categories,
          API.admin.catalog.stats,
          API.notifications.list, // the admin's and Support's « N produits à classer »
        ],
      },
      update: {
        url: (id: number) => `/admin/catalog/${id}`,
        refreshes: (): Read[] => [
          API.admin.catalog.list,
          API.admin.catalog.categories,
          API.admin.catalog.stats,
          API.notifications.list, // the admin's and Support's « N produits à classer »
        ],
      },
      remove: {
        url: (id: number) => `/admin/catalog/${id}`,
        refreshes: (): Read[] => [
          API.admin.catalog.list,
          API.admin.catalog.categories,
          API.admin.catalog.stats,
          API.notifications.list, // the admin's and Support's « N produits à classer »
        ],
      },
      importCsv: {
        url: "/uploads/catalog",
        refreshes: (): Read[] => [
          API.admin.catalog.list,
          API.admin.catalog.categories,
          API.admin.catalog.stats,
          API.notifications.list, // the admin's and Support's « N produits à classer »
        ],
      },
    },
  },

  // HIDDEN feature (« Ma boutique en ligne »): moved as-is, its pages refresh by themselves.
  // The bell of the top bar (every user, own lines only).
  notifications: {
    list: { url: "/notifications", key: ["notifications"] },
    readAll: { url: "/notifications/read-all", refreshes: (): Read[] => [API.notifications.list] },
    read: { url: (id: number) => `/notifications/${id}/read`, refreshes: (): Read[] => [API.notifications.list] },
  },
  storeWebsite: {
    myRequest: {
      url: "/store-website/my-request",
      key: ["store-website", "my-request"],
    },
    // The owner sends / edits the request (while « Envoyée »), then its logo.
    create: {
      url: "/store-website/requests",
      refreshes: (): Read[] => [API.storeWebsite.myRequest, API.storeWebsite.requests],
    },
    update: {
      url: (id: string) => `/store-website/requests/${id}`,
      refreshes: (): Read[] => [API.storeWebsite.myRequest, API.storeWebsite.requests],
    },
    myLogo: {
      url: "/store-website/my-request/logo",
      refreshes: (): Read[] => [API.storeWebsite.myRequest],
    },
    requests: {
      url: "/store-website/requests",
      key: ["store-website", "requests"],
    },
    request: {
      url: (id: string) => `/store-website/requests/${id}`,
      key: (id: string) => ["store-website", "request", id] as const,
      all: ["store-website", "request"],
    },
    // « Prendre en charge » / « Libérer » / next step: the queue and the request page change.
    claim: {
      url: (id: string) => `/store-website/requests/${id}/claim`,
      refreshes: (): Read[] => [API.storeWebsite.requests, API.storeWebsite.request, API.admin.support],
    },
    release: {
      url: (id: string) => `/store-website/requests/${id}/release`,
      refreshes: (): Read[] => [API.storeWebsite.requests, API.storeWebsite.request, API.admin.support],
    },
    state: {
      url: (id: string) => `/store-website/requests/${id}/state`,
      refreshes: (): Read[] => [API.storeWebsite.requests, API.storeWebsite.request, API.admin.support],
    },
    // The editor writes its answer into the request's cache itself (no refetch while typing).
    customization: {
      url: (id: string) => `/store-website/requests/${id}/customization`,
    },
    customizationReset: {
      url: (id: string) => `/store-website/requests/${id}/customization/reset`,
    },
    logo: { url: (id: string) => `/store-website/requests/${id}/logo` },
    // Support corrects the owner's request (name, WhatsApp, domain…).
    brief: {
      url: (id: string) => `/store-website/requests/${id}/brief`,
      refreshes: (): Read[] => [API.storeWebsite.request, API.storeWebsite.requests],
    },
    // « Télécharger le site »: a new secret key for the domain (shown once, it goes in the site's .env).
    siteKey: { url: (id: string) => `/store-website/requests/${id}/site-key` },
    // « Supprimer ma boutique » (owner): the store, its key, its settings; the request closes.
    deleteMyStore: {
      url: "/store-website/my-store",
      refreshes: (): Read[] => [API.storeWebsite.myRequest, API.storeWebsite.requests],
    },
    preview: {
      url: (id: string) => `/store-website/public/preview/${id}`,
      key: (id: string | null) => ["store-website", "preview", id] as const,
    },
    // The owner's settings (any time, the site live too): products shown / promo, categories, packs.
    myProducts: {
      url: "/store-website/my-store/products",
      key: (view: string, category: string | null, search: string, page: number) =>
        ["store-website", "my-products", view, category, search, page] as const,
      all: ["store-website", "my-products"],
    },
    setProduct: {
      url: (id: number) => `/store-website/my-store/products/${id}`,
      refreshes: (): Read[] => [API.storeWebsite.myProducts, API.storeWebsite.myCategories],
    },
    myCategories: { url: "/store-website/my-store/categories", key: ["store-website", "my-categories"] },
    setCategories: {
      url: "/store-website/my-store/categories",
      refreshes: (): Read[] => [API.storeWebsite.myCategories],
    },
    myPacks: { url: "/store-website/my-store/packs", key: ["store-website", "my-packs"] },
    createPack: { url: "/store-website/my-store/packs", refreshes: (): Read[] => [API.storeWebsite.myPacks] },
    updatePack: {
      url: (id: number) => `/store-website/my-store/packs/${id}`,
      refreshes: (): Read[] => [API.storeWebsite.myPacks],
    },
    removePack: {
      url: (id: number) => `/store-website/my-store/packs/${id}`,
      refreshes: (): Read[] => [API.storeWebsite.myPacks],
    },
    // The store's data (public, ONLY the request's pharmacy): home, catalogue page, one product.
    publicSummary: {
      url: (id: string) => `/store-website/public/${id}/summary`,
      key: (id: string) => ["store-website", "public-summary", id] as const,
    },
    publicProducts: {
      url: (id: string) => `/store-website/public/${id}/products`,
      key: (id: string, category: string | null, search: string, page: number) =>
        ["store-website", "public-products", id, category, search, page] as const,
    },
    publicProduct: {
      url: (id: string, productId: number) => `/store-website/public/${id}/products/${productId}`,
      key: (id: string, productId: number) => ["store-website", "public-product", id, productId] as const,
    },
  },
} as const;

/** After a write: refresh every read it lists (`write.refreshes`), in one pass. */
export function refresh(qc: QueryClient, write: { refreshes: () => readonly Read[] }): Promise<void> {
  const prefixes = write.refreshes().map((r) => r.all ?? (r.key as Key));
  return qc.invalidateQueries({
    predicate: (q) => prefixes.some((prefix) => prefix.every((part, i) => q.queryKey[i] === part)),
  });
}
