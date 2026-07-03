import { SuffixBadge } from "@/components/shared/SuffixBadge";
import { DataTable, type ColumnDef, type DataTablePagination } from "@/components/shared/DataTable";
import { formatMAD, formatQty } from "@/utils/format";
import type { AchatRow } from "@/types";


interface AchatsTableProps {
  rows:       AchatRow[];
  isLoading:  boolean;
  sortBy:     string | null;
  sortOrder:  "asc" | "desc";
  onSort:     (key: string) => void;
  pagination: DataTablePagination;
}


function TypeBadge({ type }: { type: AchatRow["category_type"] }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  const isPharma = type === "pharmacie";
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


const COLUMNS: ColumnDef<AchatRow>[] = [
  { key: "delivery_date", label: "Date BL", width: 110,
    render: (r) => <span className="font-mono text-xs tabular-nums text-muted-foreground">{r.delivery_date ?? "—"}</span> },
  { key: "delivery_ref", label: "Référence", width: 170,
    render: (r) => r.delivery_ref ? (
      <span className="flex items-center">
        <span className="rounded border border-border bg-surface-subtle px-1.5 py-px font-mono text-[11px]">{r.delivery_ref}</span>
        {r.delivery_ref_final && r.delivery_ref_color && (
          <SuffixBadge text={r.delivery_ref_final.slice(r.delivery_ref.length)} color={r.delivery_ref_color} />
        )}
      </span>
    ) : <span className="text-muted-foreground">—</span> },
  { key: "supplier", label: "Fournisseur", width: 200,
    render: (r) => r.supplier ? <span className="truncate text-sm" title={r.supplier}>{r.supplier}</span> : <span className="text-muted-foreground">—</span> },
  { key: "product", label: "Produit", width: 260, sortable: false,
    render: (r) => (
      <div className="flex flex-col">
        <span className="truncate text-sm" title={r.product ?? ""}>{r.product ?? "—"}</span>
        <span className="truncate font-mono text-[10px] text-muted-foreground">{r.pid ?? ""}</span>
      </div>
    ) },
  { key: "category", label: "Catégorie", width: 160, sortable: false,
    render: (r) => <span className="block max-w-[150px] truncate text-xs text-muted-foreground">{r.category ?? "—"}</span> },
  { key: "category_type", label: "Type", width: 110, sortable: false,
    render: (r) => <TypeBadge type={r.category_type} /> },
  { key: "tva", label: "TVA", width: 80, sortable: false,
    render: (r) => r.tva ? <span className="font-mono text-[11px] text-muted-foreground">{r.tva}</span> : <span className="text-muted-foreground">—</span> },
  { key: "quantity", label: "Qté", width: 70, align: "right",
    render: (r) => r.quantity != null ? formatQty(r.quantity) : "—" },
  { key: "pph", label: "PPH", width: 100, align: "right",
    render: (r) => <span className="text-muted-foreground">{r.pph != null ? formatMAD(r.pph) : "—"}</span> },
  { key: "unit_price", label: "PU (achat)", width: 110, align: "right",
    render: (r) => r.unit_price != null ? formatMAD(r.unit_price) : "—" },
  { key: "expiry_date", label: "Péremption", width: 110, align: "right",
    render: (r) => <span className="font-mono text-xs tabular-nums text-muted-foreground">{r.expiry_date ?? "—"}</span> },
  { key: "total", label: "Total", width: 110, align: "right",
    render: (r) => <span className="font-semibold">{r.total != null ? formatMAD(r.total) : "—"}</span> },
];


export function AchatsTable({ rows, isLoading, sortBy, sortOrder, onSort, pagination }: AchatsTableProps) {
  return (
    <DataTable<AchatRow>
      rows={rows}
      columns={COLUMNS}
      isLoading={isLoading}
      sortBy={sortBy ?? undefined}
      sortOrder={sortOrder}
      onSort={onSort}
      pagination={pagination}
      emptyTitle="Aucun achat trouvé"
      emptyHint="Ajustez les filtres ou importez un fichier d'achats."
      rowKey={(r) => r.id}
    />
  );
}
