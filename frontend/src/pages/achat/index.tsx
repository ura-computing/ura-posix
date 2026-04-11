import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMe } from "@/hooks/useMe";
import { useAchatList } from "@/hooks/useAchatList";
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
        to="/dashboard/upload-file?type=achat"
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
  supplier: "Fournisseur", product: "Produit", category: "Catégorie", tva: "TVA",
  quantity: "Qté", pph: "PPH (catalogue)", unit_price: "PU (achat)", expiry_date: "Péremption", total: "Total",
};

/* ── Supplier summary types removed — now fetched from backend ── */

function NeedleGauge({ grossistePct }: { grossistePct: number }) {
  const clamped = Math.min(100, Math.max(0, grossistePct));
  // Needle angle: 0% grossiste = +90° (right/green), 100% grossiste = -90° (left/red)
  const angle = 90 - (clamped / 100) * 180;

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs font-medium text-muted-foreground mb-1">Jauge</p>
      <svg viewBox="0 0 200 120" className="w-40 h-24">
        {/* Red zone (left): 80-100% grossiste */}
        <path d="M 20 100 A 80 80 0 0 1 56 28" fill="none" stroke="#ef4444" strokeWidth="16" strokeLinecap="round" />
        {/* Yellow zone (middle): 40-80% grossiste */}
        <path d="M 56 28 A 80 80 0 0 1 144 28" fill="none" stroke="#eab308" strokeWidth="16" />
        {/* Green zone (right): 0-40% grossiste */}
        <path d="M 144 28 A 80 80 0 0 1 180 100" fill="none" stroke="#16a34a" strokeWidth="16" strokeLinecap="round" />
        {/* Needle */}
        <g transform={`rotate(${angle}, 100, 100)`}>
          <line x1="100" y1="100" x2="100" y2="30" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="100" r="6" fill="#1e293b" />
          <circle cx="100" cy="100" r="3" fill="white" />
        </g>
      </svg>
      <p className="text-sm font-bold mt-1">{clamped.toFixed(0)}% grossistes</p>
    </div>
  );
}

const SupplierSummarySection = ({ dateFrom, dateTo, search, categories, tva }: {
  dateFrom?: string; dateTo?: string; search?: string; categories?: string[]; tva?: string[];
}) => {
  const { data: summary } = useQuery({
    queryKey: ["achat-supplier-summary", dateFrom, dateTo, search, categories, tva],
    queryFn: () => transactionsApi.achatSupplierSummary(dateFrom, dateTo, search, categories, tva),
  });

  if (!summary) return null;

  const g = summary.grossiste;
  const l = summary.direct_labo;
  const total = g.total_mad + l.total_mad;
  const grossistePct = total > 0 ? (g.total_mad / total) * 100 : 0;

  if (total === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm p-5">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-start">
        {/* Grossistes (left) */}
        <div className="space-y-1">
          <p className="text-sm font-semibold text-muted-foreground mb-2">Grossistes</p>
          <p className="text-xs text-muted-foreground">Achats</p>
          <p className="text-lg font-bold tabular-nums">{fmt(g.total_mad)} MAD</p>
          <p className="text-sm tabular-nums"><span className="font-semibold">{g.bl_count}</span> <span className="text-muted-foreground">BL</span></p>
          <p className="text-sm tabular-nums"><span className="font-semibold">{g.unit_count.toLocaleString("fr-MA")}</span> <span className="text-muted-foreground">unités</span></p>
        </div>

        {/* Gauge (center) */}
        <NeedleGauge grossistePct={grossistePct} />

        {/* Direct laboratoires (right) */}
        <div className="space-y-1 text-right">
          <p className="text-sm font-semibold text-muted-foreground mb-2">Direct laboratoires</p>
          <p className="text-xs text-muted-foreground">Achats</p>
          <p className="text-lg font-bold tabular-nums text-emerald-600">{fmt(l.total_mad)} MAD</p>
          <p className="text-sm tabular-nums"><span className="font-semibold">{l.bl_count}</span> <span className="text-muted-foreground">BL</span></p>
          <p className="text-sm tabular-nums"><span className="font-semibold">{l.unit_count.toLocaleString("fr-MA")}</span> <span className="text-muted-foreground">unités</span></p>
        </div>
      </div>
    </div>
  );
};

const ACHAT_COL_VALUES: Record<string, (r: Record<string, unknown>) => string> = {
  delivery_date: (r) => String(r.delivery_date ?? ""),
  delivery_ref: (r) => String(r.delivery_ref ?? ""),
  delivery_ref_final: (r) => String(r.delivery_ref_final ?? ""),
  supplier: (r) => String(r.supplier ?? ""),
  product: (r) => String(r.product ?? ""),
  category: (r) => String(r.category ?? ""),
  tva: (r) => String(r.tva ?? ""),
  quantity: (r) => String(r.quantity ?? ""),
  pph: (r) => String(r.pph ?? ""),
  unit_price: (r) => String(r.unit_price ?? ""),
  expiry_date: (r) => String(r.expiry_date ?? ""),
  total: (r) => String(r.total ?? ""),
};

const AchatList = () => {
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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    if (user?.role === eUserRole.ADMIN) navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    transactionsApi.achatCategories().then(setAllCategories).catch(() => {});
    transactionsApi.achatTvaRates().then(setAllTvaRates).catch(() => {});
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

  const { achatRows, achatPagination: paginationMeta, achatPageCount: pageCount, achatLoading: isLoading } = useAchatList({
    page, limit,
    search: searchQuery,
    categories: effectiveCategories,
    tva: selectedTva,
    dateFrom, dateTo,
  });
  const rows = achatRows as AchatRow[];

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
        header: () => <p className="column-title">PPH (catalogue)</p>,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-sm">{fmt(getValue<number | null>())}</span>
        ),
      },
      {
        id: "unit_price",
        accessorKey: "unit_price",
        size: 110,
        header: () => <p className="column-title">PU (achat)</p>,
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

  const tableInstance = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await transactionsApi.exportAchat(searchQuery, selectedCats, dateFrom, dateTo, selectedTva);
      const colValues: Record<string, (r: Record<string, unknown>) => string> = {
        ...ACHAT_COL_VALUES,
        delivery_ref_final: (r) => String(r.delivery_ref_final ?? ""),
      };
      const visibleCols = tableInstance.getAllColumns().filter(col => (!col.getCanHide() || col.getIsVisible()) && colValues[col.id]);
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
        fetchSuggestions={transactionsApi.achatSuggestions}
        suggestionGroupLabels={{ products: "Produit", suppliers: "Fournisseur", refs: "Référence" }}
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
              storageKey="achats-cols"
              columnLabels={ACHAT_COL_LABELS}
            />
            {user?.permissions?.import !== false && (
              <Link
                to="/dashboard/upload-file?type=achat"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Importer
              </Link>
            )}
          </div>
        }
      />

      <SupplierSummarySection dateFrom={dateFrom} dateTo={dateTo} search={searchQuery} categories={effectiveCategories} tva={selectedTva} />

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
        emptyState={<AchatEmptyState canImport={user?.permissions?.import !== false} />}
      />

      {rows.length > 0 && (
        <div className="mt-2 rounded-lg border border-border bg-muted/40 px-4 py-2 flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">TVA payée (page courante) :</span>
          <span className="font-semibold tabular-nums">{fmt(tvaPageTotal)} MAD</span>
        </div>
      )}
    </ListView>
  );
};

export default AchatList;
