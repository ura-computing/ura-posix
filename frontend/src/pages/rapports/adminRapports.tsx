import { useState, useMemo } from "react";
import { useAdminSystemStats, useAdminPharmacyList, useAdminPharmacyStats, useAdminAnalyseMarge } from "@/hooks/useAdminRapports";
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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/dateRangePicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthlyTrendChart } from "@/components/monthlyTrendChart";
import { AnalyseMargeTable, type MargeMode } from "./margeTable";
import * as statsApi from "@/api/stats";
import { fmt } from "@/utils/format";
import { currentMonth } from "@/utils/dateRange";
import { cn } from "@/utils/cn";
import { toast } from "sonner";
import { shortMonth, downloadBlob, KpiSkeleton } from "./shared";
import { exportFilename } from "@/utils/table";
import { CAT_COLORS, getTypeTheme } from "@/constants/theme";
import { eCategoryType } from "@/types";

export function AdminRapports() {
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(null);
  const _initial = currentMonth();
  const [dateFrom, setDateFrom] = useState(_initial.from);
  const [dateTo, setDateTo] = useState(_initial.to);
  const [exporting, setExporting] = useState<string | null>(null);
  const [categoryType, setCategoryType] = useState<eCategoryType>(eCategoryType.ALL);
  const [margeMode, setMargeMode] = useState<MargeMode>("produit");

  const { systemStats, systemLoading } = useAdminSystemStats();
  const { pharmacies } = useAdminPharmacyList();
  const { pharmStats, pharmLoading } = useAdminPharmacyStats(selectedPharmacyId, dateFrom, dateTo, categoryType);
  const { margeData, margeLoading } = useAdminAnalyseMarge(selectedPharmacyId, dateFrom, dateTo, categoryType, margeMode);

  const selectedName = pharmacies.find((p) => p.id === selectedPharmacyId)?.name;
  const systemCards = [
    { label: "Pharmacies", value: systemStats?.total_pharmacies ?? 0, icon: Building2, formula: "COUNT(pharmacies)" },
    { label: "Utilisateurs actifs", value: systemStats?.total_active_users ?? 0, icon: Users, formula: "COUNT(users actifs)" },
    { label: "Médicaments au catalogue", value: systemStats?.total_catalog_items ?? 0, icon: BookOpen, formula: "COUNT(produits)" },
    { label: "Demandes en attente", value: systemStats?.pending_catalog_requests ?? 0, icon: ClipboardCheck, formula: "COUNT(demandes pending)" },
  ];

  const kpis = pharmStats?.kpis;
  const advKpis = pharmStats?.advanced_kpis;
  const tva = pharmStats?.tva;
  const marge = pharmStats?.marge;
  const pharmTrend = (pharmStats?.monthly_trend ?? []).map((t) => ({ ...t, label: shortMonth(t.month) }));
  const pharmTopCats = pharmStats?.top_categories ?? [];
  const pharmMaxCat = pharmTopCats[0]?.total ?? 1;

  const allMargeRows = useMemo(
    () => (margeData?.rows ?? []) as Record<string, unknown>[],
    [margeData],
  );

  const typeTheme = useMemo(() => getTypeTheme(categoryType), [categoryType]);

  const handleExcel = async () => {
    if (!selectedPharmacyId) return;
    setExporting(categoryType);
    try {
      const blob = await statsApi.exportExcelForPharmacy(selectedPharmacyId, dateFrom || undefined, dateTo || undefined, categoryType);
      downloadBlob(blob, exportFilename(`RAPPORT ${categoryType.toUpperCase()}`, "xlsx", dateFrom || undefined, dateTo || undefined));
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
                      <p className={`text-sm font-medium ${isFirst ? "opacity-85" : "text-muted-foreground"}`}>{card.label}</p>
                      {systemLoading
                        ? <Skeleton className={`h-8 w-16 mt-1 ${isFirst ? "bg-white/20" : ""}`} />
                        : <p className="text-3xl font-bold mt-1 leading-tight">{card.value}</p>}
                      <p className="text-[10px] opacity-50 mt-1 font-mono">{card.formula}</p>
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

        <div className="sticky top-16 z-10 bg-background pb-4">
          <Card className="border border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-3">
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
                <DateRangePicker
                  from={dateFrom}
                  to={dateTo}
                  onFromChange={setDateFrom}
                  onToChange={setDateTo}
                />
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                    Réinitialiser
                  </Button>
                )}
                {selectedPharmacyId && (
                  <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                    <Button
                      size="sm"
                      variant={categoryType === eCategoryType.ALL ? "default" : "outline"}
                      className="h-9"
                      onClick={() => setCategoryType(eCategoryType.ALL)}
                    >
                      Mixte
                    </Button>
                    <Button
                      size="sm"
                      className={cn("h-9 border", categoryType === eCategoryType.PHARMACIE
                        ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
                        : "bg-transparent text-green-700 border-green-400 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30"
                      )}
                      onClick={() => setCategoryType(eCategoryType.PHARMACIE)}
                    >
                      Pharmacie
                    </Button>
                    <Button
                      size="sm"
                      className={cn("h-9 border", categoryType === eCategoryType.PARAPHARMACIE
                        ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700"
                        : "bg-transparent text-purple-700 border-purple-400 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-700 dark:hover:bg-purple-950/30"
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
                      onClick={handleExcel}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {selectedPharmacyId == null ? (
          <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-border py-16 text-center">
            <div className="space-y-2">
              <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">Sélectionnez une pharmacie ci-dessus pour afficher ses statistiques</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <h3 className="text-base font-semibold text-foreground">{selectedName}</h3>

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
                        {pharmLoading ? <KpiSkeleton primary /> : (
                          <p className="text-3xl font-bold mt-1 leading-tight">{fmt(kpis?.ventes_total ?? null)} MAD</p>
                        )}
                        <p className="text-[10px] opacity-50 mt-1 font-mono">PPV × qté vendue</p>
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
                        {pharmLoading ? <KpiSkeleton /> : (
                          <p className="text-3xl font-bold mt-1 leading-tight">{fmt(kpis?.achats_total ?? null)} MAD</p>
                        )}
                        <p className="text-[10px] opacity-50 mt-1 font-mono">Σ PU × qté achetée</p>
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
                        {pharmLoading ? <KpiSkeleton /> : (
                          <p className="text-3xl font-bold mt-1 leading-tight">{kpis?.ventes_count ?? 0}</p>
                        )}
                        <p className="text-[10px] opacity-50 mt-1 font-mono">COUNT(ventes)</p>
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
                        {pharmLoading ? <KpiSkeleton /> : (
                          <p className="text-3xl font-bold mt-1 leading-tight">{kpis?.achats_count ?? 0}</p>
                        )}
                        <p className="text-[10px] opacity-50 mt-1 font-mono">COUNT(achats)</p>
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
                <Card className="border border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Ticket moyen</p>
                        {pharmLoading ? <KpiSkeleton /> : (
                          <p className="text-2xl font-bold mt-1 leading-tight">{fmt(advKpis?.ticket_moyen ?? null)} MAD</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-0.5">par transaction</p>
                        <p className="text-[10px] opacity-50 mt-1 font-mono">CA ÷ ventes</p>
                      </div>
                      <Receipt className={cn("h-9 w-9", typeTheme.icon)} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Vente moyenne / jour</p>
                        {pharmLoading ? <KpiSkeleton /> : (
                          <p className="text-2xl font-bold mt-1 leading-tight">{fmt(advKpis?.vente_moyenne_par_jour ?? null)} MAD</p>
                        )}
                        <p className="text-[10px] opacity-50 mt-1 font-mono">CA ÷ jours</p>
                      </div>
                      <BarChart3 className={cn("h-9 w-9", typeTheme.icon)} />
                    </div>
                  </CardContent>
                </Card>

                <Card className={cn("border", typeTheme.border, typeTheme.bg)}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={cn("text-sm font-medium", typeTheme.text)}>Meilleure journée (DH)</p>
                        {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                          <p className={cn("text-2xl font-bold mt-1", typeTheme.textValue)}>
                            {advKpis?.best_day_dh ? `${fmt(advKpis.best_day_dh.total)} MAD` : "—"}
                          </p>
                        )}
                        <p className={cn("text-[11px] mt-0.5", typeTheme.textSubtle)}>
                          {advKpis?.best_day_dh?.date ?? "—"}
                        </p>
                        <p className={cn("text-[10px] opacity-50 mt-1 font-mono", typeTheme.textSubtle)}>MAX(CA par jour)</p>
                      </div>
                      <CalendarCheck className={cn("h-9 w-9", typeTheme.icon)} />
                    </div>
                  </CardContent>
                </Card>

                <Card className={cn("border", typeTheme.border, typeTheme.bg)}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={cn("text-sm font-medium", typeTheme.text)}>Meilleure journée (opé)</p>
                        {pharmLoading ? <Skeleton className="h-7 w-16 mt-1" /> : (
                          <p className={cn("text-2xl font-bold mt-1", typeTheme.textValue)}>
                            {advKpis?.best_day_count ? `${advKpis.best_day_count.count} opé` : "—"}
                          </p>
                        )}
                        <p className={cn("text-[11px] mt-0.5", typeTheme.textSubtle)}>
                          {advKpis?.best_day_count?.date ?? "—"}
                        </p>
                        <p className={cn("text-[10px] opacity-50 mt-1 font-mono", typeTheme.textSubtle)}>MAX(opérations par jour)</p>
                      </div>
                      <CalendarCheck className={cn("h-9 w-9", typeTheme.icon)} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Moins bonne journée (DH)</p>
                        {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                          <p className="text-2xl font-bold mt-1 text-rose-800 dark:text-rose-200">
                            {advKpis?.worst_day_dh ? `${fmt(advKpis.worst_day_dh.total)} MAD` : "—"}
                          </p>
                        )}
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                          {advKpis?.worst_day_dh?.date ?? "—"}
                        </p>
                        <p className="text-[10px] opacity-50 mt-1 font-mono text-rose-700/70 dark:text-rose-300/70">MIN(CA par jour)</p>
                      </div>
                      <CalendarX className="h-9 w-9 text-rose-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Moins bonne journée (opé)</p>
                        {pharmLoading ? <Skeleton className="h-7 w-16 mt-1" /> : (
                          <p className="text-2xl font-bold mt-1 text-rose-800 dark:text-rose-200">
                            {advKpis?.worst_day_count ? `${advKpis.worst_day_count.count} opé` : "—"}
                          </p>
                        )}
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                          {advKpis?.worst_day_count?.date ?? "—"}
                        </p>
                        <p className="text-[10px] opacity-50 mt-1 font-mono text-rose-700/70 dark:text-rose-300/70">MIN(opérations par jour)</p>
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
                    {pharmLoading ? <Skeleton className="h-8 w-28 mt-1" /> : (
                      <p className={cn("text-2xl font-bold mt-1", typeTheme.textValue)}>{fmt(tva?.tva_encaissee ?? null)} MAD</p>
                    )}
                    <p className={cn("text-[10px] opacity-50 mt-1 font-mono", typeTheme.textSubtle)}>PPV × taux TVA</p>
                  </CardContent>
                </Card>

                <Card className="border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">TVA payée (achats)</p>
                    {pharmLoading ? <Skeleton className="h-8 w-28 mt-1" /> : (
                      <p className="text-2xl font-bold mt-1 text-amber-800 dark:text-amber-200">{fmt(tva?.tva_payee ?? null)} MAD</p>
                    )}
                    <p className="text-[10px] opacity-50 mt-1 font-mono text-amber-700/70 dark:text-amber-300/70">PU × taux TVA</p>
                  </CardContent>
                </Card>

                <Card className={cn(typeTheme.primaryCard)}>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium opacity-85">TVA à déclarer</p>
                    {pharmLoading ? <KpiSkeleton primary /> : (
                      <p className="text-2xl font-bold mt-1 leading-tight">{fmt(tva?.tva_a_declarer ?? null)} MAD</p>
                    )}
                    <p className="text-[11px] opacity-75 mt-0.5">estimation</p>
                    <p className="text-[10px] opacity-50 mt-1 font-mono">encaissée − payée</p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ── Marge summary ── */}
            <Card className="border border-border">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
                  <div className="pb-4 sm:pb-0 sm:pr-6">
                    <p className="text-sm text-muted-foreground font-medium">Marge %</p>
                    {pharmLoading ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="text-2xl font-bold mt-1">{marge?.marge_pct != null ? `${marge.marge_pct.toFixed(1)}%` : "—"}</p>}
                  </div>
                  <div className="py-4 sm:py-0 sm:px-6">
                    <p className="text-sm text-muted-foreground font-medium">Marge brute</p>
                    {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-2xl font-bold mt-1">{fmt(marge?.marge_brute_dh ?? null)} MAD</p>}
                  </div>
                  <div className="pt-4 sm:pt-0 sm:pl-6">
                    <p className="text-sm text-muted-foreground font-medium">Marge nette</p>
                    {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-2xl font-bold mt-1">{fmt(marge?.marge_nette_dh ?? null)} MAD</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Analyse de marge ── */}
            <section>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-foreground">Analyse de marge</h2>
                <div className="flex items-center gap-1">
                  {(["produit", "categorie", "grossiste", "bl"] as const).map((m) => (
                    <Button
                      key={m}
                      size="sm"
                      variant="outline"
                      className={cn("h-8 text-xs", margeMode === m ? cn(typeTheme.primaryCard, "hover:opacity-90") : "")}
                      onClick={() => setMargeMode(m)}
                    >
                      {m === "produit" ? "Par produit" : m === "categorie" ? "Par catégorie" : m === "grossiste" ? "Par grossiste" : "Par BL"}
                    </Button>
                  ))}
                </div>
              </div>

              <AnalyseMargeTable
                mode={margeMode}
                data={margeData}
                loading={margeLoading}
              />
            </section>

            {/* ── Monthly trend ── */}
            <MonthlyTrendChart
              trend={pharmTrend}
              isLoading={pharmLoading}
              subtitle={periodLabel ?? undefined}
            />

            {/* ── Top categories ── */}
            {pharmTopCats.length > 0 && (
              <Card className="border border-border">
                <CardContent className="p-6 space-y-4">
                  <p className="text-base font-semibold">Top catégories (ventes)</p>
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
