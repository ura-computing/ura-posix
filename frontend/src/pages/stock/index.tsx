import { useState, useMemo } from "react";
import {
  Package,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { ListView } from "@/components/shared/listView";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/utils/cn";
import { useStockAbcd } from "@/hooks/usePharmacyRapports";
import type { StockAbcdProduct } from "@/api/stats";

/* ── ABCD colour map ───────────────────────────────────────────────────────── */

const CLASS_COLORS: Record<string, string> = {
  A: "#16a34a",
  "A-": "#22c55e",
  "B+": "#3b82f6",
  B: "#60a5fa",
  C: "#f97316",
  "C-": "#fb923c",
  "C-N": "#fbbf24",
  D: "#ef4444",
};

const CLASS_ORDER = ["A", "A-", "B+", "B", "C", "C-", "C-N", "D"];

const CLASS_LABELS: Record<string, string> = {
  A: "A (300+)",
  "A-": "A- (250-299)",
  "B+": "B+ (200-249)",
  B: "B (48-199)",
  C: "C (6-47)",
  "C-": "C- (1-5)",
  "C-N": "C-N (nouveaux)",
  D: "D (0 ventes)",
};

/* ── Stock status helpers ──────────────────────────────────────────────────── */

type StockStatus = "ok" | "sous-stock" | "sur-stock" | "inconnu";

function getStockStatus(p: StockAbcdProduct): StockStatus {
  if (p.current_stock == null) return "inconnu";
  if (p.current_stock < p.stock_min) return "sous-stock";
  if (p.current_stock > p.stock_max) return "sur-stock";
  return "ok";
}

const STATUS_CONFIG: Record<StockStatus, { label: string; className: string }> = {
  ok: {
    label: "OK",
    className:
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  },
  "sous-stock": {
    label: "Sous-stock",
    className:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
  "sur-stock": {
    label: "Sur-stock",
    className:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  },
  inconnu: {
    label: "Inconnu",
    className:
      "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700",
  },
};

function StockStatusBadge({ status }: { status: StockStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}

/* ── Category badge ────────────────────────────────────────────────────────── */

function CategoryBadge({ cat }: { cat: string }) {
  const bg = CLASS_COLORS[cat] ?? "#6b7280";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold text-white"
      style={{ backgroundColor: bg }}
    >
      {cat}
    </span>
  );
}

/* ── Sort types ────────────────────────────────────────────────────────────── */

type SortKey =
  | "product"
  | "category"
  | "units_sold_12m"
  | "stock_min"
  | "stock_max"
  | "current_stock"
  | "status";

type SortDir = "asc" | "desc";

/* ── Chart config for recharts ─────────────────────────────────────────────── */

const chartConfig = {
  count: { label: "Produits", color: "#3b82f6" },
};

/* ── Main page component ───────────────────────────────────────────────────── */

const StockList = () => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("units_sold_12m");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [classFilter, setClassFilter] = useState<string | null>(null);

  const { stockAbcd, stockAbcdLoading } = useStockAbcd(
    dateFrom || undefined,
    dateTo || undefined,
  );

  /* ── Derived data ── */

  const chartData = useMemo(() => {
    if (!stockAbcd?.distribution) return [];
    return CLASS_ORDER.filter((c) => (stockAbcd.distribution[c] ?? 0) > 0).map(
      (c) => ({
        name: c,
        count: stockAbcd.distribution[c] ?? 0,
        fill: CLASS_COLORS[c],
      }),
    );
  }, [stockAbcd]);

  const products = useMemo(() => {
    if (!stockAbcd?.products) return [];
    let list = stockAbcd.products;

    // Class filter
    if (classFilter) {
      list = list.filter((p) => p.category === classFilter);
    }

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.product.toLowerCase().includes(q));
    }

    // Sort
    const sorted = [...list].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "product") {
        return dir * a.product.localeCompare(b.product);
      }
      if (sortKey === "category") {
        return dir * (CLASS_ORDER.indexOf(a.category) - CLASS_ORDER.indexOf(b.category));
      }
      if (sortKey === "status") {
        const statusOrder = ["sous-stock", "sur-stock", "inconnu", "ok"];
        return (
          dir *
          (statusOrder.indexOf(getStockStatus(a)) -
            statusOrder.indexOf(getStockStatus(b)))
        );
      }
      const aVal = a[sortKey as keyof StockAbcdProduct] ?? 0;
      const bVal = b[sortKey as keyof StockAbcdProduct] ?? 0;
      return dir * (Number(aVal) - Number(bVal));
    });
    return sorted;
  }, [stockAbcd, search, sortKey, sortDir, classFilter]);

  /* ── Summary KPIs ── */

  const summary = useMemo(() => {
    if (!stockAbcd?.products || stockAbcd.products.length === 0)
      return { total: 0, ok: 0, under: 0, over: 0 };
    const withStock = stockAbcd.products.filter((p) => p.current_stock != null);
    const total = withStock.length;
    const ok = withStock.filter((p) => getStockStatus(p) === "ok").length;
    const under = withStock.filter((p) => getStockStatus(p) === "sous-stock").length;
    const over = withStock.filter((p) => getStockStatus(p) === "sur-stock").length;
    return { total, ok, under, over };
  }, [stockAbcd]);

  const pct = (n: number) =>
    summary.total > 0 ? `${((n / summary.total) * 100).toFixed(1)}%` : "---";

  /* ── Sort handler ── */

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  }

  /* ── Render ── */

  if (stockAbcdLoading) {
    return (
      <ListView>
        <Breadcrumb />
        <h1 className="page-title">Alertes Stock</h1>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </ListView>
    );
  }

  if (!stockAbcd || stockAbcd.total_references === 0) {
    return (
      <ListView>
        <Breadcrumb />
        <h1 className="page-title">Alertes Stock</h1>
        <div className="flex flex-1 items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-6 text-center max-w-sm pointer-events-none select-none">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-teal-500/10 border-2 border-teal-500/20">
              <Package className="h-12 w-12 text-teal-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">
                Aucune donnee de stock
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Importez des achats et des ventes pour generer l'analyse ABCD de
                vos stocks.
              </p>
            </div>
          </div>
        </div>
      </ListView>
    );
  }

  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Alertes Stock</h1>
      <p className="text-sm text-muted-foreground -mt-2">
        Analyse ABCD de vos produits sur les 12 derniers mois. Identifiez les
        niveaux de stock optimaux.
      </p>

      {/* ── Date filter bar ── */}
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
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Reinitialiser
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Summary KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase">
                  Total references
                </p>
                <p className="text-lg font-bold">
                  {stockAbcd.total_references}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase">
                  Bien gere
                </p>
                <p className="text-lg font-bold">
                  {pct(summary.ok)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({summary.ok})
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase">
                  Sous-stock
                </p>
                <p className="text-lg font-bold">
                  {pct(summary.under)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({summary.under})
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-red-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase">
                  Sur-stock
                </p>
                <p className="text-lg font-bold">
                  {pct(summary.over)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({summary.over})
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── ABCD Distribution chart ── */}
      <Card className="border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Distribution ABCD
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Nombre de produits par classe de rotation
          </p>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={40}
                  tick={{ fontSize: 12, fontWeight: 600 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, _name, item) => (
                        <span>
                          {CLASS_LABELS[item.payload.name] ?? item.payload.name}:{" "}
                          <strong>{value}</strong> produits
                        </span>
                      )}
                    />
                  }
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>

          {/* ── Class filter chips ── */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant={classFilter === null ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setClassFilter(null)}
            >
              Tous ({stockAbcd.total_references})
            </Button>
            {CLASS_ORDER.filter(
              (c) => (stockAbcd.distribution[c] ?? 0) > 0,
            ).map((c) => (
              <Button
                key={c}
                variant={classFilter === c ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                style={
                  classFilter === c
                    ? { backgroundColor: CLASS_COLORS[c], borderColor: CLASS_COLORS[c], color: "#fff" }
                    : {}
                }
                onClick={() => setClassFilter(classFilter === c ? null : c)}
              >
                {c} ({stockAbcd.distribution[c] ?? 0})
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Search bar ── */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* ── Products table ── */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center border-2 border-dashed rounded-lg">
          <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="text-base font-semibold">Aucun produit trouve</p>
            <p className="text-sm text-muted-foreground mt-1">
              Modifiez les filtres pour afficher des resultats.
            </p>
          </div>
        </div>
      ) : (
        <Card className="border border-border overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("product")}
                  >
                    <span className="inline-flex items-center">
                      Produit
                      <SortIcon col="product" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-center"
                    onClick={() => handleSort("category")}
                  >
                    <span className="inline-flex items-center">
                      Classe
                      <SortIcon col="category" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("units_sold_12m")}
                  >
                    <span className="inline-flex items-center justify-end">
                      Ventes 12m
                      <SortIcon col="units_sold_12m" />
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Stock Min</TableHead>
                  <TableHead className="text-right">Stock Max</TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("current_stock")}
                  >
                    <span className="inline-flex items-center justify-end">
                      Stock actuel
                      <SortIcon col="current_stock" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-center"
                    onClick={() => handleSort("status")}
                  >
                    <span className="inline-flex items-center">
                      Statut
                      <SortIcon col="status" />
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p, idx) => {
                  const status = getStockStatus(p);
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium max-w-[260px] truncate">
                        {p.product}
                      </TableCell>
                      <TableCell className="text-center">
                        <CategoryBadge cat={p.category} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.units_sold_12m}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.stock_min}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.stock_max}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.current_stock != null ? p.current_stock : "---"}
                      </TableCell>
                      <TableCell className="text-center">
                        <StockStatusBadge status={status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="px-4 py-2 text-xs text-muted-foreground border-t">
              {products.length} produit{products.length > 1 ? "s" : ""}
              {classFilter && (
                <span>
                  {" "}
                  - Filtre:{" "}
                  <strong>{CLASS_LABELS[classFilter] ?? classFilter}</strong>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </ListView>
  );
};

export default StockList;
