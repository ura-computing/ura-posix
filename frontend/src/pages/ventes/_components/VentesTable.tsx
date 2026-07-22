import { SuffixBadge } from "@/components/shared/SuffixBadge";
import { DataTable, type ColumnDef, type DataTablePagination } from "@/components/shared/DataTable";
import { formatMAD, formatPct, formatQty } from "@/utils/format";
import type { VenteRow } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";


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
      {mode === "pct" ? formatPct(pct) : formatMAD(dh)}
    </span>
  );
}


function TypeBadge({ type }: { type: VenteRow["category_type"] }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  const t = useT();
  const isPharma = type === "pharmacie";
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
      isPharma
        ? "bg-pharmacie-bg text-pharmacie-fg border-pharmacie-border"
        : "bg-parapharmacie-bg text-parapharmacie-fg border-parapharmacie-border"
    }`}>
      {isPharma ? t("category.pharmacie") : t("category.parapharmacie")}
    </span>
  );
}


const buildColumns = (t: TFn): ColumnDef<VenteRow>[] => [
  { key: "date", label: t("col.date"), width: 100,
    render: (r) => <span className="font-mono text-sm tabular-nums text-muted-foreground">{r.date ?? "—"}</span> },
  { key: "transaction_ref", label: t("col.transaction"), width: 170,
    render: (r) => r.transaction_ref ? (
      <span className="flex items-center">
        <span className="rounded border border-border bg-surface-subtle px-1.5 py-px font-mono text-xs">{r.transaction_ref}</span>
        {r.transaction_ref_final && r.transaction_ref_color && (
          <SuffixBadge text={r.transaction_ref_final.slice(r.transaction_ref.length)} color={r.transaction_ref_color} />
        )}
      </span>
    ) : <span className="text-muted-foreground">—</span> },
  { key: "client", label: t("col.client"), width: 160,
    render: (r) => r.client ? r.client : <span className="italic text-muted-foreground">{t("ventes.anonyme")}</span> },
  { key: "product", label: t("col.produit"), width: 240,
    render: (r) => (
      <div className="flex flex-col">
        <span className="truncate text-base" title={r.product ?? ""}>{r.product ?? "—"}</span>
        <span className="truncate font-mono text-[11px] text-muted-foreground">{r.pid ?? ""}</span>
      </div>
    ) },
  { key: "category", label: t("col.categorie"), width: 160,
    render: (r) => <span className="block max-w-[150px] truncate text-sm text-muted-foreground">{r.category ?? "—"}</span> },
  { key: "type", label: t("col.type"), width: 110, sortable: false,
    render: (r) => <TypeBadge type={r.category_type} /> },
  { key: "tva", label: t("col.tva"), width: 80, sortable: false,
    render: (r) => r.tva ? <span className="font-mono text-xs text-muted-foreground">{r.tva}</span> : <span className="text-muted-foreground">—</span> },
  { key: "quantity", label: t("col.qte"), width: 70, align: "right",
    render: (r) => r.quantity != null ? formatQty(r.quantity) : "—" },
  { key: "discount", label: t("col.remise"), width: 80, align: "right",
    render: (r) => r.discount && r.discount > 0
      ? <span className="text-warning">{formatQty(r.discount)} %</span>
      : <span className="text-muted-foreground">0</span> },
  { key: "ppv", label: t("col.ppv"), width: 100, align: "right",
    render: (r) => r.ppv != null ? formatMAD(r.ppv) : "—" },
  { key: "subtotal", label: t("col.sousTotal"), width: 110, align: "right", sortable: false,
    render: (r) => r.subtotal != null ? formatMAD(r.subtotal) : "—" },
  { key: "total", label: t("col.total"), width: 110, align: "right",
    render: (r) => <span className="font-semibold">{r.total != null ? formatMAD(r.total) : "—"}</span> },
  { key: "marge_pct", label: t("col.margePct"), width: 90, align: "right",
    render: (r) => <MargeCell row={r} mode="pct" /> },
  { key: "marge_dh", label: t("col.margeDh"), width: 110, align: "right",
    render: (r) => <MargeCell row={r} mode="dh" /> },
];


export function VentesTable({ rows, isLoading, sortBy, sortOrder, onSort, pagination }: VentesTableProps) {
  const t = useT();
  return (
    <DataTable<VenteRow>
      rows={rows}
      columns={buildColumns(t)}
      isLoading={isLoading}
      sortBy={sortBy ?? undefined}
      sortOrder={sortOrder}
      onSort={onSort}
      pagination={pagination}
      emptyTitle={t("ventes.empty")}
      emptyHint={t("ventes.emptyHint")}
      rowKey={(r) => r.id}
    />
  );
}
