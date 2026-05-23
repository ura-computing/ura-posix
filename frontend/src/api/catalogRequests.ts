import { request } from "./client";
import type { CatalogRequestOut } from "./admin";

export type PharmacyProductOut = {
  medicament_id: number;
  product: string;
  category: string | null;
  declared: boolean;
};

export type OwnerSpecialProduct = {
  medicament_id: number;
  product: string;
  category: string | null;
  created_at: string | null;
};

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

export const myExclusions = () =>
  request<OwnerSpecialProduct[]>("/owner/special-products");

export const myProducts = (search?: string) => {
  const p = new URLSearchParams();
  if (search) p.set("search", search);
  const qs = p.toString();
  return request<PharmacyProductOut[]>(`/stats/products${qs ? `?${qs}` : ""}`);
};
