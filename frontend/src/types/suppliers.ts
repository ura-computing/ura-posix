/** « Fournisseurs » (admin, Support): the list shared by every pharmacy, filled from Sobrus. */

export type SupplierKind = "laboratoire" | "grossiste" | "societe";

export interface Supplier {
  id: number;
  name: string;
  kind: SupplierKind | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
}

export interface SupplierFilters {
  search: string;
  kind: SupplierKind | null;
  sort_by: "name" | "kind" | "city";
  sort_order: "asc" | "desc";
  page: number;
  limit: number;
}

export interface SupplierListResponse {
  data: Supplier[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}
