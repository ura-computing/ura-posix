// src/pages/alertes/_components/StockAlertsSection.tsx
import type { ReactNode } from "react";
import { PackageX, AlertTriangle, TrendingDown, PackageOpen } from "lucide-react";

import { KpiTile, type IconTone } from "@/components/shared/KpiTile";
import { formatMAD, formatQty } from "@/utils/format";
import { STOCK_COLUMNS } from "./AlertDetailDialog";
import type { StockRow } from "@/types";
import type { DialogDescriptor } from "../_hooks/useAlertesPage";

export interface StockAlertsSectionProps {
  negatif:   StockRow[];
  sousStock: StockRow[];
  surStock:  StockRow[];
  negUnits:  number;
  sousPpv:   number;
  surPpv:    number;
  onOpen:    (d: DialogDescriptor) => void;
}

export function StockAlertsSection({
  negatif, sousStock, surStock, negUnits, sousPpv, surPpv, onOpen,
}: StockAlertsSectionProps) {
  const cards: {
    tone:        IconTone;
    title:       string;
    rows:        StockRow[];
    metricLabel: string;
    metric:      ReactNode;
    Icon:        typeof PackageX;
    dlgSubtitle: string;
  }[] = [
    { tone: "error",   title: "Stock négatif", rows: negatif,   metricLabel: "Unités en négatif", metric: formatQty(negUnits), Icon: AlertTriangle, dlgSubtitle: "Stock théorique négatif" },
    { tone: "warning", title: "Sous-stock",    rows: sousStock, metricLabel: "PPV potentiel",     metric: formatMAD(sousPpv),  Icon: TrendingDown,  dlgSubtitle: "Stock sous le minimum défini" },
    { tone: "info",    title: "Sur-stock",     rows: surStock,  metricLabel: "PPV immobilisé",    metric: formatMAD(surPpv),   Icon: PackageOpen,   dlgSubtitle: "Stock au-dessus du maximum défini" },
  ];

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2.5">
        <PackageX className="size-5 text-warning" />
        <div>
          <h2 className="text-base font-semibold text-foreground">Alertes de stock</h2>
          <p className="text-[13px] text-muted-foreground">Produits en sous-stock, sur-stock ou stock négatif.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((c) => {
          const count = c.rows.length;
          return (
            <KpiTile
              key={c.title}
              label={c.title}
              icon={<c.Icon className="size-5" />}
              iconTone={c.tone}
              badge={{ label: <>{formatQty(count)} produits</>, tone: c.tone }}
              disabled={count === 0}
              onClick={() =>
                onOpen({
                  title:          c.title,
                  subtitle:       c.dlgSubtitle,
                  products:       c.rows,
                  columns:        STOCK_COLUMNS,
                  defaultSortKey: "current_stock",
                })
              }
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.metricLabel}</span>
                <span className="font-mono text-lg font-bold tabular-nums text-foreground">{c.metric}</span>
              </div>
            </KpiTile>
          );
        })}
      </div>
    </section>
  );
}
