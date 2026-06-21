// src/pages/alertes/_components/PeremptionsSection.tsx
import type { ReactNode } from "react";
import { CalendarX } from "lucide-react";

import { KpiTile, type IconTone } from "@/components/shared/KpiTile";
import { formatMAD, formatQty } from "@/utils/format";
import { PEREMPTION_COLUMNS } from "./AlertDetailDialog";
import type { PeremptionsResponse, PeremptionBracket } from "@/types";
import type { DialogDescriptor } from "../_hooks/useAlertesPage";

export interface PeremptionsSectionProps {
  data?: PeremptionsResponse;
  onOpen: (d: DialogDescriptor) => void;
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-px">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export function PeremptionsSection({ data, onOpen }: PeremptionsSectionProps) {
  // `no_date` (PG-008) is surfaced here (NOT on /stock); slate tone = data-quality, not urgency.
  const cards: {
    key:         keyof PeremptionsResponse;
    tone:        IconTone;
    title:       string;
    sub:         string;
    dlgTitle:    string;
    dlgSubtitle: string;
  }[] = [
    { key: "expired",    tone: "error",   title: "Périmés",              sub: "Action urgente", dlgTitle: "Produits expirés",                       dlgSubtitle: "Date de péremption dépassée" },
    { key: "very_close", tone: "warning", title: "Très proches périmés", sub: "< 6 mois",       dlgTitle: "Péremption très proche (<6 mois)",       dlgSubtitle: "Expiration dans moins de 6 mois" },
    { key: "close",      tone: "warning", title: "Proches périmés",      sub: "6-12 mois",      dlgTitle: "Péremption proche (6-12 mois)",          dlgSubtitle: "Expiration dans 6 à 12 mois" },
    { key: "no_date",    tone: "slate",   title: "Sans date",            sub: "À renseigner",   dlgTitle: "Produits sans date de péremption",       dlgSubtitle: "Date de péremption non renseignée" },
  ];

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2.5">
        <CalendarX className="size-5 text-error" />
        <div>
          <h2 className="text-base font-semibold text-foreground">Alertes de péremption</h2>
          <p className="text-[13px] text-muted-foreground">Produits expirés ou proches de l'expiration.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const b: PeremptionBracket | undefined = data?.[c.key];
          const count = b?.count ?? 0;
          return (
            <KpiTile
              key={c.key}
              label={c.title}
              sub={c.sub}
              subTone={c.tone}
              icon={<CalendarX className="size-5" />}
              iconTone={c.tone}
              badge={{ label: formatQty(count), tone: c.tone }}
              disabled={count === 0}
              onClick={
                b
                  ? () =>
                      onOpen({
                        title:          c.dlgTitle,
                        subtitle:       c.dlgSubtitle,
                        products:       b.products,
                        columns:        PEREMPTION_COLUMNS,
                        defaultSortKey: "expiry_date",
                      })
                  : undefined
              }
            >
              <div className="flex items-center gap-5 pt-0.5">
                <MiniStat label="Unités"       value={formatQty(b?.total_units ?? 0)} />
                <MiniStat label="Valeur achat" value={formatMAD(b?.purchase_value ?? 0)} />
              </div>
            </KpiTile>
          );
        })}
      </div>
    </section>
  );
}
