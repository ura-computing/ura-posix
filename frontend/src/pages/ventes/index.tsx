import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef, getCoreRowModel, useReactTable, type SortingState } from "@tanstack/react-table";
import { useMe } from "@/hooks/useMe";
import { useVentesList } from "@/hooks/useVentesList";
import { Link, useNavigate } from "react-router";
import { Download, UploadCloud } from "lucide-react";
import { eUserRole, eCategoryType } from "@/types";

import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/shared/listView";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/DataTable/dataTable";
import { PageFilter } from "@/components/pageFilter";
import { CategoryMultiSelect } from "@/components/categoryMultiSelect";
import { TvaMultiSelect } from "@/components/tvaMultiSelect";
import * as transactionsApi from "@/api/transactions";
import { toast } from "sonner";
import { fmt } from "@/utils/format";
import { downloadXlsx, exportFilename } from "@/utils/table";
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
        to="/dashboard/upload-file?type=vente"
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
  /** PPV × qty × (1 − Remise %) — catalog-derived line sub-total. */
  subtotal: number | null;
  total: number | null;
  avg_pu: number | null;
};

const VENTE_COL_LABELS: Record<string, string> = {
  date: "Date", transaction_ref: "N° Transaction", transaction_ref_final: "N° Transaction Final",
  client: "Client", product: "Produit", category: "Catégorie", tva: "TVA",
  quantity: "Qté", discount: "Remise", ppv: "PPV", subtotal: "Sous-total", total: "Total",
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
  subtotal: (r) => String(r.subtotal ?? ""),
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
  // Default to no date filter so freshly-imported data is visible without
  // the user manually widening the range. Pharmacists can still narrow via
  // the date picker.
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryType, setCategoryType] = useState<eCategoryType>(eCategoryType.ALL);
  const [exporting, setExporting] = useState(false);
  const [venteFilter, setVenteFilter] = useState<string>("all-flagged");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sorting, setSorting] = useState<SortingState>([]);
  const sortBy = sorting[0]?.id;
  const sortOrder: "asc" | "desc" | undefined = sorting[0]
    ? (sorting[0].desc ? "desc" : "asc")
    : undefined;

  useEffect(() => {
    if (user?.role === eUserRole.ADMIN) navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    transactionsApi.venteCategories().then(setAllCategories).catch(() => {});
    transactionsApi.venteTvaRates().then(setAllTvaRates).catch(() => {});
  }, []);

  useEffect(() => { setPage(1); }, [searchQuery, selectedCats, selectedTva, dateFrom, dateTo, categoryType]);

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
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy,
    sortOrder,
  });

  // Separate query for surveillance table (filtered by selected tab)
  const surveillanceParam = venteFilter === "all-flagged" ? "all" : venteFilter === "marge-negative" ? "marge_negative" : venteFilter === "marge-low" ? "marge_low" : venteFilter === "remises" ? "remises" : venteFilter === "remises-high" ? "remises_high" : undefined;
  const [survPage, setSurvPage] = useState(1);
  const [survLimit, setSurvLimit] = useState(20);
  const [survSorting, setSurvSorting] = useState<SortingState>([]);
  const survSortBy = survSorting[0]?.id;
  const survSortOrder: "asc" | "desc" | undefined = survSorting[0]
    ? (survSorting[0].desc ? "desc" : "asc")
    : undefined;
  const { ventesRows: survRows, ventesPagination: survPagination, ventesPageCount: survPageCount, ventesLoading: survLoading } = useVentesList({
    page: survPage, limit: survLimit,
    search: searchQuery,
    categories: effectiveCategories,
    tva: selectedTva,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    surveillance: surveillanceParam,
    sortBy: survSortBy,
    sortOrder: survSortOrder,
  });
  const rows = ventesRows as VenteRow[];

  // Fetch global surveillance counts from backend
  const { data: survCounts } = useQuery({
    queryKey: ["vente-surveillance-counts", dateFrom, dateTo, searchQuery, effectiveCategories, selectedTva],
    queryFn: () => transactionsApi.venteSurveillanceCounts(dateFrom || undefined, dateTo || undefined, searchQuery, effectiveCategories, selectedTva),
  });

  const venteFilterTabs = [
    {
      key: "all-flagged",
      label: "Ventes à surveiller",
      count: survCounts?.all ?? 0,
      activeClass: "bg-rose-600 text-white border-rose-600",
      inactiveClass: "text-rose-700 border-rose-300 hover:bg-rose-50",
      countActiveClass: "bg-white/20 text-white",
      countInactiveClass: "bg-rose-100 text-rose-700",
    },
    {
      key: "marge-negative",
      label: "Marge n\u00e9gative",
      count: survCounts?.marge_negative ?? 0,
      activeClass: "bg-red-600 text-white border-red-600",
      inactiveClass: "text-red-700 border-red-300 hover:bg-red-50",
      countActiveClass: "bg-white/20 text-white",
      countInactiveClass: "bg-red-100 text-red-700",
    },
    {
      key: "marge-low",
      label: "Marge < 10%",
      count: survCounts?.marge_low ?? 0,
      activeClass: "bg-orange-600 text-white border-orange-600",
      inactiveClass: "text-orange-700 border-orange-300 hover:bg-orange-50",
      countActiveClass: "bg-white/20 text-white",
      countInactiveClass: "bg-orange-100 text-orange-700",
    },
    // {
    //   key: "remises",
    //   label: "Remises",
    //   count: survCounts?.remises ?? 0,
    //   activeClass: "bg-amber-600 text-white border-amber-600",
    //   inactiveClass: "text-amber-700 border-amber-300 hover:bg-amber-50",
    //   countActiveClass: "bg-white/20 text-white",
    //   countInactiveClass: "bg-amber-100 text-amber-700",
    // },
    {
      key: "remises-high",
      label: "Remise > 20%",
      count: survCounts?.remises_high ?? 0,
      activeClass: "bg-pink-600 text-white border-pink-600",
      inactiveClass: "text-pink-700 border-pink-300 hover:bg-pink-50",
      countActiveClass: "bg-white/20 text-white",
      countInactiveClass: "bg-pink-100 text-pink-700",
    },
  ];

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
          if (!v) return <span className="tabular-nums text-sm">0</span>;
          return <span className="tabular-nums text-sm text-amber-600">{fmt(Math.abs(v))}</span>;
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
        // Catalog-derived line sub-total = PPV × qté × (1 − Remise %).
        // Replaces the old "Prix unitaire" cell that surfaced Vente.unit_price
        // directly from Sobrus — the user prefers the recomputed value.
        id: "subtotal",
        accessorKey: "subtotal",
        size: 110,
        header: () => <p className="column-title">Sous-total</p>,
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
    state: { sorting },
    onSortingChange: setSorting,
    manualPagination: true,
    manualSorting: true,
    pageCount,
  });

  const surveillanceTable = useReactTable({
    data: survRows as VenteRow[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { sorting: survSorting },
    onSortingChange: setSurvSorting,
    manualPagination: true,
    manualSorting: true,
    pageCount: survPageCount,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await transactionsApi.exportVente(searchQuery, selectedCats, dateFrom || undefined, dateTo || undefined, selectedTva);
      const colValues: Record<string, (r: Record<string, unknown>) => string> = {
        ...VENTE_COL_VALUES,
        transaction_ref_final: (r) => String(r.transaction_ref_final ?? ""),
      };
      const visibleCols = tableInstance.getAllColumns().filter(col => (!col.getCanHide() || col.getIsVisible()) && colValues[col.id]);
      const headers = visibleCols.map(col => VENTE_COL_LABELS[col.id] ?? col.id);
      const rowMapper = (r: Record<string, unknown>) => visibleCols.map(col => colValues[col.id]!(r));
      await downloadXlsx(res.data, rowMapper, headers, exportFilename("VENTE", "xlsx", dateFrom || undefined, dateTo || undefined), "Ventes");
      toast.success(`${res.data.length} lignes exportées`);
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  const [exportingSurv, setExportingSurv] = useState(false);
  const handleExportSurveillance = async () => {
    setExportingSurv(true);
    try {
      const res = await transactionsApi.exportVente(
        searchQuery,
        selectedCats,
        dateFrom || undefined,
        dateTo || undefined,
        selectedTva,
        surveillanceParam,
      );
      const colValues: Record<string, (r: Record<string, unknown>) => string> = {
        ...VENTE_COL_VALUES,
        transaction_ref_final: (r) => String(r.transaction_ref_final ?? ""),
      };
      const visibleCols = surveillanceTable.getAllColumns().filter(col => (!col.getCanHide() || col.getIsVisible()) && colValues[col.id]);
      const headers = visibleCols.map(col => VENTE_COL_LABELS[col.id] ?? col.id);
      const rowMapper = (r: Record<string, unknown>) => visibleCols.map(col => colValues[col.id]!(r));
      const tabLabel = venteFilterTabs.find((t) => t.key === venteFilter)?.label ?? "SURVEILLANCE";
      await downloadXlsx(res.data, rowMapper, headers, exportFilename(`VENTE ${tabLabel.toUpperCase()}`, "xlsx", dateFrom || undefined, dateTo || undefined), "Ventes");
      toast.success(`${res.data.length} lignes exportées`);
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExportingSurv(false);
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
      <PageFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        categoryType={categoryType}
        onCategoryTypeChange={setCategoryType}
        search={{
          query: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Produit, client, N° transaction…",
          fetchSuggestions: transactionsApi.venteSuggestions,
          suggestionGroupLabels: { products: "Produit", clients: "Client", refs: "N° Transaction" },
        }}
        extraFilters={
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <CategoryMultiSelect allCategories={allCategories} selected={selectedCats} onChange={setSelectedCats} />
            </div>
            <div>
              <TvaMultiSelect allRates={allTvaRates} selected={selectedTva} onChange={setSelectedTva} />
            </div>
          </div>
        }
        rightSlot={
          <>
            <ColumnVisibilityToggle
              table={tableInstance}
              storageKey="ventes-cols"
              columnLabels={VENTE_COL_LABELS}
            />
            <button
              type="button"
              disabled={exporting}
              title="Exporter CSV"
              onClick={handleExport}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" />
              Exporter
            </button>
            {user?.permissions?.import !== false && (
              <Link
                to="/dashboard/upload-file?type=vente"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Importer
              </Link>
            )}
          </>
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
          {/* Surveillance tabs + red-bordered table */}
          {survCounts && (
            <>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {venteFilterTabs.map((tab) => {
                  const isActive = venteFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => { setVenteFilter(tab.key); setSurvPage(1); }}
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
                <button
                  type="button"
                  disabled={exportingSurv || !survPagination?.total}
                  title="Exporter le tableau de surveillance"
                  onClick={handleExportSurveillance}
                  className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exporter
                </button>
              </div>

              <div className="rounded-lg border-2 border-red-500 overflow-hidden">
                  <DataTable
                    table={surveillanceTable}
                    isLoading={survLoading}
                    pagination={{
                      currentPage: survPage,
                      setCurrentPage: setSurvPage,
                      pageCount: survPageCount,
                      pageSize: survLimit,
                      setPageSize: (s: number) => { setSurvLimit(s); setSurvPage(1); },
                      total: survPagination?.total,
                    }}
                    emptyState={
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        Aucune vente à surveiller.
                      </div>
                    }
                  />
                </div>
            </>
          )}

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
