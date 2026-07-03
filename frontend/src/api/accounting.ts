import { api } from "@/api/client";
import type { PaymentEntry, PaymentEntryIn } from "@/types";


/** List payment entries for the current pharmacy. Pass a YYYY-MM month
 *  string to scope to one bucket (the /comptabilité page loads the
 *  currently-displayed month this way). */
export function listPayments(month?: string): Promise<PaymentEntry[]> {
  return api<PaymentEntry[]>(`/accounting/payments${month ? `?month=${month}` : ""}`);
}

/** Upsert by (pharmacy_id, month, method) — POST always succeeds whether the
 *  (month, method) row exists or not. */
export function savePayment(body: PaymentEntryIn): Promise<PaymentEntry> {
  return api<PaymentEntry>(`/accounting/payments`, { method: "POST", body });
}

export function deletePayment(id: number): Promise<{ deleted: true }> {
  return api<{ deleted: true }>(`/accounting/payments/${id}`, { method: "DELETE" });
}
