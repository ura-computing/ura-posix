import { API_URL, ENDPOINTS, TOKEN_KEY } from "@/constants";
import type { AuthToken, LoginPayload, Pharmacy, ProfileUpdatePayload, RegisterPayload, User, UserAdmin, UserRole } from "@/types";

function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

async function uploadFile<T>(path: string, file: File): Promise<T> {
  const token = getToken();
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Upload failed");
  }
  return res.json() as Promise<T>;
}

export type PharmacyPublic = { id: number; name: string };
export type CategorySuffixOut = { id: number; category: string; suffix: string; color?: string | null };
export type CatalogRequestOut = {
  id: number;
  requested_by: number;
  pharmacy_id: number | null;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
  product: string;
  tva: string | null;
  pph: number | null;
  ppv: number | null;
  category: string | null;
  zone: string | null;
  barcode1: string | null;
  laboratoire: string | null;
  created_at: string | null;
  reviewed_at: string | null;
  requester_name: string | null;
  requester_email: string | null;
  pharmacy_name: string | null;
};

export type StatsKpis = {
  ventes_total: number;
  achats_total: number;
  ventes_count: number;
  achats_count: number;
};
export type MonthlyTrend = { month: string; ventes: number; achats: number };
export type TopCategory = { category: string; total: number };

export type AdvancedKpis = {
  ticket_moyen: number;
  vente_moyenne_par_jour: number;
  best_day_dh:     { date: string; total: number } | null;
  worst_day_dh:    { date: string; total: number } | null;
  best_day_count:  { date: string; count: number } | null;
  worst_day_count: { date: string; count: number } | null;
};
export type TvaStats = {
  tva_encaissee: number;
  tva_payee: number;
  tva_a_declarer: number;
};
export type MargeStats = {
  marge_pct: number;
  marge_brute_dh: number;
  marge_nette_dh: number;
};
export type TypeBreakdown = {
  pharmacie:     { ventes_total: number };
  parapharmacie: { ventes_total: number };
};

export type StatsResponse = {
  kpis: StatsKpis;
  advanced_kpis: AdvancedKpis;
  tva: TvaStats;
  marge: MargeStats;
  type_breakdown: TypeBreakdown;
  monthly_trend: MonthlyTrend[];
  top_categories: TopCategory[];
};
export type AdminStats = {
  total_pharmacies: number;
  total_active_users: number;
  total_catalog_items: number;
  pending_catalog_requests: number;
};

export type AdminAnalytics = {
  users_by_role: { owner: number; employee: number; admin: number };
  users_by_status: { active: number; pending: number; rejected: number };
  monthly_registrations: { month: string; count: number }[];
};

export type MedicamentOut = {
  id: number;
  pid: string;
  product: string;
  tva: string | null;
  pph: number | null;
  ppv: number | null;
  category: string | null;
  zone: string | null;
  barcode1: string | null;
  barcode2: string | null;
  laboratoire: string | null;
  product_type: "pharmacie" | "parapharmacie" | null;
};

