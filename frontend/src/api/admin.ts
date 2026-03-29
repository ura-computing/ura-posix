import { request, uploadFile } from "./client";
import { ENDPOINTS } from "@/constants";
import type { Pharmacy, UserAdmin, UserRole } from "@/types";
import type { StatsResponse } from "./stats";

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

export type CategorySuffixOut = {
  id: number;
  category: string;
  suffix: string;
  color?: string | null;
};

export type CatalogRequestOut = {
  id: number;
  requested_by: number;
  pharmacy_id: number | null;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
  request_type: "new_product" | "non_declare" | "annulation";
  medicament_id: number | null;
  medicament_name: string | null;
  notes: string | null;
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

export type AdminNotifications = {
  pending_users: { id: number; name: string; email: string; pharmacy_name?: string; created_at?: string }[];
  pending_requests: { id: number; product: string; pharmacy_name?: string; created_at?: string }[];
};

// ── Pharmacies ────────────────────────────────────────────────────────────────

export const listPharmacies = () => request<Pharmacy[]>(ENDPOINTS.admin.pharmacies);

export const createPharmacy = (body: { name: string; address?: string; phone?: string; email?: string }) =>
  request<Pharmacy>(ENDPOINTS.admin.pharmacies, { method: "POST", body: JSON.stringify(body) });

export const updatePharmacy = (id: number, body: { name?: string; address?: string; phone?: string; email?: string }) =>
  request<Pharmacy>(`${ENDPOINTS.admin.pharmacies}/${id}`, { method: "PUT", body: JSON.stringify(body) });

export const deletePharmacy = (id: number) =>
  request<{ deleted: boolean }>(`${ENDPOINTS.admin.pharmacies}/${id}`, { method: "DELETE" });

// ── Users ─────────────────────────────────────────────────────────────────────

export const listUsers = (pharmacyId?: number) => {
  const qs = pharmacyId !== undefined ? `?pharmacy_id=${pharmacyId}` : "";
  return request<UserAdmin[]>(`${ENDPOINTS.admin.users}${qs}`);
};

export const listPendingOwners = () => request<UserAdmin[]>(`${ENDPOINTS.admin.users}/pending`);

export const approveUser = (userId: number) =>
  request<UserAdmin>(`${ENDPOINTS.admin.users}/${userId}/approve`, { method: "PUT" });

export const rejectUser = (userId: number) =>
  request<UserAdmin>(`${ENDPOINTS.admin.users}/${userId}/reject`, { method: "PUT", body: JSON.stringify({}) });

export const revokeUser = (userId: number) =>
  request<UserAdmin>(`${ENDPOINTS.admin.users}/${userId}/revoke`, { method: "PUT" });

export const updateUserRole = (userId: number, role: UserRole) =>
  request<UserAdmin>(`${ENDPOINTS.admin.users}/${userId}/role`, { method: "PUT", body: JSON.stringify({ role }) });

export const updateUserPharmacy = (userId: number, pharmacyId: number | null) =>
  request<UserAdmin>(`${ENDPOINTS.admin.users}/${userId}/pharmacy`, { method: "PUT", body: JSON.stringify({ pharmacy_id: pharmacyId }) });

export const updateUserPermissions = (userId: number, permissions: Record<string, boolean>) =>
  request<UserAdmin>(`${ENDPOINTS.admin.users}/${userId}/permissions`, { method: "PUT", body: JSON.stringify({ permissions }) });

export const getNotifications = () => request<AdminNotifications>("/admin/notifications");

export const getStats = () => request<AdminStats>("/admin/stats");
export const getAnalytics = () => request<AdminAnalytics>("/admin/analytics");

export const getPharmacyStats = (pharmacyId: number, dateFrom?: string, dateTo?: string) => {
  const p = new URLSearchParams();
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  const qs = p.toString();
  return request<StatsResponse>(`/admin/pharmacy/${pharmacyId}/stats${qs ? `?${qs}` : ""}`);
};

// ── Catalog ───────────────────────────────────────────────────────────────────

export const listCatalog = (search?: string, page = 1, limit = 50) => {
  const p = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) p.set("search", search);
  return request<{ data: MedicamentOut[]; pagination: { total: number; current: number; pageSize: number } }>(`/admin/catalog?${p}`);
};

export const createMedicament = (body: Omit<MedicamentOut, "id">) =>
  request<MedicamentOut>("/admin/catalog", { method: "POST", body: JSON.stringify(body) });

export const updateMedicament = (id: number, body: Partial<MedicamentOut>) =>
  request<MedicamentOut>(`/admin/catalog/${id}`, { method: "PUT", body: JSON.stringify(body) });

export const deleteMedicament = (id: number) =>
  request<{ deleted: boolean }>(`/admin/catalog/${id}`, { method: "DELETE" });

export const importCatalog = (file: File) =>
  uploadFile<{ imported: number }>("/uploads/catalog", file);

export const exportCatalog = (search?: string) => {
  const p = new URLSearchParams({ export: "true" });
  if (search) p.set("search", search);
  return request<{ data: MedicamentOut[] }>(`/admin/catalog?${p}`);
};

export const listCatalogCategories = () => request<string[]>("/admin/catalog/categories");

// ── Category suffixes ─────────────────────────────────────────────────────────

export const listCategorySuffixes = () => request<CategorySuffixOut[]>("/admin/category-suffixes");

export const createCategorySuffix = (body: { category: string; suffix: string; color?: string | null }) =>
  request<CategorySuffixOut>("/admin/category-suffixes", { method: "POST", body: JSON.stringify(body) });

export const updateCategorySuffix = (id: number, body: { category?: string; suffix?: string; color?: string | null }) =>
  request<CategorySuffixOut>(`/admin/category-suffixes/${id}`, { method: "PUT", body: JSON.stringify(body) });

export const deleteCategorySuffix = (id: number) =>
  request<{ deleted: boolean }>(`/admin/category-suffixes/${id}`, { method: "DELETE" });

// ── Catalog requests ──────────────────────────────────────────────────────────

export const listCatalogRequests = (status?: string) => {
  const qs = status ? `?status=${status}` : "";
  return request<CatalogRequestOut[]>(`/catalog-requests${qs}`);
};

export const approveCatalogRequest = (id: number) =>
  request<CatalogRequestOut>(`/catalog-requests/${id}/approve`, { method: "PUT" });

export const rejectCatalogRequest = (id: number, reason?: string) =>
  request<CatalogRequestOut>(`/catalog-requests/${id}/reject`, { method: "PUT", body: JSON.stringify({ reason }) });
