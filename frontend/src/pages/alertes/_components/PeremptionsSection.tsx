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
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-base font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export function PeremptionsSection({ data, onOpen }: PeremptionsSectionProps) {
  // 4 mutually-exclusive cards. The first three are date-bucketed by
  // urgency; the fourth (`no_date`) is a data-quality bucket — products
  // whose Sobrus export had no expiry date.
  const cards: {
    key:         keyof PeremptionsResponse;
    tone:        IconTone;
    title:       string;
    sub:         string;
    dlgTitle:    string;
    dlgSubtitle: string;
  }[] = [
    { key: "expired", tone: "error",   title: "Périmés",      sub: "Action urgente", dlgTitle: "Produits expirés",        dlgSubtitle: "Date de péremption dépassée" },
    { key: "near_2w", tone: "warning", title: "≤ 2 semaines", sub: "Très urgent",    dlgTitle: "Péremption ≤ 2 semaines", dlgSubtitle: "Expiration dans les 14 prochains jours" },
    { key: "near_1m", tone: "warning", title: "≤ 1 mois",     sub: "À surveiller",   dlgTitle: "Péremption ≤ 1 mois",     dlgSubtitle: "Expiration entre 15 et 30 jours" },
    { key: "no_date", tone: "muted",   title: "Sans date",    sub: "À renseigner",   dlgTitle: "Produits sans date de péremption", dlgSubtitle: "Date de péremption non renseignée dans l'export Sobrus" },
  ];

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2.5">
        <CalendarX className="size-5 text-error" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Alertes de péremption</h2>
          <p className="text-sm text-muted-foreground">Produits expirés ou proches de l'expiration.</p>
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
