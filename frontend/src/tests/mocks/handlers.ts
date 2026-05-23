import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000";

// ── Mock data ────────────────────────────────────────────────────────────────

const mockUser = {
  id: 1,
  email: "test@example.com",
  name: "Test User",
  phone: "+212600000000",
  pharmacy_name: "Pharmacie Test",
  profile_complete: true,
  role: "owner" as const,
  status: "active" as const,
  permissions: { rapports: true, import: true, achat: true, ventes: true, stock: false },
  pharmacy_id: 1,
};

const mockAuthToken = {
  access_token: "mock-jwt-token",
  token_type: "bearer",
  user: mockUser,
};

const mockPharmacy = {
  id: 1,
  name: "Pharmacie Test",
  address: "123 Rue Test",
  phone: "+212600000000",
  email: "pharma@test.com",
  options: { rapports: true, import: true, achat: true, ventes: true, stock: false },
  user_count: 2,
};

const mockUserAdmin = {
  ...mockUser,
  created_at: "2026-01-01T00:00:00Z",
};

const mockStatsResponse = {
  kpis: { ventes_total: 50000, achats_total: 30000, ventes_count: 100, achats_count: 80 },
  advanced_kpis: {
    ticket_moyen: 500,
    vente_moyenne_par_jour: 1666,
    best_day_dh: { date: "2026-03-01", total: 5000 },
    worst_day_dh: { date: "2026-03-02", total: 200 },
    best_day_count: { date: "2026-03-01", count: 20 },
    worst_day_count: { date: "2026-03-02", count: 2 },
  },
  tva: { tva_encaissee: 5000, tva_payee: 3000, tva_a_declarer: 2000 },
  marge: { marge_pct: 25, marge_brute_dh: 20000, marge_nette_dh: 15000 },
  type_breakdown: {
    pharmacie: { ventes_total: 40000 },
    parapharmacie: { ventes_total: 10000 },
  },
  monthly_trend: [{ month: "2026-01", ventes: 16000, achats: 10000 }],
  top_categories: [{ category: "Medicaments", total: 30000 }],
};

const mockAnalyseMargeResponse = {
  kpis: {
    total_ventes_dh: 50000,
    total_ventes_unites: 1000,
    marge_pct_avg: 25,
    marge_pct_min: { label: "Produit A", value: 5, qty: 10 },
    marge_pct_max: { label: "Produit B", value: 60, qty: 5 },
    marge_dh_avg: 15,
    marge_dh_min: { label: "Produit A", value: 2, qty: 10 },
    marge_dh_max: { label: "Produit C", value: 100, qty: 3 },
    difference_gain_dh: 5000,
  },
  rows: [{ product: "Produit A", marge_pct: 5 }],
};

const mockPaginatedAchats = {
  data: [{ id: 1, product: "Doliprane", quantity: 10, total: 100 }],
  pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
};

const mockPaginatedVentes = {
  data: [{ id: 1, product: "Doliprane", quantity: 5, total: 50 }],
  pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
};

const mockNonDeclaredProduct = {
  medicament_id: 1,
  product: "Produit Inconnu",
  category: null,
  ppv: 10,
  pph: 8,
  tva: "7",
};

const mockAdminStats = {
  total_pharmacies: 5,
  total_active_users: 12,
  total_catalog_items: 500,
  pending_catalog_requests: 3,
};

const mockAdminAnalytics = {
  users_by_role: { owner: 5, employee: 6, admin: 1 },
  users_by_status: { active: 10, pending: 1, rejected: 1 },
  monthly_registrations: [{ month: "2026-01", count: 3 }],
};

const mockNotifications = {
  pending_users: [{ id: 2, name: "New User", email: "new@test.com" }],
  pending_requests: [{ id: 1, product: "New Product" }],
};

const mockPharmacyPublic = [
  { id: 1, name: "Pharmacie Alpha" },
  { id: 2, name: "Pharmacie Beta" },
];

