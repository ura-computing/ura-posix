/** Per-mode table column configs for /analyse.
 *
 *  Each mode's columns are a subset of `AnalyseMargeRow`. Frontend reads
 *  `MARGE_COLS[mode]` to render only the columns relevant to the active mode.
 *  Formatters live next to the column def — Excel export reads `raw` for numerics
 *  to avoid JSX cell rendering breaking the spreadsheet.
 */
import type { ReactNode } from "react";

import { formatMAD, formatPct, formatQty } from "@/utils/format";
import type { AnalyseMargeRow, MargeMode } from "@/types";
import { MatchBadge } from "./_components/MatchBadge";

export interface AnalyseColDef {
  key: string;
  label: string;
  align?: "left" | "right";
  /** Display renderer (JSX). */
  render: (row: AnalyseMargeRow) => ReactNode;
  /** Raw value for Excel export. Falls back to render's string conversion if absent. */
  raw?: (row: AnalyseMargeRow) => string | number | null;
  /** Column width in pixels or CSS units */
  width?: string;
}

function margeColor(pct: number | null | undefined): string {
  if (pct == null) return "text-muted-foreground";
  if (pct < 0) return "text-error";
  if (pct < 10) return "text-warning";
  return "text-success";
}

// ─── Per-mode column configs ──────────────────────────────────────────────────

const PRODUIT_COLS: AnalyseColDef[] = [
  { key: "product", label: "col.produit", render: (r) => r.product ?? "—", raw: (r) => r.product ?? "" },
  { key: "category", label: "col.categorie", render: (r) => r.category ?? "—", raw: (r) => r.category ?? "" },
  { key: "tva", label: "col.tva", align: "right", render: (r) => r.tva ?? "—", raw: (r) => r.tva ?? "" },
  {
    key: "stock_dispo",
    label: "col.stock",
    align: "right",
    render: (r) => (r.stock_dispo != null ? formatQty(r.stock_dispo) : "—"),
    raw: (r) => r.stock_dispo ?? null,
  },
  { key: "qty", label: "col.qteVendue", align: "right", render: (r) => formatQty(r.qty ?? 0), raw: (r) => r.qty ?? 0 },
  { key: "ca", label: "col.ca", align: "right", render: (r) => formatMAD(r.ca ?? 0), raw: (r) => r.ca ?? 0 },
  {
    key: "prix_min",
    label: "col.puMin",
    align: "right",
    render: (r) => (r.prix_min ? formatMAD(r.prix_min) : "—"),
    raw: (r) => r.prix_min ?? null,
  },
  {
    key: "prix_avg",
    label: "col.puMoy",
    align: "right",
    render: (r) => (r.prix_avg ? formatMAD(r.prix_avg) : "—"),
    raw: (r) => r.prix_avg ?? null,
  },
  {
    key: "prix_max",
    label: "col.puMax",
    align: "right",
    render: (r) => (r.prix_max ? formatMAD(r.prix_max) : "—"),
    raw: (r) => r.prix_max ?? null,
  },
  {
    key: "ppv",
    label: "col.ppv",
    align: "right",
    render: (r) => (r.ppv != null ? formatMAD(r.ppv) : "—"),
    raw: (r) => r.ppv ?? null,
  },
  {
    key: "marge_pct",
    label: "col.margePct",
    align: "right" as const,
    render: (r) => (
      <span className={margeColor(r.marge_pct)}>{r.marge_pct != null ? formatPct(r.marge_pct) : "—"}</span>
    ),
    raw: (r) => r.marge_pct ?? null,
  },
  {
    key: "marge_dh",
    label: "col.margeDh",
    align: "right" as const,
    render: (r) => <span className={margeColor(r.marge_pct)}>{r.marge_dh != null ? formatMAD(r.marge_dh) : "—"}</span>,
    raw: (r) => r.marge_dh ?? null,
  },
];

