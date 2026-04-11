import { useState, useMemo, useCallback, type ReactNode } from "react";
import { Link } from "react-router";
import {
  usePharmacyStats,
  useAnalyseMarge,
  useMarginAlerts,
} from "@/hooks/usePharmacyRapports";
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
  CalendarCheck,
  CalendarX,
  Download,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/datePicker";
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
import { fmt } from "@/utils/format";
import { cn } from "@/utils/cn";
import { toast } from "sonner";
import { shortMonth, downloadBlob, KpiSkeleton } from "./shared";
import { CHART_COLORS, CAT_COLORS, getTypeTheme } from "@/constants/theme";
import {
  AnalyseMargeTable,
  MARGE_COLS,
  SIM_LABEL_KEY,
  type MargeMode,
} from "./margeTable";
import { eCategoryType } from "@/types";

export function PharmacyRapports() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [categoryType, setCategoryType] = useState<eCategoryType>(
    eCategoryType.ALL,
  );
  const [margeMode, setMargeMode] = useState<MargeMode>("produit");

  // Simulation dialog state
  const [simOpen, setSimOpen] = useState(false);
  const [simSelected, setSimSelected] = useState<Set<number>>(new Set());
  const [simSearch, setSimSearch] = useState("");

  const { stats, statsLoading: isLoading } = usePharmacyStats(
    dateFrom,
    dateTo,
    categoryType,
  );
  const { margeData, margeLoading } = useAnalyseMarge(
    dateFrom,
    dateTo,
    categoryType,
    margeMode,
  );
  const { marginAlerts, marginAlertsLoading } = useMarginAlerts(
    dateFrom,
    dateTo,
    categoryType,
  );

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
        `rapport_${type}_${dateFrom || "all"}_${dateTo || "all"}.xlsx`,
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

  const allMargeRows = useMemo(
    () => (margeData?.rows ?? []) as Record<string, unknown>[],
    [margeData],
  );

  const simFilteredRows = useMemo(() => {
    if (!simSearch.trim())
      return allMargeRows.map((r, i) => ({ row: r, idx: i }));
    const q = simSearch.toLowerCase();
    return allMargeRows
      .map((r, i) => ({ row: r, idx: i }))
      .filter(({ row }) =>
        String(row[SIM_LABEL_KEY[margeMode]] ?? "")
          .toLowerCase()
          .includes(q),
      );
  }, [allMargeRows, simSearch, margeMode]);

  const simKpis = useMemo(() => {
    const selected = allMargeRows.filter((_, i) => simSelected.has(i));
    const ca = selected.reduce((s, r) => s + (Number(r.ca ?? r.total) || 0), 0);
    const qty = selected.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const pcts = selected
      .map((r) => Number(r.marge_pct ?? r.marge_pct_avg ?? NaN))
      .filter((v) => !isNaN(v));
    const dhs = selected
      .map((r) => Number(r.marge_dh ?? r.marge_dh_avg ?? NaN))
      .filter((v) => !isNaN(v));
    return {
      ca,
      qty,
      margePctAvg: pcts.length
        ? pcts.reduce((s, v) => s + v, 0) / pcts.length
        : null,
      margeDhAvg: dhs.length
        ? dhs.reduce((s, v) => s + v, 0) / dhs.length
        : null,
    };
  }, [allMargeRows, simSelected]);

  const toggleSimRow = useCallback((idx: number) => {
    setSimSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const exportSimCsv = useCallback(() => {
    const selected = allMargeRows.filter((_, i) => simSelected.has(i));
    if (!selected.length) return;
    const cols = MARGE_COLS[margeMode];
    const header = cols.map((c) => c.label).join(",");
    const lines = selected.map((row) =>
      cols
        .map((c) => {
          const v = row[c.key];
          return v == null
            ? ""
            : String(v).includes(",")
            ? `"${v}"`
            : String(v);
        })
        .join(","),
    );
    const csv = [header, ...lines].join("\n");
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `analyse_${margeMode}_selection.csv`,
    );
  }, [allMargeRows, simSelected, margeMode]);

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
    if (change === null) {
      return (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1",
            light
              ? "bg-white/20 text-white/70"
              : "bg-muted text-muted-foreground",
          )}
        >
          —
        </span>
      );
    }
    const isPositive = change > 0;
    const isGood = invert ? !isPositive : isPositive;
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1",
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
      </span>
    );
  };

  return (
    <div>
      {/* ── Sticky filter + export bar ── */}
      <div className="sticky top-16 z-10 bg-background">
        <Card className="border border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Du</Label>
                <DatePicker
                  value={dateFrom}
                  onChange={setDateFrom}
                  placeholder="Début"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Au</Label>
                <DatePicker
                  value={dateTo}
                  onChange={setDateTo}
                  placeholder="Fin"
                />
              </div>
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-muted-foreground"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Réinitialiser
                </Button>
              )}
              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                <Button
                  size="sm"
                  variant={
                    categoryType === eCategoryType.ALL ? "default" : "outline"
                  }
                  className="h-9"
                  onClick={() => setCategoryType(eCategoryType.ALL)}
                >
                  Mixte
                </Button>
                <Button
                  size="sm"
                  className={cn(
                    "h-9 border",
                    categoryType === eCategoryType.PHARMACIE
                      ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
                      : "bg-transparent text-green-700 border-green-400 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30",
                  )}
                  onClick={() => setCategoryType(eCategoryType.PHARMACIE)}
                >
                  Pharmacie
                </Button>
                <Button
                  size="sm"
                  className={cn(
                    "h-9 border",
                    categoryType === eCategoryType.PARAPHARMACIE
                      ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700"
                      : "bg-transparent text-purple-700 border-purple-400 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-700 dark:hover:bg-purple-950/30",
                  )}
                  onClick={() => setCategoryType(eCategoryType.PARAPHARMACIE)}
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
        {/* ── Performance banner (grey strip) ── */}
        <section>
          {isLoading ? (
            <Skeleton className="h-10 w-full rounded-lg" />
          ) : (
            <div className="flex items-center gap-3 overflow-x-auto rounded-lg bg-muted/60 border border-border px-4 py-2.5 text-xs">
              {/* Performance % vs previous period */}
              {/* Only show period comparison when user explicitly selected a date range */}
              {dateFrom &&
                dateTo &&
                (() => {
                  const prev = prevKpis?.ventes_total ?? 0;
                  const curr = kpis?.ventes_total ?? 0;
                  if (prev > 0) {
                    const pct = ((curr - prev) / prev) * 100;
                    const isUp = pct >= 0;
                    return (
                      <span
                        className={cn(
                          "font-bold shrink-0",
                          isUp ? "text-emerald-600" : "text-red-600",
                        )}
                      >
                        {isUp ? "+" : ""}
                        {pct.toFixed(1)}% vs période préc.
                      </span>
                    );
                  }
                  return null;
                })()}
              <span className="h-3.5 w-px bg-border shrink-0" />
              {(() => {
                const total = kpis?.ventes_total ?? 0;
                const pharma = typeBreakdown?.pharmacie?.ventes_total ?? 0;
                const para = typeBreakdown?.parapharmacie?.ventes_total ?? 0;
                const pctPh =
                  total > 0 ? ((pharma / total) * 100).toFixed(1) : "0.0";
                const pctPa =
                  total > 0 ? ((para / total) * 100).toFixed(1) : "0.0";
                if (categoryType === eCategoryType.PHARMACIE) {
                  return (
                    <span className="text-muted-foreground shrink-0">
                      Pharmacie{" "}
                      <span className="font-semibold text-green-600">
                        {pctPh}%
                      </span>{" "}
                      du CA
                    </span>
                  );
                }
                if (categoryType === eCategoryType.PARAPHARMACIE) {
                  return (
                    <span className="text-muted-foreground shrink-0">
                      Parapharmacie{" "}
                      <span className="font-semibold text-purple-600">
                        {pctPa}%
                      </span>{" "}
                      du CA
                    </span>
                  );
                }
                return (
                  <span className="text-muted-foreground shrink-0">
                    Pharmacie{" "}
                    <span className="font-semibold text-green-600">
                      {pctPh}%
                    </span>
                    {" · "}
                    Parapharmacie{" "}
                    <span className="font-semibold text-purple-600">
                      {pctPa}%
                    </span>{" "}
                    du CA
                  </span>
                );
              })()}
              <span className="h-3.5 w-px bg-border shrink-0" />
              <span className="text-muted-foreground shrink-0">
                Marge moy:{" "}
                <span className="font-semibold text-foreground">
                  {margePct.toFixed(1)}%
                </span>
              </span>
              <span className="h-3.5 w-px bg-border shrink-0" />
              {/* Péremption count */}
              {marginAlerts && (
                <>
                  <span className="text-muted-foreground shrink-0">
                    <span className="font-semibold text-amber-600">
                      {marginAlerts.negative?.count ?? 0}
                    </span>{" "}
                    produits en marge négative
                  </span>
                  <span className="h-3.5 w-px bg-border shrink-0" />
                </>
              )}
              <div className="flex items-center gap-1 shrink-0">
                <ShieldCheck className={cn("h-3.5 w-3.5", healthGrade.color)} />
                <span className="text-muted-foreground">
                  Santé:{" "}
                  <span className={cn("font-bold", healthGrade.color)}>
                    {healthGrade.grade}
                  </span>
                </span>
              </div>
            </div>
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
                          <ChangeBadge
                            current={kpis?.ventes_total}
                            previous={prevKpis?.ventes_total}
                            light
                          />
                        </>
                      )}
                      <p className="text-[10px] opacity-50 mt-1 font-mono">
                        PPV × qté vendue
                      </p>
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
                        {(() => {
                          const prevCA = prevKpis?.ventes_total ?? 0;
                          const prevAchats = prevKpis?.achats_total ?? 0;
                          const prevMarge =
                            prevCA > 0
                              ? ((prevCA - prevAchats) / prevCA) * 100
                              : undefined;
                          return (
                            <ChangeBadge
                              current={marge?.marge_pct}
                              previous={prevMarge}
                            />
                          );
                        })()}
                      </>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">
                      (1 − PU÷PPV) × 100
                    </p>
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
                  <p
                    className={cn(
                      "text-[10px] mt-1 font-mono",
                      typeTheme.textSubtle,
                      "opacity-60",
                    )}
                  >
                    PPV × taux TVA
                  </p>
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
                  <p className="text-[10px] text-amber-600/60 dark:text-amber-400/60 mt-1 font-mono">
                    PU × taux TVA
                  </p>
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
                  <p className="text-[10px] opacity-50 mt-1 font-mono">
                    encaissée − payée (estimation)
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        {/* ── Analyse de marge ── */}
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Analyse de marge
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                {(
                  [
                    "produit",
                    "categorie",
                    "fournisseur",
                    "bl",
                    "laboratoire",
                    "operateur",
                    "mois",
                  ] as const
                ).map((m) => {
                  const labels: Record<string, string> = {
                    produit: "Produit",
                    categorie: "Catégorie",
                    fournisseur: "Fournisseur",
                    bl: "BL",
                    laboratoire: "Labo",
                    operateur: "Opérateur",
                    mois: "Mois",
                  };
                  return (
                    <Button
                      key={m}
                      size="sm"
                      variant="outline"
                      className={cn(
                        "h-8 text-xs",
                        margeMode === m
                          ? cn(typeTheme.primaryCard, "hover:opacity-90")
                          : "",
                      )}
                      onClick={() => setMargeMode(m)}
                    >
                      {labels[m]}
                    </Button>
                  );
                })}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => {
                  setSimOpen(true);
                  setSimSelected(new Set());
                  setSimSearch("");
                }}
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
                <p className="text-sm font-medium text-muted-foreground">
                  Total ventes
                </p>
                {margeLoading ? (
                  <Skeleton className="h-8 w-28 mt-1" />
                ) : (
                  <p className="text-2xl font-bold mt-1">
                    {fmt(margeData?.kpis.total_ventes_dh ?? null)} MAD
                  </p>
                )}
                {margeLoading ? (
                  <Skeleton className="h-4 w-20 mt-2" />
                ) : (
                  <p className="text-sm font-semibold mt-2">
                    {margeData?.kpis.total_ventes_unites?.toFixed(0) ?? "—"}{" "}
                    unités
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-muted-foreground">
                  Marge moyenne
                </p>
                {margeLoading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-2xl font-bold mt-1">
                    {margeData?.kpis.marge_pct_avg != null
                      ? `${margeData.kpis.marge_pct_avg.toFixed(1)} %`
                      : "—"}
                  </p>
                )}
                {!margeLoading && margeData?.kpis.marge_pct_min && (
                  <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                    <p>
                      Min:{" "}
                      <span className="font-medium text-foreground">
                        {margeData.kpis.marge_pct_min.label}
                      </span>{" "}
                      ({margeData.kpis.marge_pct_min.value?.toFixed(1)}%) —{" "}
                      {margeData.kpis.marge_pct_min.qty} unités
                    </p>
                    <p>
                      Max:{" "}
                      <span className="font-medium text-foreground">
                        {margeData?.kpis.marge_pct_max?.label}
                      </span>{" "}
                      ({margeData?.kpis.marge_pct_max?.value?.toFixed(1)}%) —{" "}
                      {margeData?.kpis.marge_pct_max?.qty} unités
                    </p>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/60 mt-2 leading-tight font-mono">
                  (1 − PU÷PPV) × 100, pondérée par qté
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-muted-foreground">
                  Marge moy. / unité
                </p>
                {margeLoading ? (
                  <Skeleton className="h-8 w-28 mt-1" />
                ) : (
                  <p className="text-2xl font-bold mt-1">
                    {margeData?.kpis.marge_dh_avg != null
                      ? `${fmt(margeData.kpis.marge_dh_avg)} MAD`
                      : "—"}
                  </p>
                )}
                {!margeLoading && margeData?.kpis.marge_dh_min && (
                  <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                    <p>
                      Min:{" "}
                      <span className="font-medium">
                        {margeData.kpis.marge_dh_min.label}
                      </span>{" "}
                      ({fmt(margeData.kpis.marge_dh_min.value)} DH)
                    </p>
                    <p>
                      Max:{" "}
                      <span className="font-medium">
                        {margeData?.kpis.marge_dh_max?.label}
                      </span>{" "}
                      ({fmt(margeData?.kpis.marge_dh_max?.value ?? null)} DH)
                    </p>
                  </div>
                )}
                {!margeLoading &&
                  margeData?.kpis.difference_gain_dh != null && (
                    <p
                      className={`text-sm font-semibold mt-2 ${
                        (margeData.kpis.difference_gain_dh ?? 0) >= 0
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    >
                      Écart gain: {fmt(margeData.kpis.difference_gain_dh)} DH
                    </p>
                  )}
                <p className="text-[10px] text-muted-foreground/60 mt-2 leading-tight font-mono">
                  PPV − PU, pondérée par qté
                </p>
              </CardContent>
            </Card>
          </div>

          <AnalyseMargeTable
            mode={margeMode}
            data={margeData}
            loading={margeLoading}
          />
        </section>

        {/* ── Simulation dialog ── */}
        <Dialog
          open={simOpen}
          onOpenChange={(v) => {
            if (!v) {
              setSimOpen(false);
              setSimSearch("");
            }
          }}
        >
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
                  {simSelected.size === allMargeRows.length
                    ? "Désélectionner tout"
                    : "Tout sélectionner"}
                </Button>
              </div>

              {/* Live KPI preview */}
              {simSelected.size > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <p className="text-[11px] text-muted-foreground">
                      CA sélectionné
                    </p>
                    <p className="text-lg font-bold mt-0.5">
                      {fmt(simKpis.ca)}{" "}
                      <span className="text-xs font-normal">MAD</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {simKpis.qty.toFixed(0)} unités
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <p className="text-[11px] text-muted-foreground">
                      Marge % moy.
                    </p>
                    <p className="text-lg font-bold mt-0.5">
                      {simKpis.margePctAvg != null
                        ? `${simKpis.margePctAvg.toFixed(1)} %`
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <p className="text-[11px] text-muted-foreground">
                      Marge DH moy.
                    </p>
                    <p className="text-lg font-bold mt-0.5">
                      {simKpis.margeDhAvg != null
                        ? `${fmt(simKpis.margeDhAvg)} MAD`
                        : "—"}
                    </p>
                  </div>
                </div>
              )}

              {/* Row list */}
              <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg">
                {simFilteredRows.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Aucun élément trouvé
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                      <tr>
                        <th className="w-10 px-3 py-2.5" />
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          {MARGE_COLS[margeMode][0].label}
                        </th>
                        {MARGE_COLS[margeMode].slice(1, 4).map((col) => (
                          <th
                            key={col.key}
                            className="px-3 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide"
                          >
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
                            simSelected.has(idx) && "bg-primary/5",
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
                          {MARGE_COLS[margeMode].slice(1, 4).map((col) => (
                            <td
                              key={col.key}
                              className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                            >
                              {row[col.key] == null
                                ? "—"
                                : typeof row[col.key] === "number"
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
                {simSelected.size} élément{simSelected.size !== 1 ? "s" : ""}{" "}
                sélectionné{simSelected.size !== 1 ? "s" : ""}
                {simSelected.size > 0 &&
                  " — cliquez sur une ligne pour désélectionner"}
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSimSelected(new Set())}
              >
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
              <Button
                size="sm"
                onClick={() => {
                  setSimOpen(false);
                  setSimSearch("");
                }}
              >
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
    <Card className={cn("border", colors.card)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-3 flex-1 min-w-0">
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
            {bracket.products.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-border/50">
                <p
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-wide",
                    colors.subtle,
                  )}
                >
                  Top produits
                </p>
                {bracket.products.slice(0, 3).map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[11px]"
                  >
                    <span className="truncate max-w-[60%] text-foreground">
                      {p.product}
                    </span>
                    <span
                      className={cn("font-medium tabular-nums", colors.value)}
                    >
                      {p.marge_pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
