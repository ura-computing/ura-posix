import { request } from "./client";

export type PaymentEntry = {
  id: number;
  month: string;
  method: string;
  pharmacie_amount: number;
  parapharmacie_amount: number;
  count: number;
};

export type PaymentEntryCreate = {
  month: string;
  method: string;
  pharmacie_amount: number;
  parapharmacie_amount: number;
  count: number;
};

export const listPayments = (month?: string) => {
  const qs = month ? `?month=${month}` : "";
  return request<PaymentEntry[]>(`/accounting/payments${qs}`);
};

export const savePayment = (body: PaymentEntryCreate) =>
  request<PaymentEntry>("/accounting/payments", { method: "POST", body: JSON.stringify(body) });

export const deletePayment = (id: number) =>
  request<{ deleted: boolean }>(`/accounting/payments/${id}`, { method: "DELETE" });
