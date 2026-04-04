import { useEffect, useMemo, useState } from "react";
import { ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMe } from "@/hooks/useMe";
import { useAchatList } from "@/hooks/useAchatList";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Link, useNavigate } from "react-router";
import { ChevronDown, Package, TrendingUp, FileText, UploadCloud } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";

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
  supplier: "Fournisseur", product: "Produit", category: "Catégorie", tva: "TVA",
  quantity: "Qté", pph: "PPH (catalogue)", unit_price: "PU (achat)", expiry_date: "Péremption", total: "Total",
};

type SupplierSummary = {
  name: string;
  totalMAD: number;
  blCount: number;
  unitCount: number;
  lineCount: number;
};

function computeSupplierSummaries(rows: AchatRow[]): SupplierSummary[] {
  const map = new Map<string, { totalMAD: number; refs: Set<string>; unitCount: number; lineCount: number }>();
  for (const row of rows) {
    const name = (row.supplier ?? "").trim();
    if (!name) continue;
    let entry = map.get(name);
    if (!entry) {
      entry = { totalMAD: 0, refs: new Set(), unitCount: 0, lineCount: 0 };
      map.set(name, entry);
    }
    entry.totalMAD += row.total ?? 0;
    if (row.delivery_ref) entry.refs.add(row.delivery_ref);
    entry.unitCount += row.quantity ?? 0;
    entry.lineCount += 1;
  }
  return Array.from(map.entries())
    .map(([name, d]) => ({ name, totalMAD: d.totalMAD, blCount: d.refs.size, unitCount: d.unitCount, lineCount: d.lineCount }))
    .sort((a, b) => b.totalMAD - a.totalMAD);
}

const SupplierSummarySection = ({ rows }: { rows: AchatRow[] }) => {
  const [open, setOpen] = useState(true);

  const summaries = useMemo(() => computeSupplierSummaries(rows), [rows]);
  const top5 = summaries.slice(0, 5);
  const maxMAD = top5.length > 0 ? top5[0].totalMAD : 1;

  const grandTotal = useMemo(() => rows.reduce((s, r) => s + (r.total ?? 0), 0), [rows]);
  const totalBLs = useMemo(() => {
    const refs = new Set<string>();
    for (const r of rows) if (r.delivery_ref) refs.add(r.delivery_ref);
    return refs.size;
  }, [rows]);
  const totalUnits = useMemo(() => rows.reduce((s, r) => s + (r.quantity ?? 0), 0), [rows]);

  if (rows.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors rounded-t-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Resume fournisseurs</span>
            <Badge variant="secondary" className="text-xs ml-1">{summaries.length} fournisseurs</Badge>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border px-4 py-4">
            {/* Global totals */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total achats</p>
                  <p className="text-base font-bold tabular-nums">{fmt(grandTotal)} MAD</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bons de livraison</p>
                  <p className="text-base font-bold tabular-nums">{totalBLs}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
                  <Package className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Unites</p>
                  <p className="text-base font-bold tabular-nums">{totalUnits.toLocaleString("fr-MA")}</p>
                </div>
              </div>
            </div>

            {/* Top 5 suppliers */}
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Top 5 fournisseurs (page courante)</p>
            <div className="space-y-3">
              {top5.map((s, i) => {
                const pct = maxMAD > 0 ? (s.totalMAD / maxMAD) * 100 : 0;
                const shareOfTotal = grandTotal > 0 ? (s.totalMAD / grandTotal) * 100 : 0;
                return (
                  <div key={s.name} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium truncate">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                        <span>{s.blCount} BL</span>
                        <span>{s.unitCount.toLocaleString("fr-MA")} u.</span>
                        <span className="font-semibold text-foreground tabular-nums">{fmt(s.totalMAD)} MAD</span>
                        <Badge variant="outline" className="text-[10px] tabular-nums px-1.5">{shareOfTotal.toFixed(1)}%</Badge>
                      </div>
                    </div>
                    <Progress
                      value={pct}
                      className="h-2"
                      style={{
                        "--progress-background": [
                          "hsl(var(--chart-1, 142 71% 45%))",
                          "hsl(var(--chart-2, 217 91% 60%))",
                          "hsl(var(--chart-3, 262 83% 58%))",
                          "hsl(var(--chart-4, 37 92% 50%))",
                          "hsl(var(--chart-5, 0 72% 51%))",
                        ][i],
                      } as React.CSSProperties}
                    />
                  </div>
                );
              })}
            </div>

            {summaries.length > 5 && (
              <p className="text-xs text-muted-foreground mt-3">
                + {summaries.length - 5} autre{summaries.length - 5 > 1 ? "s" : ""} fournisseur{summaries.length - 5 > 1 ? "s" : ""}
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
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
        ? allCategories.filter(c => c.toLowerCase().includes("edicament") || c.toLowerCase().includes("oméopath") || c.toLowerCase().includes("omeopath"))
        : allCategories.filter(c => !(c.toLowerCase().includes("edicament") || c.toLowerCase().includes("oméopath") || c.toLowerCase().includes("omeopath")));
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
          const isPharmacy = cat.includes("edicament") || cat.includes("oméopath") || cat.includes("omeopath");
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

      <SupplierSummarySection rows={rows} />

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
