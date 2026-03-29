import { request } from "./client";
import type { CatalogRequestOut } from "./admin";

export type PharmacyProductOut = {
  medicament_id: number;
  product: string;
  category: string | null;
  declared: boolean;
};

export const submit = (body: {
  product: string;
  tva?: string;
  pph?: number;
  ppv?: number;
  category?: string;
  zone?: string;
  barcode1?: string;
  laboratoire?: string;
}) => request<CatalogRequestOut>("/catalog-requests", { method: "POST", body: JSON.stringify(body) });

export const submitNonDeclare = (body: { medicament_id: number; notes?: string }) =>
  request<CatalogRequestOut>("/catalog-requests/non-declare", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const submitAnnulation = (body: { medicament_id: number; notes?: string }) =>
  request<CatalogRequestOut>("/catalog-requests/annulation", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const list = (status?: string) => {
  const qs = status ? `?status=${status}` : "";
  return request<CatalogRequestOut[]>(`/catalog-requests${qs}`);
};

export const myProducts = (search?: string) => {
  const p = new URLSearchParams();
  if (search) p.set("search", search);
  const qs = p.toString();
  return request<PharmacyProductOut[]>(`/stats/products${qs ? `?${qs}` : ""}`);
};
