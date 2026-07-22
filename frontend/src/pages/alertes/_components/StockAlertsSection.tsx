// src/pages/alertes/_components/StockAlertsSection.tsx
import type { ReactNode } from "react";
import { PackageX, AlertTriangle, TrendingDown, PackageOpen } from "lucide-react";

import { KpiTile, type IconTone } from "@/components/shared/KpiTile";
import { formatMAD, formatQty } from "@/utils/format";
import { STOCK_COLUMNS } from "./AlertDetailDialog";
import type { StockRow } from "@/types";
import type { DialogDescriptor } from "../_hooks/useAlertesPage";
import { useT } from "@/i18n/I18nProvider";

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
  const t = useT();
  const cards: {
    tone:        IconTone;
    title:       string;
    rows:        StockRow[];
    metricLabel: string;
    metric:      ReactNode;
    Icon:        typeof PackageX;
    dlgSubtitle: string;
  }[] = [
    { tone: "error",   title: t("alertes.stockNegatif"), rows: negatif,   metricLabel: t("alertes.unitesNegatif"), metric: formatQty(negUnits), Icon: AlertTriangle, dlgSubtitle: t("alertes.stockNegatifSub") },
    { tone: "warning", title: t("alertes.sousStock"),    rows: sousStock, metricLabel: t("kpi.ppvPotentiel"),     metric: formatMAD(sousPpv),  Icon: TrendingDown,  dlgSubtitle: t("alertes.sousStockSub") },
    { tone: "info",    title: t("alertes.surStock"),     rows: surStock,  metricLabel: t("alertes.ppvImmobilise"),    metric: formatMAD(surPpv),   Icon: PackageOpen,   dlgSubtitle: t("alertes.surStockSub") },
  ];

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2.5">
        <PackageX className="size-5 text-warning" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("alertes.stockSection")}</h2>
          <p className="text-sm text-muted-foreground">{t("alertes.stockSectionSub")}</p>
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
              badge={{ label: <>{formatQty(count)} {t("common.wProduits")}</>, tone: c.tone }}
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
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{c.metricLabel}</span>
                <span className="font-mono text-xl font-bold tabular-nums text-foreground">{c.metric}</span>
              </div>
            </KpiTile>
          );
        })}
      </div>
    </section>
  );
}
