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
export const abcdFontSize = (k: AbcdClass): number =>
  k.length >= 3 ? 12 : k.length === 2 ? 15 : 19;

/** Status filter <select> options — values are EXACT backend strings. "" = no filter. */
export const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Tous statuts" },
  { value: "sous-stock", label: "Sous-stock (≤45 j)" },
  { value: "ideal", label: "Idéal (46-60 j)" },
  { value: "a-surveiller", label: "À surveiller (61-99 j)" },
  { value: "sur-stock", label: "Sur-stock (≥100 j)" },
  { value: "inconnu", label: "Inconnu" },
  { value: "negatif", label: "Stock négatif" },
];

/** Status pill styling — low-opacity bg + readable text, light + dark. */
export const STATUS_META: Record<
  StockRow["status"],
  { label: string; pill: string; dot: string }
> = {
  "sous-stock": {
    label: "Sous-stock",
    pill: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
    dot: "bg-red-500",
  },
  ideal: {
    label: "Idéal",
    pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  "a-surveiller": {
    label: "À surveiller",
    pill: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  "sur-stock": {
    label: "Sur-stock",
    pill: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  inconnu: {
    label: "Inconnu",
    pill: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  negatif: {
    label: "Stock négatif",
    pill: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
    dot: "bg-red-600",
  },
};

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);
