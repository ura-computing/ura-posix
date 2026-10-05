// src/pages/stock/_constants.ts
// Shared, locked design constants for the Stock page.
import type { AbcdClass, StockRow } from "@/types";

/** ABCD class colours — LOCKED (pharmacist memory). Do not shift to tokens. */
export const ABCD_COLORS: Record<AbcdClass, string> = {
  A: "#16a34a",
  "A-": "#22c55e",
  "B+": "#3b82f6",
  B: "#60a5fa",
  C: "#f97316",
  "C-": "#fb923c",
  "C-N": "#fbbf24",
  D: "#ef4444",
};

export const ABCD_ORDER: AbcdClass[] = ["A", "A-", "B+", "B", "C", "C-", "C-N", "D"];

/** Letter size scales with label length so "C-N" still fits the 64px circle. */
export const abcdFontSize = (k: AbcdClass): number => (k.length >= 3 ? 12 : k.length === 2 ? 15 : 19);

/** Status filter options — values are EXACT backend strings ("" = no filter).
 *  Label = t(`stockStatus.<value>`) + the day range when there is one. */
export const STATUS_OPTIONS: { value: string; days?: string }[] = [
  { value: "" },
  { value: "sous-stock", days: "≤45" },
  { value: "ideal", days: "46-60" },
  { value: "a-surveiller", days: "61-99" },
  { value: "sur-stock", days: "≥100" },
  { value: "inconnu" },
  { value: "negatif" },
];

/** Status pill styling — low-opacity bg + readable text, light + dark. Label: t(`stockStatus.<status>`). */
export const STATUS_META: Record<StockRow["status"], { pill: string; dot: string }> = {
  "sous-stock": {
    pill: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
    dot: "bg-red-500",
  },
  ideal: {
    pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  "a-surveiller": {
    pill: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  "sur-stock": {
    pill: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  inconnu: {
    pill: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  negatif: {
    pill: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
    dot: "bg-red-600",
  },
};
