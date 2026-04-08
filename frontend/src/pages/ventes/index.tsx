import { useEffect, useMemo, useState } from "react";
import { ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMe } from "@/hooks/useMe";
import { useVentesList } from "@/hooks/useVentesList";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Link, useNavigate } from "react-router";
import { UploadCloud } from "lucide-react";
import { eUserRole, eCategoryType } from "@/types";

import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/shared/listView";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/DataTable/dataTable";
import { TableToolbar } from "@/components/tableToolbar";
import * as transactionsApi from "@/api/transactions";
import { toast } from "sonner";
import { fmt } from "@/utils/format";
import { downloadCSV } from "@/utils/table";
import { SuffixBadge } from "@/components/suffixBadge";
import { ColumnVisibilityToggle } from "@/components/columnVisibilityToggle";
import { cn } from "@/utils/cn";

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
  avg_pu: number | null;
};

const VENTE_COL_LABELS: Record<string, string> = {
  date: "Date", transaction_ref: "N° Transaction", transaction_ref_final: "N° Transaction Final",
  client: "Client", product: "Produit", category: "Catégorie", tva: "TVA",
  quantity: "Qté", discount: "Remise", ppv: "PPV", unit_price: "Prix unitaire", total: "Total",
  marge_pct: "Marge %", marge_dh: "Marge DH",
};

const VENTE_COL_VALUES: Record<string, (r: Record<string, unknown>) => string> = {
  date: (r) => String(r.date ?? ""),
  transaction_ref: (r) => String(r.transaction_ref ?? ""),
  transaction_ref_final: (r) => String(r.transaction_ref_final ?? ""),
  client: (r) => String(r.client ?? ""),
  product: (r) => String(r.product ?? ""),
  category: (r) => String(r.category ?? ""),
  tva: (r) => String(r.tva ?? ""),
  quantity: (r) => String(r.quantity ?? ""),
  discount: (r) => String(r.discount ?? ""),
  ppv: (r) => String(r.ppv ?? ""),
  unit_price: (r) => String(r.unit_price ?? ""),
  total: (r) => String(r.total ?? ""),
  marge_pct: (r) => {
    const pu = r.avg_pu as number | null;
    const ppv = r.ppv as number | null;
    if (pu == null || ppv == null || ppv === 0) return "";
    return ((1 - (pu / ppv)) * 100).toFixed(1);
  },
  marge_dh: (r) => {
    const pu = r.avg_pu as number | null;
    const ppv = r.ppv as number | null;
    if (pu == null || ppv == null) return "";
    return (ppv - pu).toFixed(2);
  },
};

