import { useState, useMemo } from "react";
import { useGetIdentity } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import type { AnalyseMargeResponse } from "@/lib/api";
import { DataTablePagination } from "@/components/refine-ui/data-table/data-table-pagination";
import { MonthlyTrendChart } from "@/components/monthly-trend-chart";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarX,
  ClipboardCheck,
  Download,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { fmt } from "@/lib/table-utils";
import { toast } from "sonner";
import type { User } from "@/types";
import { eUserRole } from "@/types";

const CAT_COLORS = ["#14b8a6", "#8b5cf6", "#3b82f6", "#f59e0b", "#f43f5e"];

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Aoû",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Déc",
};

function shortMonth(m: string) {
  const [yy, mm] = m.split("-");
  const monthName = MONTH_LABELS[mm] ?? m;
  return `${monthName} ${yy?.slice(2) ?? ""}`;
}

// ── Shared: Excel download helper ─────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Shared: KPI card skeleton ─────────────────────────────────────────────────

function KpiSkeleton({ primary }: { primary?: boolean }) {
  return <Skeleton className={`h-8 w-28 mt-1 ${primary ? "bg-white/20" : ""}`} />;
}

// ── Analyse de marge table ────────────────────────────────────────────────────

type MargeMode = "produit" | "categorie" | "fournisseur" | "bl";
type SortState = { key: string; dir: "asc" | "desc" };

const MARGE_COLS: Record<MargeMode, { key: string; label: string; numeric?: boolean }[]> = {
  produit:     [
    { key: "product",   label: "Produit" },
    { key: "category",  label: "Catégorie" },
    { key: "tva",       label: "TVA" },
    { key: "ppv",       label: "PPV", numeric: true },
    { key: "prix_max",  label: "Prix max", numeric: true },
    { key: "prix_min",  label: "Prix min", numeric: true },
    { key: "prix_avg",  label: "Prix moy.", numeric: true },
    { key: "marge_pct", label: "Marge %", numeric: true },
    { key: "marge_dh",  label: "Marge DH", numeric: true },
    { key: "qty",       label: "Qté", numeric: true },
    { key: "ca",        label: "CA (MAD)", numeric: true },
  ],
  categorie:   [
    { key: "category",      label: "Catégorie" },
    { key: "prix_max",      label: "Prix max", numeric: true },
    { key: "prix_min",      label: "Prix min", numeric: true },
    { key: "prix_avg",      label: "Prix moy.", numeric: true },
    { key: "marge_pct_avg", label: "Marge % moy.", numeric: true },
    { key: "marge_dh_avg",  label: "Marge DH moy.", numeric: true },
    { key: "qty",           label: "Qté", numeric: true },
    { key: "ca",            label: "CA (MAD)", numeric: true },
  ],
  fournisseur: [
    { key: "supplier",  label: "Fournisseur" },
    { key: "prix_max",  label: "Prix max", numeric: true },
    { key: "prix_min",  label: "Prix min", numeric: true },
    { key: "prix_avg",  label: "Prix moy.", numeric: true },
    { key: "qty",       label: "Qté", numeric: true },
    { key: "ca",        label: "CA (MAD)", numeric: true },
  ],
  bl:          [
    { key: "delivery_ref",  label: "Référence BL" },
    { key: "supplier",      label: "Fournisseur" },
    { key: "delivery_date", label: "Date livraison" },
    { key: "nb_produits",   label: "Nb produits", numeric: true },
    { key: "qty",           label: "Quantité", numeric: true },
    { key: "total",         label: "Total achats (MAD)", numeric: true },
  ],
};

