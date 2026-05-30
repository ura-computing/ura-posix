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
import { currentMonth } from "@/utils/dateRange";
import { eCategoryType } from "@/types";
import {
  useMarginAlerts,
  usePeremptions,
  useStockAbcd,
} from "@/hooks/usePharmacyRapports";
import type { MarginAlertBracket, PeremptionProduct, StockAbcdProduct } from "@/api/stats";
import { AlertDetailDialog, type AlertColumn } from "./alertDetailDialog";

type AlertKey =
  | "marge-negative"
  | "marge-low"
  | "peremption-expired"
  | "peremption-very-close"
  | "peremption-close"
  | "peremption-no-date"
  | "stock-sous"
  | "stock-sur";

function getStockStatus(p: StockAbcdProduct): "ok" | "sous-stock" | "sur-stock" | "inconnu" {
  if (p.current_stock == null) return "inconnu";
  if (p.current_stock < p.stock_min) return "sous-stock";
  if (p.current_stock > p.stock_max) return "sur-stock";
  return "ok";
}

export default function AlertesPage() {
  const _initial = currentMonth();
  const [dateFrom, setDateFrom] = useState(_initial.from);
  const [dateTo, setDateTo] = useState(_initial.to);
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
  const [openAlert, setOpenAlert] = useState<AlertKey | null>(null);
  const closeAlert = () => setOpenAlert(null);

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
              <span className="text-[9px] opacity-50 font-mono">Σ tous types</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Marge négative</span>
              <span className="text-sm font-bold tabular-nums text-red-600">
                {loading ? "…" : marginAlerts?.negative?.count ?? 0}
              </span>
              <span className="text-[9px] opacity-50 font-mono">marge &lt; 0</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Marge faible</span>
              <span className="text-sm font-bold tabular-nums text-amber-600">
                {loading ? "…" : marginAlerts?.low?.count ?? 0}
              </span>
              <span className="text-[9px] opacity-50 font-mono">0 ≤ marge &lt; 10%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Produits expirés</span>
              <span className="text-sm font-bold tabular-nums text-red-600">
                {loading ? "…" : peremptions?.expired?.count ?? 0}
              </span>
              <span className="text-[9px] opacity-50 font-mono">expiré &lt; aujourd'hui</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Sous-stock</span>
              <span className="text-sm font-bold tabular-nums text-amber-600">
                {loading ? "…" : stockBuckets.sousStock.length}
              </span>
              <span className="text-[9px] opacity-50 font-mono">stock &lt; min</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Sur-stock</span>
              <span className="text-sm font-bold tabular-nums text-blue-600">
                {loading ? "…" : stockBuckets.surStock.length}
              </span>
              <span className="text-[9px] opacity-50 font-mono">stock &gt; max</span>
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
          onClick={() => setOpenAlert("marge-negative")}
        />
        <AlertCard
          label="Marge faible (<10%)"
          count={marginAlerts?.low?.count ?? 0}
          valueLabel="CA concerné"
          value={marginAlerts?.low?.total_ca ?? 0}
          tone="amber"
          onClick={() => setOpenAlert("marge-low")}
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
          onClick={() => setOpenAlert("peremption-expired")}
        />
        <AlertCard
          label="Très proche (<30j)"
          count={peremptions?.very_close?.count ?? 0}
          valueLabel="Valeur achat"
          value={peremptions?.very_close?.purchase_value ?? 0}
          tone="orange"
          onClick={() => setOpenAlert("peremption-very-close")}
        />
        <AlertCard
          label="Proche (<90j)"
          count={peremptions?.close?.count ?? 0}
          valueLabel="Valeur achat"
          value={peremptions?.close?.purchase_value ?? 0}
          tone="amber"
          onClick={() => setOpenAlert("peremption-close")}
        />
        <AlertCard
          label="Sans date"
          count={peremptions?.no_date?.count ?? 0}
          valueLabel="Valeur achat"
          value={peremptions?.no_date?.purchase_value ?? 0}
          tone="slate"
          onClick={() => setOpenAlert("peremption-no-date")}
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
          onClick={() => setOpenAlert("stock-sous")}
        />
        <AlertCard
          label="Sur-stock"
          count={stockBuckets.surStock.length}
          valueLabel="PPV immobilisé"
          value={stockBuckets.surStock.reduce((s, p) => s + (p.ppv ?? 0) * Math.max(0, (p.current_stock ?? 0) - p.stock_max), 0)}
          tone="blue"
          onClick={() => setOpenAlert("stock-sur")}
        />
      </AlertSection>

      {/* ── Detail dialogs ── */}
      <AlertDetailDialog
        open={openAlert === "marge-negative"}
        onOpenChange={(o) => !o && closeAlert()}
        title="Marge négative"
        description="Produits vendus à perte sur la période sélectionnée."
        products={marginAlerts?.negative?.products ?? []}
        columns={MARGE_COLUMNS}
      />
      <AlertDetailDialog
        open={openAlert === "marge-low"}
        onOpenChange={(o) => !o && closeAlert()}
        title="Marge faible (<10%)"
        description="Produits avec une marge inférieure à 10%."
        products={marginAlerts?.low?.products ?? []}
        columns={MARGE_COLUMNS}
      />
      <AlertDetailDialog
        open={openAlert === "peremption-expired"}
        onOpenChange={(o) => !o && closeAlert()}
        title="Produits expirés"
        description="Produits dont la date de péremption est passée."
        products={peremptions?.expired?.products ?? []}
        columns={PEREMPTION_COLUMNS}
      />
      <AlertDetailDialog
        open={openAlert === "peremption-very-close"}
        onOpenChange={(o) => !o && closeAlert()}
        title="Péremption très proche (<30j)"
        description="Produits qui expirent dans moins de 30 jours."
        products={peremptions?.very_close?.products ?? []}
        columns={PEREMPTION_COLUMNS}
      />
      <AlertDetailDialog
        open={openAlert === "peremption-close"}
        onOpenChange={(o) => !o && closeAlert()}
        title="Péremption proche (<90j)"
        description="Produits qui expirent dans moins de 90 jours."
        products={peremptions?.close?.products ?? []}
        columns={PEREMPTION_COLUMNS}
      />
      <AlertDetailDialog
        open={openAlert === "peremption-no-date"}
        onOpenChange={(o) => !o && closeAlert()}
        title="Produits sans date de péremption"
        description="Produits en stock dont la date de péremption n'est pas renseignée."
        products={peremptions?.no_date?.products ?? []}
        columns={PEREMPTION_COLUMNS}
      />
      <AlertDetailDialog
        open={openAlert === "stock-sous"}
        onOpenChange={(o) => !o && closeAlert()}
        title="Sous-stock"
        description="Produits dont le stock actuel est inférieur au minimum recommandé."
        products={stockBuckets.sousStock}
        columns={STOCK_COLUMNS}
      />
      <AlertDetailDialog
        open={openAlert === "stock-sur"}
        onOpenChange={(o) => !o && closeAlert()}
        title="Sur-stock"
        description="Produits dont le stock actuel dépasse le maximum recommandé."
        products={stockBuckets.surStock}
        columns={STOCK_COLUMNS}
      />

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
  slate:  { card: "border-border bg-muted/30",                                                    title: "text-foreground",                       count: "bg-muted text-muted-foreground",                                       value: "text-muted-foreground" },
} as const;

