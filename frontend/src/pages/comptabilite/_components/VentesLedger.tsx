import { DataTable, type ColumnDef, type DataTablePagination } from "@/components/shared/DataTable";
import type { VenteRow } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";


/**
 * Comptabilité ventes ledger — same DataTable shell as /achats and /ventes
 * (sortable headers, sticky pagination footer, page-size popover). Column
 * set is comptabilité-specific: date, client, product, category, type, TVA.
 * Intentionally drops transaction_ref / transaction_ref_final (not useful
 * in an accounting view; the full /ventes page surfaces them).
 *
 * Sortable keys must match the backend's VENTE_SORT whitelist
 * (transactions.py): id, date, transaction_ref, client, quantity, discount,
 * unit_price, total. We expose date / client as sortable.
 */

const buildColumns = (t: TFn): ColumnDef<VenteRow>[] => [
  {
    key: "date",
    label: "Date",
    sortable: true,
    render: (r) => <span className="font-mono text-xs">{r.date ?? "—"}</span>,
  },
  {
    key: "client",
    label: t("col.client"),
    sortable: true,
    render: (r) => <span>{r.client || <span className="text-muted-foreground">{t("ventes.anonyme")}</span>}</span>,
  },
  {
    key: "product",
    label: t("col.produit"),
    sortable: false,
    render: (r) => (
      <div className="flex flex-col">
        <span className="truncate" title={r.product ?? ""}>{r.product ?? "—"}</span>
        {r.pid && <span className="text-[10px] text-muted-foreground">{r.pid}</span>}
      </div>
    ),
  },
  {
    key: "category",
    label: t("col.categorie"),
    sortable: false,
    render: (r) => <span className="text-xs text-muted-foreground">{r.category ?? "—"}</span>,
  },
  {
    key: "category_type",
    label: "Type",
    sortable: false,
    render: (r) => r.category_type === "pharmacie"
      ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">{t("category.pharmacie")}</span>
      : r.category_type === "parapharmacie"
        ? <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-600">{t("category.parapharmacie")}</span>
        : <span className="text-muted-foreground">—</span>,
  },
  {
    key: "tva",
    label: "TVA",
    align: "right",
    sortable: false,
    render: (r) => <span className="font-mono text-xs">{r.tva ?? "—"}</span>,
  },
];


interface VentesLedgerProps {
  rows:        VenteRow[];
  isLoading:   boolean;
  sortBy:      string | null;
  sortOrder:   "asc" | "desc";
  onSort:      (key: string) => void;
  pagination:  DataTablePagination;
}

export function VentesLedger({ rows, isLoading, sortBy, sortOrder, onSort, pagination }: VentesLedgerProps) {
  const t = useT();
  return (
    <DataTable
      rows={rows}
      columns={buildColumns(t)}
      isLoading={isLoading}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
      pagination={pagination}
      emptyTitle={t("comptabilite.emptyVentes")}
    />
  );
}
