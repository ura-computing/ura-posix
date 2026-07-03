// src/pages/stock/_components/AlertCardsGrid.tsx
import { AlertTriangle, TrendingDown, PackageOpen } from "lucide-react";
import type { ReactNode } from "react";

import { KpiTile, type IconTone } from "@/components/shared/KpiTile";
import { formatMAD, formatQty } from "@/utils/format";
import { ROUTES } from "@/types";
import type { StockRow } from "@/types";

export interface AlertCardsGridProps {
  /** FULL products[] — alert cards always aggregate over the whole dataset. */
  products: StockRow[];
}

const absStock = (n: number | null) => (n == null ? 0 : Math.abs(n));

function aggregate(rows: StockRow[]) {
  return {
    refs: rows.length,
    units: rows.reduce((s, r) => s + absStock(r.current_stock), 0),
    purchase: rows.reduce(
      (s, r) => (r.avg_pu != null && r.current_stock != null ? s + r.avg_pu * Math.abs(r.current_stock) : s),
      0,
    ),
    ppv: rows.reduce(
      (s, r) => (r.ppv != null && r.current_stock != null ? s + r.ppv * Math.abs(r.current_stock) : s),
      0,
    ),
  };
}

function AlertCard({
  title,
  tone,
  Icon,
  rows,
}: {
  title: string;
  tone: IconTone;
  Icon: typeof AlertTriangle;
  rows: StockRow[];
}) {
  const a = aggregate(rows);
  const metrics: { label: string; value: ReactNode }[] = [
    { label: "Références", value: formatQty(a.refs) },
    { label: "Unités totales", value: formatQty(a.units) },
    { label: "Valeur achats", value: formatMAD(a.purchase) },
    { label: "PPV potentiel", value: formatMAD(a.ppv) },
  ];
  return (
    <KpiTile
      label={title}
      icon={<Icon className="size-5" />}
      iconTone={tone}
      footerLink={{ label: "voir les alertes", href: ROUTES.ALERTES }}
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {m.label}
            </span>
            <span className="font-mono text-base font-bold tabular-nums text-foreground">{m.value}</span>
          </div>
        ))}
      </div>
    </KpiTile>
  );
}

export function AlertCardsGrid({ products }: AlertCardsGridProps) {
  const negatif = products.filter((p) => p.status === "negatif");
  const sousTop = products.filter(
    (p) => (p.category === "A" || p.category === "A-") && p.status === "sous-stock",
  );
  const surstock = products.filter((p) => p.status === "sur-stock");

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <AlertCard title="Stock négatif" tone="error" Icon={AlertTriangle} rows={negatif} />
      <AlertCard title="Sous-stock top références" tone="warning" Icon={TrendingDown} rows={sousTop} />
      <AlertCard title="Sur-stock > 100 jours" tone="info" Icon={PackageOpen} rows={surstock} />
    </div>
  );
}