function AlertCard({
  label,
  count,
  valueLabel,
  value,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  valueLabel: string;
  value: number;
  tone: keyof typeof TONE_STYLES;
  onClick: () => void;
}) {
  const styles = TONE_STYLES[tone];
  const disabled = count === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "text-left w-full rounded-lg",
        !disabled && "cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "opacity-60 cursor-not-allowed",
      )}
    >
      <Card className={cn("border", styles.card)}>
        <CardHeader className="pb-2">
          <CardTitle className={cn("text-base font-semibold", styles.title)}>{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <Badge className={cn("h-7 px-2.5 text-sm font-bold border-0", styles.count)}>
              {count} produit{count !== 1 ? "s" : ""}
            </Badge>
            <div className="text-right">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{valueLabel}</p>
              <p className={cn("text-base font-bold tabular-nums", styles.value)}>{fmt(Math.abs(value))} MAD</p>
            </div>
          </div>
          {!disabled && (
            <p className="text-[11px] mt-3 font-medium text-muted-foreground">
              Cliquer pour voir le détail →
            </p>
          )}
        </CardContent>
      </Card>
    </button>
  );
}

// ── Column definitions ──────────────────────────────────────────────────────

type MarginProduct = MarginAlertBracket["products"][number];

const MARGE_COLUMNS: AlertColumn<MarginProduct>[] = [
  { key: "product", header: "Produit", accessor: (r) => r.product },
  {
    key: "marge_pct",
    header: "Marge %",
    accessor: (r) => r.marge_pct,
    align: "right",
    format: (v) => `${(v as number).toFixed(1)}%`,
  },
  {
    key: "ca",
    header: "CA",
    accessor: (r) => r.ca,
    align: "right",
    format: (v) => `${fmt(v as number)} MAD`,
  },
];

const PEREMPTION_COLUMNS: AlertColumn<PeremptionProduct>[] = [
  { key: "product", header: "Produit", accessor: (r) => r.product },
  { key: "expiry_date", header: "Date d'expiration", accessor: (r) => r.expiry_date ?? "—" },
  {
    key: "quantity",
    header: "Quantité",
    accessor: (r) => r.quantity,
    align: "right",
  },
  {
    key: "ppv",
    header: "PPV",
    accessor: (r) => r.ppv,
    align: "right",
    format: (v) => `${fmt(v as number)} MAD`,
  },
];

const STOCK_COLUMNS: AlertColumn<StockAbcdProduct>[] = [
  { key: "product", header: "Produit", accessor: (r) => r.product },
  { key: "category", header: "Catégorie", accessor: (r) => r.category },
  {
    key: "current_stock",
    header: "Stock actuel",
    accessor: (r) => r.current_stock,
    align: "right",
  },
  {
    key: "stock_min",
    header: "Stock min",
    accessor: (r) => r.stock_min,
    align: "right",
  },
  {
    key: "stock_max",
    header: "Stock max",
    accessor: (r) => r.stock_max,
    align: "right",
  },
  {
    key: "ppv",
    header: "PPV",
    accessor: (r) => r.ppv,
    align: "right",
    format: (v) => (v == null ? "—" : `${fmt(v as number)} MAD`),
  },
];
