// src/pages/alertes/_components/MarginAlertsSection.tsx
import { TrendingDown } from "lucide-react";

import { KpiTile, type IconTone } from "@/components/shared/KpiTile";
import { formatMAD, formatQty } from "@/utils/format";
import { MARGIN_COLUMNS } from "./AlertDetailDialog";
import type { MarginAlertsResponse } from "@/types";
import type { DialogDescriptor } from "../_hooks/useAlertesPage";
import { useT } from "@/i18n/I18nProvider";

export interface MarginAlertsSectionProps {
  data?: MarginAlertsResponse;
  onOpen: (d: DialogDescriptor) => void;
}

export function MarginAlertsSection({ data, onOpen }: MarginAlertsSectionProps) {
  const t = useT();
  // NB: backend also returns `high` + `very_high` — intentionally NOT shown here
  // (they live on the Rapport margin tiles).
  const cards: {
    tone:        IconTone;
    title:       string;
    bracket?:    MarginAlertsResponse["negative"];
    dlgSubtitle: string;
  }[] = [
    { tone: "error",   title: t("ventes.margeNegative"),     bracket: data?.negative, dlgSubtitle: t("alertes.margeNegativeSub") },
    { tone: "warning", title: t("alertes.margeFaible"), bracket: data?.low,      dlgSubtitle: t("alertes.margeFaibleSub") },
  ];

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2.5">
        <TrendingDown className="size-5 text-error" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("alertes.margeSection")}</h2>
          <p className="text-sm text-muted-foreground">{t("alertes.margeSectionSub")}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const count = c.bracket?.count ?? 0;
          return (
            <KpiTile
              key={c.title}
              label={c.title}
              value={formatMAD(c.bracket?.total_ca ?? 0)}
              sub={t("alertes.caConcerne")}
              icon={<TrendingDown className="size-5" />}
              iconTone={c.tone}
              badge={{ label: <>{formatQty(count)} {t("stock.produitsWord")}</>, tone: c.tone }}
              disabled={count === 0}
              onClick={
                c.bracket
                  ? () =>
                      onOpen({
                        title:          c.title,
                        subtitle:       c.dlgSubtitle,
                        products:       c.bracket!.products,
                        columns:        MARGIN_COLUMNS,
                        defaultSortKey: "marge_pct",
                      })
                  : undefined
              }
            />
          );
        })}
      </div>
    </section>
  );
}
