import { SuffixBadge } from "@/components/shared/SuffixBadge";
import { DataTable, type ColumnDef, type DataTablePagination } from "@/components/shared/DataTable";
import { formatMAD, formatPct, formatQty } from "@/utils/format";
import type { VenteRow } from "@/types";


interface VentesTableProps {
  rows:       VenteRow[];
  isLoading:  boolean;
  sortBy:     string | null;
  sortOrder:  "asc" | "desc";
  onSort:     (key: string) => void;
  pagination: DataTablePagination;
}


/** PPV - avg_pu => marge en DH. Color-coded per the audit:
 *    < 0 = red, < 10 % = orange, ≥ 10 % = emerald. Same thresholds as apcm-pharma. */
function MargeCell({ row, mode }: { row: VenteRow; mode: "pct" | "dh" }) {
  const { ppv, avg_pu } = row;
  if (ppv == null || avg_pu == null || ppv === 0) return <span className="text-muted-foreground">—</span>;
  const pct = (1 - avg_pu / ppv) * 100;
  const dh  = ppv - avg_pu;
  const cls = pct < 0 ? "text-error" : pct < 10 ? "text-warning" : "text-success";
  return (
    <span className={cls}>
      {mode === "pct" ? formatPct(pct, 1) : formatMAD(dh)}
    </span>
  );
}


function TypeBadge({ category }: { category: string | null }) {
  if (!category) return <span className="text-muted-foreground">—</span>;
  const c = category.toLowerCase();
  const isPharma = /edicament|édicament|oméopath|omeopath|iététique|ietetique/.test(c);
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
      isPharma
        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
        : "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
    }`}>
      {isPharma ? "Pharmacie" : "Parapharmacie"}
    </span>
  );
}


const COLUMNS: ColumnDef<VenteRow>[] = [
  { key: "date", label: "Date", width: 100,
    render: (r) => <span className="font-mono text-xs tabular-nums text-muted-foreground">{r.date ?? "—"}</span> },
  { key: "transaction_ref", label: "N° Transaction", width: 170,
    render: (r) => r.transaction_ref ? (
      <span className="flex items-center">
        <span className="rounded border border-border bg-surface-subtle px-1.5 py-px font-mono text-[11px]">{r.transaction_ref}</span>
        {r.transaction_ref_final && r.transaction_ref_color && (
          <SuffixBadge text={r.transaction_ref_final.slice(r.transaction_ref.length)} color={r.transaction_ref_color} />
        )}
      </span>
    ) : <span className="text-muted-foreground">—</span> },
  { key: "client", label: "Client", width: 160,
    render: (r) => r.client ? r.client : <span className="italic text-muted-foreground">Anonyme</span> },
  { key: "product", label: "Produit", width: 240,
    render: (r) => (
      <div className="flex flex-col">
        <span className="truncate text-sm" title={r.product ?? ""}>{r.product ?? "—"}</span>
        <span className="truncate font-mono text-[10px] text-muted-foreground">{r.pid ?? ""}</span>
      </div>
    ) },
  { key: "category", label: "Catégorie", width: 160, sortable: false,
    render: (r) => <span className="block max-w-[150px] truncate text-xs text-muted-foreground">{r.category ?? "—"}</span> },
  { key: "type", label: "Type", width: 110, sortable: false,
    render: (r) => <TypeBadge category={r.category} /> },
  { key: "tva", label: "TVA", width: 80, sortable: false,
    render: (r) => r.tva ? <span className="font-mono text-[11px] text-muted-foreground">{r.tva}</span> : <span className="text-muted-foreground">—</span> },
  { key: "quantity", label: "Qté", width: 70, align: "right",
    render: (r) => r.quantity != null ? formatQty(r.quantity) : "—" },
  { key: "discount", label: "Remise", width: 80, align: "right",
    render: (r) => r.discount && r.discount > 0
      ? <span className="text-warning">{formatQty(r.discount)} %</span>
      : <span className="text-muted-foreground">0</span> },
  { key: "ppv", label: "PPV", width: 100, align: "right", sortable: false,
    render: (r) => r.ppv != null ? formatMAD(r.ppv) : "—" },
  { key: "subtotal", label: "Sous-total", width: 110, align: "right", sortable: false,
    render: (r) => r.subtotal != null ? formatMAD(r.subtotal) : "—" },
  { key: "total", label: "Total", width: 110, align: "right",
    render: (r) => <span className="font-semibold">{r.total != null ? formatMAD(r.total) : "—"}</span> },
  { key: "marge_pct", label: "Marge %", width: 90, align: "right", sortable: false,
    render: (r) => <MargeCell row={r} mode="pct" /> },
  { key: "marge_dh", label: "Marge DH", width: 110, align: "right", sortable: false,
    render: (r) => <MargeCell row={r} mode="dh" /> },
];


export function VentesTable({ rows, isLoading, sortBy, sortOrder, onSort, pagination }: VentesTableProps) {
  return (
    <DataTable<VenteRow>
      rows={rows}
      columns={COLUMNS}
      isLoading={isLoading}
      sortBy={sortBy ?? undefined}
      sortOrder={sortOrder}
      onSort={onSort}
      pagination={pagination}
      emptyTitle="Aucune vente trouvée"
      emptyHint="Ajustez les filtres ou importez un fichier de ventes."
      rowKey={(r) => r.id}
    />
  );
}
