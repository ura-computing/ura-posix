import { useLogout } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  Clock,
  LogOut,
  Package,
  ShoppingCart,
  TrendingUp,
  UploadCloud,
  Users,
  XCircle,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthlyTrendChart } from "@/components/monthly-trend-chart";
import { api } from "@/lib/api";
import { fmt } from "@/lib/table-utils";
import type { User } from "@/types";
import { eUserRole } from "@/types";
import { useMe } from "@/hooks/use-me";

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Aoû",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Déc",
};

function shortMonth(m: string) {
  const [, mm] = m.split("-");
  return MONTH_LABELS[mm] ?? m;
}

// ── Pending / Rejected Notice ─────────────────────────────────────────────────

function PendingNotice({ role, status }: { role: eUserRole.OWNER | eUserRole.EMPLOYEE; status: "pending" | "rejected" }) {
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const isRejected = status === "rejected";
  return (
    <div className={`flex items-start justify-between gap-4 rounded-xl border px-5 py-4 ${
      isRejected
        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
        : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
    }`}>
      <div className="flex items-start gap-3">
        {isRejected
          ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          : <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />}
        <div>
          <p className={`text-sm font-semibold ${isRejected ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300"}`}>
            {isRejected ? "Compte refusé" : "Compte en attente d'approbation"}
          </p>
          <p className={`mt-0.5 text-sm ${isRejected ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
            {isRejected
              ? (role === eUserRole.EMPLOYEE
                  ? "Votre demande a été refusée. Contactez le propriétaire de votre pharmacie."
                  : "Votre demande a été refusée. Contactez l'administrateur.")
              : (role === eUserRole.EMPLOYEE
                  ? "Contactez le propriétaire de votre pharmacie pour valider votre compte."
                  : "Contactez l'administrateur pour valider votre compte.")}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => logout()}
        disabled={isLoggingOut}
        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          isRejected
            ? "text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900"
            : "text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900"
        }`}
      >
        <LogOut className="h-3.5 w-3.5" />
        {isLoggingOut ? "..." : "Se déconnecter"}
      </button>
    </div>
  );
}

// ── Owner / Employee Dashboard ────────────────────────────────────────────────

function PharmacyDashboard({ identity }: { identity: User }) {
  const isPending = identity.status !== "active";
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.stats.get(),
    enabled: !isPending,
  });

  const kpis = stats?.kpis;
  const trend = (stats?.monthly_trend ?? []).map((t) => ({
    ...t,
    label: shortMonth(t.month),
  }));

  return (
    <div className="space-y-6">
      {isPending && (
        <PendingNotice
          role={identity.role as eUserRole.OWNER | eUserRole.EMPLOYEE}
          status={identity.status as "pending" | "rejected"}
        />
      )}

      <section>
        <h2 className="text-lg font-semibold text-foreground">Aperçu Rapide</h2>
        <p className="text-sm text-muted-foreground mb-4">Statistiques globales de votre pharmacie</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-primary text-primary-foreground border-0 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium opacity-85">Chiffre d'affaires</p>
                  {isLoading
                    ? <Skeleton className="h-8 w-28 mt-1 bg-white/20" />
                    : <p className="text-3xl font-bold mt-1 leading-tight">{fmt(kpis?.ventes_total ?? null)}</p>}
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
                  {isLoading
                    ? <Skeleton className="h-8 w-24 mt-1" />
                    : <p className="text-3xl font-bold mt-1 leading-tight">{fmt(kpis?.achats_total ?? null)}</p>}
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
                  {isLoading
                    ? <Skeleton className="h-8 w-16 mt-1" />
                    : <p className="text-3xl font-bold mt-1 leading-tight">{kpis?.ventes_count ?? 0}</p>}
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
                  {isLoading
                    ? <Skeleton className="h-8 w-16 mt-1" />
                    : <p className="text-3xl font-bold mt-1 leading-tight">{kpis?.achats_count ?? 0}</p>}
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {!isPending && identity?.permissions?.import !== false && (
          <Link
            to="/dashboard/upload-file"
            className="group mt-5 flex items-center gap-4 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-6 py-5 transition-all hover:border-primary hover:bg-primary/10"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 group-hover:bg-primary/25 transition-colors">
              <UploadCloud className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Importer un fichier Sobrus</p>
              <p className="text-xs text-muted-foreground mt-0.5">Achats (bons de livraison) ou Ventes — format CSV</p>
            </div>
            <div className="ml-auto shrink-0 text-primary opacity-60 group-hover:opacity-100 transition-opacity">→</div>
          </Link>
        )}
      </section>

      {!isPending && (
        <section>
          <MonthlyTrendChart trend={trend} isLoading={isLoading} />
        </section>
      )}
    </div>
  );
}

