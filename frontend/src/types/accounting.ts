/** Comptabilité payment entries (mirrors backend/app/accounting/payments/schemas.py). */

// ── Comptabilité — manual monthly payment-method entries (Page 5) ──────────

export const PAYMENT_METHODS = ["tpe", "especes", "cheques", "virement"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface PaymentEntryIn {
  month: string; // "YYYY-MM"
  method: PaymentMethod;
  pharmacie_amount: number;
  parapharmacie_amount: number;
  count: number;
}

export interface PaymentEntry extends PaymentEntryIn {
  id: number;
}

/** « Clôture de caisse » (mirrors backend/app/accounting/closings/schemas.py), fetched by the Sobrus robot. */
export interface ClosingMethod {
  /** Sobrus code: cash | check | debit_card | bill_of_exchange | credit | other | wire_transfer. */
  code: string;
  /** Sobrus' own name, shown when the code has no translation. */
  label: string;
  cash_sales: number;
  settlements: number;
  advances: number;
  expenses: number;
  other: number;
}

export interface ClosingCustomer {
  name: string;
  credit: number;
  balance: number;
}

export interface ClosingDay {
  day: string;
  invoices: number;
  total: number;
  paid: number;
  unpaid: number;
  discount: number;
  cash_sales: number;
  credit_sales: number;
  unpaid_credit: number;
  returns: number;
  net: number;
  gross_total: number;
  methods: ClosingMethod[];
  customers: ClosingCustomer[];
}

/** One Sobrus « Retour client » (avoir, « RV-7162 »); `refund` = how the money went back (« Restituer en argent »). */
export interface SalesReturn {
  id: number;
  number: string;
  day: string;
  customer: string | null;
  refund: string | null;
  status: string | null;
  amount: number;
  products: { name: string; quantity: number; unit_price: number }[];
}

export interface SalesReturnMonth {
  returns: SalesReturn[];
  count: number;
  total: number;
  connected: boolean;
  /** Its account may not read the returns (only the owner's Sobrus login can). */
  no_access: boolean;
  last_fetched_at: string | null;
}

export interface ClosingMonth {
  days: ClosingDay[];
  totals: { invoices: number; total: number; paid: number; credit_sales: number; returns: number; net: number };
  /** A Sobrus connection exists. */
  connected: boolean;
  /** Its account may not read the report (only the owner's Sobrus login can). */
  no_access: boolean;
  last_fetched_at: string | null;
}
