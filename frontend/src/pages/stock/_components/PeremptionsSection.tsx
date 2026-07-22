// src/pages/stock/_components/PeremptionsSection.tsx
import { CalendarX } from "lucide-react";

import { KpiTile, type IconTone } from "@/components/shared/KpiTile";
import { PEREMPTION_COLUMNS } from "@/pages/alertes/_components/AlertDetailDialog";
import type { DialogDescriptor } from "@/pages/alertes/_hooks/useAlertesPage";
import { formatMAD, formatQty } from "@/utils/format";
import type { PeremptionBracket, PeremptionsResponse } from "@/types";
import { useT } from "@/i18n/I18nProvider";


export interface PeremptionsSectionProps {
  data:   PeremptionsResponse;
  onOpen: (d: DialogDescriptor) => void;
}


function PeremptionCard({
  title, sub, tone, bracket, onClick,
}: {
  title: string;
  sub: string;
  tone: IconTone;
  bracket: PeremptionBracket;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <KpiTile
      label={title}
      sub={sub}
      subTone={tone}
      icon={<CalendarX className="size-5" />}
      iconTone={tone}
      badge={{ label: formatQty(bracket.count), tone }}
      disabled={bracket.count === 0}
      onClick={bracket.count === 0 ? undefined : onClick}
    >
      <div className="flex items-center gap-5 pt-0.5">
        <div className="flex flex-col gap-px">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("peremptions.unites")}</span>
          <span className="font-mono text-base font-semibold tabular-nums text-foreground">
            {formatQty(bracket.total_units)}
          </span>
        </div>
        <div className="flex flex-col gap-px">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("peremptions.valeurVente")}</span>
          <span className="font-mono text-base font-semibold tabular-nums text-foreground">
            {formatMAD(bracket.sale_value)}
          </span>
        </div>
      </div>
    </KpiTile>
  );
}


export function PeremptionsSection({
  data, onOpen }: PeremptionsSectionProps) {
  const t = useT();
  // Same 4-bucket scheme as /alertes — clicking opens the shared
  // AlertDetailDialog with the per-bucket product list (sortable + Excel
  // export). The fourth bucket (`no_date`) is data-quality: products
  // whose Sobrus export had no expiry date.
  const cards: {
    key:         keyof PeremptionsResponse;
    tone:        IconTone;
    title:       string;
    sub:         string;
    dlgTitle:    string;
    dlgSubtitle: string;
  }[] = [
    { key: "expired",    tone: "error",   title: t("peremptions.expiresStock"),   sub: t("peremptions.actionUrgente"), dlgTitle: t("peremptions.dlgExpires"),              dlgSubtitle: t("peremptions.dlgExpiresSub") },
    { key: "very_close", tone: "warning", title: t("peremptions.tresProche"), sub: t("peremptions.tresUrgent"),    dlgTitle: t("peremptions.dlgTresProche"), dlgSubtitle: t("peremptions.dlgTresProcheSub") },
    { key: "close",      tone: "warning", title: t("peremptions.proche"),      sub: t("peremptions.aSurveiller"),   dlgTitle: t("peremptions.dlgProche"),      dlgSubtitle: t("peremptions.dlgProcheSub") },
    { key: "no_date",    tone: "muted",   title: t("peremptions.sansDate"),          sub: t("peremptions.aRenseigner"),   dlgTitle: t("peremptions.dlgSansDate"), dlgSubtitle: t("peremptions.dlgSansDateSub") },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {t("peremptions.surveillance")}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const bracket = data[c.key];
          return (
            <PeremptionCard
              key={c.key}
              title={c.title}
              sub={c.sub}
              tone={c.tone}
              bracket={bracket}
              onClick={() => onOpen({
                title:          c.dlgTitle,
                subtitle:       c.dlgSubtitle,
                products:       bracket.products,
                columns:        PEREMPTION_COLUMNS,
                defaultSortKey: "expiry_date",
              })}
            />
          );
        })}
      </div>
    </section>
  );
}
