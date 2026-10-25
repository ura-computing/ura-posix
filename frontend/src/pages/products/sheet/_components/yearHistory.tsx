/** « Historique (par année) » lines + columns, shared by Statistiques (Tous · Ventes · Achats) and
 *  Général (Ventes only): per year a Ventes line (light green) and an Achats line (light blue), the
 *  units each month, the total, then the amount (CA of the sales, Σ line totals of the purchases). */
import type { ColumnDef } from "@/_components/DataTable";
import type { YearHistory } from "@/types";
import type { TFn } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatNumStr, formatQty } from "@/utils/format";

const dash = <span className="text-muted-foreground">—</span>;
const money = (n: number | null) => (n != null ? formatNumStr(n, 2) : dash);

export type HistoryFilter = "all" | "sales" | "purchases";
export interface HistoryLine {
  year: number;
  kind: "sales" | "purchases";
  units: number[];
  total: number;
  amount: number;
}

/** The lines of the filter, newest year first; a kind without any unit that year is left out. */
export const historyLines = (history: YearHistory[], filter: HistoryFilter): HistoryLine[] =>
  history
    .flatMap((y): HistoryLine[] => [
      { year: y.year, kind: "sales", units: y.sold, total: y.total, amount: y.ca },
      { year: y.year, kind: "purchases", units: y.bought, total: y.bought_total, amount: y.spent },
    ])
    .filter((l) => (filter === "all" || l.kind === filter) && l.units.some((n) => n !== 0));

export const LINE_TONE: Record<HistoryLine["kind"], string> = {
  sales: "bg-success-subtle hover:bg-success-subtle",
  purchases: "bg-info-subtle hover:bg-info-subtle",
};

const unitsOrDash = (n: number) => (n === 0 ? dash : formatQty(n));
export const kindLabel = (t: TFn, kind: HistoryLine["kind"]) => t(kind === "sales" ? "nav.ventes" : "nav.achats");

/** `withKind` = false: one kind only (Général: Ventes), no « Type » column. */
export const yearColumns = (t: TFn, monthsShort: string[], withKind = true): ColumnDef<HistoryLine>[] => [
  {
    key: "year",
    label: t("col.annee"),
    sortable: false,
    render: (r) => <span className="font-semibold">{r.year}</span>,
  },
  ...(withKind
    ? [
        {
          key: "kind",
          label: t("col.type"),
          sortable: false,
          render: (r: HistoryLine) => (
            <span
              className={cn(
                "font-semibold",
                r.kind === "sales" ? "text-success-subtle-foreground" : "text-info-subtle-foreground",
              )}
            >
              {kindLabel(t, r.kind)}
            </span>
          ),
        },
      ]
    : []),
  ...monthsShort.map((label, m): ColumnDef<HistoryLine> => ({
    key: `m${m + 1}`,
    label: label.replace(/\.$/, ""),
    align: "right",
    sortable: false,
    render: (r) => unitsOrDash(r.units[m]),
  })),
  {
    key: "total",
    label: t("col.total"),
    align: "right",
    sortable: false,
    render: (r) => <span className="font-semibold">{unitsOrDash(r.total)}</span>,
  },
  { key: "amount", label: t("products.colSpentMad"), align: "right", sortable: false, render: (r) => money(r.amount) },
];
