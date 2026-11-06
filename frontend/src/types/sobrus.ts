/** « Connexion Sobrus » (mirrors backend/app/sobrus/schemas.py). The password is never sent back. */

/** `products`: the admin's « Produits Sobrus » (a pharmacy's Sobrus products into the catalogue). */
export type SobrusRunMode = "full" | "new" | "check" | "range" | "products";
export type SobrusRunStatus = "queued" | "running" | "success" | "error" | "cancelled";
export type SobrusConnectionStatus = "active" | "needs_login" | "invalid";

/** One step done by the robot: `sobrus.event.<code>` on the page. */
export interface SobrusEvent {
  at: string;
  code: string;
  kind?: "achat" | "vente" | "stock";
  year?: number;
  /** Lines added (year_done, period_done); stock_done = products updated; closing_done = days; products_done = added. */
  n?: number;
  /** products_done: known products whose empty fields were filled. */
  filled?: number;
  start?: string;
  end?: string;
  error?: string;
}

export interface SobrusRun {
  id: number;
  mode: SobrusRunMode;
  status: SobrusRunStatus;
  cancel_requested: boolean;
  /** Mode `range` only (YYYY-MM-DD). */
  date_from: string | null;
  date_to: string | null;
  /** What it does now: login | download | import | closing (« Clôture de caisse », month x / y) | products (page x). */
  phase: "login" | "download" | "import" | "closing" | "products" | null;
  kind: "achat" | "vente" | "stock" | null;
  year: number | null;
  bytes_received: number;
  chunk_current: number;
  chunk_total: number;
  lines_added: number;
  events: SobrusEvent[];
  error_code: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface SobrusConnection {
  connected: boolean;
  email: string | null;
  status: SobrusConnectionStatus | null;
  consent_at: string | null;
  last_success_at: string | null;
  last_error_code: string | null;
  active_run: SobrusRun | null;
}

/** `range` = « Importer une période »: the robot cuts it into years (Sobrus exports 1 year at most). */
export interface SobrusRunBody {
  mode: SobrusRunMode;
  date_from?: string;
  date_to?: string;
}

export interface SobrusConnectionBody {
  email?: string;
  password: string;
  consent?: boolean;
}

/** Admin Catalogue « Importer les produits depuis Sobrus » (GET /admin/catalog/sobrus-products): one owner's Sobrus
 *  account at a time, the next one if Sobrus refuses it. */
export interface AdminSobrusImport {
  /** Pharmacies with an active Sobrus connection. */
  connected: number;
  /** The last click's tries, oldest first (refused accounts, then the one that worked or still runs). */
  runs: { pharmacy_name: string; run: SobrusRun }[];
}
