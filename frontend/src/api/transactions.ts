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
  return qs;
}

export const listAchats = (p: TransactionFilters) =>
  request<PaginatedResult<Record<string, unknown>>>(`/achat?${buildTransactionQs(p)}`);

export const listVentes = (p: TransactionFilters) =>
  request<PaginatedResult<Record<string, unknown>>>(`/ventes?${buildTransactionQs(p)}`);

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
) => {
  const p = new URLSearchParams({ export: "true" });
  if (search) p.set("search", search);
  categories.forEach((c) => p.append("category", c));
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  tva?.forEach((t) => p.append("tva", t));
  return request<{ data: Record<string, unknown>[] }>(`${ENDPOINTS.ventes.list}?${p}`);
};

export const achatCategories = () => request<string[]>(ENDPOINTS.achat.categories);
export const venteCategories = () => request<string[]>(ENDPOINTS.ventes.categories);
export const achatTvaRates = () => request<string[]>(ENDPOINTS.achat.tvaRates);
export const venteTvaRates = () => request<string[]>(ENDPOINTS.ventes.tvaRates);

export const achatSuggestions = (q: string) =>
  request<{ products: string[]; suppliers: string[]; refs: string[] }>(
    `/achat/suggestions?q=${encodeURIComponent(q)}`,
  );

export const venteSuggestions = (q: string) =>
  request<{ products: string[]; clients: string[]; refs: string[] }>(
    `/ventes/suggestions?q=${encodeURIComponent(q)}`,
  );

export const getCategorySuffixes = () => request<CategorySuffixOut[]>("/category-suffixes");
