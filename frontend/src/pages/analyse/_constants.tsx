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


export interface AnalyseColDef {
  key:    string;
  label:  string;
  align?: "left" | "right";
  /** Display renderer (JSX). */
  render: (row: AnalyseMargeRow) => ReactNode;
  /** Raw value for Excel export. Falls back to render's string conversion if absent. */
  raw?:   (row: AnalyseMargeRow) => string | number | null;
}


function margeColor(pct: number | null | undefined): string {
  if (pct == null) return "text-muted-foreground";
  if (pct < 0)   return "text-error";
  if (pct < 10)  return "text-warning";
  return "text-success";
}


// ─── Per-mode column configs ──────────────────────────────────────────────────

const PRODUIT_COLS: AnalyseColDef[] = [
  { key: "product",     label: "Produit",      render: (r) => r.product ?? "—",                    raw: (r) => r.product ?? "" },
  { key: "category",    label: "Catégorie",    render: (r) => r.category ?? "—",                   raw: (r) => r.category ?? "" },
  { key: "tva",         label: "TVA",          align: "right", render: (r) => r.tva ?? "—",        raw: (r) => r.tva ?? "" },
  { key: "stock_dispo", label: "Stock",        align: "right", render: (r) => r.stock_dispo != null ? formatQty(r.stock_dispo) : "—", raw: (r) => r.stock_dispo ?? null },
  { key: "qty",         label: "Qté vendue",   align: "right", render: (r) => formatQty(r.qty ?? 0), raw: (r) => r.qty ?? 0 },
  { key: "ca",          label: "CA",           align: "right", render: (r) => formatMAD(r.ca ?? 0), raw: (r) => r.ca ?? 0 },
  { key: "prix_min",    label: "PU min",       align: "right", render: (r) => r.prix_min ? formatMAD(r.prix_min) : "—", raw: (r) => r.prix_min ?? null },
  { key: "prix_avg",    label: "PU moy",       align: "right", render: (r) => r.prix_avg ? formatMAD(r.prix_avg) : "—", raw: (r) => r.prix_avg ?? null },
  { key: "prix_max",    label: "PU max",       align: "right", render: (r) => r.prix_max ? formatMAD(r.prix_max) : "—", raw: (r) => r.prix_max ?? null },
  { key: "ppv",         label: "PPV",          align: "right", render: (r) => r.ppv != null ? formatMAD(r.ppv) : "—", raw: (r) => r.ppv ?? null },
  { key: "marge_pct",   label: "Marge %",      align: "right",
    render: (r) => <span className={margeColor(r.marge_pct)}>{r.marge_pct != null ? formatPct(r.marge_pct) : "—"}</span>,
    raw: (r) => r.marge_pct ?? null },
  { key: "marge_dh",    label: "Marge DH",     align: "right",
    render: (r) => <span className={margeColor(r.marge_pct)}>{r.marge_dh != null ? formatMAD(r.marge_dh) : "—"}</span>,
    raw: (r) => r.marge_dh ?? null },
];

const CATEGORIE_COLS: AnalyseColDef[] = [
  { key: "category",      label: "Catégorie",     render: (r) => r.category ?? "—", raw: (r) => r.category ?? "" },
  { key: "qty",           label: "Qté vendue",    align: "right", render: (r) => formatQty(r.qty ?? 0), raw: (r) => r.qty ?? 0 },
  { key: "ca",            label: "CA",            align: "right", render: (r) => formatMAD(r.ca ?? 0), raw: (r) => r.ca ?? 0 },
  { key: "prix_min",      label: "PU min",        align: "right", render: (r) => formatMAD(r.prix_min ?? 0), raw: (r) => r.prix_min ?? null },
  { key: "prix_avg",      label: "PU moy",        align: "right", render: (r) => formatMAD(r.prix_avg ?? 0), raw: (r) => r.prix_avg ?? null },
  { key: "prix_max",      label: "PU max",        align: "right", render: (r) => formatMAD(r.prix_max ?? 0), raw: (r) => r.prix_max ?? null },
  { key: "marge_pct_avg", label: "Marge moy %",   align: "right",
    render: (r) => <span className={margeColor(r.marge_pct_avg)}>{r.marge_pct_avg != null ? formatPct(r.marge_pct_avg) : "—"}</span>,
    raw: (r) => r.marge_pct_avg ?? null },
  { key: "marge_dh_avg",  label: "Marge moy DH",  align: "right",
    render: (r) => <span className={margeColor(r.marge_pct_avg)}>{r.marge_dh_avg != null ? formatMAD(r.marge_dh_avg) : "—"}</span>,
    raw: (r) => r.marge_dh_avg ?? null },
];

