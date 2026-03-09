import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useTable } from "@refinedev/react-table";
import { useGetIdentity } from "@refinedev/core";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Link, useNavigate } from "react-router";
import { UploadCloud } from "lucide-react";
import type { User } from "@/types";
import { eUserRole } from "@/types";

import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { TableToolbar } from "@/components/table-toolbar";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { fmt, downloadCSV } from "@/lib/table-utils";
import { SuffixBadge } from "@/components/suffix-badge";
import { ColumnVisibilityToggle } from "@/components/column-visibility-toggle";

const AchatEmptyState = ({ canImport }: { canImport: boolean }) => (
  <div className="flex flex-col items-center gap-4 px-6 py-4 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10">
      <UploadCloud className="h-7 w-7 text-violet-500" />
    </div>
    <div>
      <p className="text-base font-semibold text-foreground">Aucun achat importé</p>
      <p className="text-sm text-muted-foreground mt-1">
        Importez un fichier CSV Sobrus pour voir vos bons de livraison.
      </p>
    </div>
    {canImport && (
      <Link
        to="/dashboard/upload-file"
        className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 transition-colors"
      >
        <UploadCloud className="h-4 w-4" />
        Importer les achats
      </Link>
    )}
  </div>
);

type AchatRow = {
  id: number;
  delivery_date: string | null;
  delivery_ref: string | null;
  delivery_ref_final: string | null;
  delivery_ref_color: string | null;
  supplier: string | null;
  pid: string | null;
  product: string | null;
  category: string | null;
  tva: string | null;
  quantity: number | null;
  pph: number | null;
  ppv: number | null;
  unit_price: number | null;
  expiry_date: string | null;
  total: number | null;
};

const ACHAT_COL_LABELS: Record<string, string> = {
  delivery_date: "Date BL", delivery_ref: "Référence", delivery_ref_final: "Référence Finale",
  supplier: "Fournisseur", product: "Produit", category: "Catégorie",
  quantity: "Qté", pph: "PPH", unit_price: "Prix unitaire", expiry_date: "Péremption", total: "Total",
};

const ACHAT_COL_VALUES: Record<string, (r: Record<string, unknown>) => string> = {
  delivery_date: (r) => String(r.delivery_date ?? ""),
  delivery_ref: (r) => String(r.delivery_ref ?? ""),
  delivery_ref_final: (r) => String(r.delivery_ref_final ?? ""),
  supplier: (r) => String(r.supplier ?? ""),
  product: (r) => String(r.product ?? ""),
  category: (r) => String(r.category ?? ""),
  quantity: (r) => String(r.quantity ?? ""),
  pph: (r) => String(r.pph ?? ""),
  unit_price: (r) => String(r.unit_price ?? ""),
  expiry_date: (r) => String(r.expiry_date ?? ""),
  total: (r) => String(r.total ?? ""),
};

