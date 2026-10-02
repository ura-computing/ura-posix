/** Every backend path (under `${VITE_BACKEND_URL}/v1`). Query strings go in
 *  `api.get(path, { params })`, never in the path. Grouped like backend/routers/. */
export const URLS = {
  auth: {
    login:          "/auth/login",
    logout:         "/auth/logout",
    me:             "/auth/me",
    forgotPassword: "/auth/forgot-password",
    validateToken:  "/auth/validate-token",
    setPassword:    "/auth/set-password",
    changePassword: "/auth/change-password",
  },
  sessions: {
    list:         "/sessions",
    one:          (id: string) => `/sessions/${id}`,
    revokeOthers: "/sessions/revoke-others",
  },

  stats: {
    main:            "/stats",
    marginAlerts:    "/stats/margin-alerts",
    ventesSansAchat: "/stats/ventes-sans-achat",
    stockSummary:    "/stats/stock-summary",
    stockAbcd:       "/stats/stock-abcd",
    peremptions:     "/stats/peremptions",
    analyseMarge:    "/stats/analyse-marge",
    analyseListe:    "/stats/analyse-liste",
  },
  ventes: {
    list:               "/ventes",
    categories:         "/ventes/categories",
    tvaRates:           "/ventes/tva-rates",
    surveillanceCounts: "/ventes/surveillance-counts",
    discountSummary:    "/ventes/discount-summary",
    suggestions:        "/ventes/suggestions",
  },
  achats: {
    list:            "/achats",
    categories:      "/achats/categories",
    tvaRates:        "/achats/tva-rates",
    suggestions:     "/achats/suggestions",
    supplierSummary: "/achats/supplier-summary",
  },

  uploads: {
    achat:   "/uploads/achat-json",
    vente:   "/uploads/vente-json",
    stock:   "/uploads/stock-json",
    catalog: "/uploads/catalog",
    batch:   (id: number) => `/uploads/batches/${id}`,
  },
  imports: {
    list: "/data/imports",
    one:  (id: number) => `/data/imports/${id}`,
  },

  payments: {
    list: "/accounting/payments",
    one:  (id: number) => `/accounting/payments/${id}`,
  },
  specialProducts: {
    list:        "/special-products/",
    reintegrate: "/special-products/reintegrate",
    suggestions: "/special-products/suggestions",
  },
  blExclusions: {
    list:        "/bl-exclusions/",
    search:      "/bl-exclusions/search",
    detail:      "/bl-exclusions/detail",
    reintegrate: "/bl-exclusions/reintegrate",
  },
  supplierExclusions: {
    list:        "/supplier-exclusions/",
    search:      "/supplier-exclusions/search",
    reintegrate: "/supplier-exclusions/reintegrate",
  },
  categorySuffixes: {
    list: "/category-suffixes",
    one:  (id: number) => `/category-suffixes/${id}`,
  },

  employees: {
    list:          "/owner/employees",
    one:           (id: number) => `/owner/employees/${id}`,
    permissions:   (id: number) => `/owner/employees/${id}/permissions`,
    status:        (id: number) => `/owner/employees/${id}/status`,
    resetPassword: (id: number) => `/owner/employees/${id}/reset-password`,
  },

  admin: {
    stats:      "/admin/stats",
    pharmacies: "/admin/pharmacies",
    pharmacy: {
      one:          (id: number) => `/admin/pharmacies/${id}`,
      features:     (id: number) => `/admin/pharmacies/${id}/features`,
      users:        (id: number) => `/admin/pharmacies/${id}/users`,
      stats:        (id: number) => `/admin/pharmacy/${id}/stats`,
      marginAlerts: (id: number) => `/admin/pharmacy/${id}/stats/margin-alerts`,
      stockSummary: (id: number) => `/admin/pharmacy/${id}/stats/stock-summary`,
      analyseMarge: (id: number) => `/admin/pharmacy/${id}/stats/analyse-marge`,
    },
    users: "/admin/users",
    user: {
      one:           (id: number) => `/admin/users/${id}`,
      permissions:   (id: number) => `/admin/users/${id}/permissions`,
      status:        (id: number) => `/admin/users/${id}/status`,
      resetPassword: (id: number) => `/admin/users/${id}/reset-password`,
      pharmacy:      (id: number) => `/admin/users/${id}/pharmacy`,
    },
    catalog: {
      list:              "/admin/catalog",
      one:               (id: number) => `/admin/catalog/${id}`,
      categories:        "/admin/catalog/categories",
      unclassifiedCount: "/admin/catalog/unclassified-count",
    },
  },

  storeWebsite: {
    myRequest:     "/store-website/my-request",
    requests:      "/store-website/requests",
    request: {
      one:                (id: string) => `/store-website/requests/${id}`,
      featuredCategories: (id: string) => `/store-website/requests/${id}/featured-categories`,
      claim:              (id: string) => `/store-website/requests/${id}/claim`,
      release:            (id: string) => `/store-website/requests/${id}/release`,
      state:              (id: string) => `/store-website/requests/${id}/state`,
      customization:      (id: string) => `/store-website/requests/${id}/customization`,
      customizationReset: (id: string) => `/store-website/requests/${id}/customization/reset`,
      logo:               (id: string) => `/store-website/requests/${id}/logo`,
    },
    publicPreview: (id: string) => `/store-website/public/preview/${id}`,
    developers:    "/store-website/admin/developers",
  },
} as const;