const CATEGORIE_COLS: AnalyseColDef[] = [
  { key: "category", label: "col.categorie", render: (r) => r.category ?? "—", raw: (r) => r.category ?? "" },
  { key: "qty", label: "col.qteVendue", align: "right", render: (r) => formatQty(r.qty ?? 0), raw: (r) => r.qty ?? 0 },
  { key: "ca", label: "col.ca", align: "right", render: (r) => formatMAD(r.ca ?? 0), raw: (r) => r.ca ?? 0 },
  {
    key: "prix_min",
    label: "col.puMin",
    align: "right",
    render: (r) => formatMAD(r.prix_min ?? 0),
    raw: (r) => r.prix_min ?? null,
  },
  {
    key: "prix_avg",
    label: "col.puMoy",
    align: "right",
    render: (r) => formatMAD(r.prix_avg ?? 0),
    raw: (r) => r.prix_avg ?? null,
  },
  {
    key: "prix_max",
    label: "col.puMax",
    align: "right",
    render: (r) => formatMAD(r.prix_max ?? 0),
    raw: (r) => r.prix_max ?? null,
  },
  {
    key: "marge_pct_avg",
    label: "col.margeMoyPct",
    align: "right",
    render: (r) => (
      <span className={margeColor(r.marge_pct_avg)}>{r.marge_pct_avg != null ? formatPct(r.marge_pct_avg) : "—"}</span>
    ),
    raw: (r) => r.marge_pct_avg ?? null,
  },
  {
    key: "marge_dh_avg",
    label: "col.margeMoyDh",
    align: "right",
    render: (r) => (
      <span className={margeColor(r.marge_pct_avg)}>{r.marge_dh_avg != null ? formatMAD(r.marge_dh_avg) : "—"}</span>
    ),
    raw: (r) => r.marge_dh_avg ?? null,
  },
];

const LABORATOIRE_COLS: AnalyseColDef[] = [
  {
    key: "laboratoire",
    label: "col.laboratoire",
    render: (r) => r.laboratoire ?? "—",
    raw: (r) => r.laboratoire ?? "",
  },
  { key: "qty", label: "col.qteVendue", align: "right", render: (r) => formatQty(r.qty ?? 0), raw: (r) => r.qty ?? 0 },
  { key: "ca", label: "col.ca", align: "right", render: (r) => formatMAD(r.ca ?? 0), raw: (r) => r.ca ?? 0 },
  {
    key: "total_achat_cost",
    label: "col.coutAchats",
    align: "right",
    render: (r) => formatMAD(r.total_achat_cost ?? 0),
    raw: (r) => r.total_achat_cost ?? 0,
  },
  {
    key: "marge_pct_avg",
    label: "col.margeMoyPct",
    align: "right",
    render: (r) => (
      <span className={margeColor(r.marge_pct_avg)}>{r.marge_pct_avg != null ? formatPct(r.marge_pct_avg) : "—"}</span>
    ),
    raw: (r) => r.marge_pct_avg ?? null,
  },
  {
    key: "marge_dh_avg",
    label: "col.margeMoyDh",
    align: "right",
    render: (r) => (
      <span className={margeColor(r.marge_pct_avg)}>{r.marge_dh_avg != null ? formatMAD(r.marge_dh_avg) : "—"}</span>
    ),
    raw: (r) => r.marge_dh_avg ?? null,
  },
];

