import { useState, useMemo, useCallback, type ReactNode } from "react";
import { Link } from "react-router";
import { usePharmacyStats, useAnalyseMarge, useMarginAlerts, useStockAbcd } from "@/hooks/usePharmacyRapports";
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
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarCheck,
  CalendarX,
  ChevronDown,
  Coins,
  Download,
  Percent,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  Wallet,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { OptimisationGauge } from "@/components/optimisationGauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageFilter } from "@/components/pageFilter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { MarginAlertBracket } from "@/api/stats";
import { fmt, fmtInt } from "@/utils/format";
import { currentMonth } from "@/utils/dateRange";
import { cn } from "@/utils/cn";
import { toast } from "sonner";
import { shortMonth, downloadBlob, KpiSkeleton } from "./shared";
import { exportFilename } from "@/utils/table";
import { CHART_COLORS, CAT_COLORS, getTypeTheme } from "@/constants/theme";
import { eCategoryType } from "@/types";

export function PharmacyRapports() {
  const _initial = currentMonth();
  const [dateFrom, setDateFrom] = useState(_initial.from);
  const [dateTo, setDateTo] = useState(_initial.to);
  const [exporting, setExporting] = useState<string | null>(null);
  // Performance banner: collapsed by default, persisted per-user.
  const [perfOpen, setPerfOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("apcm-rapports-perf-open") === "1";
  });
  const togglePerf = (o: boolean) => {
    setPerfOpen(o);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("apcm-rapports-perf-open", o ? "1" : "0");
    }
  };
  const [categoryType, setCategoryType] = useState<eCategoryType>(
    eCategoryType.ALL,
  );

  const { stats, statsLoading: isLoading } = usePharmacyStats(
    dateFrom,
    dateTo,
    categoryType,
  );
  const { margeData, margeLoading } = useAnalyseMarge(
    dateFrom,
    dateTo,
    categoryType,
    "produit",
  );
  const analyseKpis = margeData?.kpis;
  const { marginAlerts, marginAlertsLoading } = useMarginAlerts(
    dateFrom,
    dateTo,
    categoryType,
  );
  const { stockAbcd, stockAbcdLoading } = useStockAbcd(dateFrom, dateTo);

  // Stock summary metrics
  const stockSummary = useMemo(() => {
    const products = stockAbcd?.products ?? [];
    const withStock = products.filter((p) => p.current_stock != null);
    const sousStock = products.filter(
      (p) => p.current_stock != null && p.current_stock < p.stock_min,
    ).length;
    const surStock = products.filter(
      (p) => p.current_stock != null && p.current_stock > p.stock_max,
    ).length;
    const healthy = products.filter(
      (p) =>
        p.current_stock != null &&
        p.current_stock >= p.stock_min &&
        p.current_stock <= p.stock_max,
    ).length;
    const healthPct = withStock.length > 0 ? Math.round((healthy / withStock.length) * 100) : 0;
    return {
      totalRefs: stockAbcd?.total_references ?? 0,
      ppvPotentiel: stockAbcd?.ppv_potentiel ?? 0,
      sousStock,
      surStock,
      healthPct,
    };
  }, [stockAbcd]);

  const kpis = stats?.kpis;
  const prevKpis = stats?.previous_kpis;
  const advKpis = stats?.advanced_kpis;
  const tva = stats?.tva;
  const marge = stats?.marge;
  const typeBreakdown = stats?.type_breakdown;
  const trend = (stats?.monthly_trend ?? []).map((t) => ({
    ...t,
    label: shortMonth(t.month),
  }));
  const topCats = stats?.top_categories ?? [];
  const maxCatTotal = topCats[0]?.total ?? 1;

  // Compute financial health grade from margin %
  const margePct = marge?.marge_pct ?? 0;
  const healthGrade = useMemo(() => {
    if (margePct > 30)
      return {
        grade: "A+",
        color: "text-emerald-600",
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        border: "border-emerald-200 dark:border-emerald-800",
        desc: "Excellente rentabilite",
      };
    if (margePct > 25)
      return {
        grade: "A",
        color: "text-emerald-600",
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        border: "border-emerald-200 dark:border-emerald-800",
        desc: "Tres bonne rentabilite",
      };
    if (margePct > 20)
      return {
        grade: "B+",
        color: "text-blue-600",
        bg: "bg-blue-50 dark:bg-blue-950/30",
        border: "border-blue-200 dark:border-blue-800",
        desc: "Bonne rentabilite",
      };
    if (margePct > 15)
      return {
        grade: "B",
        color: "text-blue-600",
        bg: "bg-blue-50 dark:bg-blue-950/30",
        border: "border-blue-200 dark:border-blue-800",
        desc: "Rentabilite correcte",
      };
    if (margePct > 10)
      return {
        grade: "C",
        color: "text-amber-600",
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-800",
        desc: "Rentabilite faible",
      };
    if (margePct > 5)
      return {
        grade: "D",
        color: "text-orange-600",
        bg: "bg-orange-50 dark:bg-orange-950/30",
        border: "border-orange-200 dark:border-orange-800",
        desc: "Rentabilite critique",
      };
    return {
      grade: "F",
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-950/30",
      border: "border-red-200 dark:border-red-800",
      desc: "Rentabilite insuffisante",
    };
  }, [margePct]);

  const handleExcel = async (type: eCategoryType) => {
    setExporting(type);
    try {
      const blob = await statsApi.exportExcel(
        dateFrom || undefined,
        dateTo || undefined,
        type,
      );
      downloadBlob(
        blob,
        exportFilename(`RAPPORT ${type.toUpperCase()}`, "xlsx", dateFrom || undefined, dateTo || undefined),
      );
      toast.success("Rapport exporté");
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(null);
    }
  };

  const periodLabel =
    dateFrom && dateTo
      ? `${dateFrom} → ${dateTo}`
      : dateFrom
      ? `À partir du ${dateFrom}`
      : dateTo
      ? `Jusqu'au ${dateTo}`
      : null;

  const typeTheme = useMemo(() => getTypeTheme(categoryType), [categoryType]);

  /** Compute % change between current and previous value. Returns null when no previous data. */
  const pctChange = (
    current: number | undefined,
    previous: number | undefined,
  ): number | null => {
    if (previous === undefined || previous === 0 || current === undefined)
      return null;
    return ((current - previous) / previous) * 100;
  };

  const ChangeBadge = ({
    current,
    previous,
    invert = false,
    light = false,
  }: {
    current: number | undefined;
    previous: number | undefined;
    /** When true, a decrease is shown green (e.g. for costs) */
    invert?: boolean;
    /** Use lighter colors for badges on the primary-colored card */
    light?: boolean;
  }) => {
    const change = pctChange(current, previous);
    const compareLabel = "Comparé à la même période l'année dernière";
    if (change === null) {
      return (
        <span
          title={compareLabel}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium mt-1",
            light
              ? "bg-white/20 text-white/70"
              : "bg-muted text-muted-foreground",
          )}
        >
          — <span className="opacity-70 text-[10px]">vs an dernier</span>
        </span>
      );
    }
    const isPositive = change > 0;
    const isGood = invert ? !isPositive : isPositive;
    return (
      <span
        title={compareLabel}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium mt-1",
          light
            ? isGood
              ? "bg-white/20 text-white"
              : "bg-red-400/30 text-white"
            : isGood
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
        )}
      >
        {isPositive ? "\u2191" : "\u2193"}
        {Math.abs(change).toFixed(1)}%
        <span className="opacity-70 text-[10px]">vs an dernier</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <PageFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        categoryType={categoryType}
        onCategoryTypeChange={setCategoryType}
        rightSlot={
          <button
            type="button"
            disabled={!!exporting}
            title="Exporter Excel"
            onClick={() => handleExcel(categoryType)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            Exporter
          </button>
        }
      />

      <div className="space-y-8">
        {/* ── Performance banner (collapsible — default closed) ── */}
        <section>
          {isLoading ? (
            <Skeleton className="h-14 w-full rounded-xl" />
          ) : (
            <Collapsible open={perfOpen} onOpenChange={togglePerf}>
              <Card className="border border-border">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors cursor-pointer"
                    aria-expanded={perfOpen}
                  >
                    <span className="flex items-center gap-2">
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          !perfOpen && "-rotate-90",
                        )}
                      />
                      <span className="text-sm font-semibold">Vue d'ensemble</span>
                    </span>
                    {/* Compact teaser visible when closed */}
                    {!perfOpen && (
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className={cn("h-4 w-4", healthGrade.color)} />
                        <span className={cn("text-sm font-bold", healthGrade.color)}>{healthGrade.grade}</span>
                      </span>
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-4 px-4">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-3">
                  {/* Performance % vs previous period */}
                  {dateFrom && dateTo && (() => {
                    const prev = prevKpis?.ventes_total ?? 0;
                    const curr = kpis?.ventes_total ?? 0;
                    if (prev <= 0) return null;
                    const pct = ((curr - prev) / prev) * 100;
                    const isUp = pct >= 0;
                    return (
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">vs période préc.</span>
                        <span className={cn("text-sm font-bold tabular-nums", isUp ? "text-emerald-600" : "text-red-600")}>
                          {isUp ? "+" : ""}{pct.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })()}

                  {/* CA split */}
                  {(() => {
                    const total = kpis?.ventes_total ?? 0;
                    const pharma = typeBreakdown?.pharmacie?.ventes_total ?? 0;
                    const para = typeBreakdown?.parapharmacie?.ventes_total ?? 0;
                    const pctPh = total > 0 ? ((pharma / total) * 100).toFixed(1) : "0.0";
                    const pctPa = total > 0 ? ((para / total) * 100).toFixed(1) : "0.0";
                    return (
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Répartition CA</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {(categoryType === eCategoryType.ALL || categoryType === eCategoryType.PHARMACIE) && (
                            <Badge variant="outline" className="h-6 text-xs font-semibold text-green-700 border-green-300 bg-green-50 dark:text-green-300 dark:border-green-800 dark:bg-green-950/30">
                              Pharmacie {pctPh}%
                            </Badge>
                          )}
                          {(categoryType === eCategoryType.ALL || categoryType === eCategoryType.PARAPHARMACIE) && (
                            <Badge variant="outline" className="h-6 text-xs font-semibold text-purple-700 border-purple-300 bg-purple-50 dark:text-purple-300 dark:border-purple-800 dark:bg-purple-950/30">
                              Parapharmacie {pctPa}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Marge moyenne */}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Marge moy.</span>
                    <span className="text-sm font-bold tabular-nums text-foreground">{margePct.toFixed(1)}%</span>
                  </div>

                  {/* Produits en marge négative */}
                  {marginAlerts && (
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Marge négative</span>
                      <span className="text-sm font-bold tabular-nums text-amber-600">
                        {marginAlerts.negative?.count ?? 0} produits
                      </span>
                    </div>
                  )}

                  {/* Santé */}
                  <div className="flex flex-col ml-auto">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Santé</span>
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className={cn("h-4 w-4", healthGrade.color)} />
                      <span className={cn("text-sm font-bold", healthGrade.color)}>{healthGrade.grade}</span>
                    </span>
                  </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </section>

        {/* ── Row 1 — 4 KPI cards ── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Indicateurs clés
            {periodLabel && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {periodLabel}
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CA */}
            <Link to="/comptabilite" className="block">
              <Card
                className={cn(
                  typeTheme.primaryCard,
                  "cursor-pointer hover:opacity-90 transition-opacity",
                )}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium opacity-85">
                        Chiffre d'affaires
                      </p>
                      {isLoading ? (
                        <KpiSkeleton primary />
                      ) : (
                        <>
                          <p className="text-3xl font-bold mt-1 leading-tight">
                            {fmt(kpis?.ventes_total ?? null)} MAD
                          </p>
                          {/* Show the previous-year value explicitly so the user
                              sees the magnitude of change, not just the % delta. */}
                          <p className="text-xs opacity-70 mt-1">
                            Année précédente : {prevKpis?.ventes_total ? `${fmt(prevKpis.ventes_total)} MAD` : "—"}
                          </p>
                          <ChangeBadge
                            current={kpis?.ventes_total}
                            previous={prevKpis?.ventes_total}
                            light
                          />
                        </>
                      )}
                      {/* <p className="text-[10px] opacity-50 mt-1 font-mono">
                        PPV × qté vendue
                      </p> */}
                    </div>
                    <TrendingUp className="h-8 w-8 opacity-60 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Total achats */}
            <Link to="/achat" className="block">
              <Card className="border border-border cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total achats
                      </p>
                      {isLoading ? (
                        <KpiSkeleton />
                      ) : (
                        <>
                          <p className="text-3xl font-bold mt-1 leading-tight">
                            {fmt(kpis?.achats_total ?? null)} MAD
                          </p>
                          <ChangeBadge
                            current={kpis?.achats_total}
                            previous={prevKpis?.achats_total}
                            invert
                          />
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {kpis?.achats_count ?? 0} unités
                          </p>
                        </>
                      )}
                      {/* <p className="text-[10px] opacity-50 mt-1 font-mono">
                        Σ PU × qté achetée
                      </p> */}
                    </div>
                    <ShoppingCart className={cn("h-8 w-8", typeTheme.icon)} />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Marge brute moyenne */}
            <Card className="border border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Marge brute moyenne
                    </p>
                    {isLoading ? (
                      <KpiSkeleton />
                    ) : (
                      <>
                        <p className="text-3xl font-bold mt-1 leading-tight">
                          {marge?.marge_pct != null
                            ? `${marge.marge_pct.toFixed(1)}%`
                            : "—"}
                        </p>
                        <ChangeBadge
                          current={marge?.marge_pct}
                          previous={prevKpis?.marge_pct}
                        />

                      </>
                    )}
                    {/* <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">
                      (1 − PU÷PPV) × 100
                    </p> */}
                  </div>
                  <TrendingUp className={cn("h-8 w-8", typeTheme.icon)} />
                </div>
              </CardContent>
            </Card>

            {/* Transactions */}
            <Card className="border border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Transactions
                    </p>
                    {isLoading ? (
                      <KpiSkeleton />
                    ) : (
                      <>
                        <p className="text-3xl font-bold mt-1 leading-tight">
                          {kpis?.ventes_count ?? 0}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          panier moy: {fmt(advKpis?.ticket_moyen ?? null)} MAD
                        </p>
                      </>
                    )}
                    {/* <p className="text-[10px] opacity-50 mt-1 font-mono">
                      COUNT(ventes)
                    </p> */}
                  </div>
                  <BarChart3 className={cn("h-8 w-8", typeTheme.icon)} />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Row 2 — 4 detail cards ── */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Ticket moyen */}
            <Card className="border border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Ticket moyen ¥
                  </p>
                  <Receipt className={cn("h-7 w-7", typeTheme.icon)} />
                </div>
                {isLoading ? (
                  <KpiSkeleton />
                ) : (
                  <>
                    <p className="text-2xl font-bold leading-tight">
                      {fmt(advKpis?.ticket_moyen ?? null)} MAD
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        Mixte {fmt(advKpis?.ticket_moyen ?? null)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                        Ph {fmt(advKpis?.ticket_moyen ?? null)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                        Pa {fmt(advKpis?.ticket_moyen ?? null)}
                      </span>
                    </div>
                  </>
                )}
                {/* <p className="text-[10px] opacity-50 mt-2 font-mono">
                  CA ÷ ventes
                </p> */}
              </CardContent>
            </Card>

            {/* Moyenne / jour */}
            <Card className="border border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Moyenne / jour
                  </p>
                  <BarChart3 className={cn("h-7 w-7", typeTheme.icon)} />
                </div>
                {isLoading ? (
                  <KpiSkeleton />
                ) : (
                  <>
                    <p className="text-2xl font-bold leading-tight">
                      {fmt(advKpis?.vente_moyenne_par_jour ?? null)} MAD
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ventes: {kpis?.ventes_count ?? 0} · Opérations:{" "}
                      {fmt(advKpis?.vente_moyenne_par_jour ?? null)}
                    </p>
                  </>
                )}
                {/* <p className="text-[10px] opacity-50 mt-1 font-mono">
                  CA ÷ jours
                </p> */}
              </CardContent>
            </Card>

            {/* Meilleure journée (combined DH + opé) */}
            <Card className={cn("border", typeTheme.border, typeTheme.bg)}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className={cn("text-sm font-medium", typeTheme.text)}>
                    Meilleure journée
                  </p>
                  <CalendarCheck className={cn("h-7 w-7", typeTheme.icon)} />
                </div>
                {isLoading ? (
                  <Skeleton className="h-7 w-24 mt-1" />
                ) : (
                  <>
                    <p
                      className={cn(
                        "text-2xl font-bold leading-tight",
                        typeTheme.textValue,
                      )}
                    >
                      {advKpis?.best_day_dh
                        ? `${fmt(advKpis.best_day_dh.total)} MAD`
                        : "—"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className={cn("text-[11px]", typeTheme.textSubtle)}>
                        {advKpis?.best_day_dh?.date ?? "—"}
                      </p>
                      {advKpis?.best_day_count && (
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                            typeTheme.bg,
                            typeTheme.text,
                          )}
                        >
                          {advKpis.best_day_count.count} opé
                        </span>
                      )}
                    </div>
                  </>
                )}
                {/* <p className={cn("text-[10px] opacity-50 mt-1 font-mono", typeTheme.textSubtle)}>
                  MAX(CA par jour)
                </p> */}
              </CardContent>
            </Card>

            {/* Moins bonne journée (combined DH + opé) */}
            <Card className="border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                    Moins bonne journée
                  </p>
                  <CalendarX className="h-7 w-7 text-rose-500" />
                </div>
                {isLoading ? (
                  <Skeleton className="h-7 w-24 mt-1" />
                ) : (
                  <>
                    <p className="text-2xl font-bold leading-tight text-rose-800 dark:text-rose-200">
                      {advKpis?.worst_day_dh
                        ? `${fmt(advKpis.worst_day_dh.total)} MAD`
                        : "—"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">
                        {advKpis?.worst_day_dh?.date ?? "—"}
                      </p>
                      {advKpis?.worst_day_count && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          {advKpis.worst_day_count.count} opé
                        </span>
                      )}
                    </div>
                  </>
                )}
                {/* <p className="text-[10px] opacity-50 mt-1 font-mono text-rose-700/70 dark:text-rose-300/70">
                  MIN(CA par jour)
                </p> */}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Répartition & Santé financière ── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Repartition & Marges
          </h2>
          <div className="space-y-4">
            {/* Donut chart — category distribution (full width: chart left, table right) */}
            <Card className="border border-border">
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : topCats.length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                    Aucune donnee
                  </div>
                ) : (
                  <>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">
                        Repartition par categorie
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Part des ventes par categorie
                      </p>
                    </CardHeader>
                    <div className="flex flex-col lg:flex-row gap-6 items-start">
                      {/* Pie chart on the left */}
                      <div className="shrink-0 mx-auto lg:mx-0">
                        <PieChart width={240} height={240}>
                          <Pie
                            data={topCats}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            dataKey="total"
                            nameKey="category"
                            paddingAngle={0}
                          >
                            {topCats.map((_, i) => (
                              <Cell
                                key={i}
                                fill={CAT_COLORS[i % CAT_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: number) => [fmt(v) + " MAD", ""]}
                            contentStyle={{ fontSize: 11, borderRadius: 8 }}
                          />
                        </PieChart>
                      </div>

                      {/* Table on the right */}
                      <div className="flex-1 w-full border rounded-lg max-h-[320px] overflow-y-scroll">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                Catégorie
                              </th>
                              <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                CA (MAD)
                              </th>
                              <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                Marge %
                              </th>
                              <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                Part %
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {topCats.map((cat, i) => {
                              const totalCA = kpis?.ventes_total ?? 0;
                              const partPct =
                                totalCA > 0 ? (cat.total / totalCA) * 100 : 0;
                              return (
                                <tr key={i} className="border-t border-border">
                                  <td className="px-3 py-2 font-medium flex items-center gap-2">
                                    <span
                                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                      style={{
                                        backgroundColor:
                                          CAT_COLORS[i % CAT_COLORS.length],
                                      }}
                                    />
                                    {cat.category}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                    {fmt(cat.total)}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {cat.marge_pct != null
                                      ? `${cat.marge_pct.toFixed(1)}%`
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                                    {partPct.toFixed(1)}%
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Santé financière card (full width, below) */}
            <Card className={cn("border", healthGrade.border, healthGrade.bg)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Sante financiere
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Note globale basee sur la marge moyenne
                </p>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 space-y-4">
                    <div
                      className={cn(
                        "flex items-center justify-center h-28 w-28 rounded-full border-4",
                        healthGrade.border,
                        "bg-white dark:bg-gray-900",
                      )}
                    >
                      <span
                        className={cn("text-5xl font-black", healthGrade.color)}
                      >
                        {healthGrade.grade}
                      </span>
                    </div>
                    <div className="text-center space-y-1">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          healthGrade.color,
                        )}
                      >
                        {healthGrade.desc}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Marge moyenne:{" "}
                        <span className="font-semibold">
                          {margePct.toFixed(1)}%
                        </span>
                      </p>
                    </div>
                    <div className="w-full max-w-md mx-auto space-y-2 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Marge brute
                        </span>
                        <span className="font-semibold">
                          {fmt(marge?.marge_brute_dh ?? null)} MAD
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Marge nette
                        </span>
                        <span className="font-semibold">
                          {fmt(marge?.marge_nette_dh ?? null)} MAD
                        </span>
                      </div>
                      <div className="mt-3 rounded-md bg-muted/50 p-2.5">
                        <p className="text-[10px] text-muted-foreground leading-relaxed font-mono">
                          Echelle : A+ (&gt;30%) &middot; A (&gt;25%) &middot;
                          B+ (&gt;20%) &middot; B (&gt;15%) &middot; C (&gt;10%)
                          &middot; D (&gt;5%) &middot; F (&le;5%)
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Alertes Marges ── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Alertes Marges
            </span>
          </h2>
          {marginAlertsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-lg" />
              ))}
            </div>
          ) : !marginAlerts ? (
            <Card className="border border-border">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucune donnee de marge disponible pour cette periode.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Marge négative — red */}
              <MarginAlertCard
                title="Marge negative"
                bracket={marginAlerts.negative}
                colorScheme="red"
                icon={<TrendingDown className="h-5 w-5 text-red-500" />}
                valueLabel="Perte totale"
                valueKey="total_margin_dh"
              />
              {/* Marge 0%–10% — orange */}
              <MarginAlertCard
                title="Marge 0% a 10%"
                bracket={marginAlerts.low}
                colorScheme="orange"
                icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
                valueLabel="CA concerne"
                valueKey="total_ca"
              />
              {/* Marge 60%–89.9% — yellow */}
              <MarginAlertCard
                title="Marge 60% a 89.9%"
                bracket={marginAlerts.high}
                colorScheme="yellow"
                icon={<TrendingUp className="h-5 w-5 text-yellow-600" />}
                valueLabel="CA concerne"
                valueKey="total_ca"
              />
              {/* Marge > 90% — green */}
              <MarginAlertCard
                title="Marge > 90%"
                bracket={marginAlerts.very_high}
                colorScheme="green"
                icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />}
                valueLabel="CA concerne"
                valueKey="total_ca"
              />
            </div>
          )}
        </section>

        {/* ── TVA ── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Déclaration TVA
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link to="/comptabilite" className="block">
              <Card
                className={cn(
                  "border cursor-pointer hover:opacity-90 transition-opacity",
                  typeTheme.border,
                  typeTheme.bg,
                )}
              >
                <CardContent className="p-6">
                  <p className={cn("text-sm font-medium", typeTheme.text)}>
                    TVA encaissée (ventes)
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-28 mt-1" />
                  ) : (
                    <p
                      className={cn(
                        "text-2xl font-bold mt-1",
                        typeTheme.textValue,
                      )}
                    >
                      {fmt(tva?.tva_encaissee ?? null)} MAD
                    </p>
                  )}
                  {/* <p
                    className={cn(
                      "text-[10px] mt-1 font-mono",
                      typeTheme.textSubtle,
                      "opacity-60",
                    )}
                  >
                    PPV × taux TVA
                  </p> */}
                </CardContent>
              </Card>
            </Link>

            <Link to="/comptabilite" className="block">
              <Card className="border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-950/40 transition-colors">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    TVA payée (achats)
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-28 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold mt-1 text-amber-800 dark:text-amber-200">
                      {fmt(tva?.tva_payee ?? null)} MAD
                    </p>
                  )}
                  {/* <p className="text-[10px] text-amber-600/60 dark:text-amber-400/60 mt-1 font-mono">
                    PU × taux TVA
                  </p> */}
                </CardContent>
              </Card>
            </Link>

            <Link to="/comptabilite" className="block">
              <Card
                className={cn(
                  typeTheme.primaryCard,
                  "cursor-pointer hover:opacity-90 transition-opacity",
                )}
              >
                <CardContent className="p-6">
                  <p className="text-sm font-medium opacity-85">
                    TVA à déclarer
                  </p>
                  {isLoading ? (
                    <KpiSkeleton primary />
                  ) : (
                    <p className="text-2xl font-bold mt-1 leading-tight">
                      {fmt(tva?.tva_a_declarer ?? null)} MAD
                    </p>
                  )}
                  {/* <p className="text-[10px] opacity-50 mt-1 font-mono">
                    encaissée − payée (estimation)
                  </p> */}
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        {/* ── Analyse de marge (preview KPIs + CTA) ── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Analyse de marge</h2>

          {/* Preview KPI cards */}
          {margeLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
          ) : analyseKpis && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <Card className="border border-border">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Chiffre d'affaires</p>
                      <p className="text-3xl font-bold mt-1 leading-tight tabular-nums">{fmt(analyseKpis.total_ventes_dh)} MAD</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtInt(analyseKpis.total_ventes_unites)} unités vendues</p>
                      {/* <p className="text-[10px] opacity-50 mt-1 font-mono">PPV × qté vendue</p> */}
                    </div>
                    <Wallet className="h-8 w-8 opacity-60 shrink-0 text-primary" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-border">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Marge moyenne</p>
                      <p className="text-3xl font-bold mt-1 leading-tight tabular-nums">{analyseKpis.marge_pct_avg != null ? `${analyseKpis.marge_pct_avg.toFixed(1)}%` : "—"}</p>
                      {/* <p className="text-[10px] opacity-50 mt-1 font-mono">moyenne pondérée par qté</p> */}
                    </div>
                    <Percent className="h-8 w-8 opacity-60 shrink-0 text-primary" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-border">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Marge moyenne (MAD)</p>
                      <p className="text-3xl font-bold mt-1 leading-tight tabular-nums">{analyseKpis.marge_dh_avg != null ? fmt(analyseKpis.marge_dh_avg) : "—"}</p>
                      {/* <p className="text-[10px] opacity-50 mt-1 font-mono">PPV − PU (moyen)</p> */}
                    </div>
                    <Coins className="h-8 w-8 opacity-60 shrink-0 text-primary" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-border">
                <CardContent className="p-6 flex items-center justify-center">
                  <OptimisationGauge gain={analyseKpis.difference_gain_dh} />
                </CardContent>
              </Card>
            </div>
          )}

          {/* CTA card */}
          <Card className="border border-dashed border-border bg-muted/30">
            <CardContent className="p-8 flex flex-col items-center text-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <UploadCloud className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-base font-semibold">Analyse personnalisée</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Importez une liste de produits ou sélectionnez des éléments pour simuler vos marges.
                </p>
              </div>
              <Link
                to="/analyse"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Créer une analyse
              </Link>
            </CardContent>
          </Card>
        </section>

        {/* ── Stock CTA ── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Stock</h2>

          {/* Clickable preview cards → /stock */}
          {stockAbcdLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <Link to="/stock" className="block">
                <Card className="border border-border cursor-pointer hover:bg-muted/50 transition-colors h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Total références</p>
                        <p className="text-3xl font-bold mt-1 leading-tight tabular-nums">{fmtInt(stockSummary.totalRefs)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">produits suivis</p>
                        {/* <p className="text-[10px] opacity-50 mt-1 font-mono">COUNT(produits)</p> */}
                      </div>
                      <Boxes className="h-8 w-8 opacity-60 shrink-0 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/stock" className="block">
                <Card className="border border-border cursor-pointer hover:bg-muted/50 transition-colors h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">PPV potentiel</p>
                        <p className="text-3xl font-bold mt-1 leading-tight tabular-nums">{fmt(stockSummary.ppvPotentiel)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">MAD en stock</p>
                        {/* <p className="text-[10px] opacity-50 mt-1 font-mono">Σ PPV × stock</p> */}
                      </div>
                      <Coins className="h-8 w-8 opacity-60 shrink-0 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/stock" className="block">
                <Card className="border border-border cursor-pointer hover:bg-muted/50 transition-colors h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Sous-stock / Sur-stock</p>
                        <p className="text-3xl font-bold mt-1 leading-tight tabular-nums">
                          <span className="text-amber-600">{stockSummary.sousStock}</span>
                          <span className="text-muted-foreground text-xl"> / </span>
                          <span className="text-blue-600">{stockSummary.surStock}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">produits à ajuster</p>
                        {/* <p className="text-[10px] opacity-50 mt-1 font-mono">stock &lt; min / &gt; max</p> */}
                      </div>
                      <AlertTriangle className="h-8 w-8 opacity-60 shrink-0 text-amber-500" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/stock" className="block">
                <Card className="border border-border cursor-pointer hover:bg-muted/50 transition-colors h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Santé du stock</p>
                        <p className={cn(
                          "text-3xl font-bold mt-1 leading-tight tabular-nums",
                          stockSummary.healthPct >= 80 ? "text-emerald-600"
                          : stockSummary.healthPct >= 60 ? "text-amber-600"
                          : "text-red-600",
                        )}>{stockSummary.healthPct}%</p>
                        <p className="text-xs text-muted-foreground mt-0.5">dans la fourchette min-max</p>
                        {/* <p className="text-[10px] opacity-50 mt-1 font-mono">(OK ÷ total) × 100</p> */}
                      </div>
                      <ShieldCheck className="h-8 w-8 opacity-60 shrink-0 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          )}

          <Card className="border border-dashed border-border bg-muted/30">
            <CardContent className="p-8 flex flex-col items-center text-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                <Boxes className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-base font-semibold">Analyse du stock</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Consultez la classification ABCD, les alertes sous-stock/sur-stock et les péremptions.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <Link
                  to="/stock"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Boxes className="h-3.5 w-3.5" />
                  Voir le stock
                </Link>
                <Link
                  to="/dashboard/upload-file?type=stock"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-4 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  Importer stock
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Monthly trend ── */}
        <section>
          <MonthlyTrendChart
            trend={trend}
            isLoading={isLoading}
            subtitle={
              dateFrom && dateTo
                ? `Ventes et achats du ${dateFrom} au ${dateTo}`
                : dateFrom
                ? `Ventes et achats à partir du ${dateFrom}`
                : dateTo
                ? `Ventes et achats jusqu'au ${dateTo}`
                : undefined
            }
          />
        </section>

        {/* ── Tendance cumulée (full width) ── */}
        <section>
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Tendance cumulée
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Évolution des ventes et achats
              </p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : trend.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  Aucune donnée
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart
                    data={trend}
                    margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="gVentes" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={CHART_COLORS.ventesHex}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={CHART_COLORS.ventesHex}
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient id="gAchats" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={CHART_COLORS.achatsHex}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={CHART_COLORS.achatsHex}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                      }
                    />
                    <Tooltip
                      formatter={(v: number) => [fmt(v), ""]}
                      labelStyle={{ fontSize: 11 }}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="ventes"
                      name="Ventes"
                      stroke={CHART_COLORS.ventesHex}
                      strokeWidth={2}
                      fill="url(#gVentes)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="achats"
                      name="Achats"
                      stroke={CHART_COLORS.achatsHex}
                      strokeWidth={2}
                      fill="url(#gAchats)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Top categories ── */}
        <section>
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Top catégories (ventes)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {periodLabel ?? "Les 5 catégories les plus vendues"}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))
              ) : topCats.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucune donnée disponible
                </p>
              ) : (
                topCats.map((cat, i) => {
                  const color = CAT_COLORS[i % CAT_COLORS.length];
                  const pct = (cat.total / maxCatTotal) * 100;
                  return (
                    <div key={cat.category} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ background: color }}
                          />
                          <span className="text-sm font-medium flex-1 min-w-0 truncate">
                            {cat.category}
                          </span>
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {fmt(cat.total)} MAD
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: color }}
                        />
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

/* ── Margin alert card sub-component ── */

const ALERT_COLORS = {
  red: {
    card: "border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/30",
    title: "text-red-700 dark:text-red-300",
    value: "text-red-800 dark:text-red-200",
    count: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300",
    subtle: "text-red-600/70 dark:text-red-400/70",
  },
  orange: {
    card: "border-orange-200 dark:border-orange-800 bg-orange-50/60 dark:bg-orange-950/30",
    title: "text-orange-700 dark:text-orange-300",
    value: "text-orange-800 dark:text-orange-200",
    count:
      "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300",
    subtle: "text-orange-600/70 dark:text-orange-400/70",
  },
  yellow: {
    card: "border-yellow-200 dark:border-yellow-800 bg-yellow-50/60 dark:bg-yellow-950/30",
    title: "text-yellow-700 dark:text-yellow-300",
    value: "text-yellow-800 dark:text-yellow-200",
    count:
      "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300",
    subtle: "text-yellow-600/70 dark:text-yellow-400/70",
  },
  green: {
    card: "border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30",
    title: "text-emerald-700 dark:text-emerald-300",
    value: "text-emerald-800 dark:text-emerald-200",
    count:
      "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
    subtle: "text-emerald-600/70 dark:text-emerald-400/70",
  },
} as const;

function MarginAlertCard({
  title,
  bracket,
  colorScheme,
  icon,
  valueLabel,
  valueKey,
}: {
  title: string;
  bracket: MarginAlertBracket;
  colorScheme: keyof typeof ALERT_COLORS;
  icon: ReactNode;
  valueLabel: string;
  valueKey: "total_ca" | "total_margin_dh";
}) {
  const colors = ALERT_COLORS[colorScheme];
  const value = bracket[valueKey];

  return (
    <Link to="/alertes" className="block">
      <Card className={cn("border cursor-pointer transition-shadow hover:shadow-md", colors.card)}>
        <CardContent className="p-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {icon}
              <p className={cn("text-sm font-semibold", colors.title)}>
                {title}
              </p>
            </div>
            <div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
                  colors.count,
                )}
              >
                {bracket.count} produit{bracket.count !== 1 ? "s" : ""}
              </span>
            </div>
            <div>
              <p className={cn("text-xs", colors.subtle)}>{valueLabel}</p>
              <p className={cn("text-lg font-bold", colors.value)}>
                {fmt(Math.abs(value))} MAD
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
