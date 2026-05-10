import { request } from "./client";
import { ENDPOINTS } from "@/constants";

export type TransactionFilters = {
  page: number;
  limit: number;
  search?: string;
  categories?: string[];
  tva?: string[];
  dateFrom?: string;
  dateTo?: string;
  surveillance?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  /** When false, non-declared ("produits spéciaux") rows are excluded. Backend defaults true. */
  includeNonDeclared?: boolean;
};

export type PaginatedResult<T> = {
  data: T[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
};

export type CategorySuffixOut = {
  id: number;
  category: string;
  suffix: string;
  color?: string | null;
};

function buildTransactionQs(p: TransactionFilters): URLSearchParams {
  const qs = new URLSearchParams({ page: String(p.page), limit: String(p.limit) });
  if (p.search) qs.set("search", p.search);
  p.categories?.forEach((c) => qs.append("category", c));
  p.tva?.forEach((t) => qs.append("tva", t));
  if (p.dateFrom) qs.set("date_from", p.dateFrom);
  if (p.dateTo) qs.set("date_to", p.dateTo);
  if (p.sortBy) qs.set("sort_by", p.sortBy);
  if (p.sortOrder) qs.set("sort_order", p.sortOrder);
  if (p.includeNonDeclared === false) qs.set("include_non_declared", "false");
  return qs;
}

export const listAchats = (p: TransactionFilters) =>
  request<PaginatedResult<Record<string, unknown>>>(`/achat?${buildTransactionQs(p)}`);

export const listVentes = (p: TransactionFilters) => {
  const qs = buildTransactionQs(p);
  if (p.surveillance) qs.set("surveillance", p.surveillance);
  return request<PaginatedResult<Record<string, unknown>>>(`/ventes?${qs}`);
};

export type SurveillanceCounts = { all: number; remises: number; remises_high: number; marge_negative: number; marge_low: number };

export const venteSurveillanceCounts = (dateFrom?: string, dateTo?: string, search?: string, categories?: string[], tva?: string[]) => {
  const p = new URLSearchParams();
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  if (search) p.set("search", search);
  categories?.forEach((c) => p.append("category", c));
  tva?.forEach((t) => p.append("tva", t));
  const qs = p.toString();
  return request<SurveillanceCounts>(`/ventes/surveillance-counts${qs ? `?${qs}` : ""}`);
};

export const exportAchat = (
  search: string,
  categories: string[],
  dateFrom?: string,
  dateTo?: string,
  tva?: string[],
) => {
  const p = new URLSearchParams({ export: "true" });
  if (search) p.set("search", search);
  categories.forEach((c) => p.append("category", c));
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  tva?.forEach((t) => p.append("tva", t));
  return request<{ data: Record<string, unknown>[] }>(`${ENDPOINTS.achat.list}?${p}`);
};

export const exportVente = (
  search: string,
  categories: string[],
  dateFrom?: string,
  dateTo?: string,
  tva?: string[],
  surveillance?: string,
) => {
  const p = new URLSearchParams({ export: "true" });
  if (search) p.set("search", search);
  categories.forEach((c) => p.append("category", c));
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  tva?.forEach((t) => p.append("tva", t));
  if (surveillance) p.set("surveillance", surveillance);
  return request<{ data: Record<string, unknown>[] }>(`${ENDPOINTS.ventes.list}?${p}`);
};

export const achatCategories = () => request<string[]>(ENDPOINTS.achat.categories);
export const venteCategories = () => request<string[]>(ENDPOINTS.ventes.categories);
export const achatTvaRates = () => request<string[]>(ENDPOINTS.achat.tvaRates);
export const venteTvaRates = () => request<string[]>(ENDPOINTS.ventes.tvaRates);

export type SupplierSummaryGroup = { total_mad: number; bl_count: number; unit_count: number };
export type SupplierSummaryResponse = { grossiste: SupplierSummaryGroup; direct_labo: SupplierSummaryGroup };

export const achatSupplierSummary = (dateFrom?: string, dateTo?: string, search?: string, categories?: string[], tva?: string[]) => {
  const p = new URLSearchParams();
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  if (search) p.set("search", search);
  if (categories?.length) categories.forEach((c) => p.append("category", c));
  if (tva?.length) tva.forEach((t) => p.append("tva", t));
  const qs = p.toString();
  return request<SupplierSummaryResponse>(`/achat/supplier-summary${qs ? `?${qs}` : ""}`);
};

export const achatSuggestions = (q: string) =>
  request<{ products: string[]; suppliers: string[]; refs: string[] }>(
    `/achat/suggestions?q=${encodeURIComponent(q)}`,
  );

export const venteSuggestions = (q: string) =>
  request<{ products: string[]; clients: string[]; refs: string[] }>(
    `/ventes/suggestions?q=${encodeURIComponent(q)}`,
  );

export const getCategorySuffixes = () => request<CategorySuffixOut[]>("/category-suffixes");