const GROSSISTE_COLS: AnalyseColDef[] = [
  { key: "grossiste", label: "col.grossiste", render: (r) => r.grossiste ?? "—", raw: (r) => r.grossiste ?? "" },
  { key: "qty", label: "col.qteVendue", align: "right", render: (r) => formatQty(r.qty ?? 0), raw: (r) => r.qty ?? 0 },
  { key: "ca", label: "col.ca", align: "right", render: (r) => formatMAD(r.ca ?? 0), raw: (r) => r.ca ?? 0 },
  {
    key: "total_achat_cost",
    label: "col.coutAchats",
    align: "right",
    render: (r) => formatMAD(r.total_achat_cost ?? 0),
    raw: (r) => r.total_achat_cost ?? 0,
  },
  {
    key: "marge_pct_avg",
    label: "col.margeMoyPct",
    align: "right",
    render: (r) => (
      <span className={margeColor(r.marge_pct_avg)}>{r.marge_pct_avg != null ? formatPct(r.marge_pct_avg) : "—"}</span>
    ),
    raw: (r) => r.marge_pct_avg ?? null,
  },
  {
    key: "marge_dh_avg",
    label: "col.margeMoyDh",
    align: "right",
    render: (r) => (
      <span className={margeColor(r.marge_pct_avg)}>{r.marge_dh_avg != null ? formatMAD(r.marge_dh_avg) : "—"}</span>
    ),
    raw: (r) => r.marge_dh_avg ?? null,
  },
];

const OPERATEUR_COLS: AnalyseColDef[] = [
  { key: "client", label: "col.client", render: (r) => r.client ?? "—", raw: (r) => r.client ?? "" },
  {
    key: "nb_transactions",
    label: "kpi.transactions",
    align: "right",
    render: (r) => formatQty(r.nb_transactions ?? 0),
    raw: (r) => r.nb_transactions ?? 0,
  },
  { key: "qty", label: "col.qteVendue", align: "right", render: (r) => formatQty(r.qty ?? 0), raw: (r) => r.qty ?? 0 },
  { key: "ca", label: "col.ca", align: "right", render: (r) => formatMAD(r.ca ?? 0), raw: (r) => r.ca ?? 0 },
];

const MOIS_COLS: AnalyseColDef[] = [
  { key: "mois", label: "col.mois", render: (r) => r.mois ?? "—", raw: (r) => r.mois ?? "" },
  {
    key: "nb_transactions",
    label: "kpi.transactions",
    align: "right",
    render: (r) => formatQty(r.nb_transactions ?? 0),
    raw: (r) => r.nb_transactions ?? 0,
  },
  { key: "qty", label: "col.qteVendue", align: "right", render: (r) => formatQty(r.qty ?? 0), raw: (r) => r.qty ?? 0 },
  { key: "ca", label: "col.ca", align: "right", render: (r) => formatMAD(r.ca ?? 0), raw: (r) => r.ca ?? 0 },
];

const MONTH_KEYS = ["m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08", "m09", "m10", "m11", "m12"] as const;

/** Two-line cell body used by the Année pivot: qty on the first line, CA on the second. */
function monthValueCell(qty: number, ca: number) {
  return (
    <span className="flex flex-col text-sm tabular-nums">
      <span>{formatQty(qty)}</span>
      <span>{formatMAD(ca)}</span>
    </span>
  );
}

const ANNEE_COLS: AnalyseColDef[] = [
  {
    key: "annee",
    label: "col.annee",
    render: (r) => <span className="font-bold">{r.annee ?? "—"}</span>,
    raw: (r) => r.annee ?? "",
    align: "left" as const,
    width: "120px",
  },
  ...MONTH_KEYS.map((k) => ({
    key: k,
    label: k,
    align: "left" as const,
    render: (r: AnalyseMargeRow) => {
      const monthData = r[k as keyof AnalyseMargeRow] as { qty: number; ca: number } | undefined;
      return monthValueCell(monthData?.qty ?? 0, monthData?.ca ?? 0);
    },
    raw: (r: AnalyseMargeRow) => {
      const monthData = r[k as keyof AnalyseMargeRow] as { qty: number; ca: number } | undefined;
      return monthData?.qty ?? 0;
    },
    width: "200px",
  })),
  {
    key: "total",
    label: "Total",
    align: "left" as const,
    render: (r) => monthValueCell(r.qty ?? 0, r.ca ?? 0),
    raw: (r) => r.qty ?? 0,
    width: "200px",
  },
];