// ── Handlers ─────────────────────────────────────────────────────────────────

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/login`, () => HttpResponse.json(mockAuthToken)),
  http.post(`${BASE}/auth/signup`, () => HttpResponse.json(mockAuthToken)),
  http.get(`${BASE}/auth/me`, () => HttpResponse.json(mockUser)),
  http.put(`${BASE}/auth/me`, () => HttpResponse.json(mockUser)),
  http.post(`${BASE}/auth/forgot-password`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${BASE}/auth/forgot-password-whatsapp`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${BASE}/auth/verify-otp`, () => HttpResponse.json({ reset_token: "reset-tok-123" })),
  http.post(`${BASE}/auth/reset-password`, () => new HttpResponse(null, { status: 204 })),

  // Transactions — achats
  http.get(`${BASE}/achat`, () => HttpResponse.json(mockPaginatedAchats)),
  http.get(`${BASE}/achat/categories`, () => HttpResponse.json(["Cat A", "Cat B"])),
  http.get(`${BASE}/achat/tva-rates`, () => HttpResponse.json(["7", "20"])),
  http.get(`${BASE}/achat/suggestions`, () =>
    HttpResponse.json({ products: ["Doliprane"], suppliers: ["Sanofi"], refs: ["REF001"] }),
  ),

  // Transactions — ventes
  http.get(`${BASE}/ventes`, () => HttpResponse.json(mockPaginatedVentes)),
  http.get(`${BASE}/ventes/categories`, () => HttpResponse.json(["Cat X", "Cat Y"])),
  http.get(`${BASE}/ventes/tva-rates`, () => HttpResponse.json(["7", "20"])),
  http.get(`${BASE}/ventes/suggestions`, () =>
    HttpResponse.json({ products: ["Doliprane"], clients: ["Client A"], refs: ["REF002"] }),
  ),

  // Category suffixes (public)
  http.get(`${BASE}/category-suffixes`, () =>
    HttpResponse.json([{ id: 1, category: "Cat A", suffix: "CA", color: "#ff0000" }]),
  ),

  // Stats
  http.get(`${BASE}/stats`, () => HttpResponse.json(mockStatsResponse)),
  http.get(`${BASE}/stats/analyse-marge`, () => HttpResponse.json(mockAnalyseMargeResponse)),

  // Admin — pharmacies
  http.get(`${BASE}/admin/pharmacies`, () => HttpResponse.json([mockPharmacy])),
  http.post(`${BASE}/admin/pharmacies`, () => HttpResponse.json(mockPharmacy)),
  http.put(`${BASE}/admin/pharmacies/:id`, () => HttpResponse.json(mockPharmacy)),
  http.delete(`${BASE}/admin/pharmacies/:id`, () => HttpResponse.json({ deleted: true })),
  http.get(`${BASE}/admin/pharmacies/:id/options`, () =>
    HttpResponse.json({ rapports: true, import: true, achat: true, ventes: true, stock: false }),
  ),
  http.put(`${BASE}/admin/pharmacies/:id/options`, () =>
    HttpResponse.json({ rapports: true, import: true, achat: true, ventes: true, stock: false }),
  ),

  // Admin — users
  http.get(`${BASE}/admin/users`, () => HttpResponse.json([mockUserAdmin])),
  http.get(`${BASE}/admin/users/pending`, () => HttpResponse.json([mockUserAdmin])),
  http.put(`${BASE}/admin/users/:id/approve`, () => HttpResponse.json(mockUserAdmin)),
  http.put(`${BASE}/admin/users/:id/reject`, () => HttpResponse.json(mockUserAdmin)),
  http.put(`${BASE}/admin/users/:id/revoke`, () => HttpResponse.json(mockUserAdmin)),
  http.put(`${BASE}/admin/users/:id/role`, () => HttpResponse.json(mockUserAdmin)),
  http.put(`${BASE}/admin/users/:id/pharmacy`, () => HttpResponse.json(mockUserAdmin)),
  http.put(`${BASE}/admin/users/:id/permissions`, () => HttpResponse.json(mockUserAdmin)),

  // Admin — non-declared products
  http.get(`${BASE}/admin/pharmacy/:id/non-declared`, () => HttpResponse.json([mockNonDeclaredProduct])),

  // Admin — stats / analytics / notifications
  http.get(`${BASE}/admin/stats`, () => HttpResponse.json(mockAdminStats)),
  http.get(`${BASE}/admin/analytics`, () => HttpResponse.json(mockAdminAnalytics)),
  http.get(`${BASE}/admin/notifications`, () => HttpResponse.json(mockNotifications)),

  // Admin — pharmacy-level stats
  http.get(`${BASE}/admin/pharmacy/:id/stats`, () => HttpResponse.json(mockStatsResponse)),
  http.get(`${BASE}/admin/pharmacy/:id/stats/analyse-marge`, () =>
    HttpResponse.json(mockAnalyseMargeResponse),
  ),
  http.get(`${BASE}/admin/pharmacy/:id/stats/export-excel`, () =>
    new HttpResponse("excel-data", {
      status: 200,
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    }),
  ),
  http.get(`${BASE}/stats/export-excel`, () =>
    new HttpResponse("excel-data", {
      status: 200,
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    }),
  ),

  // Admin — catalog
  http.get(`${BASE}/admin/catalog`, () =>
    HttpResponse.json({
      data: [{ id: 1, pid: "PID001", product: "Doliprane", tva: "7", pph: 10, ppv: 15, category: "Cat A", zone: null, barcode1: null, barcode2: null, laboratoire: "Sanofi", product_type: "pharmacie" }],
      pagination: { total: 1, current: 1, pageSize: 50 },
    }),
  ),
  http.post(`${BASE}/admin/catalog`, () =>
    HttpResponse.json({ id: 2, pid: "PID002", product: "NewMed", tva: "20", pph: 5, ppv: 8, category: "Cat B", zone: null, barcode1: null, barcode2: null, laboratoire: null, product_type: null }),
  ),
  http.put(`${BASE}/admin/catalog/:id`, () =>
    HttpResponse.json({ id: 1, pid: "PID001", product: "Updated", tva: "7", pph: 10, ppv: 15, category: "Cat A", zone: null, barcode1: null, barcode2: null, laboratoire: "Sanofi", product_type: "pharmacie" }),
  ),
  http.delete(`${BASE}/admin/catalog/:id`, () => HttpResponse.json({ deleted: true })),
  http.get(`${BASE}/admin/catalog/categories`, () => HttpResponse.json(["Cat A", "Cat B"])),

  // Admin — category suffixes
  http.get(`${BASE}/admin/category-suffixes`, () =>
    HttpResponse.json([{ id: 1, category: "Cat A", suffix: "CA", color: "#ff0000" }]),
  ),
  http.post(`${BASE}/admin/category-suffixes`, () =>
    HttpResponse.json({ id: 2, category: "Cat B", suffix: "CB", color: null }),
  ),
  http.put(`${BASE}/admin/category-suffixes/:id`, () =>
    HttpResponse.json({ id: 1, category: "Cat A", suffix: "CA-updated", color: "#00ff00" }),
  ),
  http.delete(`${BASE}/admin/category-suffixes/:id`, () => HttpResponse.json({ deleted: true })),

  // Special products (current exclusions, read from PharmacyMedicamentStatus)
  http.get(`${BASE}/admin/non-declared`, () =>
    HttpResponse.json([{ pharmacy_id: 1, pharmacy_name: "Pharmacie Demo", medicament_id: 1, product: "New Drug", created_at: "2026-05-23T12:00:00Z" }]),
  ),
  http.get(`${BASE}/owner/special-products`, () =>
    HttpResponse.json([{ medicament_id: 1, product: "New Drug", category: null, created_at: "2026-05-23T12:00:00Z" }]),
  ),
  http.post(`${BASE}/catalog-requests/non-declare`, () =>
    HttpResponse.json({ id: 1, status: "approved", request_type: "non_declare", product: "New Drug" }),
  ),
  http.post(`${BASE}/catalog-requests/annulation`, () =>
    HttpResponse.json({ id: 1, status: "approved", request_type: "annulation", product: "New Drug" }),
  ),

  // Public
  http.get(`${BASE}/public/pharmacies`, () => HttpResponse.json(mockPharmacyPublic)),
];