const LABORATOIRE_COLS: AnalyseColDef[] = [
  { key: "laboratoire",   label: "Laboratoire",   render: (r) => r.laboratoire ?? "—", raw: (r) => r.laboratoire ?? "" },
  { key: "qty",           label: "Qté vendue",    align: "right", render: (r) => formatQty(r.qty ?? 0), raw: (r) => r.qty ?? 0 },
  { key: "ca",            label: "CA",            align: "right", render: (r) => formatMAD(r.ca ?? 0), raw: (r) => r.ca ?? 0 },
  { key: "total_achat_cost", label: "Coût achats", align: "right", render: (r) => formatMAD(r.total_achat_cost ?? 0), raw: (r) => r.total_achat_cost ?? 0 },
  { key: "marge_pct_avg", label: "Marge moy %",   align: "right",
    render: (r) => <span className={margeColor(r.marge_pct_avg)}>{r.marge_pct_avg != null ? formatPct(r.marge_pct_avg) : "—"}</span>,
    raw: (r) => r.marge_pct_avg ?? null },
  { key: "marge_dh_avg",  label: "Marge moy DH",  align: "right",
    render: (r) => <span className={margeColor(r.marge_pct_avg)}>{r.marge_dh_avg != null ? formatMAD(r.marge_dh_avg) : "—"}</span>,
    raw: (r) => r.marge_dh_avg ?? null },
];

const GROSSISTE_COLS: AnalyseColDef[] = [
  { key: "grossiste",     label: "Grossiste",     render: (r) => r.grossiste ?? "—", raw: (r) => r.grossiste ?? "" },
  { key: "qty",           label: "Qté vendue",    align: "right", render: (r) => formatQty(r.qty ?? 0), raw: (r) => r.qty ?? 0 },
  { key: "ca",            label: "CA",            align: "right", render: (r) => formatMAD(r.ca ?? 0), raw: (r) => r.ca ?? 0 },
  { key: "total_achat_cost", label: "Coût achats", align: "right", render: (r) => formatMAD(r.total_achat_cost ?? 0), raw: (r) => r.total_achat_cost ?? 0 },
  { key: "marge_pct_avg", label: "Marge moy %",   align: "right",
    render: (r) => <span className={margeColor(r.marge_pct_avg)}>{r.marge_pct_avg != null ? formatPct(r.marge_pct_avg) : "—"}</span>,
    raw: (r) => r.marge_pct_avg ?? null },
  { key: "marge_dh_avg",  label: "Marge moy DH",  align: "right",
    render: (r) => <span className={margeColor(r.marge_pct_avg)}>{r.marge_dh_avg != null ? formatMAD(r.marge_dh_avg) : "—"}</span>,
    raw: (r) => r.marge_dh_avg ?? null },
];

const OPERATEUR_COLS: AnalyseColDef[] = [
  { key: "client",          label: "Client",        render: (r) => r.client ?? "Anonyme", raw: (r) => r.client ?? "" },
  { key: "nb_transactions", label: "Transactions",  align: "right", render: (r) => formatQty(r.nb_transactions ?? 0), raw: (r) => r.nb_transactions ?? 0 },
  { key: "qty",             label: "Qté vendue",    align: "right", render: (r) => formatQty(r.qty ?? 0), raw: (r) => r.qty ?? 0 },
  { key: "ca",              label: "CA",            align: "right", render: (r) => formatMAD(r.ca ?? 0), raw: (r) => r.ca ?? 0 },
];