const LISTE_COLS: AnalyseColDef[] = [
  {
    key: "match_status",
    label: "col.statut",
    render: (r) => <MatchBadge found={r.match_status === "found"} />,
    raw: (r) => r.match_status ?? "",
  },
  { key: "product", label: "col.produit", render: (r) => r.product ?? "—", raw: (r) => r.product ?? "" },
  { key: "category", label: "col.categorie", render: (r) => r.category ?? "—", raw: (r) => r.category ?? "" },
  {
    key: "stock_dispo",
    label: "col.stock",
    align: "right",
    render: (r) => (r.stock_dispo != null ? formatQty(r.stock_dispo) : "—"),
    raw: (r) => r.stock_dispo ?? null,
  },
  { key: "qty", label: "col.qteVendue", align: "right", render: (r) => formatQty(r.qty ?? 0), raw: (r) => r.qty ?? 0 },
  {
    key: "ppv",
    label: "col.ppv",
    align: "right",
    render: (r) => (r.ppv != null ? formatMAD(r.ppv) : "—"),
    raw: (r) => r.ppv ?? null,
  },
  {
    key: "pu",
    label: "col.puMoy",
    align: "right",
    render: (r) => (r.pu != null ? formatMAD(r.pu) : "—"),
    raw: (r) => r.pu ?? null,
  },
  {
    key: "marge_pct",
    label: "col.margePct",
    align: "right" as const,
    render: (r) => (
      <span className={margeColor(r.marge_pct)}>{r.marge_pct != null ? formatPct(r.marge_pct) : "—"}</span>
    ),
    raw: (r) => r.marge_pct ?? null,
  },
  {
    key: "marge_dh",
    label: "col.margeDh",
    align: "right" as const,
    render: (r) => <span className={margeColor(r.marge_pct)}>{r.marge_dh != null ? formatMAD(r.marge_dh) : "—"}</span>,
    raw: (r) => r.marge_dh ?? null,
  },
];

export const MARGE_COLS: Record<MargeMode, AnalyseColDef[]> = {
  produit: PRODUIT_COLS,
  categorie: CATEGORIE_COLS,
  laboratoire: LABORATOIRE_COLS,
  grossiste: GROSSISTE_COLS,
  operateur: OPERATEUR_COLS,
  mois: MOIS_COLS,
  annee: ANNEE_COLS,
  liste: LISTE_COLS,
};

// ─── Excel export columns — OLD-APP PARITY ────────────────────────────────────
// The generated .xlsx must match the old apcm-pharma exports exactly (client
// request): same headers, same column order; filename "APCM - ANALYSE {MODE} …"
// and sheet name "Analyse" are set in useAnalysePage.handleExport. The on-screen
// table keeps the newer MARGE_COLS labels above — only the export differs.
// Exception: `liste` — the old app never exported its CSV-comparison table (its
// "Liste" tab exported BL aggregates that no longer exist), so we export the
// comparison with the old TABLE's headers and a French Statut.

export interface AnalyseExportCol {
  label: string;
  raw: (row: AnalyseMargeRow) => string | number | null;
}

// Shared tail of the old categorie/grossiste/laboratoire exports.
const OLD_AGG_EXPORT_TAIL: AnalyseExportCol[] = [
  { label: "Prix max", raw: (r) => r.prix_max ?? null },
  { label: "Prix min", raw: (r) => r.prix_min ?? null },
  { label: "Prix moy.", raw: (r) => r.prix_avg ?? null },
  { label: "Marge % moy.", raw: (r) => r.marge_pct_avg ?? null },
  { label: "Marge DH moy.", raw: (r) => r.marge_dh_avg ?? null },
  { label: "Qté", raw: (r) => r.qty ?? 0 },
  { label: "CA (MAD)", raw: (r) => r.ca ?? 0 },
];

// Old app used full French month abbreviations (Juin/Juil/Août) in the pivot.
const OLD_MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

