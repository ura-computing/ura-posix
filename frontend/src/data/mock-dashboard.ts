/** Mock data for dashboard and rapports (API calls commented out per TODO) */

export const MOCK_KPIS = {
  salesToday: {
    amount: 331352.14,
    currency: "MAD",
    trend: { value: 12.5, direction: "up" as const, comparison: "vs hier" },
  },
  productPara: { value: 126, trend: { value: 8.2, direction: "up" as const, comparison: "vs hier" } },
  productPharma: { value: 25 },
  pharmaSpec: { value: 6, subtitle: "para sspec" },
};

export const MOCK_INVOICE_ROWS = [
  { id: "1", username: "Username", invoiceNumber: "f-31312-1", status: "new" as const, avatarColor: "bg-blue-400" },
  { id: "2", username: "Username", invoiceNumber: "Content", status: "new" as const, avatarColor: "bg-rose-400" },
  { id: "3", username: "Username", invoiceNumber: "Content", status: "new" as const, avatarColor: "bg-amber-400" },
  { id: "4", username: "Username", invoiceNumber: "Content", status: "new" as const, avatarColor: "bg-violet-400" },
];

export const MOCK_PAYMENT_METHODS = [
  { id: "1", name: "TPE Pharmacie", amount: 85420.5, percentage: 25.8, color: "#3b82f6" },
  { id: "2", name: "TPE Drugstore", amount: 131815.53, percentage: 39.8, color: "#8b5cf6" },
  { id: "3", name: "Espèces", amount: 78542.11, percentage: 23.7, color: "#10b981" },
  { id: "4", name: "Chèques", amount: 15420, percentage: 4.7, color: "#f59e0b" },
  { id: "5", name: "Virement", amount: 12854, percentage: 2.9, color: "#14b8a6" },
];

export function formatCurrency(amount: number, currency = "MAD"): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + " " + currency;
}