const MOIS_COLS: AnalyseColDef[] = [
  { key: "mois",            label: "Mois",          render: (r) => r.mois ?? "—", raw: (r) => r.mois ?? "" },
  { key: "nb_transactions", label: "Transactions",  align: "right", render: (r) => formatQty(r.nb_transactions ?? 0), raw: (r) => r.nb_transactions ?? 0 },
  { key: "qty",             label: "Qté vendue",    align: "right", render: (r) => formatQty(r.qty ?? 0), raw: (r) => r.qty ?? 0 },
  { key: "ca",              label: "CA",            align: "right", render: (r) => formatMAD(r.ca ?? 0), raw: (r) => r.ca ?? 0 },
];

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const MONTH_KEYS  = ["m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08", "m09", "m10", "m11", "m12"] as const;

const ANNEE_COLS: AnalyseColDef[] = [
  { key: "annee", label: "Année", render: (r) => String(r.annee ?? "—"), raw: (r) => r.annee ?? "" },
  ...MONTH_KEYS.map((k, i): AnalyseColDef => ({
    key:   k,
    label: MONTH_LABELS[i],
    align: "right",
    render: (r) => formatMAD((r as unknown as Record<string, number>)[k] ?? 0),
    raw:    (r) => (r as unknown as Record<string, number>)[k] ?? 0,
  })),
  { key: "ca",  label: "Total CA", align: "right", render: (r) => formatMAD(r.ca ?? 0), raw: (r) => r.ca ?? 0 },
  { key: "qty", label: "Total qté", align: "right", render: (r) => formatQty(r.qty ?? 0), raw: (r) => r.qty ?? 0 },
];

const LISTE_COLS: AnalyseColDef[] = [
  { key: "match_status", label: "Statut", render: (r) => (
      r.match_status === "found"
        ? <span className="rounded-full bg-success-subtle px-2 py-0.5 text-xs font-semibold text-success">Trouvé</span>
        : <span className="rounded-full bg-error-subtle px-2 py-0.5 text-xs font-semibold text-error">Introuvable</span>
    ), raw: (r) => r.match_status ?? "" },
  { key: "product",     label: "Produit",      render: (r) => r.product ?? "—", raw: (r) => r.product ?? "" },
  { key: "category",    label: "Catégorie",    render: (r) => r.category ?? "—", raw: (r) => r.category ?? "" },
  { key: "stock_dispo", label: "Stock",        align: "right", render: (r) => r.stock_dispo != null ? formatQty(r.stock_dispo) : "—", raw: (r) => r.stock_dispo ?? null },
  { key: "qty",         label: "Qté vendue",   align: "right", render: (r) => formatQty(r.qty ?? 0), raw: (r) => r.qty ?? 0 },
  { key: "ppv",         label: "PPV",          align: "right", render: (r) => r.ppv != null ? formatMAD(r.ppv) : "—", raw: (r) => r.ppv ?? null },
  { key: "pu",          label: "PU moy",       align: "right", render: (r) => r.pu  != null ? formatMAD(r.pu)  : "—", raw: (r) => r.pu  ?? null },
  { key: "marge_pct",   label: "Marge %",      align: "right",
    render: (r) => <span className={margeColor(r.marge_pct)}>{r.marge_pct != null ? formatPct(r.marge_pct) : "—"}</span>,
    raw: (r) => r.marge_pct ?? null },
  { key: "marge_dh",    label: "Marge DH",     align: "right",
    render: (r) => <span className={margeColor(r.marge_pct)}>{r.marge_dh != null ? formatMAD(r.marge_dh) : "—"}</span>,
    raw: (r) => r.marge_dh ?? null },
];


export const MARGE_COLS: Record<MargeMode, AnalyseColDef[]> = {
  produit:     PRODUIT_COLS,
  categorie:   CATEGORIE_COLS,
  laboratoire: LABORATOIRE_COLS,
  grossiste:   GROSSISTE_COLS,
  operateur:   OPERATEUR_COLS,
  mois:        MOIS_COLS,
  annee:       ANNEE_COLS,
  liste:       LISTE_COLS,
};
