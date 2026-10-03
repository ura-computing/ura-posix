/** Comptabilité payment entries (mirrors backend/schemas/accounting.py). */

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
