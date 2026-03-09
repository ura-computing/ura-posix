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

const VenteEmptyState = ({ canImport }: { canImport: boolean }) => (
  <div className="flex flex-col items-center gap-4 px-6 py-4 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#14b8a6]/10">
      <UploadCloud className="h-7 w-7 text-[#14b8a6]" />
    </div>
    <div>
      <p className="text-base font-semibold text-foreground">Aucune vente importée</p>
      <p className="text-sm text-muted-foreground mt-1">
        Importez un fichier CSV Sobrus pour voir vos transactions de vente.
      </p>
    </div>
    {canImport && (
      <Link
        to="/dashboard/upload-file"
        className="inline-flex items-center gap-2 rounded-lg bg-[#14b8a6] px-4 py-2 text-sm font-medium text-white hover:bg-[#0d9488] transition-colors"
      >
        <UploadCloud className="h-4 w-4" />
        Importer les ventes
      </Link>
    )}
  </div>
);

type VenteRow = {
  id: number;
  date: string | null;
  transaction_ref: string | null;
  transaction_ref_final: string | null;
  transaction_ref_color: string | null;
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

const VENTE_COL_LABELS: Record<string, string> = {
  date: "Date", transaction_ref: "N° Transaction", transaction_ref_final: "N° Transaction Final",
  client: "Client", product: "Produit", category: "Catégorie",
  quantity: "Qté", discount: "Remise", ppv: "PPV", unit_price: "Prix unitaire", total: "Total",
};

const VENTE_COL_VALUES: Record<string, (r: Record<string, unknown>) => string> = {
  date: (r) => String(r.date ?? ""),
  transaction_ref: (r) => String(r.transaction_ref ?? ""),
  transaction_ref_final: (r) => String(r.transaction_ref_final ?? ""),
  client: (r) => String(r.client ?? ""),
  product: (r) => String(r.product ?? ""),
  category: (r) => String(r.category ?? ""),
  quantity: (r) => String(r.quantity ?? ""),
  discount: (r) => String(r.discount ?? ""),
  ppv: (r) => String(r.ppv ?? ""),
  unit_price: (r) => String(r.unit_price ?? ""),
  total: (r) => String(r.total ?? ""),
};

const VentesList = () => {
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
    api.tables.venteCategories().then(setAllCategories).catch(() => {});
    api.tables.venteTvaRates().then(setAllTvaRates).catch(() => {});
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const dateFrom = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
      const dateTo = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
      const res = await api.tables.exportVente(searchQuery, selectedCats, dateFrom, dateTo, selectedTva);
      const colValues: Record<string, (r: Record<string, unknown>) => string> = {
        ...VENTE_COL_VALUES,
        transaction_ref_final: (r) => String(r.transaction_ref_final ?? ""),
      };
      const visibleCols = table.reactTable.getAllColumns().filter(col => (!col.getCanHide() || col.getIsVisible()) && colValues[col.id]);
      const headers = visibleCols.map(col => VENTE_COL_LABELS[col.id] ?? col.id);
      const rowMapper = (r: Record<string, unknown>) => visibleCols.map(col => colValues[col.id]!(r));
      downloadCSV(res.data, rowMapper, headers, `ventes_export_${Date.now()}.csv`);
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
        id: "transaction_ref_final",
        size: 150,
        header: () => <p className="column-title">N° Transaction Final</p>,
        cell: ({ row }) => {
          const ref = row.original.transaction_ref;
          const final = row.original.transaction_ref_final;
          const color = row.original.transaction_ref_color;
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
      <h1 className="page-title">Ventes</h1>

      <p className="text-sm text-muted-foreground -mt-2">Historique des transactions de vente.</p>
      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Produit, client, N° transaction…"
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
        fetchSuggestions={api.tables.venteSuggestions}
        suggestionGroupLabels={{ products: "Produit", clients: "Client", refs: "N° Transaction" }}
        rightAddon={
          <ColumnVisibilityToggle
            table={table.reactTable}
            storageKey="ventes-cols"
            columnLabels={VENTE_COL_LABELS}
          />
        }
      />

      <DataTable table={table} emptyState={<VenteEmptyState canImport={identity?.permissions?.import !== false} />} />
    </ListView>
  );
};

export default VentesList;
