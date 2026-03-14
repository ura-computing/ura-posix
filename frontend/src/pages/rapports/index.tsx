import { useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
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
  ClipboardCheck,
  Package,
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

// ── Owner / Employee Rapports ─────────────────────────────────────────────────

function PharmacyRapports() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats", dateFrom, dateTo],
    queryFn: () => api.stats.get(dateFrom || undefined, dateTo || undefined),
  });

  const kpis = stats?.kpis;
  const trend = (stats?.monthly_trend ?? []).map((t) => ({
    ...t,
    label: shortMonth(t.month),
  }));
  const topCats = stats?.top_categories ?? [];
  const maxCatTotal = topCats[0]?.total ?? 1;

  return (
    <div className="space-y-8">
      {/* Date range filter */}
      <section className="sticky top-0 z-10 bg-background pb-2">
        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
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
            </div>
          </CardContent>
        </Card>
      </section>

      {/* KPI cards */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Indicateurs clés
          {(dateFrom || dateTo) && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom ? `À partir du ${dateFrom}` : `Jusqu'au ${dateTo}`}
            </span>
          )}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-primary text-primary-foreground border-0">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium opacity-85">Chiffre d'affaires</p>
                  {isLoading ? <Skeleton className="h-8 w-28 mt-1 bg-white/20" /> : (
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
                  {isLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
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
                  {isLoading ? <Skeleton className="h-8 w-16 mt-1" /> : (
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
                  {isLoading ? <Skeleton className="h-8 w-16 mt-1" /> : (
                    <p className="text-3xl font-bold mt-1 leading-tight">{kpis?.achats_count ?? 0}</p>
                  )}
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Monthly trend */}
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

      {/* Area chart + donut side by side */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Area chart — evolution */}
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

          {/* Donut — categories */}
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

      {/* Top categories */}
      <section>
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top catégories (ventes)</CardTitle>
            <p className="text-xs text-muted-foreground">
              {dateFrom && dateTo
                ? `${dateFrom} → ${dateTo}`
                : dateFrom
                ? `À partir du ${dateFrom}`
                : dateTo
                ? `Jusqu'au ${dateTo}`
                : "Les 5 catégories les plus vendues"}
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
  );
}

// ── Admin Rapports ────────────────────────────────────────────────────────────

function AdminRapports() {
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
  const pharmTrend = (pharmStats?.monthly_trend ?? []).map((t) => ({ ...t, label: shortMonth(t.month) }));
  const pharmTopCats = pharmStats?.top_categories ?? [];
  const pharmMaxCat = pharmTopCats[0]?.total ?? 1;

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

        {/* Filters */}
        <section className="sticky top-0 z-10 bg-background pb-2">
        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Pharmacie</Label>
                <Select
                  value={selectedPharmacyId?.toString() ?? ""}
                  onValueChange={(v) => setSelectedPharmacyId(v ? Number(v) : null)}
                >
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
            </div>
          </CardContent>
        </Card>
        </section>

        {/* Pharmacy stats */}
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

            {/* Monthly trend */}
            <MonthlyTrendChart
              trend={pharmTrend}
              isLoading={pharmLoading}
              subtitle={
                dateFrom && dateTo ? `${dateFrom} → ${dateTo}` :
                dateFrom ? `À partir du ${dateFrom}` :
                dateTo ? `Jusqu'au ${dateTo}` : undefined
              }
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