export const api = {
  auth: {
    login: (payload: LoginPayload) =>
      request<AuthToken>(ENDPOINTS.auth.login, { method: "POST", body: JSON.stringify(payload) }),

    register: (payload: RegisterPayload) =>
      request<AuthToken>(ENDPOINTS.auth.register, { method: "POST", body: JSON.stringify(payload) }),

    me: () => request<User>(ENDPOINTS.auth.me),

    updateMe: (payload: ProfileUpdatePayload) =>
      request<User>(ENDPOINTS.auth.me, { method: "PUT", body: JSON.stringify(payload) }),
  },

  uploads: {
    achat: (file: File) => uploadFile<{ inserted: number }>(ENDPOINTS.uploads.achat, file),
    vente: (file: File) => uploadFile<{ inserted: number }>(ENDPOINTS.uploads.vente, file),
    achatJson: (rows: Record<string, string>[]) =>
      request<{ inserted: number; skipped: number }>(ENDPOINTS.uploads.achatJson, {
        method: "POST",
        body: JSON.stringify({ rows }),
      }),
    venteJson: (rows: Record<string, string>[]) =>
      request<{ inserted: number; skipped: number }>(ENDPOINTS.uploads.venteJson, {
        method: "POST",
        body: JSON.stringify({ rows }),
      }),
  },

  tables: {
    achatCategories: () => request<string[]>(ENDPOINTS.achat.categories),
    venteCategories: () => request<string[]>(ENDPOINTS.ventes.categories),
    achatTvaRates: () => request<string[]>(ENDPOINTS.achat.tvaRates),
    venteTvaRates: () => request<string[]>(ENDPOINTS.ventes.tvaRates),
    exportAchat: (search: string, categories: string[], dateFrom?: string, dateTo?: string, tva?: string[]) => {
      const p = new URLSearchParams({ export: "true" });
      if (search) p.set("search", search);
      categories.forEach((cat) => p.append("category", cat));
      if (dateFrom) p.set("date_from", dateFrom);
      if (dateTo) p.set("date_to", dateTo);
      tva?.forEach((t) => p.append("tva", t));
      return request<{ data: Record<string, unknown>[] }>(`${ENDPOINTS.achat.list}?${p}`);
    },
    exportVente: (search: string, categories: string[], dateFrom?: string, dateTo?: string, tva?: string[]) => {
      const p = new URLSearchParams({ export: "true" });
      if (search) p.set("search", search);
      categories.forEach((cat) => p.append("category", cat));
      if (dateFrom) p.set("date_from", dateFrom);
      if (dateTo) p.set("date_to", dateTo);
      tva?.forEach((t) => p.append("tva", t));
      return request<{ data: Record<string, unknown>[] }>(`${ENDPOINTS.ventes.list}?${p}`);
    },
    achatSuggestions: (q: string) =>
      request<{ products: string[]; suppliers: string[]; refs: string[] }>(`/achat/suggestions?q=${encodeURIComponent(q)}`),
    venteSuggestions: (q: string) =>
      request<{ products: string[]; clients: string[]; refs: string[] }>(`/ventes/suggestions?q=${encodeURIComponent(q)}`),
    getCategorySuffixes: () => request<CategorySuffixOut[]>("/category-suffixes"),
  },

  data: {
    clearAchats: (filters?: { categories?: string[]; dateFrom?: string; dateTo?: string }) => {
      const p = new URLSearchParams();
      filters?.categories?.forEach((c) => p.append("category", c));
      if (filters?.dateFrom) p.set("date_from", filters.dateFrom);
      if (filters?.dateTo) p.set("date_to", filters.dateTo);
      const qs = p.toString();
      return request<{ deleted: number }>(`${ENDPOINTS.data.achats}${qs ? `?${qs}` : ""}`, { method: "DELETE" });
    },
    clearVentes: (filters?: { categories?: string[]; dateFrom?: string; dateTo?: string }) => {
      const p = new URLSearchParams();
      filters?.categories?.forEach((c) => p.append("category", c));
      if (filters?.dateFrom) p.set("date_from", filters.dateFrom);
      if (filters?.dateTo) p.set("date_to", filters.dateTo);
      const qs = p.toString();
      return request<{ deleted: number }>(`${ENDPOINTS.data.ventes}${qs ? `?${qs}` : ""}`, { method: "DELETE" });
    },
  },

  admin: {
    listPharmacies: () => request<Pharmacy[]>(ENDPOINTS.admin.pharmacies),
    createPharmacy: (body: { name: string; address?: string; phone?: string; email?: string }) =>
      request<Pharmacy>(ENDPOINTS.admin.pharmacies, { method: "POST", body: JSON.stringify(body) }),
    updatePharmacy: (id: number, body: { name?: string; address?: string; phone?: string; email?: string }) =>
      request<Pharmacy>(`${ENDPOINTS.admin.pharmacies}/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    deletePharmacy: (id: number) =>
      request<{ deleted: boolean }>(`${ENDPOINTS.admin.pharmacies}/${id}`, { method: "DELETE" }),
    listUsers: (pharmacyId?: number) => {
      const qs = pharmacyId !== undefined ? `?pharmacy_id=${pharmacyId}` : "";
      return request<UserAdmin[]>(`${ENDPOINTS.admin.users}${qs}`);
    },
    listPendingOwners: () => request<UserAdmin[]>(`${ENDPOINTS.admin.users}/pending`),
    getNotifications: () => request<{
      pending_users: { id: number; name: string; email: string; pharmacy_name?: string; created_at?: string }[];
      pending_requests: { id: number; product: string; pharmacy_name?: string; created_at?: string }[];
    }>("/admin/notifications"),
    approveUser: (userId: number) =>
      request<UserAdmin>(`${ENDPOINTS.admin.users}/${userId}/approve`, { method: "PUT" }),
    rejectUser: (userId: number) =>
      request<UserAdmin>(`${ENDPOINTS.admin.users}/${userId}/reject`, { method: "PUT", body: JSON.stringify({}) }),
    revokeUser: (userId: number) =>
      request<UserAdmin>(`${ENDPOINTS.admin.users}/${userId}/revoke`, { method: "PUT" }),
    updateUserRole: (userId: number, role: UserRole) =>
      request<UserAdmin>(`${ENDPOINTS.admin.users}/${userId}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
    updateUserPharmacy: (userId: number, pharmacyId: number | null) =>
      request<UserAdmin>(`${ENDPOINTS.admin.users}/${userId}/pharmacy`, { method: "PUT", body: JSON.stringify({ pharmacy_id: pharmacyId }) }),
    // Catalog direct CRUD
    listCatalog: (search?: string, page = 1) => {
      const p = new URLSearchParams({ page: String(page) });
      if (search) p.set("search", search);
      return request<MedicamentOut[]>(`/admin/catalog?${p}`);
    },
    createMedicament: (body: Omit<MedicamentOut, "id">) =>
      request<MedicamentOut>("/admin/catalog", { method: "POST", body: JSON.stringify(body) }),
    updateMedicament: (id: number, body: Partial<MedicamentOut>) =>
      request<MedicamentOut>(`/admin/catalog/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    deleteMedicament: (id: number) =>
      request<{ deleted: boolean }>(`/admin/catalog/${id}`, { method: "DELETE" }),
    // Catalog CSV/XLSM import
    importCatalog: (file: File) => uploadFile<{ imported: number }>("/uploads/catalog", file),
    // Category suffixes
    listCatalogCategories: () => request<string[]>("/admin/catalog/categories"),
    listCategorySuffixes: () => request<CategorySuffixOut[]>("/admin/category-suffixes"),
    createCategorySuffix: (body: { category: string; suffix: string; color?: string | null }) =>
      request<CategorySuffixOut>("/admin/category-suffixes", { method: "POST", body: JSON.stringify(body) }),
    updateCategorySuffix: (id: number, body: { category?: string; suffix?: string; color?: string | null }) =>
      request<CategorySuffixOut>(`/admin/category-suffixes/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    deleteCategorySuffix: (id: number) =>
      request<{ deleted: boolean }>(`/admin/category-suffixes/${id}`, { method: "DELETE" }),
    getStats: () => request<AdminStats>("/admin/stats"),
    getAnalytics: () => request<AdminAnalytics>("/admin/analytics"),
    getPharmacyStats: (pharmacyId: number, dateFrom?: string, dateTo?: string) => {
      const p = new URLSearchParams();
      if (dateFrom) p.set("date_from", dateFrom);
      if (dateTo) p.set("date_to", dateTo);
      const qs = p.toString();
      return request<StatsResponse>(`/admin/pharmacy/${pharmacyId}/stats${qs ? `?${qs}` : ""}`);
    },
    exportCatalog: (search?: string) => {
      const p = new URLSearchParams({ export: "true" });
      if (search) p.set("search", search);
      return request<{ data: MedicamentOut[] }>(`/admin/catalog?${p}`);
    },
    updateUserPermissions: (userId: number, permissions: Record<string, boolean>) =>
      request<UserAdmin>(`${ENDPOINTS.admin.users}/${userId}/permissions`, { method: "PUT", body: JSON.stringify({ permissions }) }),
    // Catalog requests (admin side)
    listCatalogRequests: (status?: string) => {
      const qs = status ? `?status=${status}` : "";
      return request<CatalogRequestOut[]>(`/catalog-requests${qs}`);
    },
    approveCatalogRequest: (id: number) =>
      request<CatalogRequestOut>(`/catalog-requests/${id}/approve`, { method: "PUT" }),
    rejectCatalogRequest: (id: number, reason?: string) =>
      request<CatalogRequestOut>(`/catalog-requests/${id}/reject`, { method: "PUT", body: JSON.stringify({ reason }) }),
  },

  stats: {
    get: (dateFrom?: string, dateTo?: string) => {
      const p = new URLSearchParams();
      if (dateFrom) p.set("date_from", dateFrom);
      if (dateTo) p.set("date_to", dateTo);
      const qs = p.toString();
      return request<StatsResponse>(`/stats${qs ? `?${qs}` : ""}`);
    },
    exportExcel: (dateFrom?: string, dateTo?: string, categoryType: "all" | "pharmacie" | "parapharmacie" = "all"): Promise<Blob> => {
      const token = getToken();
      const p = new URLSearchParams({ category_type: categoryType });
      if (dateFrom) p.set("date_from", dateFrom);
      if (dateTo)   p.set("date_to",   dateTo);
      return fetch(`${API_URL}/stats/export-excel?${p}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      }).then(r => { if (!r.ok) throw new Error("Export failed"); return r.blob(); });
    },
    exportExcelForPharmacy: (pharmacyId: number, dateFrom?: string, dateTo?: string, categoryType: "all" | "pharmacie" | "parapharmacie" = "all"): Promise<Blob> => {
      const token = getToken();
      const p = new URLSearchParams({ category_type: categoryType });
      if (dateFrom) p.set("date_from", dateFrom);
      if (dateTo)   p.set("date_to",   dateTo);
      return fetch(`${API_URL}/admin/pharmacy/${pharmacyId}/stats/export-excel?${p}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      }).then(r => { if (!r.ok) throw new Error("Export failed"); return r.blob(); });
    },
  },

  owner: {
    getNotifications: () => request<{
      pending_employees: { id: number; name: string; email: string; created_at?: string }[];
    }>("/owner/notifications"),
    listEmployees: () => request<UserAdmin[]>("/owner/employees"),
    approveEmployee: (id: number) =>
      request<UserAdmin>(`/owner/employees/${id}/approve`, { method: "PUT" }),
    rejectEmployee: (id: number) =>
      request<UserAdmin>(`/owner/employees/${id}/reject`, { method: "PUT" }),
    revokeEmployee: (id: number) =>
      request<UserAdmin>(`/owner/employees/${id}/revoke`, { method: "PUT" }),
    updateEmployeePermissions: (id: number, permissions: Record<string, boolean>) =>
      request<UserAdmin>(`/owner/employees/${id}/permissions`, { method: "PUT", body: JSON.stringify({ permissions }) }),
  },

  catalogRequests: {
    submit: (body: { product: string; tva?: string; pph?: number; ppv?: number; category?: string; zone?: string; barcode1?: string; laboratoire?: string }) =>
      request<CatalogRequestOut>("/catalog-requests", { method: "POST", body: JSON.stringify(body) }),
    list: (status?: string) => {
      const qs = status ? `?status=${status}` : "";
      return request<CatalogRequestOut[]>(`/catalog-requests${qs}`);
    },
  },

  public: {
    listPharmacies: () => {
      return fetch(`${API_URL}/public/pharmacies`)
        .then((r) => r.json()) as Promise<PharmacyPublic[]>;
    },
  },

  storeSession: (data: AuthToken) => {
    sessionStorage.setItem(TOKEN_KEY, data.access_token);
  },

  clearSession: () => {
    sessionStorage.removeItem(TOKEN_KEY);
  },
};