// ── Admin Dashboard ────────────────────────────────────────────────────────────

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground))", "#8b5cf6"];

function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.admin.getStats(),
  });
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => api.admin.getAnalytics(),
  });

  const cards = [
    { label: "Pharmacies", value: stats?.total_pharmacies ?? 0, icon: Building2, href: "/admin/pharmacies" },
    { label: "Utilisateurs actifs", value: stats?.total_active_users ?? 0, icon: Users, href: "/admin/pharmacies" },
    { label: "Médicaments au catalogue", value: stats?.total_catalog_items ?? 0, icon: BookOpen, href: "/admin/catalog" },
    { label: "Demandes en attente", value: stats?.pending_catalog_requests ?? 0, icon: ClipboardCheck, href: "/admin/catalog-requests", highlight: (stats?.pending_catalog_requests ?? 0) > 0 },
  ];

  const roleData = analytics ? [
    { name: "Propriétaires", value: analytics.users_by_role.owner },
    { name: "Employés", value: analytics.users_by_role.employee },
    { name: "Admins", value: analytics.users_by_role.admin },
  ].filter((d) => d.value > 0) : [];

  const registrations = (analytics?.monthly_registrations ?? []).map((r) => ({
    ...r,
    label: shortMonth(r.month),
  }));

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-foreground">Vue système</h2>
        <p className="text-sm text-muted-foreground mb-4">Aperçu global de la plateforme APCM Pharma</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, i) => {
            const Icon = card.icon;
            const isFirst = i === 0;
            return (
              <Link key={card.label} to={card.href}>
                <Card className={`border transition-colors hover:border-primary/50 ${isFirst ? "bg-primary text-primary-foreground border-0" : "border-border"}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-[11px] font-medium ${isFirst ? "opacity-85" : "text-muted-foreground"}`}>{card.label}</p>
                        {isLoading
                          ? <Skeleton className={`h-8 w-16 mt-1 ${isFirst ? "bg-white/20" : ""}`} />
                          : (
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-3xl font-bold leading-tight">{card.value}</p>
                              {card.highlight && (
                                <span className="rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 dark:bg-amber-950 dark:text-amber-400">●</span>
                              )}
                            </div>
                          )}
                      </div>
                      <Icon className={`h-8 w-8 shrink-0 ${isFirst ? "opacity-60" : "text-primary"}`} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Donut: users by role */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Répartition des utilisateurs</CardTitle>
              <p className="text-xs text-muted-foreground">Par rôle sur la plateforme</p>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : roleData.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height={192}>
                  <PieChart>
                    <Pie data={roleData} cx="50%" cy="50%" innerRadius={52} outerRadius={76} dataKey="value" nameKey="name" paddingAngle={3}>
                      {roleData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, ""]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Bar: monthly registrations */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Inscriptions</CardTitle>
              <p className="text-xs text-muted-foreground">Nouveaux comptes sur les derniers mois</p>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : registrations.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height={192}>
                  <BarChart data={registrations} barGap={2}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => [v, "Inscriptions"]} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { data: identity, isLoading } = useMe();
  if (isLoading) return <div className="space-y-4 p-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  if (!identity) return null;
  if (identity.role === eUserRole.ADMIN) return <AdminDashboard />;
  return <PharmacyDashboard identity={identity as User} />;
};

export default Dashboard;
