import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useTable } from "@refinedev/react-table";

import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { TableToolbar } from "@/components/table-toolbar";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { fmt, downloadCSV } from "@/lib/table-utils";

type VenteRow = {
  id: number;
  date: string | null;
  transaction_ref: string | null;
  client: string | null;
  pid: string | null;
  product: string | null;
  category: string | null;
  tva: string | null;
  quantity: number | null;
  discount: number | null;
  ppv: number | null;
  unit_price: number | null;
  total: number | null;
};

const VENTE_CSV_HEADERS = [
  "Date", "N° Transaction", "Client", "Produit", "PID",
  "Catégorie", "Qté", "Remise", "PPV", "Prix unitaire", "Total",
];

function venteRowToCSV(r: Record<string, unknown>): string[] {
  return [
    String(r.date ?? ""),
    String(r.transaction_ref ?? ""),
    String(r.client ?? ""),
    String(r.product ?? ""),
    String(r.pid ?? ""),
    String(r.category ?? ""),
    String(r.quantity ?? ""),
    String(r.discount ?? ""),
    String(r.ppv ?? ""),
    String(r.unit_price ?? ""),
    String(r.total ?? ""),
  ];
}

const VentesList = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.tables.venteCategories().then(setAllCategories).catch(() => {});
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.tables.exportVente(searchQuery, selectedCats);
      downloadCSV(res.data, venteRowToCSV, VENTE_CSV_HEADERS, `ventes_export_${Date.now()}.csv`);
      toast.success(`${res.data.length} lignes exportées`);
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo<ColumnDef<VenteRow>[]>(
    () => [
      {
        id: "date",
        accessorKey: "date",
        size: 110,
        header: () => <p className="column-title">Date</p>,
        cell: ({ getValue }) => (
          <span className="text-sm tabular-nums">{getValue<string>() ?? "—"}</span>
        ),
      },
      {
        id: "transaction_ref",
        accessorKey: "transaction_ref",
        size: 130,
        header: () => <p className="column-title">N° Transaction</p>,
        cell: ({ getValue }) =>
          getValue<string>() ? (
            <Badge variant="outline" className="font-mono text-xs">{getValue<string>()}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "client",
        accessorKey: "client",
        size: 170,
        header: () => <p className="column-title">Client</p>,
        cell: ({ getValue }) => {
          const v = getValue<string>();
          return v
            ? <span className="text-sm">{v}</span>
            : <span className="text-muted-foreground text-xs italic">Anonyme</span>;
        },
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
        size: 170,
        header: () => <p className="column-title">Catégorie</p>,
        cell: ({ getValue }) => {
          const cat = getValue<string>();
          if (!cat) return <span className="text-muted-foreground">—</span>;
          const label = cat.replace(/\s*\([\d.]+%\)/, "").trim();
          return <Badge variant="secondary" className="text-xs max-w-[150px] truncate">{label}</Badge>;
        },
      },
      {
        id: "quantity",
        accessorKey: "quantity",
        size: 70,
        header: () => <p className="column-title">Qté</p>,
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{getValue<number>() ?? "—"}</span>
        ),
      },
      {
        id: "discount",
        accessorKey: "discount",
        size: 90,
        header: () => <p className="column-title">Remise</p>,
        cell: ({ getValue }) => {
          const v = getValue<number | null>();
          if (!v) return <span className="text-muted-foreground">—</span>;
          return <span className="tabular-nums text-sm text-amber-600 dark:text-amber-400">-{fmt(v)}</span>;
        },
      },
      {
        id: "ppv",
        accessorKey: "ppv",
        size: 100,
        header: () => <p className="column-title">PPV</p>,
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

  const table = useTable<VenteRow>({
    columns,
    refineCoreProps: {
      resource: "ventes",
      pagination: { pageSize: 20, mode: "server" },
      sorters: { initial: [{ field: "id", order: "desc" }] },
    },
  });

  useEffect(() => {
    table.refineCore.setFilters(
      [
        ...(searchQuery ? [{ field: "search", operator: "contains" as const, value: searchQuery }] : []),
        ...(selectedCats.length > 0 ? [{ field: "categories", operator: "in" as const, value: selectedCats }] : []),
      ],
      "replace",
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedCats]);

  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Ventes</h1>

      <div className="intro-row">
        <p className="text-sm text-muted-foreground">Historique des transactions de vente.</p>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Produit, client, N° transaction…"
          allCategories={allCategories}
          selectedCats={selectedCats}
          onCatsChange={setSelectedCats}
          onExport={handleExport}
          exporting={exporting}
        />
      </div>

      <DataTable table={table} />
    </ListView>
  );
};

export default VentesList;
