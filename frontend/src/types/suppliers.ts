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

export type OrderChannel = "phone" | "fax" | "email" | "whatsapp" | "edi" | "delegate";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEK: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** A supplier's sheet: every order field null = « inconnu » (orange). */
export interface SupplierSheet extends Supplier {
  contact_name: string | null;
  order_channel: OrderChannel | null;
  delivery_days: Weekday[] | null;
  /** « 11:00 »: order before, delivered next day. */
  cutoff_time: string | null;
  lead_time_days: number | null;
  payment_terms: string | null;
  /** MAD per order; free from `free_transport_from` MAD. */
  transport_fee: number | null;
  free_transport_from: number | null;
  note: string | null;
  archived_at: string | null;
}

/** PATCH /admin/suppliers/{id}: the fields sent (null = back to « inconnu »). */
export type SupplierEdit = Partial<Omit<SupplierSheet, "id" | "archived_at">> & { archived?: boolean };

export interface SupplierFilters {
  search: string;
  kind: SupplierKind | null;
  /** true = the archived ones only. */
  archived: boolean;
  sort_by: "name" | "kind" | "city";
  sort_order: "asc" | "desc";
  page: number;
  limit: number;
}

export interface SupplierListResponse {
  data: Supplier[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}
