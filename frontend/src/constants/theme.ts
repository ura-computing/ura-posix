import { eCategoryType } from "@/types";

/* ── Chart colors (match CSS vars in App.css) ────────────────────────────── */

export const CHART_COLORS = {
  ventes: "var(--chart-ventes)",
  achats: "var(--chart-achats)",
  ventesHex: "#14b8a6",
  achatsHex: "#3b82f6",
} as const;

/* ── Gauge colors (match CSS vars in App.css) ────────────────────────────── */

export const GAUGE_COLORS = {
  good: "var(--gauge-good)",
  warn: "var(--gauge-warn)",
  bad: "var(--gauge-bad)",
  needle: "var(--gauge-needle)",
  goodHex: "#16a34a",
  warnHex: "#eab308",
  badHex: "#ef4444",
  needleHex: "#1e293b",
} as const;

/* ── Category type themes ────────────────────────────────────────────────── */

export type TypeTheme = {
  primaryCard: string;
  border: string;
  bg: string;
  text: string;
  textValue: string;
  textSubtle: string;
  icon: string;
  iconHex: string;
};

const THEME_PHARMACIE: TypeTheme = {
  primaryCard: "bg-green-600 text-white border-0",
  border:      "border-green-200 dark:border-green-800",
  bg:          "bg-green-50/50 dark:bg-green-950/20",
  text:        "text-green-700 dark:text-green-300",
  textValue:   "text-green-800 dark:text-green-200",
  textSubtle:  "text-green-600 dark:text-green-400",
  icon:        "text-green-500",
  iconHex:     "#22c55e",
};

const THEME_PARAPHARMACIE: TypeTheme = {
  primaryCard: "bg-purple-600 text-white border-0",
  border:      "border-purple-200 dark:border-purple-800",
  bg:          "bg-purple-50/50 dark:bg-purple-950/20",
  text:        "text-purple-700 dark:text-purple-300",
  textValue:   "text-purple-800 dark:text-purple-200",
  textSubtle:  "text-purple-600 dark:text-purple-400",
  icon:        "text-purple-500",
  iconHex:     "#a855f7",
};

const THEME_MIXTE: TypeTheme = {
  primaryCard: "bg-primary text-primary-foreground border-0",
  border:      "border-emerald-200 dark:border-emerald-800",
  bg:          "bg-emerald-50/50 dark:bg-emerald-950/20",
  text:        "text-emerald-700 dark:text-emerald-300",
  textValue:   "text-emerald-800 dark:text-emerald-200",
  textSubtle:  "text-emerald-600 dark:text-emerald-400",
  icon:        "text-emerald-500",
  iconHex:     "#14b8a6",
};

export function getTypeTheme(categoryType: eCategoryType): TypeTheme {
  if (categoryType === eCategoryType.PHARMACIE) return THEME_PHARMACIE;
  if (categoryType === eCategoryType.PARAPHARMACIE) return THEME_PARAPHARMACIE;
  return THEME_MIXTE;
}

/* ── Pie chart category palette ──────────────────────────────────────────── */

export const CAT_COLORS = [
  "#14b8a6", "#8b5cf6", "#3b82f6", "#f59e0b", "#f43f5e",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
  "#10b981", "#a855f6", "#0ea5e9", "#eab308", "#ef4444",
  "#22d3ee", "#d946ef", "#a3e635", "#fb923c", "#818cf8",
];

/* ── ABCD stock classification colors ────────────────────────────────────── */

export const CLASS_COLORS: Record<string, string> = {
  A: "#16a34a",
  "A-": "#22c55e",
  "B+": "#3b82f6",
  B: "#60a5fa",
  C: "#f97316",
  "C-": "#fb923c",
  "C-N": "#fbbf24",
  D: "#ef4444",
};