const VentesList = () => {
  const { me: user } = useMe();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [selectedTva, setSelectedTva] = useState<string[]>([]);
  const [allTvaRates, setAllTvaRates] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [categoryType, setCategoryType] = useState<eCategoryType>(eCategoryType.ALL);
  const [exporting, setExporting] = useState(false);
  const [venteFilter, setVenteFilter] = useState<string>("all-flagged");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    if (user?.role === eUserRole.ADMIN) navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    transactionsApi.venteCategories().then(setAllCategories).catch(() => {});
    transactionsApi.venteTvaRates().then(setAllTvaRates).catch(() => {});
  }, []);

  const dateFrom = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
  const dateTo = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;

  useEffect(() => { setPage(1); }, [searchQuery, selectedCats, selectedTva, dateRange, categoryType]);

  const effectiveCategories = useMemo(() => {
    const typeCats = categoryType === eCategoryType.ALL
      ? allCategories
      : categoryType === eCategoryType.PHARMACIE
        ? allCategories.filter(c => c.toLowerCase().includes("edicament") || c.toLowerCase().includes("édicament") || c.toLowerCase().includes("oméopath") || c.toLowerCase().includes("omeopath"))
        : allCategories.filter(c => !(c.toLowerCase().includes("edicament") || c.toLowerCase().includes("édicament") || c.toLowerCase().includes("oméopath") || c.toLowerCase().includes("omeopath")));
    if (selectedCats.length === 0) return categoryType === eCategoryType.ALL ? [] : typeCats;
    return selectedCats.filter(c => typeCats.includes(c));
  }, [allCategories, selectedCats, categoryType]);

  const { ventesRows, ventesPagination: paginationMeta, ventesPageCount: pageCount, ventesLoading: isLoading } = useVentesList({
    page, limit,
    search: searchQuery,
    categories: effectiveCategories,
    tva: selectedTva,
    dateFrom, dateTo,
  });
  const rows = ventesRows as VenteRow[];

  const venteFilterTabs = useMemo(() => {
    const isMargeNegative = (r: VenteRow) =>
      r.avg_pu != null && r.ppv != null && r.avg_pu > r.ppv;
    const isLowMargin = (r: VenteRow) =>
      r.avg_pu != null && r.ppv != null && r.ppv > 0 && (1 - r.avg_pu / r.ppv) * 100 < 10 && !(r.avg_pu > r.ppv);
    const hasDiscount = (r: VenteRow) => (r.discount ?? 0) > 0;

    const anyFlag = (r: VenteRow) => isMargeNegative(r) || isLowMargin(r) || hasDiscount(r);

    return [
      {
        key: "all-flagged",
        label: "Ventes à surveiller",
        count: rows.filter(anyFlag).length,
        filterFn: anyFlag,
        activeClass: "bg-rose-600 text-white border-rose-600",
        inactiveClass: "text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-700 dark:hover:bg-rose-950/30",
        countActiveClass: "bg-white/20 text-white",
        countInactiveClass: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
      },
      {
        key: "marge-negative",
        label: "Marge n\u00e9gative",
        count: rows.filter(isMargeNegative).length,
        filterFn: isMargeNegative,
        activeClass: "bg-red-600 text-white border-red-600",
        inactiveClass: "text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950/30",
        countActiveClass: "bg-white/20 text-white",
        countInactiveClass: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
      },
      {
        key: "marge-low",
        label: "Marge < 10%",
        count: rows.filter(isLowMargin).length,
        filterFn: isLowMargin,
        activeClass: "bg-orange-600 text-white border-orange-600",
        inactiveClass: "text-orange-700 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950/30",
        countActiveClass: "bg-white/20 text-white",
        countInactiveClass: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
      },
      {
        key: "remises",
        label: "Remises",
        count: rows.filter(hasDiscount).length,
        filterFn: hasDiscount,
        activeClass: "bg-amber-600 text-white border-amber-600",
        inactiveClass: "text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950/30",
        countActiveClass: "bg-white/20 text-white",
        countInactiveClass: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
      },
    ] as const;
  }, [rows]);

  const activeTab = venteFilterTabs.find(t => t.key === venteFilter) ?? venteFilterTabs[0];
  const surveillanceRows = useMemo(
    () => rows.filter(activeTab.filterFn),
    [rows, activeTab],
  );

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
        id: "type",
        size: 120,
        header: () => <p className="column-title">Type</p>,
        cell: ({ row }) => {
          const cat = (row.original.category ?? "").toLowerCase();
          const isPharmacy = cat.includes("edicament") || cat.includes("édicament") || cat.includes("oméopath") || cat.includes("omeopath");
          if (!row.original.category) return <span className="text-muted-foreground">—</span>;
          return (
            <Badge variant="outline" className={isPharmacy
              ? "text-blue-700 border-blue-300 bg-blue-50 text-xs"
              : "text-purple-700 border-purple-300 bg-purple-50 text-xs"}>
              {isPharmacy ? "Pharmacie" : "Parapharmacie"}
            </Badge>
          );
        },
      },
      {
        id: "tva",
        accessorKey: "tva",
        size: 80,
        header: () => <p className="column-title">TVA</p>,
        cell: ({ getValue }) => {
          const v = getValue<string | null>();
          if (!v) return <span className="text-muted-foreground">—</span>;
          return <Badge variant="outline" className="text-xs font-mono">{v}</Badge>;
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
      {
        id: "marge_pct",
        size: 100,
        header: () => <p className="column-title">Marge %</p>,
        cell: ({ row }) => {
          const pu = row.original.avg_pu;
          const ppv = row.original.ppv;
          if (pu == null || ppv == null || ppv === 0) return <span className="text-muted-foreground">—</span>;
          const pct = (1 - pu / ppv) * 100;
          return (
            <span className={cn("tabular-nums text-sm font-medium", pct < 0 ? "text-red-600" : pct < 10 ? "text-orange-600" : "text-emerald-600")}>
              {pct.toFixed(1)}%
            </span>
          );
        },
      },
      {
        id: "marge_dh",
        size: 110,
        header: () => <p className="column-title">Marge DH</p>,
        cell: ({ row }) => {
          const pu = row.original.avg_pu;
          const ppv = row.original.ppv;
          if (pu == null || ppv == null) return <span className="text-muted-foreground">—</span>;
          const val = ppv - pu;
          return (
            <span className={cn("tabular-nums text-sm font-medium", val < 0 ? "text-red-600" : "text-foreground")}>
              {fmt(val)}
            </span>
          );
        },
      },
    ],
    [],
  );

  const tableInstance = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });

  const surveillanceTable = useReactTable({
    data: surveillanceRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await transactionsApi.exportVente(searchQuery, selectedCats, dateFrom, dateTo, selectedTva);
      const colValues: Record<string, (r: Record<string, unknown>) => string> = {
        ...VENTE_COL_VALUES,
        transaction_ref_final: (r) => String(r.transaction_ref_final ?? ""),
      };
      const visibleCols = tableInstance.getAllColumns().filter(col => (!col.getCanHide() || col.getIsVisible()) && colValues[col.id]);
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

  const tvaPageTotal = useMemo(() =>
    rows.reduce((acc, row) => {
      const m = String(row.tva ?? "").match(/([\d.]+)\s*%/);
      const rate = m ? parseFloat(m[1]) / 100 : 0;
      return acc + (row.total ?? 0) * rate;
    }, 0),
  [rows]);

  if (user?.role === eUserRole.ADMIN) return null;

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
        fetchSuggestions={transactionsApi.venteSuggestions}
        suggestionGroupLabels={{ products: "Produit", clients: "Client", refs: "N° Transaction" }}
        rightAddon={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCategoryType(eCategoryType.ALL)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
                categoryType === eCategoryType.ALL
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:bg-muted"
              )}
            >
              Mixte
            </button>
            <button
              onClick={() => setCategoryType(eCategoryType.PHARMACIE)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
                categoryType === eCategoryType.PHARMACIE
                  ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
                  : "bg-transparent text-green-700 border-green-400 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30"
              )}
            >
              Pharmacie
            </button>
            <button
              onClick={() => setCategoryType(eCategoryType.PARAPHARMACIE)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
                categoryType === eCategoryType.PARAPHARMACIE
                  ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700"
                  : "bg-transparent text-purple-700 border-purple-400 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-700 dark:hover:bg-purple-950/30"
              )}
            >
              Parapharmacie
            </button>
            <ColumnVisibilityToggle
              table={tableInstance}
              storageKey="ventes-cols"
              columnLabels={VENTE_COL_LABELS}
            />
            {user?.permissions?.import !== false && (
              <Link
                to="/dashboard/upload-file"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Importer
              </Link>
            )}
          </div>
        }
      />

      <DataTable
        table={tableInstance}
        isLoading={isLoading}
        pagination={{
          currentPage: page,
          setCurrentPage: setPage,
          pageCount,
          pageSize: limit,
          setPageSize: setLimit,
          total: paginationMeta?.total,
        }}
        emptyState={<VenteEmptyState canImport={user?.permissions?.import !== false} />}
      />

      {rows.length > 0 && (
        <>
          {/* Surveillance tabs */}
          <div className="flex flex-wrap gap-2 mt-4">
            {venteFilterTabs.map((tab) => {
              const isActive = venteFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setVenteFilter(tab.key)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                    isActive ? tab.activeClass : tab.inactiveClass,
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-full px-1.5 min-w-[1.25rem] h-5 text-[11px] font-semibold tabular-nums",
                      isActive ? tab.countActiveClass : tab.countInactiveClass,
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Surveillance table — red border */}
          <div className="rounded-lg border-2 border-red-500 overflow-hidden">
            <DataTable
              table={surveillanceTable}
              isLoading={isLoading}
              emptyState={
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Aucune vente à surveiller sur cette page.
                </div>
              }
            />
          </div>

          <div className="mt-2 rounded-lg border border-border bg-muted/40 px-4 py-2 flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">TVA encaissée (page courante) :</span>
            <span className="font-semibold tabular-nums">{fmt(tvaPageTotal)} MAD</span>
          </div>
        </>
      )}
    </ListView>
  );
};

export default VentesList;