function AnalyseMargeTable({ mode, data, loading }: {
  mode: MargeMode;
  data: AnalyseMargeResponse | undefined;
  loading: boolean;
}) {
  const [sort, setSort] = useState<SortState>({ key: "", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const cols = MARGE_COLS[mode];
  const rawRows = (data?.rows ?? []) as Record<string, unknown>[];

  const sorted = useMemo(() => {
    if (!sort.key) return rawRows;
    return [...rawRows].sort((a, b) => {
      const av = a[sort.key] ?? "";
      const bv = b[sort.key] ?? "";
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rawRows, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggle = (key: string) => {
    setPage(1);
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  };

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (!sorted.length) return (
    <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
  );

  const fmtCell = (v: unknown) => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
    return String(v);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {cols.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground ${col.numeric ? "text-right" : ""}`}
                  onClick={() => toggle(col.key)}
                >
                  {col.label}
                  {sort.key === col.key ? (sort.dir === "asc" ? " ↑" : " ↓") : " ↕"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                {cols.map((col) => (
                  <td key={col.key} className={`px-3 py-2 text-[12px] ${col.numeric ? "text-right tabular-nums" : ""}`}>
                    {fmtCell(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DataTablePagination
        currentPage={page}
        pageCount={pageCount}
        setCurrentPage={setPage}
        pageSize={pageSize}
        setPageSize={(s) => { setPageSize(s); setPage(1); }}
        total={sorted.length}
      />
    </div>
  );
}

// ── Owner / Employee Rapports ─────────────────────────────────────────────────

function PharmacyRapports() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [categoryType, setCategoryType] = useState<"all" | "pharmacie" | "parapharmacie">("all");
  const [margeMode, setMargeMode] = useState<MargeMode>("produit");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats", dateFrom, dateTo, categoryType],
    queryFn: () => api.stats.get(dateFrom || undefined, dateTo || undefined, categoryType),
  });

  const { data: margeData, isLoading: margeLoading } = useQuery({
    queryKey: ["analyse-marge", dateFrom, dateTo, categoryType, margeMode],
    queryFn: () => api.stats.analyseMarge(dateFrom || undefined, dateTo || undefined, categoryType, margeMode),
  });

  const kpis     = stats?.kpis;
  const advKpis  = stats?.advanced_kpis;
  const tva      = stats?.tva;
  const trend    = (stats?.monthly_trend ?? []).map((t) => ({ ...t, label: shortMonth(t.month) }));
  const topCats  = stats?.top_categories ?? [];
  const maxCatTotal = topCats[0]?.total ?? 1;

  const handleExcel = async (type: "all" | "pharmacie" | "parapharmacie") => {
    setExporting(type);
    try {
      const blob = await api.stats.exportExcel(dateFrom || undefined, dateTo || undefined, type);
      downloadBlob(blob, `rapport_${type}_${dateFrom || "all"}_${dateTo || "all"}.xlsx`);
      toast.success("Rapport exporté");
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(null);
    }
  };

  const periodLabel =
    dateFrom && dateTo ? `${dateFrom} → ${dateTo}` :
    dateFrom ? `À partir du ${dateFrom}` :
    dateTo ? `Jusqu'au ${dateTo}` : null;

  return (
    <div>
      {/* ── Sticky filter + export bar ── */}
      <div className="sticky top-16 z-10 bg-background pb-4">
        <Card className="border border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Du</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 w-40 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Au</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 w-40 text-sm"
                />
              </div>
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-muted-foreground"
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                >
                  Réinitialiser
                </Button>
              )}
              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                {(["all", "pharmacie", "parapharmacie"] as const).map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={categoryType === t ? "default" : "outline"}
                    className="h-9"
                    onClick={() => setCategoryType(t)}
                  >
                    {t === "all" ? "Mixte" : t === "pharmacie" ? "Pharmacie" : "Parapharmacie"}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 ml-1"
                  disabled={!!exporting}
                  title="Exporter Excel"
                  onClick={() => handleExcel(categoryType)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
      {/* ── Indicateurs clés ── */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Indicateurs clés
          {periodLabel && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">{periodLabel}</span>
          )}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-primary text-primary-foreground border-0">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium opacity-85">Chiffre d'affaires</p>
                  {isLoading ? <KpiSkeleton primary /> : (
                    <p className="text-3xl font-bold mt-1 leading-tight">{fmt(kpis?.ventes_total ?? null)}</p>
                  )}
                  <p className="text-[11px] opacity-75">MAD</p>
                </div>
                <TrendingUp className="h-8 w-8 opacity-60 shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Achats totaux</p>
                  {isLoading ? <KpiSkeleton /> : (
                    <p className="text-3xl font-bold mt-1 leading-tight">{fmt(kpis?.achats_total ?? null)}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5">MAD</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Transactions ventes</p>
                  {isLoading ? <KpiSkeleton /> : (
                    <p className="text-3xl font-bold mt-1 leading-tight">{kpis?.ventes_count ?? 0}</p>
                  )}
                </div>
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Transactions achats</p>
                  {isLoading ? <KpiSkeleton /> : (
                    <p className="text-3xl font-bold mt-1 leading-tight">{kpis?.achats_count ?? 0}</p>
                  )}
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>


      {/* ── Indicateurs avancés ── */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">Indicateurs avancés</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Ticket moyen */}
          <Card className="border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Ticket moyen</p>
                  {isLoading ? <KpiSkeleton /> : (
                    <p className="text-2xl font-bold mt-1 leading-tight">{fmt(advKpis?.ticket_moyen ?? null)}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5">MAD / transaction</p>
                </div>
                <Receipt className="h-7 w-7 text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Vente moy/jour */}
          <Card className="border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Vente moyenne / jour</p>
                  {isLoading ? <KpiSkeleton /> : (
                    <p className="text-2xl font-bold mt-1 leading-tight">{fmt(advKpis?.vente_moyenne_par_jour ?? null)}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5">MAD</p>
                </div>
                <BarChart3 className="h-7 w-7 text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Best day DH */}
          <Card className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Meilleure journée (DH)</p>
                  {isLoading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                    <p className="text-2xl font-bold mt-1 text-emerald-800 dark:text-emerald-200">
                      {advKpis?.best_day_dh ? fmt(advKpis.best_day_dh.total) : "—"}
                    </p>
                  )}
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {advKpis?.best_day_dh?.date ?? "—"}
                  </p>
                </div>
                <CalendarCheck className="h-7 w-7 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          {/* Best day ops */}
          <Card className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Meilleure journée (opé)</p>
                  {isLoading ? <Skeleton className="h-7 w-16 mt-1" /> : (
                    <p className="text-2xl font-bold mt-1 text-emerald-800 dark:text-emerald-200">
                      {advKpis?.best_day_count ? `${advKpis.best_day_count.count} opé` : "—"}
                    </p>
                  )}
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {advKpis?.best_day_count?.date ?? "—"}
                  </p>
                </div>
                <CalendarCheck className="h-7 w-7 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          {/* Worst day DH */}
          <Card className="border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium text-rose-700 dark:text-rose-300">Moins bonne journée (DH)</p>
                  {isLoading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                    <p className="text-2xl font-bold mt-1 text-rose-800 dark:text-rose-200">
                      {advKpis?.worst_day_dh ? fmt(advKpis.worst_day_dh.total) : "—"}
                    </p>
                  )}
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                    {advKpis?.worst_day_dh?.date ?? "—"}
                  </p>
                </div>
                <CalendarX className="h-7 w-7 text-rose-500" />
              </div>
            </CardContent>
          </Card>

          {/* Worst day ops */}
          <Card className="border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium text-rose-700 dark:text-rose-300">Moins bonne journée (opé)</p>
                  {isLoading ? <Skeleton className="h-7 w-16 mt-1" /> : (
                    <p className="text-2xl font-bold mt-1 text-rose-800 dark:text-rose-200">
                      {advKpis?.worst_day_count ? `${advKpis.worst_day_count.count} opé` : "—"}
                    </p>
                  )}
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                    {advKpis?.worst_day_count?.date ?? "—"}
                  </p>
                </div>
                <CalendarX className="h-7 w-7 text-rose-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── TVA ── */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">Déclaration TVA</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="p-6">
              <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">TVA encaissée (ventes)</p>
              {isLoading ? <Skeleton className="h-8 w-28 mt-1" /> : (
                <p className="text-2xl font-bold mt-1 text-emerald-800 dark:text-emerald-200">{fmt(tva?.tva_encaissee ?? null)}</p>
              )}
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">MAD</p>
            </CardContent>
          </Card>

          <Card className="border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-6">
              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">TVA payée (achats)</p>
              {isLoading ? <Skeleton className="h-8 w-28 mt-1" /> : (
                <p className="text-2xl font-bold mt-1 text-amber-800 dark:text-amber-200">{fmt(tva?.tva_payee ?? null)}</p>
              )}
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">MAD</p>
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground border-0">
            <CardContent className="p-6">
              <p className="text-[11px] font-medium opacity-85">TVA à déclarer</p>
              {isLoading ? <KpiSkeleton primary /> : (
                <p className="text-2xl font-bold mt-1 leading-tight">{fmt(tva?.tva_a_declarer ?? null)}</p>
              )}
              <p className="text-[11px] opacity-75 mt-0.5">MAD = encaissée − payée</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Analyse de marge ── */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-foreground">Analyse de marge</h2>
          <div className="flex items-center gap-1 flex-wrap">
            {(["produit", "categorie", "fournisseur", "bl"] as const).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={margeMode === m ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setMargeMode(m)}
              >
                {m === "produit" ? "Par produit" : m === "categorie" ? "Par catégorie" : m === "fournisseur" ? "Par fournisseur" : "Par BL"}
              </Button>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="border border-border">
            <CardContent className="p-5">
              <p className="text-[11px] font-medium text-muted-foreground">Total ventes</p>
              {margeLoading ? <Skeleton className="h-8 w-28 mt-1" /> : (
                <p className="text-2xl font-bold mt-1">{fmt(margeData?.kpis.total_ventes_dh ?? null)}</p>
              )}
              <p className="text-[11px] text-muted-foreground">MAD</p>
              {margeLoading ? <Skeleton className="h-4 w-20 mt-2" /> : (
                <p className="text-sm font-semibold mt-2">{margeData?.kpis.total_ventes_unites?.toFixed(0) ?? "—"} unités</p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-5">
              <p className="text-[11px] font-medium text-muted-foreground">Marge moyenne</p>
              {margeLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
                <p className="text-2xl font-bold mt-1">
                  {margeData?.kpis.marge_pct_avg != null ? `${margeData.kpis.marge_pct_avg.toFixed(1)} %` : "—"}
                </p>
              )}
              {!margeLoading && margeData?.kpis.marge_pct_min && (
                <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                  <p>Min: <span className="font-medium text-foreground">{margeData.kpis.marge_pct_min.label}</span> ({margeData.kpis.marge_pct_min.value?.toFixed(1)}%) — {margeData.kpis.marge_pct_min.qty} unités</p>
                  <p>Max: <span className="font-medium text-foreground">{margeData?.kpis.marge_pct_max?.label}</span> ({margeData?.kpis.marge_pct_max?.value?.toFixed(1)}%) — {margeData?.kpis.marge_pct_max?.qty} unités</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-5">
              <p className="text-[11px] font-medium text-muted-foreground">Marge moy. / unité</p>
              {margeLoading ? <Skeleton className="h-8 w-28 mt-1" /> : (
                <p className="text-2xl font-bold mt-1">
                  {margeData?.kpis.marge_dh_avg != null ? `${fmt(margeData.kpis.marge_dh_avg)} MAD` : "—"}
                </p>
              )}
              {!margeLoading && margeData?.kpis.marge_dh_min && (
                <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                  <p>Min: <span className="font-medium">{margeData.kpis.marge_dh_min.label}</span> ({fmt(margeData.kpis.marge_dh_min.value)} DH)</p>
                  <p>Max: <span className="font-medium">{margeData?.kpis.marge_dh_max?.label}</span> ({fmt(margeData?.kpis.marge_dh_max?.value)} DH)</p>
                </div>
              )}
              {!margeLoading && margeData?.kpis.difference_gain_dh != null && (
                <p className={`text-sm font-semibold mt-2 ${(margeData.kpis.difference_gain_dh ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  Écart gain: {fmt(margeData.kpis.difference_gain_dh)} DH
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <AnalyseMargeTable mode={margeMode} data={margeData} loading={margeLoading} />
      </section>

      {/* ── Monthly trend ── */}
      <section>
        <MonthlyTrendChart
          trend={trend}
          isLoading={isLoading}
          subtitle={
            dateFrom && dateTo ? `Ventes et achats du ${dateFrom} au ${dateTo}` :
            dateFrom ? `Ventes et achats à partir du ${dateFrom}` :
            dateTo ? `Ventes et achats jusqu'au ${dateTo}` : undefined
          }
        />
      </section>

      {/* ── Area chart + donut ── */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Tendance cumulée</CardTitle>
              <p className="text-xs text-muted-foreground">Évolution des ventes et achats</p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : trend.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height={192}>
                  <AreaChart data={trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gVentes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gAchats" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={48}
                      tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip formatter={(v: number) => [fmt(v), ""]} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="ventes" name="Ventes" stroke="#14b8a6" strokeWidth={2} fill="url(#gVentes)" dot={false} />
                    <Area type="monotone" dataKey="achats" name="Achats" stroke="#8b5cf6" strokeWidth={2} fill="url(#gAchats)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Répartition par catégorie</CardTitle>
              <p className="text-xs text-muted-foreground">Part des ventes par catégorie</p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : topCats.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height={192}>
                  <PieChart>
                    <Pie data={topCats} cx="50%" cy="50%" innerRadius={50} outerRadius={76} dataKey="total" nameKey="category" paddingAngle={3}>
                      {topCats.map((_, i) => (
                        <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [fmt(v) + " MAD", ""]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Top categories ── */}
      <section>
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top catégories (ventes)</CardTitle>
            <p className="text-xs text-muted-foreground">
              {periodLabel ?? "Les 5 catégories les plus vendues"}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
            ) : topCats.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucune donnée disponible</p>
            ) : (
              topCats.map((cat, i) => {
                const color = CAT_COLORS[i % CAT_COLORS.length];
                const pct = (cat.total / maxCatTotal) * 100;
                return (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                        <span className="text-sm font-medium flex-1 min-w-0 truncate">{cat.category}</span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">{fmt(cat.total)} MAD</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>
      </div>
    </div>
  );
}

// ── Admin Rapports ────────────────────────────────────────────────────────────

function AdminRapports() {
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);

  const { data: systemStats, isLoading: systemLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.admin.getStats(),
  });

  const { data: pharmacies = [] } = useQuery({
    queryKey: ["admin-pharmacies"],
    queryFn: () => api.admin.listPharmacies(),
  });

  const { data: pharmStats, isLoading: pharmLoading } = useQuery({
    queryKey: ["admin-pharmacy-stats", selectedPharmacyId, dateFrom, dateTo],
    queryFn: () => api.admin.getPharmacyStats(selectedPharmacyId!, dateFrom || undefined, dateTo || undefined),
    enabled: selectedPharmacyId != null,
  });

  const selectedName = pharmacies.find((p) => p.id === selectedPharmacyId)?.name;
  const systemCards = [
    { label: "Pharmacies", value: systemStats?.total_pharmacies ?? 0, icon: Building2 },
    { label: "Utilisateurs actifs", value: systemStats?.total_active_users ?? 0, icon: Users },
    { label: "Médicaments au catalogue", value: systemStats?.total_catalog_items ?? 0, icon: BookOpen },
    { label: "Demandes en attente", value: systemStats?.pending_catalog_requests ?? 0, icon: ClipboardCheck },
  ];

  const kpis = pharmStats?.kpis;
  const advKpis = pharmStats?.advanced_kpis;
  const tva = pharmStats?.tva;
  const marge = pharmStats?.marge;
  const breakdown = pharmStats?.type_breakdown;
  const pharmTrend = (pharmStats?.monthly_trend ?? []).map((t) => ({ ...t, label: shortMonth(t.month) }));
  const pharmTopCats = pharmStats?.top_categories ?? [];
  const pharmMaxCat = pharmTopCats[0]?.total ?? 1;

  const handleExcel = async (type: "all" | "pharmacie" | "parapharmacie") => {
    if (!selectedPharmacyId) return;
    setExporting(type);
    try {
      const blob = await api.stats.exportExcelForPharmacy(selectedPharmacyId, dateFrom || undefined, dateTo || undefined, type);
      downloadBlob(blob, `rapport_pharmacie${selectedPharmacyId}_${type}_${dateFrom || "all"}_${dateTo || "all"}.xlsx`);
      toast.success("Rapport exporté");
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* System overview */}
      <section>
        <h2 className="text-lg font-semibold text-foreground">Vue système</h2>
        <p className="text-sm text-muted-foreground mb-4">Aperçu global de la plateforme</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {systemCards.map((card, i) => {
            const Icon = card.icon;
            const isFirst = i === 0;
            return (
              <Card key={card.label} className={isFirst ? "bg-primary text-primary-foreground border-0" : "border border-border"}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-[11px] font-medium ${isFirst ? "opacity-85" : "text-muted-foreground"}`}>{card.label}</p>
                      {systemLoading
                        ? <Skeleton className={`h-8 w-16 mt-1 ${isFirst ? "bg-white/20" : ""}`} />
                        : <p className="text-3xl font-bold mt-1 leading-tight">{card.value}</p>}
                    </div>
                    <Icon className={`h-8 w-8 shrink-0 ${isFirst ? "opacity-60" : "text-primary"}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Pharmacy drill-down */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Rapport par pharmacie</h2>
          <p className="text-sm text-muted-foreground">Sélectionnez une pharmacie pour consulter ses statistiques détaillées.</p>
        </div>

        <section className="sticky top-0 z-10 bg-background pb-2">
          <Card className="border border-border">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Pharmacie</Label>
                  <Select value={selectedPharmacyId?.toString() ?? ""} onValueChange={(v) => setSelectedPharmacyId(v ? Number(v) : null)}>
                    <SelectTrigger className="h-9 min-w-[200px] text-sm">
                      <SelectValue placeholder="— Choisir une pharmacie —" />
                    </SelectTrigger>
                    <SelectContent>
                      {pharmacies.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Du</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Au</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40 text-sm" />
                </div>
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                    Réinitialiser
                  </Button>
                )}
                {selectedPharmacyId && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Button size="sm" className="h-9" disabled={!!exporting} onClick={() => handleExcel("all")}>
                      <Download className="h-4 w-4 mr-1.5" />{exporting === "all" ? "Export…" : "Excel"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-9" disabled={!!exporting} onClick={() => handleExcel("pharmacie")}>
                      <Download className="h-4 w-4 mr-1.5" />{exporting === "pharmacie" ? "Export…" : "Pharmacie"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-9" disabled={!!exporting} onClick={() => handleExcel("parapharmacie")}>
                      <Download className="h-4 w-4 mr-1.5" />{exporting === "parapharmacie" ? "Export…" : "Parapharmacie"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {selectedPharmacyId == null ? (
          <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-border py-16 text-center">
            <div className="space-y-2">
              <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">Sélectionnez une pharmacie ci-dessus pour afficher ses statistiques</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h3 className="text-base font-semibold text-foreground">{selectedName}</h3>

            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Chiffre d'affaires", value: kpis ? fmt(kpis.ventes_total) + " MAD" : "—", icon: TrendingUp, primary: true },
                { label: "Achats totaux", value: kpis ? fmt(kpis.achats_total) + " MAD" : "—", icon: ShoppingCart, primary: false },
                { label: "Transactions ventes", value: String(kpis?.ventes_count ?? 0), icon: BarChart3, primary: false },
                { label: "Transactions achats", value: String(kpis?.achats_count ?? 0), icon: Package, primary: false },
              ].map(({ label, value, icon: Icon, primary }) => (
                <Card key={label} className={primary ? "bg-primary text-primary-foreground border-0" : "border border-border"}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-[11px] font-medium ${primary ? "opacity-85" : "text-muted-foreground"}`}>{label}</p>
                        {pharmLoading ? <Skeleton className={`h-8 w-24 mt-1 ${primary ? "bg-white/20" : ""}`} /> : (
                          <p className="text-2xl font-bold mt-1 leading-tight">{value}</p>
                        )}
                      </div>
                      <Icon className={`h-8 w-8 shrink-0 ${primary ? "opacity-60" : "text-primary"}`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Répartition Pharmacie / Parapharmacie */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium text-blue-700 dark:text-blue-300">CA Pharmacie</p>
                      {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                        <p className="text-2xl font-bold mt-1 text-blue-800 dark:text-blue-200">{fmt(breakdown?.pharmacie.ventes_total ?? null)} MAD</p>
                      )}
                    </div>
                    <Receipt className="h-7 w-7 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium text-purple-700 dark:text-purple-300">CA Parapharmacie</p>
                      {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                        <p className="text-2xl font-bold mt-1 text-purple-800 dark:text-purple-200">{fmt(breakdown?.parapharmacie.ventes_total ?? null)} MAD</p>
                      )}
                    </div>
                    <Package className="h-7 w-7 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Advanced KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="border border-border">
                <CardContent className="p-5">
                  <p className="text-[11px] text-muted-foreground font-medium">Ticket moyen</p>
                  {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-xl font-bold mt-1">{fmt(advKpis?.ticket_moyen ?? null)} MAD</p>}
                </CardContent>
              </Card>
              <Card className="border border-border">
                <CardContent className="p-5">
                  <p className="text-[11px] text-muted-foreground font-medium">Vente moy / jour</p>
                  {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-xl font-bold mt-1">{fmt(advKpis?.vente_moyenne_par_jour ?? null)} MAD</p>}
                </CardContent>
              </Card>
              <Card className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CardContent className="p-5">
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">Meilleure journée (DH)</p>
                  {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                    <>
                      <p className="text-xl font-bold mt-1 text-emerald-800 dark:text-emerald-200">{advKpis?.best_day_dh ? fmt(advKpis.best_day_dh.total) : "—"} MAD</p>
                      <p className="text-[11px] text-emerald-600 mt-0.5">{advKpis?.best_day_dh?.date ?? "—"}</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* TVA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CardContent className="p-5">
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">TVA encaissée</p>
                  {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-xl font-bold mt-1 text-emerald-800 dark:text-emerald-200">{fmt(tva?.tva_encaissee ?? null)} MAD</p>}
                </CardContent>
              </Card>
              <Card className="border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="p-5">
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">TVA payée</p>
                  {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-xl font-bold mt-1 text-amber-800 dark:text-amber-200">{fmt(tva?.tva_payee ?? null)} MAD</p>}
                </CardContent>
              </Card>
              <Card className="bg-primary text-primary-foreground border-0">
                <CardContent className="p-5">
                  <p className="text-[11px] opacity-85 font-medium">TVA à déclarer</p>
                  {pharmLoading ? <Skeleton className="h-7 w-24 mt-1 bg-white/20" /> : <p className="text-xl font-bold mt-1">{fmt(tva?.tva_a_declarer ?? null)} MAD</p>}
                </CardContent>
              </Card>
            </div>

            {/* Marge */}
            <Card className="border border-border">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
                  <div className="pb-4 sm:pb-0 sm:pr-6">
                    <p className="text-[11px] text-muted-foreground font-medium">Marge %</p>
                    {pharmLoading ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="text-2xl font-bold mt-1">{marge?.marge_pct != null ? `${marge.marge_pct.toFixed(1)}%` : "—"}</p>}
                  </div>
                  <div className="py-4 sm:py-0 sm:px-6">
                    <p className="text-[11px] text-muted-foreground font-medium">Marge brute</p>
                    {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-2xl font-bold mt-1">{fmt(marge?.marge_brute_dh ?? null)} MAD</p>}
                  </div>
                  <div className="pt-4 sm:pt-0 sm:pl-6">
                    <p className="text-[11px] text-muted-foreground font-medium">Marge nette</p>
                    {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-2xl font-bold mt-1">{fmt(marge?.marge_nette_dh ?? null)} MAD</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly trend */}
            <MonthlyTrendChart
              trend={pharmTrend}
              isLoading={pharmLoading}
              subtitle={dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom ? `À partir du ${dateFrom}` : dateTo ? `Jusqu'au ${dateTo}` : undefined}
            />

            {/* Top categories */}
            {pharmTopCats.length > 0 && (
              <Card className="border border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Top catégories (ventes)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pharmLoading
                    ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
                    : pharmTopCats.map((cat, i) => {
                      const color = CAT_COLORS[i % CAT_COLORS.length];
                      const pct = (cat.total / pharmMaxCat) * 100;
                      return (
                        <div key={cat.category} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                              <span className="text-sm font-medium flex-1 min-w-0 truncate">{cat.category}</span>
                            </span>
                            <span className="text-sm font-semibold tabular-nums">{fmt(cat.total)} MAD</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────

export default function RapportsPage() {
  const { data: identity } = useGetIdentity<User>();
  if (!identity) return null;
  if (identity.role === eUserRole.ADMIN) return <AdminRapports />;
  return <PharmacyRapports />;
}
