// src/pages/alertes/_components/MarginAlertsSection.tsx
import { TrendingDown } from "lucide-react";

import { KpiTile, type IconTone } from "@/components/shared/KpiTile";
import { formatMAD, formatQty } from "@/utils/format";
import { MARGIN_COLUMNS } from "./AlertDetailDialog";
import type { MarginAlertsResponse } from "@/types";
import type { DialogDescriptor } from "../_hooks/useAlertesPage";

export interface MarginAlertsSectionProps {
  data?: MarginAlertsResponse;
  onOpen: (d: DialogDescriptor) => void;
}

export function MarginAlertsSection({ data, onOpen }: MarginAlertsSectionProps) {
  // NB: backend also returns `high` + `very_high` — intentionally NOT shown here
  // (they live on the Rapport "Alertes marges" tiles).
  const cards: {
    tone:        IconTone;
    title:       string;
    bracket?:    MarginAlertsResponse["negative"];
    dlgSubtitle: string;
  }[] = [
    { tone: "error",   title: "Marge négative",     bracket: data?.negative, dlgSubtitle: "Marge inférieure à 0 %" },
    { tone: "warning", title: "Marge faible (<10%)", bracket: data?.low,      dlgSubtitle: "Marge comprise entre 0 % et 10 %" },
  ];

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2.5">
        <TrendingDown className="size-5 text-error" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Alertes de marge</h2>
          <p className="text-sm text-muted-foreground">Produits vendus avec une marge problématique.</p>
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
              sub="CA concerné"
              icon={<TrendingDown className="size-5" />}
              iconTone={c.tone}
              badge={{ label: <>{formatQty(count)} produits</>, tone: c.tone }}
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
