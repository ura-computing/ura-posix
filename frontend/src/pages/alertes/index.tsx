import { useMemo, useState } from "react";
import { AlertTriangle, CalendarX, PackageX, TrendingDown } from "lucide-react";

import { ListView } from "@/components/shared/listView";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageFilter } from "@/components/pageFilter";
import { cn } from "@/utils/cn";
import { fmt } from "@/utils/format";
import { eCategoryType } from "@/types";
import {
  useMarginAlerts,
  usePeremptions,
  useStockAbcd,
} from "@/hooks/usePharmacyRapports";
import type { StockAbcdProduct } from "@/api/stats";

function getStockStatus(p: StockAbcdProduct): "ok" | "sous-stock" | "sur-stock" | "inconnu" {
  if (p.current_stock == null) return "inconnu";
  if (p.current_stock < p.stock_min) return "sous-stock";
  if (p.current_stock > p.stock_max) return "sur-stock";
  return "ok";
}

export default function AlertesPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryType, setCategoryType] = useState<eCategoryType>(eCategoryType.ALL);

  const { marginAlerts, marginAlertsLoading } = useMarginAlerts(dateFrom, dateTo, categoryType);
  const { peremptions, peremptionsLoading } = usePeremptions(dateFrom, dateTo);
  const { stockAbcd, stockAbcdLoading } = useStockAbcd(dateFrom, dateTo);

  const stockBuckets = useMemo(() => {
    const all = stockAbcd?.products ?? [];
    return {
      sousStock: all.filter((p) => getStockStatus(p) === "sous-stock"),
      surStock: all.filter((p) => getStockStatus(p) === "sur-stock"),
    };
  }, [stockAbcd]);

  const loading = marginAlertsLoading || peremptionsLoading || stockAbcdLoading;

  const totalAlerts =
    (marginAlerts?.negative?.count ?? 0) +
    (marginAlerts?.low?.count ?? 0) +
    (peremptions?.expired?.count ?? 0) +
    (peremptions?.very_close?.count ?? 0) +
    (peremptions?.close?.count ?? 0) +
    stockBuckets.sousStock.length +
    stockBuckets.surStock.length;

  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Alertes</h1>
      <p className="text-sm text-muted-foreground -mt-2">
        Centralisation des problèmes détectés dans votre pharmacie.
      </p>

      <PageFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        categoryType={categoryType}
        onCategoryTypeChange={setCategoryType}
      />

      {/* ── Global summary ── */}
      <Card className="border border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Total alertes</span>
              {loading ? (
                <Skeleton className="h-5 w-16 mt-0.5" />
              ) : (
                <span className={cn("text-lg font-bold tabular-nums", totalAlerts > 0 ? "text-red-600" : "text-emerald-600")}>
                  {totalAlerts}
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Marge négative</span>
              <span className="text-sm font-bold tabular-nums text-red-600">
                {loading ? "…" : marginAlerts?.negative?.count ?? 0}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Marge faible</span>
              <span className="text-sm font-bold tabular-nums text-amber-600">
                {loading ? "…" : marginAlerts?.low?.count ?? 0}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Produits expirés</span>
              <span className="text-sm font-bold tabular-nums text-red-600">
                {loading ? "…" : peremptions?.expired?.count ?? 0}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Sous-stock</span>
              <span className="text-sm font-bold tabular-nums text-amber-600">
                {loading ? "…" : stockBuckets.sousStock.length}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Sur-stock</span>
              <span className="text-sm font-bold tabular-nums text-blue-600">
                {loading ? "…" : stockBuckets.surStock.length}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Marge alerts ── */}
      <AlertSection
        icon={<TrendingDown className="h-5 w-5 text-red-500" />}
        title="Alertes de marge"
        description="Produits vendus avec une marge problématique"
        loading={marginAlertsLoading}
      >
        <AlertCard
          label="Marge négative"
          count={marginAlerts?.negative?.count ?? 0}
          valueLabel="CA concerné"
          value={marginAlerts?.negative?.total_ca ?? 0}
          tone="red"
          products={(marginAlerts?.negative?.products ?? []).slice(0, 5).map((p) => ({
            name: p.product,
            detail: `${p.marge_pct.toFixed(1)}% · ${fmt(p.ca)} MAD`,
          }))}
        />
        <AlertCard
          label="Marge faible (<10%)"
          count={marginAlerts?.low?.count ?? 0}
          valueLabel="CA concerné"
          value={marginAlerts?.low?.total_ca ?? 0}
          tone="amber"
          products={(marginAlerts?.low?.products ?? []).slice(0, 5).map((p) => ({
            name: p.product,
            detail: `${p.marge_pct.toFixed(1)}% · ${fmt(p.ca)} MAD`,
          }))}
        />
      </AlertSection>

      {/* ── Péremption alerts ── */}
      <AlertSection
        icon={<CalendarX className="h-5 w-5 text-red-500" />}
        title="Alertes de péremption"
        description="Produits expirés ou proches de l'expiration"
        loading={peremptionsLoading}
      >
        <AlertCard
          label="Expirés"
          count={peremptions?.expired?.count ?? 0}
          valueLabel="Valeur achat"
          value={peremptions?.expired?.purchase_value ?? 0}
          tone="red"
          products={(peremptions?.expired?.products ?? []).slice(0, 5).map((p) => ({
            name: p.product,
            detail: `${p.expiry_date} · ${p.quantity} unités`,
          }))}
        />
        <AlertCard
          label="Très proche (<30j)"
          count={peremptions?.very_close?.count ?? 0}
          valueLabel="Valeur achat"
          value={peremptions?.very_close?.purchase_value ?? 0}
          tone="orange"
          products={(peremptions?.very_close?.products ?? []).slice(0, 5).map((p) => ({
            name: p.product,
            detail: `${p.expiry_date} · ${p.quantity} unités`,
          }))}
        />
        <AlertCard
          label="Proche (<90j)"
          count={peremptions?.close?.count ?? 0}
          valueLabel="Valeur achat"
          value={peremptions?.close?.purchase_value ?? 0}
          tone="amber"
          products={(peremptions?.close?.products ?? []).slice(0, 5).map((p) => ({
            name: p.product,
            detail: `${p.expiry_date} · ${p.quantity} unités`,
          }))}
        />
      </AlertSection>

      {/* ── Stock alerts ── */}
      <AlertSection
        icon={<PackageX className="h-5 w-5 text-amber-500" />}
        title="Alertes de stock"
        description="Produits en sous-stock ou sur-stock"
        loading={stockAbcdLoading}
      >
        <AlertCard
          label="Sous-stock"
          count={stockBuckets.sousStock.length}
          valueLabel="PPV potentiel"
          value={stockBuckets.sousStock.reduce((s, p) => s + (p.ppv ?? 0) * Math.max(0, p.stock_min - (p.current_stock ?? 0)), 0)}
          tone="amber"
          products={stockBuckets.sousStock.slice(0, 5).map((p) => ({
            name: p.product,
            detail: `${p.current_stock ?? 0}/${p.stock_min} unités`,
          }))}
        />
        <AlertCard
          label="Sur-stock"
          count={stockBuckets.surStock.length}
          valueLabel="PPV immobilisé"
          value={stockBuckets.surStock.reduce((s, p) => s + (p.ppv ?? 0) * Math.max(0, (p.current_stock ?? 0) - p.stock_max), 0)}
          tone="blue"
          products={stockBuckets.surStock.slice(0, 5).map((p) => ({
            name: p.product,
            detail: `${p.current_stock ?? 0}/${p.stock_max} unités`,
          }))}
        />
      </AlertSection>

      {!loading && totalAlerts === 0 && (
        <Card className="border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-emerald-500 mb-2" />
            <p className="text-base font-semibold text-emerald-700 dark:text-emerald-300">Aucune alerte</p>
            <p className="text-sm text-muted-foreground mt-1">Tout va bien pour cette période.</p>
          </CardContent>
        </Card>
      )}
    </ListView>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function AlertSection({
  icon,
  title,
  description,
  loading,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-start gap-2 mb-3">
        {icon}
        <div>
          <h2 className="text-lg font-semibold text-foreground leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
      )}
    </section>
  );
}

