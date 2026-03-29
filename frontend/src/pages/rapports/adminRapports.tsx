import { useState } from "react";
import { useAdminSystemStats, useAdminPharmacyList, useAdminPharmacyStats } from "@/hooks/useAdminRapports";
import {
  BarChart3,
  BookOpen,
  Building2,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthlyTrendChart } from "@/components/monthlyTrendChart";
import * as statsApi from "@/api/stats";
import { fmt } from "@/utils/format";
import { toast } from "sonner";
import { CAT_COLORS, shortMonth, downloadBlob } from "./shared";

export function AdminRapports() {
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);

  const { systemStats, systemLoading } = useAdminSystemStats();
  const { pharmacies } = useAdminPharmacyList();
  const { pharmStats, pharmLoading } = useAdminPharmacyStats(selectedPharmacyId, dateFrom, dateTo);

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
      const blob = await statsApi.exportExcelForPharmacy(selectedPharmacyId, dateFrom || undefined, dateTo || undefined, type);
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
                      <p className={`text-sm font-medium ${isFirst ? "opacity-85" : "text-muted-foreground"}`}>{card.label}</p>
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
                        <p className={`text-sm font-medium ${primary ? "opacity-85" : "text-muted-foreground"}`}>{label}</p>
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
              <Card className="border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">CA Pharmacie</p>
                      {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                        <p className="text-2xl font-bold mt-1 text-green-800 dark:text-green-200">{fmt(breakdown?.pharmacie.ventes_total ?? null)} MAD</p>
                      )}
                    </div>
                    <Receipt className="h-7 w-7 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-300">CA Parapharmacie</p>
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
                  <p className="text-sm text-muted-foreground font-medium">Ticket moyen</p>
                  {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-xl font-bold mt-1">{fmt(advKpis?.ticket_moyen ?? null)} MAD</p>}
                </CardContent>
              </Card>
              <Card className="border border-border">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground font-medium">Vente moy / jour</p>
                  {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-xl font-bold mt-1">{fmt(advKpis?.vente_moyenne_par_jour ?? null)} MAD</p>}
                </CardContent>
              </Card>
              <Card className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CardContent className="p-5">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">Meilleure journée (DH)</p>
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
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">TVA encaissée</p>
                  {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-xl font-bold mt-1 text-emerald-800 dark:text-emerald-200">{fmt(tva?.tva_encaissee ?? null)} MAD</p>}
                </CardContent>
              </Card>
              <Card className="border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="p-5">
                  <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">TVA payée</p>
                  {pharmLoading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="text-xl font-bold mt-1 text-amber-800 dark:text-amber-200">{fmt(tva?.tva_payee ?? null)} MAD</p>}
                </CardContent>
              </Card>
              <Card className="bg-primary text-primary-foreground border-0">
                <CardContent className="p-5">
                  <p className="text-sm opacity-85 font-medium">TVA à déclarer</p>
                  {pharmLoading ? <Skeleton className="h-7 w-24 mt-1 bg-white/20" /> : <p className="text-xl font-bold mt-1">{fmt(tva?.tva_a_declarer ?? null)} MAD</p>}
                </CardContent>
              </Card>
            </div>

            {/* Marge */}
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

            {/* Monthly trend */}
            <MonthlyTrendChart
              trend={pharmTrend}
              isLoading={pharmLoading}
              subtitle={dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom ? `À partir du ${dateFrom}` : dateTo ? `Jusqu'au ${dateTo}` : undefined}
            />

            {/* Top categories */}
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
