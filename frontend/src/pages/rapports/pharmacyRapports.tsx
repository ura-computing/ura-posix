import { useState, useMemo, useCallback } from "react";
import { usePharmacyStats, useAnalyseMarge } from "@/hooks/usePharmacyRapports";
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
  CalendarCheck,
  CalendarX,
  Download,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MonthlyTrendChart } from "@/components/monthlyTrendChart";
import * as statsApi from "@/api/stats";
import { fmt } from "@/utils/format";
import { cn } from "@/utils/cn";
import { toast } from "sonner";
import { CAT_COLORS, shortMonth, downloadBlob, KpiSkeleton } from "./shared";
import { AnalyseMargeTable, MARGE_COLS, SIM_LABEL_KEY, type MargeMode } from "./margeTable";

export function PharmacyRapports() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [categoryType, setCategoryType] = useState<"all" | "pharmacie" | "parapharmacie">("all");
  const [margeMode, setMargeMode] = useState<MargeMode>("produit");

  // Simulation dialog state
  const [simOpen, setSimOpen] = useState(false);
  const [simSelected, setSimSelected] = useState<Set<number>>(new Set());
  const [simSearch, setSimSearch] = useState("");

  const { stats, statsLoading: isLoading } = usePharmacyStats(dateFrom, dateTo, categoryType);
  const { margeData, margeLoading } = useAnalyseMarge(dateFrom, dateTo, categoryType, margeMode);

  const kpis     = stats?.kpis;
  const advKpis  = stats?.advanced_kpis;
  const tva      = stats?.tva;
  const trend    = (stats?.monthly_trend ?? []).map((t) => ({ ...t, label: shortMonth(t.month) }));
  const topCats  = stats?.top_categories ?? [];
  const maxCatTotal = topCats[0]?.total ?? 1;

  const handleExcel = async (type: "all" | "pharmacie" | "parapharmacie") => {
    setExporting(type);
    try {
      const blob = await statsApi.exportExcel(dateFrom || undefined, dateTo || undefined, type);
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

  const typeTheme = useMemo(() => {
    if (categoryType === "pharmacie") return {
      primaryCard:  "bg-green-600 text-white border-0",
      border:       "border-green-200 dark:border-green-800",
      bg:           "bg-green-50/50 dark:bg-green-950/20",
      text:         "text-green-700 dark:text-green-300",
      textValue:    "text-green-800 dark:text-green-200",
      textSubtle:   "text-green-600 dark:text-green-400",
      icon:         "text-green-500",
      iconHex:      "#22c55e",
    };
    if (categoryType === "parapharmacie") return {
      primaryCard:  "bg-purple-600 text-white border-0",
      border:       "border-purple-200 dark:border-purple-800",
      bg:           "bg-purple-50/50 dark:bg-purple-950/20",
      text:         "text-purple-700 dark:text-purple-300",
      textValue:    "text-purple-800 dark:text-purple-200",
      textSubtle:   "text-purple-600 dark:text-purple-400",
      icon:         "text-purple-500",
      iconHex:      "#a855f7",
    };
    return {
      primaryCard:  "bg-primary text-primary-foreground border-0",
      border:       "border-emerald-200 dark:border-emerald-800",
      bg:           "bg-emerald-50/50 dark:bg-emerald-950/20",
      text:         "text-emerald-700 dark:text-emerald-300",
      textValue:    "text-emerald-800 dark:text-emerald-200",
      textSubtle:   "text-emerald-600 dark:text-emerald-400",
      icon:         "text-emerald-500",
      iconHex:      "#14b8a6",
    };
  }, [categoryType]);

  const allMargeRows = useMemo(
    () => (margeData?.rows ?? []) as Record<string, unknown>[],
    [margeData]
  );

  const simFilteredRows = useMemo(() => {
    if (!simSearch.trim()) return allMargeRows.map((r, i) => ({ row: r, idx: i }));
    const q = simSearch.toLowerCase();
    return allMargeRows
      .map((r, i) => ({ row: r, idx: i }))
      .filter(({ row }) => String(row[SIM_LABEL_KEY[margeMode]] ?? "").toLowerCase().includes(q));
  }, [allMargeRows, simSearch, margeMode]);

  const simKpis = useMemo(() => {
    const selected = allMargeRows.filter((_, i) => simSelected.has(i));
    const ca    = selected.reduce((s, r) => s + (Number(r.ca ?? r.total) || 0), 0);
    const qty   = selected.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const pcts  = selected.map(r => Number(r.marge_pct ?? r.marge_pct_avg ?? NaN)).filter(v => !isNaN(v));
    const dhs   = selected.map(r => Number(r.marge_dh ?? r.marge_dh_avg ?? NaN)).filter(v => !isNaN(v));
    return {
      ca,
      qty,
      margePctAvg: pcts.length ? pcts.reduce((s, v) => s + v, 0) / pcts.length : null,
      margeDhAvg:  dhs.length  ? dhs.reduce((s, v) => s + v, 0)  / dhs.length  : null,
    };
  }, [allMargeRows, simSelected]);

  const toggleSimRow = useCallback((idx: number) => {
    setSimSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const exportSimCsv = useCallback(() => {
    const selected = allMargeRows.filter((_, i) => simSelected.has(i));
    if (!selected.length) return;
    const cols = MARGE_COLS[margeMode];
    const header = cols.map(c => c.label).join(",");
    const lines = selected.map(row =>
      cols.map(c => {
        const v = row[c.key];
        return v == null ? "" : String(v).includes(",") ? `"${v}"` : String(v);
      }).join(",")
    );
    const csv = [header, ...lines].join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `analyse_${margeMode}_selection.csv`);
  }, [allMargeRows, simSelected, margeMode]);

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
                <Button
                  size="sm"
                  variant={categoryType === "all" ? "default" : "outline"}
                  className="h-9"
                  onClick={() => setCategoryType("all")}
                >
                  Mixte
                </Button>
                <Button
                  size="sm"
                  className={cn("h-9 border", categoryType === "pharmacie"
                    ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
                    : "bg-transparent text-green-700 border-green-400 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30"
                  )}
                  onClick={() => setCategoryType("pharmacie")}
                >
                  Pharmacie
                </Button>
                <Button
                  size="sm"
                  className={cn("h-9 border", categoryType === "parapharmacie"
                    ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700"
                    : "bg-transparent text-purple-700 border-purple-400 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-700 dark:hover:bg-purple-950/30"
                  )}
                  onClick={() => setCategoryType("parapharmacie")}
                >
                  Parapharmacie
                </Button>
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
          <Card className={cn(typeTheme.primaryCard)}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium opacity-85">Chiffre d'affaires</p>
                  {isLoading ? <KpiSkeleton primary /> : (
                    <p className="text-3xl font-bold mt-1 leading-tight">{fmt(kpis?.ventes_total ?? null)} MAD</p>
                  )}
                </div>
                <TrendingUp className="h-8 w-8 opacity-60 shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Achats totaux</p>
                  {isLoading ? <KpiSkeleton /> : (
                    <p className="text-3xl font-bold mt-1 leading-tight">{fmt(kpis?.achats_total ?? null)} MAD</p>
                  )}
                </div>
                <ShoppingCart className={cn("h-8 w-8", typeTheme.icon)} />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Transactions ventes</p>
                  {isLoading ? <KpiSkeleton /> : (
                    <p className="text-3xl font-bold mt-1 leading-tight">{kpis?.ventes_count ?? 0}</p>
                  )}
                </div>
                <BarChart3 className={cn("h-8 w-8", typeTheme.icon)} />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Transactions achats</p>
                  {isLoading ? <KpiSkeleton /> : (
                    <p className="text-3xl font-bold mt-1 leading-tight">{kpis?.achats_count ?? 0}</p>
                  )}
                </div>
                <Package className={cn("h-8 w-8", typeTheme.icon)} />
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
                  <p className="text-sm font-medium text-muted-foreground">Ticket moyen</p>
                  {isLoading ? <KpiSkeleton /> : (
                    <p className="text-2xl font-bold mt-1 leading-tight">{fmt(advKpis?.ticket_moyen ?? null)} MAD</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5">par transaction</p>
                </div>
                <Receipt className={cn("h-9 w-9", typeTheme.icon)} />
              </div>
            </CardContent>
          </Card>

          {/* Vente moy/jour */}
          <Card className="border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Vente moyenne / jour</p>
                  {isLoading ? <KpiSkeleton /> : (
                    <p className="text-2xl font-bold mt-1 leading-tight">{fmt(advKpis?.vente_moyenne_par_jour ?? null)} MAD</p>
                  )}
                </div>
                <BarChart3 className={cn("h-9 w-9", typeTheme.icon)} />
              </div>
            </CardContent>
          </Card>

          {/* Best day DH */}
          <Card className={cn("border", typeTheme.border, typeTheme.bg)}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className={cn("text-sm font-medium", typeTheme.text)}>Meilleure journée (DH)</p>
                  {isLoading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                    <p className={cn("text-2xl font-bold mt-1", typeTheme.textValue)}>
                      {advKpis?.best_day_dh ? `${fmt(advKpis.best_day_dh.total)} MAD` : "—"}
                    </p>
                  )}
                  <p className={cn("text-[11px] mt-0.5", typeTheme.textSubtle)}>
                    {advKpis?.best_day_dh?.date ?? "—"}
                  </p>
                </div>
                <CalendarCheck className={cn("h-9 w-9", typeTheme.icon)} />
              </div>
            </CardContent>
          </Card>

          {/* Best day ops */}
          <Card className={cn("border", typeTheme.border, typeTheme.bg)}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className={cn("text-sm font-medium", typeTheme.text)}>Meilleure journée (opé)</p>
                  {isLoading ? <Skeleton className="h-7 w-16 mt-1" /> : (
                    <p className={cn("text-2xl font-bold mt-1", typeTheme.textValue)}>
                      {advKpis?.best_day_count ? `${advKpis.best_day_count.count} opé` : "—"}
                    </p>
                  )}
                  <p className={cn("text-[11px] mt-0.5", typeTheme.textSubtle)}>
                    {advKpis?.best_day_count?.date ?? "—"}
                  </p>
                </div>
                <CalendarCheck className={cn("h-9 w-9", typeTheme.icon)} />
              </div>
            </CardContent>
          </Card>

          {/* Worst day DH */}
          <Card className="border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Moins bonne journée (DH)</p>
                  {isLoading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                    <p className="text-2xl font-bold mt-1 text-rose-800 dark:text-rose-200">
                      {advKpis?.worst_day_dh ? `${fmt(advKpis.worst_day_dh.total)} MAD` : "—"}
                    </p>
                  )}
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                    {advKpis?.worst_day_dh?.date ?? "—"}
                  </p>
                </div>
                <CalendarX className="h-9 w-9 text-rose-500" />
              </div>
            </CardContent>
          </Card>

          {/* Worst day ops */}
          <Card className="border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Moins bonne journée (opé)</p>
                  {isLoading ? <Skeleton className="h-7 w-16 mt-1" /> : (
                    <p className="text-2xl font-bold mt-1 text-rose-800 dark:text-rose-200">
                      {advKpis?.worst_day_count ? `${advKpis.worst_day_count.count} opé` : "—"}
                    </p>
                  )}
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                    {advKpis?.worst_day_count?.date ?? "—"}
                  </p>
                </div>
                <CalendarX className="h-9 w-9 text-rose-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── TVA ── */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">Déclaration TVA</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className={cn("border", typeTheme.border, typeTheme.bg)}>
            <CardContent className="p-6">
              <p className={cn("text-sm font-medium", typeTheme.text)}>TVA encaissée (ventes)</p>
              {isLoading ? <Skeleton className="h-8 w-28 mt-1" /> : (
                <p className={cn("text-2xl font-bold mt-1", typeTheme.textValue)}>{fmt(tva?.tva_encaissee ?? null)} MAD</p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">TVA payée (achats)</p>
              {isLoading ? <Skeleton className="h-8 w-28 mt-1" /> : (
                <p className="text-2xl font-bold mt-1 text-amber-800 dark:text-amber-200">{fmt(tva?.tva_payee ?? null)} MAD</p>
              )}
            </CardContent>
          </Card>

          <Card className={cn(typeTheme.primaryCard)}>
            <CardContent className="p-6">
              <p className="text-sm font-medium opacity-85">TVA à déclarer</p>
              {isLoading ? <KpiSkeleton primary /> : (
                <p className="text-2xl font-bold mt-1 leading-tight">{fmt(tva?.tva_a_declarer ?? null)} MAD</p>
              )}
              <p className="text-[11px] opacity-75 mt-0.5">encaissée − payée</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Analyse de marge ── */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-foreground">Analyse de marge</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              {(["produit", "categorie", "fournisseur", "bl"] as const).map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant="outline"
                  className={cn("h-8 text-xs", margeMode === m ? cn(typeTheme.primaryCard, "hover:opacity-90") : "")}
                  onClick={() => setMargeMode(m)}
                >
                  {m === "produit" ? "Par produit" : m === "categorie" ? "Par catégorie" : m === "fournisseur" ? "Par fournisseur" : "Par BL"}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => { setSimOpen(true); setSimSelected(new Set()); setSimSearch(""); }}
              disabled={!allMargeRows.length}
            >
              <Plus className="h-3.5 w-3.5" />
              Créer une analyse
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="border border-border">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">Total ventes</p>
              {margeLoading ? <Skeleton className="h-8 w-28 mt-1" /> : (
                <p className="text-2xl font-bold mt-1">{fmt(margeData?.kpis.total_ventes_dh ?? null)} MAD</p>
              )}
              {margeLoading ? <Skeleton className="h-4 w-20 mt-2" /> : (
                <p className="text-sm font-semibold mt-2">{margeData?.kpis.total_ventes_unites?.toFixed(0) ?? "—"} unités</p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">Marge moyenne</p>
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
              <p className="text-sm font-medium text-muted-foreground">Marge moy. / unité</p>
              {margeLoading ? <Skeleton className="h-8 w-28 mt-1" /> : (
                <p className="text-2xl font-bold mt-1">
                  {margeData?.kpis.marge_dh_avg != null ? `${fmt(margeData.kpis.marge_dh_avg)} MAD` : "—"}
                </p>
              )}
              {!margeLoading && margeData?.kpis.marge_dh_min && (
                <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                  <p>Min: <span className="font-medium">{margeData.kpis.marge_dh_min.label}</span> ({fmt(margeData.kpis.marge_dh_min.value)} DH)</p>
                  <p>Max: <span className="font-medium">{margeData?.kpis.marge_dh_max?.label}</span> ({fmt(margeData?.kpis.marge_dh_max?.value ?? null)} DH)</p>
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

      {/* ── Simulation dialog ── */}
      <Dialog open={simOpen} onOpenChange={(v) => { if (!v) { setSimOpen(false); setSimSearch(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Créer une analyse personnalisée</DialogTitle>
            <DialogDescription>
              Sélectionnez des éléments pour simuler leurs KPIs combinés.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden py-2">
            {/* Search + select-all */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrer les éléments..."
                  className="pl-9 h-9"
                  value={simSearch}
                  onChange={(e) => setSimSearch(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-xs shrink-0"
                onClick={() => {
                  if (simSelected.size === allMargeRows.length) {
                    setSimSelected(new Set());
                  } else {
                    setSimSelected(new Set(allMargeRows.map((_, i) => i)));
                  }
                }}
              >
                {simSelected.size === allMargeRows.length ? "Désélectionner tout" : "Tout sélectionner"}
              </Button>
            </div>

            {/* Live KPI preview */}
            {simSelected.size > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-[11px] text-muted-foreground">CA sélectionné</p>
                  <p className="text-lg font-bold mt-0.5">{fmt(simKpis.ca)} <span className="text-xs font-normal">MAD</span></p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{simKpis.qty.toFixed(0)} unités</p>
                </div>
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-[11px] text-muted-foreground">Marge % moy.</p>
                  <p className="text-lg font-bold mt-0.5">
                    {simKpis.margePctAvg != null ? `${simKpis.margePctAvg.toFixed(1)} %` : "—"}
                  </p>
                </div>
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-[11px] text-muted-foreground">Marge DH moy.</p>
                  <p className="text-lg font-bold mt-0.5">
                    {simKpis.margeDhAvg != null ? `${fmt(simKpis.margeDhAvg)} MAD` : "—"}
                  </p>
                </div>
              </div>
            )}

            {/* Row list */}
            <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg">
              {simFilteredRows.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Aucun élément trouvé</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                    <tr>
                      <th className="w-10 px-3 py-2.5" />
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {MARGE_COLS[margeMode][0].label}
                      </th>
                      {MARGE_COLS[margeMode].slice(1, 4).map(col => (
                        <th key={col.key} className="px-3 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {simFilteredRows.map(({ row, idx }) => (
                      <tr
                        key={idx}
                        className={cn(
                          "border-t border-border cursor-pointer hover:bg-muted/30 transition-colors",
                          simSelected.has(idx) && "bg-primary/5"
                        )}
                        onClick={() => toggleSimRow(idx)}
                      >
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            readOnly
                            checked={simSelected.has(idx)}
                            className="h-4 w-4 accent-primary"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium truncate max-w-[200px]">
                          {String(row[SIM_LABEL_KEY[margeMode]] ?? "—")}
                        </td>
                        {MARGE_COLS[margeMode].slice(1, 4).map(col => (
                          <td key={col.key} className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {row[col.key] == null ? "—" : typeof row[col.key] === "number"
                              ? (row[col.key] as number).toFixed(2)
                              : String(row[col.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {simSelected.size} élément{simSelected.size !== 1 ? "s" : ""} sélectionné{simSelected.size !== 1 ? "s" : ""}
              {simSelected.size > 0 && " — cliquez sur une ligne pour désélectionner"}
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setSimSelected(new Set())}>
              Réinitialiser
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={simSelected.size === 0}
              onClick={exportSimCsv}
            >
              <Download className="h-3.5 w-3.5" />
              Exporter CSV
            </Button>
            <Button size="sm" onClick={() => { setSimOpen(false); setSimSearch(""); }}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                        <stop offset="5%" stopColor={typeTheme.iconHex} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={typeTheme.iconHex} stopOpacity={0} />
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
                    <Area type="monotone" dataKey="ventes" name="Ventes" stroke={typeTheme.iconHex} strokeWidth={2} fill="url(#gVentes)" dot={false} />
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
