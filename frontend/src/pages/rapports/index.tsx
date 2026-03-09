import { useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { MonthlyTrendChart } from "@/components/monthly-trend-chart";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { fmt } from "@/lib/table-utils";
import type { User } from "@/types";
import { eUserRole } from "@/types";

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Aoû",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Déc",
};

function shortMonth(m: string) {
  const [, mm] = m.split("-");
  return MONTH_LABELS[mm] ?? m;
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
      <section>
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

      {/* Top categories */}
      <section>
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top catégories (ventes)</CardTitle>
            <p className="text-xs text-muted-foreground">Les 5 catégories les plus vendues</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
            ) : topCats.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucune donnée disponible</p>
            ) : (
              topCats.map((cat) => (
                <div key={cat.category} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="secondary" className="text-xs truncate max-w-[60%]">{cat.category}</Badge>
                    <span className="text-sm font-semibold tabular-nums">{fmt(cat.total)} MAD</span>
                  </div>
                  <Progress
                    value={(cat.total / maxCatTotal) * 100}
                    className="h-1.5"
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// ── Admin Rapports ────────────────────────────────────────────────────────────

function AdminRapports() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.admin.getStats(),
  });

  const cards = [
    { label: "Pharmacies", value: stats?.total_pharmacies ?? 0, icon: Building2 },
    { label: "Utilisateurs actifs", value: stats?.total_active_users ?? 0, icon: Users },
    { label: "Médicaments au catalogue", value: stats?.total_catalog_items ?? 0, icon: BookOpen },
    { label: "Demandes en attente", value: stats?.pending_catalog_requests ?? 0, icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-foreground">Vue système</h2>
        <p className="text-sm text-muted-foreground mb-4">
          En tant qu'administrateur, les statistiques de ventes sont consultables par pharmacie.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, i) => {
            const Icon = card.icon;
            const isFirst = i === 0;
            return (
              <Card key={card.label} className={isFirst ? "bg-primary text-primary-foreground border-0" : "border border-border"}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-[11px] font-medium ${isFirst ? "opacity-85" : "text-muted-foreground"}`}>{card.label}</p>
                      {isLoading
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
