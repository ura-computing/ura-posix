// src/pages/stock/_components/PeremptionsSection.tsx
import { CalendarX } from "lucide-react";

import { KpiTile, type IconTone } from "@/components/shared/KpiTile";
import { formatMAD, formatQty } from "@/utils/format";
import { ROUTES } from "@/types";
import type { PeremptionsResponse, PeremptionBracket } from "@/types";

export interface PeremptionsSectionProps {
  data: PeremptionsResponse;
  // NB: data.no_date is intentionally ignored on this page (lives on /alertes).
}

function PeremptionCard({
  title,
  sub,
  tone,
  bracket,
}: {
  title: string;
  sub: string;
  tone: IconTone;
  bracket: PeremptionBracket;
}) {
  return (
    <KpiTile
      label={title}
      sub={sub}
      subTone={tone}
      icon={<CalendarX className="size-5" />}
      iconTone={tone}
      badge={{ label: formatQty(bracket.count), tone }}
      footerLink={{ label: "voir les produits", href: ROUTES.ALERTES }}
    >
      <div className="flex items-center gap-5 pt-0.5">
        <div className="flex flex-col gap-px">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Unités</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {formatQty(bracket.total_units)}
          </span>
        </div>
        <div className="flex flex-col gap-px">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Valeur vente</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {formatMAD(bracket.sale_value)}
          </span>
        </div>
      </div>
    </KpiTile>
  );
}

export function PeremptionsSection({ data }: PeremptionsSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Surveillance Péremptions
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PeremptionCard title="Périmés en stock"      sub="Action urgente" tone="error"   bracket={data.expired}    />
        <PeremptionCard title="Très proches périmés"  sub="< 6 mois"       tone="warning" bracket={data.very_close} />
        <PeremptionCard title="Proches périmés"       sub="6-12 mois"      tone="warning" bracket={data.close}      />
      </div>
    </section>
  );
}