export const EXPORT_COLS: Record<MargeMode, AnalyseExportCol[]> = {
  annee: [
    { label: "Année", raw: (r: AnalyseMargeRow) => r.annee ?? "" },
    ...MONTH_KEYS.flatMap((k, i) => [
      {
        label: `${OLD_MONTH_LABELS[i]} (Qty)`,
        raw: (r: AnalyseMargeRow) =>
          (r[k as keyof AnalyseMargeRow] as { qty: number; ca: number } | undefined)?.qty ?? 0,
      },
      {
        label: `${OLD_MONTH_LABELS[i]} (CA)`,
        raw: (r: AnalyseMargeRow) =>
          (r[k as keyof AnalyseMargeRow] as { qty: number; ca: number } | undefined)?.ca ?? 0,
      },
    ]),
    { label: "Total Qté", raw: (r: AnalyseMargeRow) => r.qty ?? 0 },
    { label: "Total CA", raw: (r: AnalyseMargeRow) => r.ca ?? 0 },
  ],
  produit: [
    { label: "Produit", raw: (r) => r.product ?? "" },
    { label: "Stock dispo", raw: (r) => r.stock_dispo ?? null },
    { label: "Vente total unit", raw: (r) => r.qty ?? 0 },
    { label: "Vente total DH", raw: (r) => r.ca ?? 0 },
    { label: "Prix unit +", raw: (r) => r.prix_max ?? null },
    { label: "Prix unit -", raw: (r) => r.prix_min ?? null },
    { label: "Prix unit X", raw: (r) => r.prix_avg ?? null },
    { label: "PPV", raw: (r) => r.ppv ?? null },
    { label: "Marge% X", raw: (r) => r.marge_pct ?? null },
    { label: "Marge DH X", raw: (r) => r.marge_dh ?? null },
    { label: "Catégorie", raw: (r) => r.category ?? "" },
    { label: "TVA", raw: (r) => r.tva ?? "" },
  ],
  categorie: [{ label: "Catégorie", raw: (r) => r.category ?? "" }, ...OLD_AGG_EXPORT_TAIL],
  grossiste: [{ label: "Grossiste", raw: (r) => r.grossiste ?? "" }, ...OLD_AGG_EXPORT_TAIL],
  laboratoire: [{ label: "Laboratoire", raw: (r) => r.laboratoire ?? "" }, ...OLD_AGG_EXPORT_TAIL],
  operateur: [
    { label: "Opérateur / Client", raw: (r) => r.client ?? "" },
    { label: "Transactions", raw: (r) => r.nb_transactions ?? 0 },
    { label: "Qté", raw: (r) => r.qty ?? 0 },
    { label: "CA (MAD)", raw: (r) => r.ca ?? 0 },
  ],
  mois: [
    { label: "Mois", raw: (r) => r.mois ?? "" },
    { label: "Transactions", raw: (r) => r.nb_transactions ?? 0 },
    { label: "Qté", raw: (r) => r.qty ?? 0 },
    { label: "CA (MAD)", raw: (r) => r.ca ?? 0 },
  ],
  liste: [
    {
      label: "Statut",
      raw: (r) => (r.match_status === "found" ? "Trouvé" : r.match_status === "not_found" ? "Introuvable" : ""),
    },
    { label: "Produit", raw: (r) => r.product ?? "" },
    { label: "Stock dispo", raw: (r) => r.stock_dispo ?? null },
    { label: "Ventes", raw: (r) => r.qty ?? 0 },
    { label: "PPV", raw: (r) => r.ppv ?? null },
    { label: "PU moy.", raw: (r) => r.pu ?? null },
    { label: "Marge %", raw: (r) => r.marge_pct ?? null },
    { label: "Marge DH", raw: (r) => r.marge_dh ?? null },
    { label: "Catégorie", raw: (r) => r.category ?? "" },
  ],
};