const TONE_STYLES = {
  red:    { card: "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800",           title: "text-red-700 dark:text-red-300",       count: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",       value: "text-red-700 dark:text-red-300" },
  orange: { card: "border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800", title: "text-orange-700 dark:text-orange-300", count: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300", value: "text-orange-700 dark:text-orange-300" },
  amber:  { card: "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800",   title: "text-amber-700 dark:text-amber-300",   count: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",   value: "text-amber-700 dark:text-amber-300" },
  blue:   { card: "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800",       title: "text-blue-700 dark:text-blue-300",     count: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",     value: "text-blue-700 dark:text-blue-300" },
} as const;

function AlertCard({
  label,
  count,
  valueLabel,
  value,
  tone,
  products,
}: {
  label: string;
  count: number;
  valueLabel: string;
  value: number;
  tone: keyof typeof TONE_STYLES;
  products: { name: string; detail: string }[];
}) {
  const styles = TONE_STYLES[tone];
  return (
    <Card className={cn("border", styles.card)}>
      <CardHeader className="pb-2">
        <CardTitle className={cn("text-sm font-semibold", styles.title)}>{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge className={cn("h-6 px-2 text-xs font-bold border-0", styles.count)}>
            {count} produit{count !== 1 ? "s" : ""}
          </Badge>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{valueLabel}</p>
            <p className={cn("text-sm font-bold tabular-nums", styles.value)}>{fmt(Math.abs(value))} MAD</p>
          </div>
        </div>
        {products.length > 0 && (
          <div className="pt-2 border-t border-border/50 space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Top produits</p>
            {products.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-foreground">{p.name}</span>
                <span className={cn("shrink-0 tabular-nums font-medium", styles.value)}>{p.detail}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
