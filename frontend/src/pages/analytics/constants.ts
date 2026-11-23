// src/pages/stock/_constants.ts
// Shared, locked design constants for the Stock page.
import type { IconTone } from "@/_components/organisms/KpiTile";
import type { TFn } from "@/i18n/I18nProvider";
import type { AbcdClass, PeremptionsResponse, StockRow } from "@/types";

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

/** The 4 expiry buckets of Alertes and Stock (same order, labels, dialog texts): 3 by urgency, then `no_date` (no expiry
 *  date in the stock file). `expiredTitle`: « Expirés » (Alertes) or « Expirés en stock » (Stock). */
export function peremptionBuckets(
  t: TFn,
  expiredTitle: "peremptions.expires" | "peremptions.expiresStock",
): {
  key: keyof PeremptionsResponse;
  tone: IconTone;
  title: string;
  sub: string;
  dlgTitle: string;
  dlgSubtitle: string;
}[] {
  return [
    {
      key: "expired",
      tone: "error",
      title: t(expiredTitle),
      sub: t("peremptions.actionUrgente"),
      dlgTitle: t("peremptions.dlgExpires"),
      dlgSubtitle: t("peremptions.dlgExpiresSub"),
    },
    {
      key: "very_close",
      tone: "warning",
      title: t("peremptions.tresProche"),
      sub: t("peremptions.tresUrgent"),
      dlgTitle: t("peremptions.dlgTresProche"),
      dlgSubtitle: t("peremptions.dlgTresProcheSub"),
    },
    {
      key: "close",
      tone: "warning",
      title: t("peremptions.proche"),
      sub: t("peremptions.aSurveiller"),
      dlgTitle: t("peremptions.dlgProche"),
      dlgSubtitle: t("peremptions.dlgProcheSub"),
    },
    {
      key: "no_date",
      tone: "muted",
      title: t("peremptions.sansDate"),
      sub: t("peremptions.aRenseigner"),
      dlgTitle: t("peremptions.dlgSansDate"),
      dlgSubtitle: t("peremptions.dlgSansDateSub"),
    },
  ];
}
