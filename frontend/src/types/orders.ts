/** « Commandes du jour »: one draft per supplier (same names as `backend/app/orders/schemas.py`). */

export type OrderGroup = "urgent" | "restock" | "promis" | "check";

export interface OrderLine {
  id: number;
  medicament_id: number;
  pid: string;
  product: string;
  quantity: number;
  suggested: number;
  /** The person changed it (or added it): « Recalculer » keeps it. */
  edited: boolean;
  group: OrderGroup;
  for_shelf: number;
  for_promis: number;
  customers: string[];
  unit_price: number | null;
  discount_pct: number;
  net_total: number;
  /** The multiple required when the quantity does not respect it. */
  packaging: number | null;
}

export interface DailyOrder {
  id: number;
  /** null = supplier unknown (« À vérifier »). */
  supplier: { id: number; name: string } | null;
  lines: OrderLine[];
  gross_total: number;
  net_total: number;
  minimums: { basis: "units" | "mad" | "references"; required: number; current: number; reached: boolean }[];
  next_tiers: { basis: "units" | "mad"; more: number; pct: number }[];
  transport_missing: number;
  unverified_rules: number;
  created_at: string;
}

export interface DailyOrders {
  orders: DailyOrder[];
  counts: Partial<Record<OrderGroup, number>>;
}
