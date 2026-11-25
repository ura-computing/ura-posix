/** « Promis »: products promised to a customer (same names as `backend/app/promis/schemas.py`). */

export type PromisState =
  | "created"
  | "to_order"
  | "ordered"
  | "received"
  | "incident"
  | "ready"
  | "picked_up"
  | "expired"
  | "returned"
  | "cancelled";

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  whatsapp_ok: boolean;
}

export interface PromisProduct {
  id: number;
  pid: string;
  product: string;
  price: number | null;
  /** « Remise comptoir » (%), 0 = none. */
  counter_discount: number;
  /** null = not in the pharmacy's stock. */
  free_stock: number | null;
}

export interface PromisLine {
  medicament_id: number | null;
  name: string;
  quantity: number;
}

export interface Promis {
  id: number;
  number: number;
  state: PromisState;
  customer_name: string;
  customer_phone: string | null;
  lines: PromisLine[];
  note: string | null;
  pickup_deadline: string | null;
  created_by_name: string;
  created_at: string;
}

export interface PromisInput {
  customer_id: number | null;
  customer: { name: string; phone: string | null; whatsapp_ok: boolean } | null;
  unreachable: boolean;
  note: string | null;
  lines: PromisLine[];
}

export interface PromisFilters {
  search: string;
  state: PromisState | null;
  deadline: PromisDeadline | null;
  sort_by: string | null;
  sort_order: "asc" | "desc";
  page: number;
  limit: number;
}

export interface PromisListResponse {
  data: Promis[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

export interface PromisSheetLine {
  id: number;
  medicament_id: number | null;
  pid: string | null;
  name: string;
  quantity: number;
  reserved_qty: number;
  shelf_place: string | null;
  /** PPV and counter discount (%) at creation. */
  unit_price: number | null;
  counter_discount: number;
  /** null = outside the catalogue or not in the pharmacy's stock. */
  free_stock: number | null;
}

export interface PromisEvent {
  from_state: PromisState | null;
  to_state: PromisState;
  actor_name: string;
  reason: string | null;
  at: string;
}

export interface PromisSheet {
  id: number;
  number: number;
  state: PromisState;
  customer: Customer;
  unreachable: boolean;
  note: string | null;
  ready_at: string | null;
  pickup_deadline: string | null;
  created_by_name: string;
  created_at: string;
  lines: PromisSheetLine[];
  /** Oldest first. */
  events: PromisEvent[];
  /** Where it may go now. */
  next: PromisState[];
  /** WhatsApp messages sent, oldest first. */
  messages: { kind: MessageKind; sent_by_name: string; sent_at: string }[];
  /** The message to send now. */
  message_due: MessageKind | null;
}

export type MessageKind = "created" | "ready" | "reminder" | "returned";

export type PromisTodoKind =
  "expired" | "last_day" | "msg_ready" | "msg_reminder" | "msg_returned" | "msg_created" | "received" | "to_order";

export interface PromisSummary {
  /** Per state (absent = 0). */
  counts: Partial<Record<PromisState, number>>;
  /** Most urgent first, 50 at most. */
  todo: { id: number; number: number; customer_name: string; todo: PromisTodoKind }[];
  /** « Prêt » whose last pickup day is within 7 days. */
  week: number;
}

export type PromisDeadline = "today" | "tomorrow" | "week" | "late";

export interface PromisMove {
  state: PromisState;
  reason: string | null;
  shelf_place: string | null;
}
