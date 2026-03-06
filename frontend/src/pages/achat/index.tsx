import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useTable } from "@refinedev/react-table";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { TableToolbar } from "@/components/table-toolbar";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { fmt, downloadCSV } from "@/lib/table-utils";

type AchatRow = {
  id: number;
  delivery_date: string | null;
  delivery_ref: string | null;
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

const ACHAT_CSV_HEADERS = [
  "Date BL", "Référence", "Fournisseur", "Produit", "PID",
  "Catégorie", "Qté", "PPH", "PPV", "Prix unitaire", "Péremption", "Total",
];

function achatRowToCSV(r: Record<string, unknown>): string[] {
  return [
    String(r.delivery_date ?? ""),
    String(r.delivery_ref ?? ""),
    String(r.supplier ?? ""),
    String(r.product ?? ""),
    String(r.pid ?? ""),
    String(r.category ?? ""),
    String(r.quantity ?? ""),
    String(r.pph ?? ""),
    String(r.ppv ?? ""),
    String(r.unit_price ?? ""),
    String(r.expiry_date ?? ""),
    String(r.total ?? ""),
  ];
}

const AchatList = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.tables.achatCategories().then(setAllCategories).catch(() => {});
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const dateFrom = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
      const dateTo = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
      const res = await api.tables.exportAchat(searchQuery, selectedCats, dateFrom, dateTo);
      downloadCSV(res.data, achatRowToCSV, ACHAT_CSV_HEADERS, `achats_export_${Date.now()}.csv`);
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
        ...(dateFrom ? [{ field: "date_from", operator: "gte" as const, value: dateFrom }] : []),
        ...(dateTo ? [{ field: "date_to", operator: "lte" as const, value: dateTo }] : []),
      ],
      "replace",
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedCats, dateRange]);

  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Achats</h1>

      <div className="intro-row">
        <p className="text-sm text-muted-foreground">Historique des bons de livraison fournisseurs.</p>
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
        />
      </div>

      <DataTable table={table} />
    </ListView>
  );
};

export default AchatList;
