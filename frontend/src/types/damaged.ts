/** « Stock abîmé »: boxes declared damaged, off PharmaGest's free stock until « Remis en vente ». */

export type DamageStatus = "pending" | "returned" | "destroyed" | "back_on_sale";

export interface Damage {
  id: number;
  medicament_id: number;
  pid: string;
  product: string;
  quantity: number;
  reason: string | null;
  note: string | null;
  status: DamageStatus;
  created_by_name: string;
  created_at: string;
  closed_at: string | null;
}

export interface DamageInput {
  medicament_id: number;
  quantity: number;
  reason: string | null;
  note: string | null;
}

export interface DamageFilters {
  search: string;
  status: DamageStatus | null;
  sort_by: string | null;
  sort_order: "asc" | "desc";
  page: number;
  limit: number;
}

export interface DamageListResponse {
  data: Damage[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
  /** Boxes of the filtered rows still off the free stock (not « Remis en vente »). */
  boxes_off: number;
}