const AchatList = () => {
  const { data: identity } = useGetIdentity<User>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [selectedTva, setSelectedTva] = useState<string[]>([]);
  const [allTvaRates, setAllTvaRates] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (identity?.role === eUserRole.ADMIN) navigate("/", { replace: true });
  }, [identity, navigate]);

  useEffect(() => {
    api.tables.achatCategories().then(setAllCategories).catch(() => {});
    api.tables.achatTvaRates().then(setAllTvaRates).catch(() => {});
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const dateFrom = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
      const dateTo = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
      const res = await api.tables.exportAchat(searchQuery, selectedCats, dateFrom, dateTo, selectedTva);
      const colValues: Record<string, (r: Record<string, unknown>) => string> = {
        ...ACHAT_COL_VALUES,
        delivery_ref_final: (r) => String(r.delivery_ref_final ?? ""),
      };
      const visibleCols = table.reactTable.getAllColumns().filter(col => (!col.getCanHide() || col.getIsVisible()) && colValues[col.id]);
      const headers = visibleCols.map(col => ACHAT_COL_LABELS[col.id] ?? col.id);
      const rowMapper = (r: Record<string, unknown>) => visibleCols.map(col => colValues[col.id]!(r));
      downloadCSV(res.data, rowMapper, headers, `achats_export_${Date.now()}.csv`);
      toast.success(`${res.data.length} lignes exportées`);
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo<ColumnDef<AchatRow>[]>(
    () => [
      {
        id: "delivery_date",
        accessorKey: "delivery_date",
        size: 110,
        header: () => <p className="column-title">Date BL</p>,
        cell: ({ getValue }) => (
          <span className="text-sm tabular-nums">{getValue<string>() ?? "—"}</span>
        ),
      },
      {
        id: "delivery_ref",
        accessorKey: "delivery_ref",
        size: 100,
        header: () => <p className="column-title">Référence</p>,
        cell: ({ getValue }) =>
          getValue<string>() ? (
            <Badge variant="outline" className="font-mono text-xs">{getValue<string>()}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "delivery_ref_final",
        size: 150,
        header: () => <p className="column-title">Référence Finale</p>,
        cell: ({ row }) => {
          const ref = row.original.delivery_ref;
          const final = row.original.delivery_ref_final;
          const color = row.original.delivery_ref_color;
          if (!final) return <span className="text-muted-foreground">—</span>;
          const suffix = ref ? final.slice(ref.length) : final;
          return (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="font-mono text-xs">{ref}</Badge>
              {suffix && <SuffixBadge suffix={suffix} color={color} />}
            </div>
          );
        },
      },
      {
        id: "supplier",
        accessorKey: "supplier",
        size: 200,
        header: () => <p className="column-title">Fournisseur</p>,
        cell: ({ getValue }) => (
          <span className="truncate text-sm">{getValue<string>() ?? "—"}</span>
        ),
      },
      {
        id: "product",
        accessorKey: "product",
        size: 260,
        header: () => <p className="column-title">Produit</p>,
        cell: ({ row }) => (
          <div className="flex flex-col min-w-0">
            <span className="truncate text-sm font-medium">{row.original.product ?? "—"}</span>
            {row.original.pid && (
              <span className="text-xs text-muted-foreground font-mono">PID {row.original.pid}</span>
            )}
          </div>
        ),
      },
      {
        id: "category",
        accessorKey: "category",
        size: 180,
        header: () => <p className="column-title">Catégorie</p>,
        cell: ({ getValue }) => {
          const cat = getValue<string>();
          if (!cat) return <span className="text-muted-foreground">—</span>;
          const label = cat.replace(/\s*\([\d.]+%\)/, "").trim();
          return <Badge variant="secondary" className="text-xs max-w-[160px] truncate">{label}</Badge>;
        },
      },
      {
        id: "quantity",
        accessorKey: "quantity",
        size: 80,
        header: () => <p className="column-title">Qté</p>,
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{getValue<number>() ?? "—"}</span>
        ),
      },
      {
        id: "pph",
        accessorKey: "pph",
        size: 100,
        header: () => <p className="column-title">PPH</p>,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-sm">{fmt(getValue<number | null>())}</span>
        ),
      },
      {
        id: "unit_price",
        accessorKey: "unit_price",
        size: 110,
        header: () => <p className="column-title">Prix unitaire</p>,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-sm">{fmt(getValue<number | null>())}</span>
        ),
      },
      {
        id: "expiry_date",
        accessorKey: "expiry_date",
        size: 110,
        header: () => <p className="column-title">Péremption</p>,
        cell: ({ getValue }) => {
          const v = getValue<string>();
          if (!v) return <span className="text-muted-foreground">—</span>;
          return <span className="text-sm tabular-nums">{v}</span>;
        },
      },
      {
        id: "total",
        accessorKey: "total",
        size: 110,
        header: () => <p className="column-title">Total</p>,
        cell: ({ getValue }) => (
          <span className="tabular-nums font-semibold text-sm">
            {fmt(getValue<number | null>())}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useTable<AchatRow>({
    columns,
    refineCoreProps: {
      resource: "achat",
      pagination: { pageSize: 20, mode: "server" },
      sorters: { initial: [{ field: "id", order: "desc" }] },
    },
  });

  useEffect(() => {
    const dateFrom = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
    const dateTo = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
    table.refineCore.setFilters(
      [
        ...(searchQuery ? [{ field: "search", operator: "contains" as const, value: searchQuery }] : []),
        ...(selectedCats.length > 0 ? [{ field: "categories", operator: "in" as const, value: selectedCats }] : []),
        ...(selectedTva.length > 0 ? [{ field: "tva", operator: "in" as const, value: selectedTva }] : []),
        ...(dateFrom ? [{ field: "date_from", operator: "gte" as const, value: dateFrom }] : []),
        ...(dateTo ? [{ field: "date_to", operator: "lte" as const, value: dateTo }] : []),
      ],
      "replace",
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedCats, selectedTva, dateRange]);

  if (identity?.role === eUserRole.ADMIN) return null;

  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Achats</h1>

      <p className="text-sm text-muted-foreground -mt-2">Historique des bons de livraison fournisseurs.</p>
      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Produit, fournisseur, référence…"
        allCategories={allCategories}
        selectedCats={selectedCats}
        onCatsChange={setSelectedCats}
        onExport={handleExport}
        exporting={exporting}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        allTvaRates={allTvaRates}
        selectedTva={selectedTva}
        onTvaChange={setSelectedTva}
        fetchSuggestions={api.tables.achatSuggestions}
        suggestionGroupLabels={{ products: "Produit", suppliers: "Fournisseur", refs: "Référence" }}
        rightAddon={
          <ColumnVisibilityToggle
            table={table.reactTable}
            storageKey="achats-cols"
            columnLabels={ACHAT_COL_LABELS}
          />
        }
      />

      <DataTable table={table} emptyState={<AchatEmptyState canImport={identity?.permissions?.import !== false} />} />
    </ListView>
  );
};

export default AchatList;
