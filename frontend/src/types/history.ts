/** « Historique des modifications » (mirrors backend/app/history/schemas.py). */

/** backend `app/core/audit.py` AuditAction: the page shows `history.<action>`. */
export type AuditAction =
  | "import_done"
  | "import_cancelled"
  | "import_failed"
  | "import_deleted"
  | "product_edited"
  | "product_reverted"
  | "note_added"
  | "note_deleted";

export interface AuditRow {
  id: number;
  created_at: string;
  /** Who (name, else email; kept if the account is deleted); "" = unknown (old imports). */
  user_name: string;
  action: AuditAction;
  /** The action's values: file, field before → after, note text… */
  details: Record<string, string | number | null>;
  /** The product it is about (link to its page). */
  medicament_id: number | null;
  product: string | null;
  /** A product's tab, import line: that product's lines in the import (else null). */
  product_lines: number | null;
}

export interface HistoryResponse {
  data: AuditRow[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
  /** Everyone in the pharmacy's history (« Personne » filter). */
  people: string[];
}

export interface ProductHistoryResponse {
  data: AuditRow[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

export type HistoryKind = "all" | "imports" | "product" | "notes";

export interface HistoryFilters {
  page: number;
  limit: number;
  search: string;
  kind: HistoryKind;
  person: string | null;
  date_from: string | null;
  date_to: string | null;
  sort_by: string | null;
  sort_order: "asc" | "desc";
}
